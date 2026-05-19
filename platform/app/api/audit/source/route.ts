import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import type { AuditScript, AuditEvent, Severity } from "@/lib/audit-script";
import type { ScreenNodeData } from "@/lib/fixtures";

// ─── Types ───────────────────────────────────────────────────────────────────

type NodeShape = {
  id: string;
  label: string;
  kind: ScreenNodeData["kind"];
  position: { x: number; y: number };
  hasScreenshot: boolean;
  url: string;
  deviceType: "mobile" | "desktop";
};

type SourceAuditResponse = {
  script: AuditScript;
  nodes: NodeShape[];
  edges: Array<{ source: string; target: string }>;
  screenshots: Record<string, string>;
};

type NavItem = {
  label: string;
  index: number;
  pressScript: string;
};

type CollectionSpec = {
  name: string;
  // Full osascript one-liner to count items (returns a number)
  countScript: (proc: string) => string;
  // Element path fragment for label resolution (passed to getLabel)
  elemPath: (proc: string, n: number) => string;
  // Full osascript one-liner to AXPress item N
  pressScript: (proc: string, n: number, label: string) => string;
};

type CrawlCtx = {
  proc: string;
  bundlePath: string;
  nodes: NodeShape[];
  edges: Array<{ source: string; target: string }>;
  screenshots: Record<string, string>;
  events: AuditEvent[];
  findings: Array<{ nodeId: string; severity: Severity; msg: string }>;
  seenHashes: Set<string>;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const APP_SEARCH_DIRS = [
  "/Applications",
  path.join(os.homedir(), "Applications"),
  "/Applications/Utilities",
  "/System/Applications",
  "/System/Applications/Utilities",
];

const SETTLE_MS   = 1600;
const LAUNCH_WAIT = 3500;
const MAX_ITEMS   = 12;
const MAX_DEPTH   = 3;
const COL_STEP    = 220;
const SUB_STEP    = 190;
const ROW_GAP     = 240;

// ─── Shell helpers ────────────────────────────────────────────────────────────

function runSafe(cmd: string, ms = 5000): string | null {
  try {
    return execSync(cmd, { timeout: ms, encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

// Write script to temp file — avoids all shell quoting issues
function runAS(script: string, ms = 6000): string | null {
  const tmp = path.join(os.tmpdir(), `uifa-${Date.now()}-${Math.random().toString(36).slice(2)}.applescript`);
  try {
    fs.writeFileSync(tmp, script);
    return execSync(`osascript "${tmp}"`, { timeout: ms, encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function fsExists(p: string): boolean {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function activate(appName: string): void {
  runSafe(`osascript -e 'tell application "${appName}" to activate'`, 3000);
}

// Raise the first window via AX — ensures it's frontmost on any display
function raiseWindow(proc: string): void {
  runSafe(
    `osascript -e 'tell application "System Events" to tell process "${proc}" to perform action "AXRaise" of window 1'`,
    3000
  );
}

// Returns window {x, y, w, h} from AX position/size attributes
function getWindowBounds(proc: string): { x: number; y: number; w: number; h: number } | null {
  const pos = runSafe(
    `osascript -e 'tell application "System Events" to tell process "${proc}" to get position of window 1'`,
    3000
  );
  const sz = runSafe(
    `osascript -e 'tell application "System Events" to tell process "${proc}" to get size of window 1'`,
    3000
  );
  if (!pos || !sz) return null;
  const p = pos.match(/-?\d+/g)?.map(Number);
  const s = sz.match(/\d+/g)?.map(Number);
  if (!p || p.length < 2 || !s || s.length < 2) return null;
  return { x: p[0], y: p[1], w: s[0], h: s[1] };
}

// ─── Label resolution ─────────────────────────────────────────────────────────
//
// Rules learned from NordVPN + general macOS apps:
//   • NEVER use "get <attr> of every <element>" — mass queries swap description/help
//   • ALWAYS use singular "get <attr> of element N" for correct values
//   • Try description > child-description > help > name > title in order
//   • Filter out state strings ("button is selected", "table row", etc.)

// AX role names and role-description strings that are NOT real labels
const AX_ROLE_STRINGS = new Set([
  "button", "check box", "cell", "row", "table row", "table cell", "table",
  "group", "split group", "splitter", "image", "text field", "static text",
  "scroll area", "web area", "list", "list item", "outline", "outline row",
  "menu item", "menu", "menu bar", "toolbar", "application", "window", "sheet",
  "drawer", "popover", "radio button", "pop up button", "popup button",
  "combo box", "disclosure triangle", "slider", "progress indicator",
  "color well", "date picker", "stepper", "browser", "value indicator",
  "selected", "not selected", "enabled", "disabled", "unknown", "missing value",
  "separator", "spacer", "divider",
]);

function isUsableLabel(s: string | null): boolean {
  if (!s || !s.trim()) return false;
  const t = s.trim();
  if (AX_ROLE_STRINGS.has(t.toLowerCase())) return false;
  if (/button is (not )?selected|^selected$|^not selected$/i.test(t)) return false;
  if (t.length < 2) return false;
  return true;
}

function getLabel(proc: string, elemPath: string, idx: number): string {
  // Ordered by reliability — singular queries only, never "every"
  const exprs = [
    `description of ${elemPath}`,
    `description of UI element 1 of ${elemPath}`,
    `help of ${elemPath}`,
    `name of ${elemPath}`,
    `title of ${elemPath}`,
    `help of UI element 1 of ${elemPath}`,
    `name of UI element 1 of ${elemPath}`,
  ];
  for (const expr of exprs) {
    const r = runSafe(
      `osascript -e 'tell application "System Events" to tell process "${proc}" to get ${expr}'`,
      2000
    );
    if (isUsableLabel(r)) return r!.trim();
  }
  return `Item ${idx}`;
}

function countAX(proc: string, collection: string): number {
  const r = runSafe(
    `osascript -e 'tell application "System Events" to tell process "${proc}" to count ${collection}'`,
    3000
  );
  const n = parseInt(r ?? "0", 10);
  return isNaN(n) ? 0 : n;
}

// ─── Collection specs ─────────────────────────────────────────────────────────
//
// Defines WHERE to find nav elements (count-based) and HOW to press them.
// Labels always resolved per-index via getLabel() — never mass queries.

const PRIMARY_SPECS: CollectionSpec[] = [
  {
    name: "splitter-sidebar",
    countScript: () => `buttons of UI element 1 of splitter group 1 of window 1`,
    elemPath: (_p, n) => `button ${n} of UI element 1 of splitter group 1 of window 1`,
    pressScript: (p, n) => `tell application "System Events" to tell process "${p}" to perform action "AXPress" of button ${n} of UI element 1 of splitter group 1 of window 1`,
  },
  {
    name: "toolbar-buttons",
    countScript: () => `buttons of toolbar 1 of window 1`,
    elemPath: (_p, n) => `button ${n} of toolbar 1 of window 1`,
    pressScript: (p, n, lbl) => `tell application "System Events" to tell process "${p}" to perform action "AXPress" of (first button of toolbar 1 of window 1 whose name is "${lbl}")`,
  },
  {
    name: "tab-group",
    countScript: () => `tabs of tab group 1 of window 1`,
    elemPath: (_p, n) => `tab ${n} of tab group 1 of window 1`,
    pressScript: (p, n) => `tell application "System Events" to tell process "${p}" to perform action "AXPress" of tab ${n} of tab group 1 of window 1`,
  },
  {
    name: "radio-nav",
    countScript: () => `radio buttons of group 1 of window 1`,
    elemPath: (_p, n) => `radio button ${n} of group 1 of window 1`,
    pressScript: (p, n, lbl) => `tell application "System Events" to tell process "${p}" to perform action "AXPress" of (first radio button of group 1 of window 1 whose name is "${lbl}")`,
  },
  {
    name: "outline-sidebar",
    countScript: () => `rows of outline 1 of scroll area 1 of window 1`,
    elemPath: (_p, n) => `row ${n} of outline 1 of scroll area 1 of window 1`,
    // Outline rows use AXPress (they have actions, unlike table rows)
    pressScript: (p, n) => `tell application "System Events" to tell process "${p}" to perform action "AXPress" of row ${n} of outline 1 of scroll area 1 of window 1`,
  },
  {
    name: "table-sidebar",
    countScript: () => `rows of table 1 of scroll area 1 of window 1`,
    elemPath: (_p, n) => `row ${n} of table 1 of scroll area 1 of window 1`,
    // Table rows have no AX actions — selection is done by setting selected attribute
    pressScript: (p, n) => `tell application "System Events" to tell process "${p}" to set selected of row ${n} of table 1 of scroll area 1 of window 1 to true`,
  },
];

// Sub-nav specs — checked after each primary nav click.
// Covers the content area of splitter groups, new panels that appear, etc.
const SUB_SPECS: CollectionSpec[] = [
  {
    name: "splitter-panel3-table",
    countScript: () => `rows of table 1 of UI element 3 of splitter group 1 of window 1`,
    elemPath: (_p, n) => `row ${n} of table 1 of UI element 3 of splitter group 1 of window 1`,
    pressScript: (p, n) => `tell application "System Events" to tell process "${p}" to set selected of row ${n} of table 1 of UI element 3 of splitter group 1 of window 1 to true`,
  },
  {
    name: "splitter-panel2-table",
    countScript: () => `rows of table 1 of UI element 2 of splitter group 1 of window 1`,
    elemPath: (_p, n) => `row ${n} of table 1 of UI element 2 of splitter group 1 of window 1`,
    pressScript: (p, n) => `tell application "System Events" to tell process "${p}" to set selected of row ${n} of table 1 of UI element 2 of splitter group 1 of window 1 to true`,
  },
  {
    name: "splitter-panel3-tabs",
    countScript: () => `tabs of tab group 1 of UI element 3 of splitter group 1 of window 1`,
    elemPath: (_p, n) => `tab ${n} of tab group 1 of UI element 3 of splitter group 1 of window 1`,
    pressScript: (p, n) => `tell application "System Events" to tell process "${p}" to perform action "AXPress" of tab ${n} of tab group 1 of UI element 3 of splitter group 1 of window 1`,
  },
  {
    name: "splitter-panel3-radio",
    countScript: () => `radio buttons of group 1 of UI element 3 of splitter group 1 of window 1`,
    elemPath: (_p, n) => `radio button ${n} of group 1 of UI element 3 of splitter group 1 of window 1`,
    pressScript: (p, n, lbl) => `tell application "System Events" to tell process "${p}" to perform action "AXPress" of (first radio button of group 1 of UI element 3 of splitter group 1 of window 1 whose name is "${lbl}")`,
  },
  {
    name: "window-tab-group",
    countScript: () => `tabs of tab group 1 of window 1`,
    elemPath: (_p, n) => `tab ${n} of tab group 1 of window 1`,
    pressScript: (p, n) => `tell application "System Events" to tell process "${p}" to perform action "AXPress" of tab ${n} of tab group 1 of window 1`,
  },
  {
    name: "scroll-outline",
    countScript: () => `rows of outline 1 of scroll area 1 of window 1`,
    elemPath: (_p, n) => `row ${n} of outline 1 of scroll area 1 of window 1`,
    pressScript: (p, n) => `tell application "System Events" to tell process "${p}" to perform action "AXPress" of row ${n} of outline 1 of scroll area 1 of window 1`,
  },
  // Detail panel (4th pane in a 3+detail splitter layout — e.g. NordVPN, System Settings)
  {
    name: "splitter-panel4-tabs",
    countScript: () => `tabs of tab group 1 of UI element 4 of splitter group 1 of window 1`,
    elemPath: (_p, n) => `tab ${n} of tab group 1 of UI element 4 of splitter group 1 of window 1`,
    pressScript: (p, n) => `tell application "System Events" to tell process "${p}" to perform action "AXPress" of tab ${n} of tab group 1 of UI element 4 of splitter group 1 of window 1`,
  },
  {
    name: "splitter-panel4-radio",
    countScript: () => `radio buttons of group 1 of UI element 4 of splitter group 1 of window 1`,
    elemPath: (_p, n) => `radio button ${n} of group 1 of UI element 4 of splitter group 1 of window 1`,
    pressScript: (p, n, lbl) => `tell application "System Events" to tell process "${p}" to perform action "AXPress" of (first radio button of group 1 of UI element 4 of splitter group 1 of window 1 whose name is "${lbl}")`,
  },
  // Generic: tabs anywhere inside the window (catches preference pane tabs, sidebar-less tab UIs)
  {
    name: "window-any-tab-group",
    countScript: () => `tabs of tab group 1 of group 1 of window 1`,
    elemPath: (_p, n) => `tab ${n} of tab group 1 of group 1 of window 1`,
    pressScript: (p, n) => `tell application "System Events" to tell process "${p}" to perform action "AXPress" of tab ${n} of tab group 1 of group 1 of window 1`,
  },
];

function findNavItems(
  proc: string,
  specs: CollectionSpec[],
  max: number
): { spec: CollectionSpec; items: NavItem[] } | null {
  for (const spec of specs) {
    const count = countAX(proc, spec.countScript(proc));
    if (count < 2) continue;

    const items: NavItem[] = [];
    for (let i = 1; i <= Math.min(count, max); i++) {
      const label = getLabel(proc, spec.elemPath(proc, i), i);
      items.push({ label, index: i, pressScript: spec.pressScript(proc, i, label) });
    }
    return { spec, items };
  }
  return null;
}

// ─── Screenshot ───────────────────────────────────────────────────────────────

function getCGWindowId(processName: string): number | null {
  const py = `
import Quartz, sys
name = sys.argv[1].lower()
wins = Quartz.CGWindowListCopyWindowInfo(
    Quartz.kCGWindowListOptionOnScreenOnly | Quartz.kCGWindowListExcludeDesktopElements,
    Quartz.kCGNullWindowID,
)
for w in sorted(wins, key=lambda x: x.get("kCGWindowLayer", 999)):
    owner = (w.get("kCGWindowOwnerName") or "").lower()
    if name in owner or owner in name:
        wid = w.get("kCGWindowNumber")
        if wid:
            print(wid)
            sys.exit(0)
sys.exit(1)`.trim();
  const pyPath = path.join(os.tmpdir(), `uifa-wid-${Date.now()}.py`);
  try {
    fs.writeFileSync(pyPath, py);
    const out = execSync(`/usr/bin/python3 "${pyPath}" "${processName}"`, { timeout: 5000, encoding: "utf8" }).trim();
    const id = parseInt(out, 10);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  } finally {
    try { fs.unlinkSync(pyPath); } catch { /* ignore */ }
  }
}

// Capture window without touching app focus — preserves navigation state.
// Only falls back to activate if the window has been dismissed.
async function captureScreen(processName: string): Promise<string | null> {
  const tmp = path.join(os.tmpdir(), `uifa-${Date.now()}.jpg`);
  try {
    let winId = getCGWindowId(processName);
    if (winId === null) {
      // Window dismissed — recover, but navigation state will reset
      activate(processName);
      raiseWindow(processName);
      await sleep(700);
      winId = getCGWindowId(processName);
    }

    let cmd: string;
    if (winId !== null) {
      cmd = `screencapture -l ${winId} -x -t jpg "${tmp}"`;
    } else {
      const bounds = getWindowBounds(processName);
      if (bounds && bounds.w > 0 && bounds.h > 0) {
        cmd = `screencapture -x -R ${bounds.x},${bounds.y},${bounds.w},${bounds.h} -t jpg "${tmp}"`;
      } else {
        cmd = `screencapture -x -t jpg "${tmp}"`;
      }
    }

    execSync(cmd, { timeout: 8000 });
    if (!fsExists(tmp)) return null;
    runSafe(`sips -Z 1280 "${tmp}" --out "${tmp}" 2>/dev/null`, 6000);
    const buf = fs.readFileSync(tmp);
    fs.unlinkSync(tmp);
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    return null;
  }
}

// Entry screenshot — activates the app first to ensure the window is visible.
// Use ONLY for initial/entry shots, never after navigation presses.
async function takeScreenshot(processName: string): Promise<string | null> {
  raiseWindow(processName);
  activate(processName);
  await sleep(500);
  // Retry CGWindowID once after activation settles
  if (getCGWindowId(processName) === null) await sleep(500);
  return captureScreen(processName);
}

// Sample mid-image for dedup (skips title bar which is identical across views)
function contentHash(shot: string | null): string {
  if (!shot) return "__null__";
  const data = shot.slice(22);
  const mid = Math.floor(data.length / 2);
  return data.slice(mid - 300, mid + 300);
}

// ─── Recursive crawler ────────────────────────────────────────────────────────

async function crawlLevel(
  ctx: CrawlCtx,
  parentId: string,
  parentLabel: string,
  depth: number,
  specs: CollectionSpec[],
  returnScript: string | null,
  startX: number,
  rowY: number,
  skipSpecNames: Set<string> = new Set()
): Promise<number /* next colX */> {
  // Exclude any spec that was already used to arrive here — prevents re-discovering
  // the same collection at every recursion level (e.g. NordVPN's settings row list)
  const candidateSpecs = specs.filter((s) => !skipSpecNames.has(s.name));
  const nav = findNavItems(ctx.proc, candidateSpecs, MAX_ITEMS);
  if (!nav || nav.items.length === 0) return startX;

  ctx.events.push({
    kind: "scan",
    nodeId: parentId,
    utterance: `${nav.items.length} item${nav.items.length === 1 ? "" : "s"} via ${nav.spec.name}.`,
    durationMs: 600,
  });

  let colX = startX;

  for (const item of nav.items) {
    // AXPress the item, then immediately bring the app to front before any
    // auto-dismiss timer fires (critical for menu-bar popovers like NordVPN)
    runAS(item.pressScript);
    activate(ctx.proc);  // keep window alive and force re-render of new selection
    await sleep(SETTLE_MS);

    const shot = await captureScreen(ctx.proc);
    const hash = contentHash(shot);
    const isDup = ctx.seenHashes.has(hash);
    if (shot && !isDup) ctx.seenHashes.add(hash);

    const nodeId = `${parentId}-${item.index}`;
    const nodeLabel = item.label;

    ctx.nodes.push({
      id: nodeId,
      label: nodeLabel,
      kind: depth === MAX_DEPTH - 1 ? "entry" : "tab",
      position: { x: colX, y: rowY },
      hasScreenshot: !!shot,
      url: ctx.bundlePath,
      deviceType: "desktop",
    });
    ctx.edges.push({ source: parentId, target: nodeId });
    ctx.events.push({ kind: "scan", nodeId, utterance: `${nodeLabel}.`, durationMs: 800 });
    if (shot) ctx.screenshots[nodeId] = shot;
    if (isDup) {
      ctx.findings.push({ nodeId, severity: "low", msg: `${nodeLabel}: matches a previously captured screen.` });
    }

    // Recurse into sub-nav, excluding the spec we just used so we don't loop
    if (depth > 0 && !isDup) {
      const nextSkip = new Set(skipSpecNames);
      nextSkip.add(nav.spec.name);
      await crawlLevel(ctx, nodeId, nodeLabel, depth - 1, SUB_SPECS, item.pressScript, colX - 2 * SUB_STEP, rowY + ROW_GAP, nextSkip);
    }

    colX += (depth === MAX_DEPTH - 1 ? COL_STEP : SUB_STEP);
  }

  // Restore parent view after exploring all items at this level
  if (returnScript) {
    runAS(returnScript);
    await sleep(SETTLE_MS);
  }

  return colX;
}

// ─── Main app crawl ───────────────────────────────────────────────────────────

async function crawlAppWindows(
  bundlePath: string,
  bundleName: string,
  processName: string
): Promise<{
  nodes: NodeShape[];
  edges: Array<{ source: string; target: string }>;
  screenshots: Record<string, string>;
  events: AuditEvent[];
  findings: Array<{ nodeId: string; severity: Severity; msg: string }>;
}> {
  const ctx: CrawlCtx = {
    proc: processName,
    bundlePath,
    nodes: [],
    edges: [],
    screenshots: {},
    events: [],
    findings: [],
    seenHashes: new Set(),
  };

  // ── Launch ──────────────────────────────────────────────────────────────────
  runSafe(`open "${bundlePath}"`, 6000);
  await sleep(LAUNCH_WAIT);
  activate(processName);
  await sleep(600);

  // ── Entry node ──────────────────────────────────────────────────────────────
  const entryShot = await takeScreenshot(processName);
  if (entryShot) ctx.seenHashes.add(contentHash(entryShot));

  ctx.nodes.push({
    id: "entry",
    label: `${bundleName} · Main`,
    kind: "entry",
    position: { x: 300, y: 40 },
    hasScreenshot: !!entryShot,
    url: bundlePath,
    deviceType: "desktop",
  });
  ctx.events.push({ kind: "scan", nodeId: "entry", utterance: "Main window.", durationMs: 900 });
  if (entryShot) ctx.screenshots["entry"] = entryShot;
  if (!entryShot) {
    ctx.findings.push({
      nodeId: "entry",
      severity: "medium",
      msg: "Screenshot failed. Grant Screen Recording to Terminal in System Settings → Privacy & Security → Screen Recording.",
    });
  }

  // ── Discover primary navigation ─────────────────────────────────────────────
  const primaryNav = findNavItems(processName, PRIMARY_SPECS, MAX_ITEMS);

  if (primaryNav) {
    ctx.events.push({
      kind: "scan",
      nodeId: "entry",
      utterance: `${primaryNav.items.length} nav items via ${primaryNav.spec.name}.`,
      durationMs: 700,
    });

    let colX = 80;
    for (const item of primaryNav.items) {
      runAS(item.pressScript);
      activate(processName);
      await sleep(SETTLE_MS);

      const shot = await captureScreen(processName);
      const hash = contentHash(shot);
      const isDup = ctx.seenHashes.has(hash);
      if (shot && !isDup) ctx.seenHashes.add(hash);

      const nodeId = `nav-${item.index}`;
      ctx.nodes.push({
        id: nodeId,
        label: item.label,
        kind: "tab",
        position: { x: colX, y: 280 },
        hasScreenshot: !!shot,
        url: bundlePath,
        deviceType: "desktop",
      });
      ctx.edges.push({ source: "entry", target: nodeId });
      ctx.events.push({ kind: "scan", nodeId, utterance: `${item.label}.`, durationMs: 800 });
      if (shot) ctx.screenshots[nodeId] = shot;
      if (isDup) {
        ctx.findings.push({ nodeId, severity: "low", msg: `${item.label}: matches a previously captured screen.` });
      }

      // Deep-crawl sub-navigation (Settings categories, nested tabs, etc.)
      if (!isDup) {
        await crawlLevel(ctx, nodeId, item.label, MAX_DEPTH - 1, SUB_SPECS, item.pressScript, colX - 2 * SUB_STEP, 280 + ROW_GAP);
      }

      colX += COL_STEP;
    }
  } else {
    // ── Fallback: Cmd+, + window enumeration ──────────────────────────────────
    ctx.events.push({ kind: "scan", nodeId: "entry", utterance: "No nav found. Trying Preferences + windows.", durationMs: 800 });

    runAS(`tell application "System Events" to keystroke "," using {command down}`);
    await sleep(1800);
    const prefShot = await takeScreenshot(processName);
    ctx.nodes.push({ id: "preferences", label: "Preferences", kind: "tab", position: { x: 80, y: 280 }, hasScreenshot: !!prefShot, url: bundlePath, deviceType: "desktop" });
    ctx.edges.push({ source: "entry", target: "preferences" });
    ctx.events.push({ kind: "scan", nodeId: "preferences", utterance: "Preferences.", durationMs: 900 });
    if (prefShot) ctx.screenshots["preferences"] = prefShot;

    runAS(`tell application "System Events" to keystroke "w" using {command down}`);
    await sleep(600);
    activate(processName);
    await sleep(400);

    const winListRaw = runAS(`tell application "System Events" to tell process "${processName}" to get name of every window`);
    if (winListRaw) {
      const seen = new Set([bundleName, `${bundleName} · Main`, "preferences", ""]);
      const winNames = winListRaw.split(",").map((s) => s.trim()).filter((n) => n && n !== "missing value" && !seen.has(n));
      let colX = 300;
      for (let i = 0; i < Math.min(winNames.length, 4); i++) {
        seen.add(winNames[i]);
        runAS(`tell application "System Events" to tell process "${processName}" to perform action "AXRaise" of (first window whose name is "${winNames[i]}")`);
        await sleep(1200);
        const winShot = await takeScreenshot(processName);
        const winId = `window-${i}`;
        ctx.nodes.push({ id: winId, label: winNames[i], kind: "tab", position: { x: colX, y: 280 }, hasScreenshot: !!winShot, url: bundlePath, deviceType: "desktop" });
        ctx.edges.push({ source: "entry", target: winId });
        ctx.events.push({ kind: "scan", nodeId: winId, utterance: `${winNames[i]}.`, durationMs: 900 });
        if (winShot) ctx.screenshots[winId] = winShot;
        colX += COL_STEP;
      }
    }
  }

  // ── Menu bar check ──────────────────────────────────────────────────────────
  const mc = runSafe(`osascript -e 'tell application "System Events" to tell process "${processName}" to count menu bar items of menu bar 1'`, 3000);
  if (mc) {
    const n = parseInt(mc, 10);
    if (!isNaN(n) && n < 3) {
      ctx.findings.push({ nodeId: "entry", severity: "low", msg: `Only ${n} menu bar item${n === 1 ? "" : "s"} detected. App may be menu-bar-only or menus haven't loaded.` });
    }
  }

  return ctx;
}

// ─── Route ────────────────────────────────────────────────────────────────────

function expandPath(p: string): string {
  return p.startsWith("~/") || p === "~" ? path.join(os.homedir(), p.slice(1)) : p;
}

function resolveAppPath(rawPath: string): string | null {
  const expanded = expandPath(rawPath);
  if (fsExists(expanded)) return expanded;
  if (/\.app\/?$/i.test(expanded)) {
    const basename = path.basename(expanded);
    for (const dir of APP_SEARCH_DIRS) {
      const candidate = path.join(dir, basename);
      if (fsExists(candidate)) return candidate;
    }
  }
  return null;
}

function readTextSafe(p: string): string | null {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}

function parsePlist(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const re = /<key>([^<]+)<\/key>\s*<(?:string|integer|real)>([^<]*)<\/(?:string|integer|real)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) result[m[1]] = m[2];
  return result;
}

export async function POST(req: Request) {
  let body: { path?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const rawPath = (body.path ?? "").trim();
  if (!rawPath) return NextResponse.json({ error: "path is required" }, { status: 400 });

  const resolved = resolveAppPath(rawPath);
  if (!resolved) {
    const hint = /\.app\/?$/i.test(rawPath) ? " Searched ~/Applications, /Applications, /System/Applications." : "";
    return NextResponse.json({ error: `Path not found: ${rawPath}.${hint}` }, { status: 404 });
  }

  return /\.app\/?$/i.test(resolved)
    ? auditAppBundle(resolved)
    : NextResponse.json(auditSourceFolder(resolved, rawPath));
}

async function auditAppBundle(bundlePath: string): Promise<NextResponse> {
  const plistXml = readTextSafe(path.join(bundlePath, "Contents", "Info.plist"));
  const plist = plistXml ? parsePlist(plistXml) : {};
  const bundleName = plist.CFBundleDisplayName || plist.CFBundleName || path.basename(bundlePath, ".app");
  const version = plist.CFBundleShortVersionString ?? plist.CFBundleVersion ?? "?";
  const processName = plist.CFBundleExecutable ?? bundleName;

  const events: AuditEvent[] = [
    { kind: "start", utterance: `${bundleName} · v${version}. Launching.`, durationMs: 1200 },
  ];

  const result = await crawlAppWindows(bundlePath, bundleName, processName);
  events.push(...result.events);

  for (const f of result.findings) {
    events.push({ kind: "finding", nodeId: f.nodeId, severity: f.severity, utterance: f.msg, durationMs: 1700 });
  }

  const highCount = result.findings.filter((f) => f.severity === "high").length;
  const summary = result.findings.length === 0
    ? `${result.nodes.length} screens captured.`
    : `${result.nodes.length} screens. ${result.findings.length} finding${result.findings.length === 1 ? "" : "s"}${highCount > 0 ? `. ${highCount} high.` : "."}`;
  events.push({ kind: "end", utterance: summary, durationMs: 1400 });

  return NextResponse.json({
    script: { target: bundleName, events },
    nodes: result.nodes,
    edges: result.edges,
    screenshots: result.screenshots,
  } as SourceAuditResponse);
}

function collectExtensions(dir: string, limit: number): Set<string> {
  const exts = new Set<string>();
  let count = 0;
  function walk(p: string, depth: number) {
    if (depth > 6 || count > limit) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (count > limit) return;
      if (e.isDirectory()) walk(path.join(p, e.name), depth + 1);
      else { const ext = path.extname(e.name).toLowerCase(); if (ext) exts.add(ext); count++; }
    }
  }
  walk(dir, 0);
  return exts;
}

function auditSourceFolder(folderPath: string, rawPath: string): SourceAuditResponse {
  const ext = collectExtensions(folderPath, 500);
  const folderName = path.basename(folderPath);
  let platformLabel = "Source";
  if (ext.has(".swift")) platformLabel = "iOS / macOS Swift";
  else if (ext.has(".dart") || fsExists(path.join(folderPath, "pubspec.yaml"))) platformLabel = "Flutter";
  else if (ext.has(".kt")) platformLabel = "Android";
  else if (ext.has(".ts") || ext.has(".tsx")) platformLabel = "TypeScript";

  return {
    script: {
      target: folderName,
      events: [
        { kind: "start", utterance: `${folderName} · ${platformLabel} source.`, durationMs: 1200 },
        { kind: "scan", nodeId: "entry", utterance: `${ext.size} file types detected.`, durationMs: 900 },
        { kind: "finding", nodeId: "entry", severity: "low", utterance: "Point to a compiled .app bundle to launch and capture real screens.", durationMs: 1600 },
        { kind: "end", utterance: "Source scan complete.", durationMs: 1200 },
      ],
    },
    nodes: [{ id: "entry", label: folderName, kind: "entry", position: { x: 300, y: 40 }, hasScreenshot: false, url: rawPath, deviceType: "desktop" }],
    edges: [],
    screenshots: {},
  };
}
