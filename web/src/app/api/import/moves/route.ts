import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { getDbPath } from "@/lib/db";

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const csvText = String(body?.csv || "").trim();
    if (!csvText) {
      return NextResponse.json({ error: "CSV payload is empty." }, { status: 400 });
    }

    const tmpFile = path.join(os.tmpdir(), `talent_moves_${Date.now()}.csv`);
    fs.writeFileSync(tmpFile, csvText, "utf-8");

    try {
      const repoRoot = path.resolve(process.cwd(), "..");
      const venvPython = path.join(repoRoot, ".venv", "bin", "python");
      const pythonBin = fs.existsSync(venvPython) ? venvPython : "python3";
      const crawlerDir = path.join(repoRoot, "crawler");
      const dbPath = getDbPath();

      const { stdout } = await execFileAsync(
        pythonBin,
        ["-m", "talent_crawler.cli", "--db", dbPath, "import-moves", "--file", tmpFile],
        {
          cwd: repoRoot,
          env: { ...process.env, PYTHONPATH: crawlerDir },
          timeout: 15_000,
        }
      );

      const result = JSON.parse(stdout);
      return NextResponse.json(result);
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "CSV import failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
