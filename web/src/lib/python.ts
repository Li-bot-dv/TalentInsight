import fs from "node:fs";
import path from "node:path";

export function getRepoRoot(): string {
  return path.resolve(process.cwd(), "..");
}

export function resolvePythonBin(repoRoot: string = getRepoRoot()): string {
  const candidates =
    process.platform === "win32"
      ? [
          path.join(repoRoot, ".venv", "Scripts", "python.exe"),
          path.join(repoRoot, "venv", "Scripts", "python.exe"),
        ]
      : [
          path.join(repoRoot, ".venv", "bin", "python"),
          path.join(repoRoot, ".venv", "bin", "python3"),
          path.join(repoRoot, "venv", "bin", "python"),
        ];

  for (const bin of candidates) {
    if (fs.existsSync(/*turbopackIgnore: true*/ bin)) return bin;
  }
  return process.platform === "win32" ? "python" : "python3";
}
