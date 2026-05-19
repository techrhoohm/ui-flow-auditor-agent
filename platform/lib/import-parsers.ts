import type { Priority, TestType } from "./test-cases";

export type ImportedTestCase = {
  title: string;
  body: string;
  priority: Priority;
  type: TestType;
};

const VALID_PRIORITIES = new Set<Priority>(["P0", "P1", "P2"]);
const VALID_TYPES = new Set<TestType>(["functional", "visual", "a11y", "perf"]);

function safePriority(v: unknown): Priority {
  const s = String(v ?? "").toUpperCase().trim();
  return VALID_PRIORITIES.has(s as Priority) ? (s as Priority) : "P1";
}

function safeType(v: unknown): TestType {
  const s = String(v ?? "").toLowerCase().trim();
  return VALID_TYPES.has(s as TestType) ? (s as TestType) : "functional";
}

// ── JSON ──────────────────────────────────────────────────────────────────────
// Accepts an array directly, or an object with a "cases" key.
export function parseJsonTestCases(text: string): ImportedTestCase[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON");
  }

  const arr: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as Record<string, unknown>)?.cases)
    ? ((parsed as Record<string, unknown>).cases as unknown[])
    : [];

  const out: ImportedTestCase[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const title = String(r.title ?? r.name ?? "").trim();
    if (!title) continue;
    out.push({
      title,
      body: String(r.body ?? r.steps ?? r.description ?? "").trim(),
      priority: safePriority(r.priority),
      type: safeType(r.type ?? r.kind),
    });
  }
  return out;
}

// ── CSV ───────────────────────────────────────────────────────────────────────
// Required: title column. Optional: body, priority, type.
export function parseCsvTestCases(text: string): ImportedTestCase[] {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");

  const header = parseCsvRow(lines[0]).map((h) => h.toLowerCase().trim());
  const col = (name: string) => header.indexOf(name);

  const titleIdx = col("title") !== -1 ? col("title") : col("name");
  if (titleIdx === -1) throw new Error("CSV must have a 'title' column");

  const bodyIdx = col("body") !== -1 ? col("body") : col("steps") !== -1 ? col("steps") : col("description");
  const priorityIdx = col("priority");
  const typeIdx = col("type") !== -1 ? col("type") : col("kind");

  const out: ImportedTestCase[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const row = parseCsvRow(line);
    const title = (row[titleIdx] ?? "").trim();
    if (!title) continue;
    out.push({
      title,
      body: bodyIdx >= 0 ? (row[bodyIdx] ?? "").trim() : "",
      priority: safePriority(priorityIdx >= 0 ? row[priorityIdx] : undefined),
      type: safeType(typeIdx >= 0 ? row[typeIdx] : undefined),
    });
  }
  return out;
}

function parseCsvRow(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// ── Markdown ──────────────────────────────────────────────────────────────────
// Each ## heading = one test case.
// Lines "priority: P0" and "type: functional" set metadata; rest = body.
export function parseMdTestCases(text: string): ImportedTestCase[] {
  const lines = text.split(/\r?\n/);
  const sections: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      if (current) sections.push(current);
      current = { title: headingMatch[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);

  if (sections.length === 0) throw new Error("No headings found (use ## Heading per test case)");

  const out: ImportedTestCase[] = [];
  for (const section of sections) {
    const title = section.title;
    if (!title) continue;

    let priority: Priority = "P1";
    let type: TestType = "functional";
    const bodyLines: string[] = [];

    for (const ln of section.lines) {
      const priMatch = ln.match(/^priority:\s*(.+)/i);
      if (priMatch) { priority = safePriority(priMatch[1]); continue; }
      const typeMatch = ln.match(/^type:\s*(.+)/i);
      if (typeMatch) { type = safeType(typeMatch[1]); continue; }
      bodyLines.push(ln);
    }

    const body = bodyLines.join("\n").trim();
    out.push({ title, body, priority, type });
  }
  return out;
}

// ── Script import ─────────────────────────────────────────────────────────────
export type ImportedScript = {
  name: string;
  body: string;
};

export function parseScriptFile(filename: string, text: string): ImportedScript {
  const name = filename.replace(/\.(ts|js|mts|mjs|cjs|cts)$/i, "").trim() || filename;
  const body = text.trim();
  if (!body) throw new Error("File is empty");
  return { name, body };
}
