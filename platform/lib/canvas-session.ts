"use client";

import type { Edge, Node } from "@xyflow/react";
import type { ScreenNodeData } from "./fixtures";
import type { AuditFinding } from "./audit-runner";
import { dbGet, dbSet } from "./db";

const SESSION_KEY = "latest";

export type CanvasSession = {
  targetInput: string;
  nodes: Node<ScreenNodeData>[];
  edges: Edge[];
  findingsByNode: Record<string, AuditFinding[]>;
  hasScreenshots: boolean;
  savedAt: number;
};

export async function saveCanvasSession(session: Omit<CanvasSession, "savedAt">): Promise<void> {
  const cleaned: CanvasSession = {
    ...session,
    nodes: session.nodes.map((n) => ({
      ...n,
      data: { ...n.data, isActive: false, flashSeverity: null },
    })),
    savedAt: Date.now(),
  };
  await dbSet("canvas-session", SESSION_KEY, cleaned);
}

export async function loadCanvasSession(): Promise<CanvasSession | null> {
  const session = await dbGet<CanvasSession>("canvas-session", SESSION_KEY);
  return session ?? null;
}

export async function clearCanvasSession(): Promise<void> {
  await dbSet("canvas-session", SESSION_KEY, null);
}
