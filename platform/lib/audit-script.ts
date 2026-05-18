export type Severity = "low" | "medium" | "high";

export type AuditEvent =
  | { kind: "start"; utterance: string; durationMs: number }
  | { kind: "scan"; nodeId: string; utterance: string; durationMs: number }
  | {
      kind: "finding";
      nodeId: string;
      severity: Severity;
      utterance: string;
      durationMs: number;
    }
  | { kind: "end"; utterance: string; durationMs: number };

export type AuditScript = {
  target: string;
  events: AuditEvent[];
};

export const vitalsAppScript: AuditScript = {
  target: "VitalsApp",
  events: [
    { kind: "start", utterance: "Starting. Six screens.", durationMs: 1400 },

    { kind: "scan", nodeId: "entry", utterance: "Launch surface.", durationMs: 1100 },
    {
      kind: "finding",
      nodeId: "entry",
      severity: "medium",
      utterance: "No splash skip. Users wait every cold start.",
      durationMs: 1800,
    },

    { kind: "scan", nodeId: "tab-home", utterance: "Home.", durationMs: 900 },
    {
      kind: "finding",
      nodeId: "tab-home",
      severity: "high",
      utterance: "Primary CTA sits below the fold on small devices.",
      durationMs: 2000,
    },
    {
      kind: "finding",
      nodeId: "tab-home",
      severity: "low",
      utterance: "Greeting text reflows on rotate. Layout shifts by 14 pixels.",
      durationMs: 1900,
    },

    { kind: "scan", nodeId: "tab-activity", utterance: "Activity.", durationMs: 900 },
    {
      kind: "finding",
      nodeId: "tab-activity",
      severity: "medium",
      utterance: "Step count uses red on zero. Negative signal for a neutral state.",
      durationMs: 2000,
    },

    { kind: "scan", nodeId: "tab-heart", utterance: "Heart.", durationMs: 900 },
    {
      kind: "finding",
      nodeId: "tab-heart",
      severity: "high",
      utterance: "BPM chart has no empty state. Renders an axis with no series.",
      durationMs: 2100,
    },
    {
      kind: "finding",
      nodeId: "tab-heart",
      severity: "medium",
      utterance: "Tap target on the data points is under 32 points.",
      durationMs: 1900,
    },

    { kind: "scan", nodeId: "tab-sleep", utterance: "Sleep.", durationMs: 900 },
    {
      kind: "finding",
      nodeId: "tab-sleep",
      severity: "low",
      utterance: "Date picker accepts future nights. It should not.",
      durationMs: 1900,
    },

    { kind: "scan", nodeId: "tab-ai", utterance: "AI.", durationMs: 900 },
    {
      kind: "finding",
      nodeId: "tab-ai",
      severity: "high",
      utterance: "Chat input has no send disabled state while streaming. Double-sends.",
      durationMs: 2100,
    },
    {
      kind: "finding",
      nodeId: "tab-ai",
      severity: "medium",
      utterance: "Streaming tokens overflow the bubble width on narrow phones.",
      durationMs: 2000,
    },

    { kind: "scan", nodeId: "tab-profile", utterance: "Profile.", durationMs: 900 },
    {
      kind: "finding",
      nodeId: "tab-profile",
      severity: "high",
      utterance: "Sign-out lives next to delete account. Same color. Same size.",
      durationMs: 2200,
    },

    { kind: "end", utterance: "Nine findings. Three high.", durationMs: 1800 },
  ],
};
