#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "=== TalentInsight Vietnam — Local Setup & Launcher ==="

# 1. Verify Node.js >= 22 (required for built-in node:sqlite)
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js 22+ is required. Install from https://nodejs.org/"
  exit 1
fi
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "Error: Found Node.js $(node -v). Please install Node.js 22+ (required for built-in SQLite)."
  exit 1
fi

# 2. Verify Python 3
PYTHON_BIN="$(command -v python3 || command -v python || true)"
if [ -z "$PYTHON_BIN" ]; then
  echo "Error: Python 3.10+ is required. Install from https://www.python.org/"
  exit 1
fi

# 3. Set up Python virtualenv & crawler dependencies
if [ ! -d ".venv" ]; then
  echo "[1/4] Creating Python virtual environment (.venv)..."
  "$PYTHON_BIN" -m venv .venv
fi
echo "[2/4] Installing Python crawler dependencies..."
.venv/bin/pip install -q -r crawler/requirements.txt

# 4. Install Next.js web dependencies
if [ ! -d "web/node_modules" ]; then
  echo "[3/4] Installing Next.js web dependencies..."
  npm --prefix web install
else
  echo "[3/4] Web dependencies already installed."
fi

# 5. Populate SQLite DB with live-crawled Vietnam data if DB does not exist yet
if [ ! -f "data/talent_insight.db" ]; then
  echo "[4/4] Crawling 100% live Vietnam jobs & news into data/talent_insight.db (takes ~30-60s)..."
  if ! PYTHONPATH=crawler .venv/bin/python -m talent_crawler.cli init-live; then
    echo "Live crawl encountered a network error; falling back to local demo baseline seed..."
    PYTHONPATH=crawler .venv/bin/python -m talent_crawler.cli seed --reset
  fi
else
  echo "[4/4] Found existing data/talent_insight.db (run 'npm run crawl:update' anytime to refresh live data)."
fi

PORT="${PORT:-3000}"
echo ""
echo "Starting TalentInsight Vietnam locally on port ${PORT}..."
echo "Press Ctrl+C to stop."
exec npm --prefix web run dev -- -p "$PORT"
