---
name: docker-debug
description: Debug the docker compose stack — check service health, logs, data counts
disable-model-invocation: true
---
Debug the docker compose stack for: $ARGUMENTS

Diagnostic sequence:

```bash
# 1. Service status
docker compose ps

# 2. Recent logs for failing service
docker compose logs <service> --tail=50

# 3. ClickHouse health
curl -s http://localhost:8123/ping

# 4. Data validation
curl -s "http://localhost:8123/?query=SELECT+count()+FROM+bronze.raw_dvf"
curl -s "http://localhost:8123/?query=SELECT+count()+FROM+silver.stg_dvf"
curl -s "http://localhost:8123/?query=SELECT+count()+FROM+gold.mart_prix_commune"

# 5. API health
curl -s http://localhost:8000/health || curl -s http://localhost:8000/docs | head -5

# 6. Full reset (last resort)
docker compose down -v && docker compose up
```

Identify the root cause from logs and fix it. Common issues:
- ClickHouse not ready → check healthcheck, increase retry count in ingest.py
- dbt profile not found → check transform/profiles.yml exists and CLICKHOUSE_HOST env var
- Port conflict → check `docker compose ps` for port bindings
- Volume permissions → check clickhouse-data volume owner

Never delete volumes without user confirmation.
