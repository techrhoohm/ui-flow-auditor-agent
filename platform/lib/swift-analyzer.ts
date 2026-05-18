import type { Severity } from "./audit-script";

export type RuleId =
  | "icon-button-needs-label"
  | "theme-bypass-color"
  | "destructive-proximity"
  | "force-unwrap"
  | "magic-padding-spread"
  | "missing-empty-state"
  | "tap-target-too-small"
  | "inline-color-literal"
  | "long-view-file";

export type RuleFinding = {
  rule: RuleId;
  severity: Severity;
  message: string;
  line: number;
};

export type AnalyzedFile = {
  path: string;
  name: string;
  content: string;
};

const DIRECT_COLORS = [
  "red",
  "blue",
  "green",
  "orange",
  "yellow",
  "pink",
  "purple",
  "gray",
  "black",
];

const isThemeFile = (name: string) => name === "Theme.swift";

const lineOf = (content: string, index: number) =>
  content.slice(0, index).split("\n").length;

export function analyzeFile(
  file: AnalyzedFile
): RuleFinding[] {
  const findings: RuleFinding[] = [];
  const { content, name } = file;
  const lines = content.split("\n");

  // 1. icon-button-needs-label
  if (!isThemeFile(name)) {
    const sysImage = (content.match(/Image\(systemName:/g) ?? []).length;
    const a11y = (content.match(/\.accessibilityLabel\(/g) ?? []).length;
    if (sysImage > a11y) {
      const firstIdx = content.indexOf("Image(systemName:");
      findings.push({
        rule: "icon-button-needs-label",
        severity: "medium",
        message: `${sysImage - a11y} icon image${
          sysImage - a11y > 1 ? "s" : ""
        } in ${name} lack .accessibilityLabel(). VoiceOver users hear nothing useful.`,
        line: firstIdx >= 0 ? lineOf(content, firstIdx) : 1,
      });
    }
  }

  // 2. theme-bypass-color
  if (!isThemeFile(name)) {
    for (const c of DIRECT_COLORS) {
      const re = new RegExp(`Color\\.${c}\\b`, "g");
      const m = re.exec(content);
      if (m) {
        findings.push({
          rule: "theme-bypass-color",
          severity: "low",
          message: `Direct Color.${c} bypasses the design system. Add a token in Theme.swift.`,
          line: lineOf(content, m.index),
        });
        break;
      }
    }
  }

  // 3. destructive-proximity
  if (/Sign\s*Out/i.test(content) && /Delete|Remove/i.test(content)) {
    const idx = content.search(/Sign\s*Out/i);
    findings.push({
      rule: "destructive-proximity",
      severity: "high",
      message:
        "Sign Out and a destructive action coexist in this view. Visually separate them or move destructive flow behind a confirmation.",
      line: idx >= 0 ? lineOf(content, idx) : 1,
    });
  }

  // 4. force-unwrap
  const forceTry = /\btry!\s/.exec(content);
  const forceUnwrap = /[A-Za-z_][A-Za-z0-9_]*!\.[A-Za-z_]/.exec(content);
  const hit = forceTry ?? forceUnwrap;
  if (hit) {
    findings.push({
      rule: "force-unwrap",
      severity: "high",
      message: `Force-unwrap detected ("${hit[0].trim()}"). One nil and the screen crashes — guard with if let / try?.`,
      line: lineOf(content, hit.index),
    });
  }

  // 5. magic-padding-spread
  if (!isThemeFile(name)) {
    const paddingValues = new Set<number>();
    let firstPaddingLine = 1;
    const re = /\.padding\(\s*(?:\.[a-z]+\s*,\s*)?([0-9]+)\s*\)/g;
    let m: RegExpExecArray | null;
    let first = true;
    while ((m = re.exec(content))) {
      paddingValues.add(Number(m[1]));
      if (first) {
        firstPaddingLine = lineOf(content, m.index);
        first = false;
      }
    }
    if (paddingValues.size >= 6) {
      findings.push({
        rule: "magic-padding-spread",
        severity: "low",
        message: `${paddingValues.size} distinct padding values in this view. Pick a spacing scale (4/8/12/16/24) and stick to it.`,
        line: firstPaddingLine,
      });
    }
  }

  // 6. missing-empty-state
  if (!isThemeFile(name)) {
    const forEachMatches = [...content.matchAll(/ForEach\(/g)];
    let flagged = false;
    for (const fm of forEachMatches) {
      const ln = lineOf(content, fm.index!);
      const before = lines.slice(Math.max(0, ln - 8), ln).join("\n");
      if (!/isEmpty|\bcount\s*==\s*0\b/.test(before)) {
        if (!flagged) {
          findings.push({
            rule: "missing-empty-state",
            severity: "medium",
            message:
              "ForEach renders without a nearby empty-state guard. Empty data shows an empty axis or blank list.",
            line: ln,
          });
          flagged = true;
        }
      }
    }
  }

  // 7. tap-target-too-small
  const sysImageMatches = [...content.matchAll(/Image\(systemName:[^\n]*/g)];
  for (const sm of sysImageMatches) {
    const ln = lineOf(content, sm.index!);
    const window = lines.slice(ln - 1, ln + 6).join("\n");
    const frameMatch = /\.frame\(\s*width:\s*(\d+)\s*,\s*height:\s*(\d+)\s*\)/.exec(
      window
    );
    if (frameMatch) {
      const w = Number(frameMatch[1]);
      const h = Number(frameMatch[2]);
      if (w < 44 || h < 44) {
        findings.push({
          rule: "tap-target-too-small",
          severity: "medium",
          message: `Tappable icon is ${w}×${h}pt — under Apple's 44pt minimum.`,
          line: ln,
        });
        break;
      }
    }
  }

  // 8. inline-color-literal
  if (!isThemeFile(name)) {
    const literal = /Color\(\s*red:\s*[0-9.]+\s*,/g.exec(content);
    if (literal) {
      findings.push({
        rule: "inline-color-literal",
        severity: "medium",
        message:
          "RGB Color(red:green:blue:) literal in a view file. Move it to Theme.swift for reuse and dark-mode parity.",
        line: lineOf(content, literal.index),
      });
    }
  }

  // 9. long-view-file
  if (!isThemeFile(name) && lines.length > 200) {
    findings.push({
      rule: "long-view-file",
      severity: "low",
      message: `${lines.length} lines in one view file. Extract subviews so each tab stays under ~150.`,
      line: 1,
    });
  }

  return findings;
}

export function analyzeSources(files: AnalyzedFile[]): Map<string, RuleFinding[]> {
  const out = new Map<string, RuleFinding[]>();
  for (const f of files) {
    out.set(f.name, analyzeFile(f));
  }
  return out;
}
