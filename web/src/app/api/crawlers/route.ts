import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { getCrawlerStatus, getDbPath } from "@/lib/db";
import { getRepoRoot, resolvePythonBin } from "@/lib/python";

const execFileAsync = promisify(execFile);

const ALLOWED_SOURCES = new Set([
  "all",
  "company_ats",
  "topdev",
  "itviec",
  "vietnamworks",
  "careerviet",
  "careerlink",
  "vn_news_rss",
]);

export async function GET() {
  return NextResponse.json(getCrawlerStatus());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const source = String(body?.source || "vn_news_rss");
    const limit = Math.min(Math.max(Number(body?.limit || 5), 1), 30);

    if (!ALLOWED_SOURCES.has(source)) {
      return NextResponse.json({ error: `Unsupported crawler source: ${source}` }, { status: 400 });
    }

    const repoRoot = getRepoRoot();
    const pythonBin = resolvePythonBin(repoRoot);
    const crawlerDir = path.join(repoRoot, "crawler");
    const dbPath = getDbPath();

    const { stdout, stderr } = await execFileAsync(
      pythonBin,
      ["-m", "talent_crawler.cli", "--db", dbPath, "crawl", "--source", source, "--limit", String(limit)],
      {
        cwd: repoRoot,
        env: { ...process.env, PYTHONPATH: crawlerDir },
        timeout: 45_000,
      }
    );

    let parsed: unknown = [];
    try {
      parsed = JSON.parse(stdout);
    } catch {
      parsed = { raw: stdout, stderr };
    }

    return NextResponse.json({ results: parsed, status: getCrawlerStatus() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Crawler execution failed";
    return NextResponse.json({ error: msg, status: getCrawlerStatus() }, { status: 500 });
  }
}
