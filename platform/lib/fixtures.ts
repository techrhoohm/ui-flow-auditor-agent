import type { Edge, Node } from "@xyflow/react";

import type { Severity } from "./audit-script";

export type ScreenNodeData = {
  label: string;
  kind: "entry" | "tab" | "modal" | "detail";
  issueCount: number;
  thumbnailSeed: string;
  isActive?: boolean;
  flashSeverity?: Severity | null;
  [key: string]: unknown;
};

export const vitalsAppNodes: Node<ScreenNodeData>[] = [
  {
    id: "entry",
    type: "screen",
    position: { x: 480, y: 40 },
    data: {
      label: "VitalsApp · Launch",
      kind: "entry",
      issueCount: 0,
      thumbnailSeed: "entry",
    },
  },
  {
    id: "tab-home",
    type: "screen",
    position: { x: 60, y: 280 },
    data: { label: "Home", kind: "tab", issueCount: 0, thumbnailSeed: "home" },
  },
  {
    id: "tab-activity",
    type: "screen",
    position: { x: 240, y: 280 },
    data: { label: "Activity", kind: "tab", issueCount: 0, thumbnailSeed: "activity" },
  },
  {
    id: "tab-heart",
    type: "screen",
    position: { x: 420, y: 280 },
    data: { label: "Heart", kind: "tab", issueCount: 0, thumbnailSeed: "heart" },
  },
  {
    id: "tab-sleep",
    type: "screen",
    position: { x: 600, y: 280 },
    data: { label: "Sleep", kind: "tab", issueCount: 0, thumbnailSeed: "sleep" },
  },
  {
    id: "tab-ai",
    type: "screen",
    position: { x: 780, y: 280 },
    data: { label: "AI", kind: "tab", issueCount: 0, thumbnailSeed: "ai" },
  },
  {
    id: "tab-profile",
    type: "screen",
    position: { x: 960, y: 280 },
    data: { label: "Profile", kind: "tab", issueCount: 0, thumbnailSeed: "profile" },
  },
];

export const vitalsAppEdges: Edge[] = [
  { id: "e-home", source: "entry", target: "tab-home", animated: false },
  { id: "e-activity", source: "entry", target: "tab-activity", animated: false },
  { id: "e-heart", source: "entry", target: "tab-heart", animated: false },
  { id: "e-sleep", source: "entry", target: "tab-sleep", animated: false },
  { id: "e-ai", source: "entry", target: "tab-ai", animated: false },
  { id: "e-profile", source: "entry", target: "tab-profile", animated: false },
];
