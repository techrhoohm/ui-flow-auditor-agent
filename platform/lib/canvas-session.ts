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

function cleanNodes(nodes: Node<ScreenNodeData>[]): Node<ScreenNodeData>[] {
  return nodes.map((n) => ({
    ...n,
    data: { ...n.data, isActive: false, flashSeverity: null },
  }));
}

export async function saveCanvasSession(session: Omit<CanvasSession, "savedAt">): Promise<void> {
  const cleaned: CanvasSession = { ...session, nodes: cleanNodes(session.nodes), savedAt: Date.now() };
  await dbSet("canvas-session", SESSION_KEY, cleaned);
}

export async function loadCanvasSession(): Promise<CanvasSession | null> {
  const session = await dbGet<CanvasSession>("canvas-session", SESSION_KEY);
  return session ?? null;
}

export async function clearCanvasSession(): Promise<void> {
  await dbSet("canvas-session", SESSION_KEY, null);
}

// Per-run named sessions — keyed by audit run ID
export async function saveNamedSession(runId: string, session: Omit<CanvasSession, "savedAt">): Promise<void> {
  const cleaned: CanvasSession = { ...session, nodes: cleanNodes(session.nodes), savedAt: Date.now() };
  await dbSet("canvas-session", `run:${runId}`, cleaned);
}

export async function loadNamedSession(runId: string): Promise<CanvasSession | null> {
  const session = await dbGet<CanvasSession>("canvas-session", `run:${runId}`);
  return session ?? null;
}
