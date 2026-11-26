FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-pip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY crawler/requirements.txt ./crawler/requirements.txt
RUN python3 -m venv /app/.venv && /app/.venv/bin/pip install --no-cache-dir -r crawler/requirements.txt

COPY web/package.json web/package-lock.json ./web/
RUN npm --prefix web ci

COPY . .

RUN npm --prefix web run build

EXPOSE 3000
ENV PORT=3000
ENV TALENT_DB_PATH=/app/data/talent_insight.db

CMD ["sh", "-c", "if [ ! -f /app/data/talent_insight.db ]; then PYTHONPATH=/app/crawler /app/.venv/bin/python -m talent_crawler.cli init-live || PYTHONPATH=/app/crawler /app/.venv/bin/python -m talent_crawler.cli seed --reset; fi && npm --prefix web run start -- -H 0.0.0.0 -p 3000"]
