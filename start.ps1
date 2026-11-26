$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "=== TalentInsight Vietnam — Local Setup & Launcher (Windows) ===" -ForegroundColor Cyan

# 1. Check Node.js >= 22
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js 22+ is required. Install from https://nodejs.org/"
    exit 1
}
$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 22) {
    Write-Error "Found Node.js $(node -v). Please install Node.js 22+ (required for built-in SQLite)."
    exit 1
}

# 2. Check Python 3
$pyCmd = if (Get-Command python -ErrorAction SilentlyContinue) { "python" } elseif (Get-Command py -ErrorAction SilentlyContinue) { "py -3" } else { "" }
if (-not $pyCmd) {
    Write-Error "Python 3.10+ is required. Install from https://www.python.org/"
    exit 1
}

# 3. Create .venv & install crawler dependencies
if (-not (Test-Path ".venv")) {
    Write-Host "[1/4] Creating Python virtual environment (.venv)..."
    Invoke-Expression "$pyCmd -m venv .venv"
}
Write-Host "[2/4] Installing Python crawler dependencies..."
& .\.venv\Scripts\pip.exe install -q -r crawler\requirements.txt

# 4. Install web dependencies
if (-not (Test-Path "web\node_modules")) {
    Write-Host "[3/4] Installing Next.js web dependencies..."
    npm --prefix web install
} else {
    Write-Host "[3/4] Web dependencies already installed."
}

# 5. Initialize SQLite DB with live Vietnam crawl if missing
if (-not (Test-Path "data\talent_insight.db")) {
    Write-Host "[4/4] Crawling 100% live Vietnam jobs & news into data\talent_insight.db (~30-60s)..."
    $env:PYTHONPATH = "crawler"
    try {
        & .\.venv\Scripts\python.exe -m talent_crawler.cli init-live
    } catch {
        Write-Warning "Live crawl failed; falling back to local demo seed..."
        & .\.venv\Scripts\python.exe -m talent_crawler.cli seed --reset
    }
} else {
    Write-Host "[4/4] Found existing data\talent_insight.db."
}

$port = if ($env:PORT) { $env:PORT } else { "3000" }
Write-Host ""
Write-Host "Starting TalentInsight Vietnam locally on port $port..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop."
npm --prefix web run dev -- -p $port
