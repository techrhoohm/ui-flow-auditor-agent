import type { AuditEvent, AuditScript, Severity } from "./audit-script";
import type { RuleFinding } from "./swift-analyzer";

export const FILE_TO_NODE: Record<string, string> = {
  "VitalsApp.swift": "entry",
  "ContentView.swift": "entry",
  "HomeView.swift": "tab-home",
  "ActivityView.swift": "tab-activity",
  "HeartView.swift": "tab-heart",
  "SleepView.swift": "tab-sleep",
  "ChatView.swift": "tab-ai",
  "AIService.swift": "tab-ai",
  "ProfileView.swift": "tab-profile",
};

const NODE_LABELS: Record<string, string> = {
  entry: "Launch surface",
  "tab-home": "Home",
  "tab-activity": "Activity",
  "tab-heart": "Heart",
  "tab-sleep": "Sleep",
  "tab-ai": "AI",
  "tab-profile": "Profile",
};

const NODE_ORDER = [
  "entry",
  "tab-home",
  "tab-activity",
  "tab-heart",
  "tab-sleep",
  "tab-ai",
  "tab-profile",
];

const SEVERITY_DURATION: Record<Severity, number> = {
  low: 1700,
  medium: 1900,
  high: 2100,
};

const utteranceForFinding = (f: RuleFinding): string => {
  switch (f.rule) {
    case "icon-button-needs-label":
      return f.message.replace(/\.$/, ".");
    case "theme-bypass-color":
      return f.message;
    case "destructive-proximity":
      return "Destructive action sits beside Sign Out. One mis-tap.";
    case "force-unwrap":
      return f.message;
    case "magic-padding-spread":
      return f.message;
    case "missing-empty-state":
      return "ForEach with no empty-state guard. Empty data renders nothing useful.";
    case "tap-target-too-small":
      return f.message;
    case "inline-color-literal":
      return "Color literal in a view. Move it to the theme.";
    case "long-view-file":
      return f.message;
    default:
      return f.message;
  }
};

export function findingsToScript(
  target: string,
  byFile: Map<string, RuleFinding[]>
): AuditScript {
  const findingsByNode = new Map<string, RuleFinding[]>();

  for (const [file, findings] of byFile) {
    const node = FILE_TO_NODE[file];
    if (!node) continue;
    const list = findingsByNode.get(node) ?? [];
    list.push(...findings);
    findingsByNode.set(node, list);
  }

  const totalFindings = [...findingsByNode.values()].reduce(
    (acc, list) => acc + list.length,
    0
  );
  const visitedNodes = NODE_ORDER.filter((id) => findingsByNode.has(id));

  const events: AuditEvent[] = [];
  events.push({
    kind: "start",
    utterance: `Starting. ${visitedNodes.length} surfaces.`,
    durationMs: 1400,
  });

  for (const nodeId of NODE_ORDER) {
    const list = findingsByNode.get(nodeId);
    if (!list || list.length === 0) continue;

    const label = NODE_LABELS[nodeId] ?? nodeId;
    events.push({
      kind: "scan",
      nodeId,
      utterance: `${label}.`,
      durationMs: 1000,
    });

    const sorted = [...list].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
    for (const f of sorted) {
      events.push({
        kind: "finding",
        nodeId,
        severity: f.severity,
        utterance: utteranceForFinding(f),
        durationMs: SEVERITY_DURATION[f.severity],
      });
    }
  }

  const highCount = [...findingsByNode.values()]
    .flat()
    .filter((f) => f.severity === "high").length;

  events.push({
    kind: "end",
    utterance:
      totalFindings === 0
        ? "Clean. Nothing to report."
        : `${totalFindings} findings. ${highCount} high.`,
    durationMs: 1800,
  });

  return { target, events };
}

const severityRank = (s: Severity) =>
  s === "high" ? 3 : s === "medium" ? 2 : 1;
