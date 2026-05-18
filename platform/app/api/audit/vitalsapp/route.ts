import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { NextResponse } from "next/server";
import { findingsToScript } from "@/lib/audit-sources";
import {
  analyzeSources,
  type AnalyzedFile,
} from "@/lib/swift-analyzer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_DIR = path.join(os.homedir(), "Desktop", "VitalsApp", "VitalsApp");

export async function GET() {
  try {
    const entries = await fs.readdir(SOURCE_DIR, { withFileTypes: true });
    const swiftEntries = entries.filter(
      (e) => e.isFile() && e.name.endsWith(".swift")
    );

    if (swiftEntries.length === 0) {
      return NextResponse.json(
        { error: `No .swift files found at ${SOURCE_DIR}` },
        { status: 404 }
      );
    }

    const files: AnalyzedFile[] = await Promise.all(
      swiftEntries.map(async (e) => {
        const fullPath = path.join(SOURCE_DIR, e.name);
        const content = await fs.readFile(fullPath, "utf8");
        return { path: fullPath, name: e.name, content };
      })
    );

    const byFile = analyzeSources(files);
    const script = findingsToScript("VitalsApp · live", byFile);

    return NextResponse.json({
      script,
      meta: {
        filesScanned: files.length,
        sourceDir: SOURCE_DIR,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Audit failed: ${message}` },
      { status: 500 }
    );
  }
}
