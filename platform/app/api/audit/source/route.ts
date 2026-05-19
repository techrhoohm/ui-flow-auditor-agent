import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import type { AuditScript, AuditEvent, Severity } from "@/lib/audit-script";
import type { ScreenNodeData } from "@/lib/fixtures";

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

const APP_SEARCH_DIRS = [
  "/Applications",
  path.join(os.homedir(), "Applications"),
  "/Applications/Utilities",
  "/System/Applications",
  "/System/Applications/Utilities",
];

function expandPath(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

function fsExists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function readTextSafe(p: string): string | null {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function parsePlist(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex =
    /<key>([^<]+)<\/key>\s*<(?:string|integer|real)>([^<]*)<\/(?:string|integer|real)>/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    result[m[1]] = m[2];
  }
  return result;
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function run(cmd: string, timeoutMs = 5000): string {
  return execSync(cmd, { timeout: timeoutMs, encoding: "utf8" }).trim();
}

function runSafe(cmd: string, timeoutMs = 5000): string | null {
  try {
    return run(cmd, timeoutMs);
  } catch {
    return null;
  }
}

// Returns the CGWindowID of the frontmost visible window owned by processName.
// Uses system Python3 + PyObjC (ships on every Mac) to query CGWindowListCopyWindowInfo
// so screencapture -l can target the window regardless of which display it's on.
function getCGWindowId(processName: string): number | null {
  const script = `
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
sys.exit(1)
`.trim();

  const scriptPath = path.join(os.tmpdir(), `uifa-winid-${Date.now()}.py`);
  try {
    fs.writeFileSync(scriptPath, script);
    const result = execSync(
      `/usr/bin/python3 "${scriptPath}" "${processName}"`,
      { timeout: 5000, encoding: "utf8" }
    ).trim();
    const id = parseInt(result, 10);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  } finally {
    try { fs.unlinkSync(scriptPath); } catch { /* ignore */ }
  }
}

async function takeScreenshot(processName?: string): Promise<string | null> {
  const tmpPath = path.join(os.tmpdir(), `uifa-${Date.now()}.jpg`);
  try {
    let captureCmd = `screencapture -x -t jpg "${tmpPath}"`;

    if (processName) {
      const winId = getCGWindowId(processName);
      if (winId !== null) {
        // -l captures that specific window on whichever display it lives
        captureCmd = `screencapture -l ${winId} -x -t jpg "${tmpPath}"`;
      }
    }

    execSync(captureCmd, { timeout: 8000 });
    if (!fs.existsSync(tmpPath)) return null;
    runSafe(`sips -Z 1280 "${tmpPath}" --out "${tmpPath}" 2>/dev/null`, 6000);
    const buf = fs.readFileSync(tmpPath);
    fs.unlinkSync(tmpPath);
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    return null;
  }
}

function appleScriptActivate(appName: string): void {
  runSafe(`osascript -e 'tell application "${appName}" to activate'`, 4000);
}

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
  const nodes: NodeShape[] = [];
  const edges: Array<{ source: string; target: string }> = [];
  const screenshots: Record<string, string> = {};
  const events: AuditEvent[] = [];
  const findings: Array<{ nodeId: string; severity: Severity; msg: string }> = [];

  // Launch the app (no-op if already running)
  runSafe(`open "${bundlePath}"`, 6000);
  await sleep(3500);

  // Bring it to front
  appleScriptActivate(processName);
  await sleep(800);

  // --- Main window ---
  const mainShot = await takeScreenshot(processName);
  nodes.push({
    id: "entry",
    label: `${bundleName} · Main`,
    kind: "entry",
    position: { x: 300, y: 40 },
    hasScreenshot: !!mainShot,
    url: bundlePath,
    deviceType: "desktop",
  });
  events.push({
    kind: "scan",
    nodeId: "entry",
    utterance: "Main window.",
    durationMs: 900,
  });
  if (mainShot) screenshots["entry"] = mainShot;

  // Check for screen recording permission (screenshot came back blank-ish or failed)
  if (!mainShot) {
    findings.push({
      nodeId: "entry",
      severity: "medium",
      msg: "Screenshot capture failed. Grant Screen Recording permission to Terminal (or your IDE) in System Settings → Privacy & Security → Screen Recording, then retry.",
    });
  }

  let colX = 80;

  // --- Preferences / Settings (Cmd+,) ---
  const pressedPrefs = runSafe(
    `osascript -e 'tell application "System Events" to keystroke "," using {command down}'`,
    3000
  );
  if (pressedPrefs !== null) {
    await sleep(1800);
    const prefShot = await takeScreenshot(processName);
    const prefId = "preferences";
    nodes.push({
      id: prefId,
      label: "Preferences",
      kind: "tab",
      position: { x: colX, y: 280 },
      hasScreenshot: !!prefShot,
      url: bundlePath,
      deviceType: "desktop",
    });
    edges.push({ source: "entry", target: prefId });
    events.push({
      kind: "scan",
      nodeId: prefId,
      utterance: "Preferences.",
      durationMs: 900,
    });
    if (prefShot) screenshots[prefId] = prefShot;
    colX += 220;

    // Close preferences
    runSafe(
      `osascript -e 'tell application "System Events" to keystroke "w" using {command down}'`,
      2000
    );
    await sleep(600);
    appleScriptActivate(processName);
    await sleep(400);
  }

  // --- Enumerate top-level windows via AppleScript ---
  const winListRaw = runSafe(
    `osascript -e 'tell application "System Events" to tell process "${processName}" to get name of every window'`,
    4000
  );

  if (winListRaw) {
    // AppleScript returns comma-separated names
    const winNames = winListRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((n) => n !== "missing value");

    // Skip the main and preferences windows we already captured
    const alreadyCaptured = new Set(["", bundleName, `${bundleName} · Main`]);

    for (let i = 0; i < Math.min(winNames.length, 4); i++) {
      const winName = winNames[i];
      if (alreadyCaptured.has(winName)) continue;
      alreadyCaptured.add(winName);

      // Bring that specific window to front
      runSafe(
        `osascript -e 'tell application "System Events" to tell process "${processName}" to perform action "AXRaise" of (first window whose name is "${winName}")'`,
        3000
      );
      await sleep(1200);

      const winShot = await takeScreenshot(processName);
      const winId = `window-${i}`;
      nodes.push({
        id: winId,
        label: winName,
        kind: "tab",
        position: { x: colX, y: 280 },
        hasScreenshot: !!winShot,
        url: bundlePath,
        deviceType: "desktop",
      });
      edges.push({ source: "entry", target: winId });
      events.push({
        kind: "scan",
        nodeId: winId,
        utterance: `${winName}.`,
        durationMs: 900,
      });
      if (winShot) screenshots[winId] = winShot;
      colX += 220;
    }
  }

  // --- Menu-bar audit via AppleScript ---
  const menuCountRaw = runSafe(
    `osascript -e 'tell application "System Events" to tell process "${processName}" to count menu bar items of menu bar 1'`,
    3000
  );
  if (menuCountRaw) {
    const menuCount = parseInt(menuCountRaw, 10);
    if (!isNaN(menuCount) && menuCount < 3) {
      findings.push({
        nodeId: "entry",
        severity: "low",
        msg: `Only ${menuCount} menu bar item${menuCount === 1 ? "" : "s"} detected. The app may be a menu-bar-only app or hasn't fully loaded its menus.`,
      });
    }
  }

  return { nodes, edges, screenshots, events, findings };
}

export async function POST(req: Request) {
  let body: { path?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawPath = (body.path ?? "").trim();
  if (!rawPath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const resolved = resolveAppPath(rawPath);
  if (!resolved) {
    const isApp = /\.app\/?$/i.test(rawPath);
    const hint = isApp
      ? ` Searched ~/Applications, /Applications, and /System/Applications.`
      : "";
    return NextResponse.json(
      { error: `Path not found: ${rawPath}.${hint}` },
      { status: 404 }
    );
  }

  const isAppBundle = /\.app\/?$/i.test(resolved);
  if (isAppBundle) {
    return auditAppBundle(resolved, rawPath);
  }
  return auditSourceFolder(resolved, rawPath);
}

async function auditAppBundle(
  bundlePath: string,
  rawPath: string
): Promise<NextResponse> {
  const contentsPath = path.join(bundlePath, "Contents");
  const plistXml = readTextSafe(path.join(contentsPath, "Info.plist"));

  const plist = plistXml ? parsePlist(plistXml) : {};
  const bundleName =
    plist.CFBundleDisplayName ||
    plist.CFBundleName ||
    path.basename(bundlePath, ".app");
  const version =
    plist.CFBundleShortVersionString ?? plist.CFBundleVersion ?? "?";

  // Prefer the executable name as the process name (more reliable for AppleScript)
  const processName = plist.CFBundleExecutable ?? bundleName;

  const events: AuditEvent[] = [
    {
      kind: "start",
      utterance: `${bundleName} · v${version}. Launching.`,
      durationMs: 1200,
    },
  ];

  const { nodes, edges, screenshots, events: crawlEvents, findings } =
    await crawlAppWindows(bundlePath, bundleName, processName);

  events.push(...crawlEvents);

  for (const f of findings) {
    events.push({
      kind: "finding",
      nodeId: f.nodeId,
      severity: f.severity,
      utterance: f.msg,
      durationMs: 1700,
    });
  }

  const highCount = findings.filter((f) => f.severity === "high").length;
  const summaryText =
    findings.length === 0
      ? `${nodes.length} screen${nodes.length === 1 ? "" : "s"} captured.`
      : `${nodes.length} screen${nodes.length === 1 ? "" : "s"}. ${findings.length} finding${findings.length === 1 ? "" : "s"}${highCount > 0 ? `. ${highCount} high.` : "."}`;

  events.push({ kind: "end", utterance: summaryText, durationMs: 1400 });

  return NextResponse.json({
    script: { target: bundleName, events },
    nodes,
    edges,
    screenshots,
  } as SourceAuditResponse);
}

function collectExtensions(dir: string, limit: number): Set<string> {
  const result = new Set<string>();
  let count = 0;
  function walk(p: string, depth: number) {
    if (depth > 6 || count > limit) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(p, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (count > limit) return;
      if (e.isDirectory()) walk(path.join(p, e.name), depth + 1);
      else {
        const ext = path.extname(e.name).toLowerCase();
        if (ext) result.add(ext);
        count++;
      }
    }
  }
  walk(dir, 0);
  return result;
}

function auditSourceFolder(
  folderPath: string,
  rawPath: string
): NextResponse {
  const ext = collectExtensions(folderPath, 500);
  const folderName = path.basename(folderPath);

  const hasSwift = ext.has(".swift");
  const hasDart = ext.has(".dart");
  const hasKotlin = ext.has(".kt");
  const hasTS = ext.has(".ts") || ext.has(".tsx");
  const hasPubspec = fsExists(path.join(folderPath, "pubspec.yaml"));

  let platformLabel = "Source";
  if (hasSwift) platformLabel = "iOS / macOS Swift";
  else if (hasDart || hasPubspec) platformLabel = "Flutter";
  else if (hasKotlin) platformLabel = "Android";
  else if (hasTS) platformLabel = "TypeScript";

  const nodes: NodeShape[] = [
    {
      id: "entry",
      label: folderName,
      kind: "entry",
      position: { x: 300, y: 40 },
      hasScreenshot: false,
      url: rawPath,
      deviceType: "desktop",
    },
  ];

  const events: AuditEvent[] = [
    {
      kind: "start",
      utterance: `${folderName} · ${platformLabel} source.`,
      durationMs: 1200,
    },
    {
      kind: "scan",
      nodeId: "entry",
      utterance: `${ext.size} file type${ext.size === 1 ? "" : "s"} detected.`,
      durationMs: 900,
    },
    {
      kind: "finding",
      nodeId: "entry",
      severity: "low",
      utterance:
        "Source folder scan. Point to a compiled .app bundle to launch and capture real screens.",
      durationMs: 1600,
    },
    { kind: "end", utterance: "Source scan complete.", durationMs: 1200 },
  ];

  return NextResponse.json({
    script: { target: folderName, events },
    nodes,
    edges: [],
    screenshots: {},
  } as SourceAuditResponse);
}
