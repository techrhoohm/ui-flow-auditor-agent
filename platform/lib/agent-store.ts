import type { AgentConfig } from "./agent-config";
import { DEFAULT_AGENT_CONFIG } from "./agent-config";

export type AgentRunState =
  | "queued"
  | "crawling"
  | "analyzing"
  | "reporting"
  | "done"
  | "error";

export interface AgentRun {
  runId: string;
  state: AgentRunState;
  targetId: string;
  url: string;
  startedAt: number;
  updatedAt: number;
  pagesFound: number;
  issuesFound: number;
  issuesFiled: number;
  issueUrls?: string[];
  log: string[];
  error?: string;
  // Live page-by-page data streamed during crawl
  partialCrawl?: Array<{
    id: string;
    label: string;
    url: string;
    screenshot: string | null;
  }>;
  // Stored after crawl completes so the UI can load results into canvas
  crawlResult?: {
    nodes: Array<{
      id: string;
      label: string;
      url: string;
      position: { x: number; y: number };
      screenshot: string | null;   // JPEG data URL captured during crawl
    }>;
    edges: Array<{ source: string; target: string }>;
    findings: Array<{ nodeId: string; nodeLabel: string; severity: string; message: string; rule: string }>;
    aiSummary?: string;
  };
}

const KEY_CONFIG = "agent:config";
const KEY_CURRENT = "agent:current";
const KEY_LAST = "agent:last";
const KEY_LAST_BATCH = "agent:batch";

// --- In-memory fallback (local dev without Redis) ---
const mem = new Map<string, string>();

function redisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function kv_set(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const r = redisClient();
  if (!r) { mem.set(key, value); return; }
  const endpoint = `${r.url}/set/${encodeURIComponent(key)}`;
  const body = ttlSeconds
    ? JSON.stringify([value, "EX", ttlSeconds])
    : JSON.stringify([value]);
  await fetch(`${r.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${r.token}`, "Content-Type": "application/json" },
    body: JSON.stringify([[ttlSeconds ? "SETEX" : "SET", key, ...(ttlSeconds ? [ttlSeconds, value] : [value])]]),
  });
  void endpoint; void body;
  // simpler direct SET
  await fetch(`${r.url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}${ttlSeconds ? `?EX=${ttlSeconds}` : ""}`, {
    headers: { Authorization: `Bearer ${r.token}` },
  });
}

async function kv_get(key: string): Promise<string | null> {
  const r = redisClient();
  if (!r) return mem.get(key) ?? null;
  const res = await fetch(`${r.url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${r.token}` },
  });
  if (!res.ok) return null;
  const data = await res.json() as { result: string | null };
  return data.result;
}

// --- Public API ---

export async function getAgentConfig(): Promise<AgentConfig> {
  const raw = await kv_get(KEY_CONFIG);
  if (!raw) return { ...DEFAULT_AGENT_CONFIG };
  try { return JSON.parse(raw) as AgentConfig; }
  catch { return { ...DEFAULT_AGENT_CONFIG }; }
}

export async function setAgentConfig(config: AgentConfig): Promise<void> {
  await kv_set(KEY_CONFIG, JSON.stringify(config));
}

export async function getCurrentRun(): Promise<AgentRun | null> {
  const raw = await kv_get(KEY_CURRENT);
  if (!raw) return null;
  try { return JSON.parse(raw) as AgentRun; }
  catch { return null; }
}

export async function getLastRun(): Promise<AgentRun | null> {
  const raw = await kv_get(KEY_LAST);
  if (!raw) return null;
  try { return JSON.parse(raw) as AgentRun; }
  catch { return null; }
}

export async function upsertRun(run: AgentRun): Promise<void> {
  await kv_set(KEY_CURRENT, JSON.stringify(run), 3600);
}

export async function finalizeRun(run: AgentRun): Promise<void> {
  await kv_set(KEY_LAST, JSON.stringify(run), 86400 * 7);
  // Clear current so status shows idle
  await kv_set(KEY_CURRENT, "", 1);
}

export async function saveLastBatch(runs: AgentRun[]): Promise<void> {
  await kv_set(KEY_LAST_BATCH, JSON.stringify(runs), 86400 * 7);
}

export async function getLastBatch(): Promise<AgentRun[]> {
  const raw = await kv_get(KEY_LAST_BATCH);
  if (!raw) return [];
  try { return JSON.parse(raw) as AgentRun[]; }
  catch { return []; }
}
