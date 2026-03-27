---
name: docker-cmds
description: Commandes Docker Compose du projet DVF Analytics
paths: ["**"]
---

# Commandes Docker — DVF Analytics

```bash
# Stack complète
docker compose up

# Services individuels (dans l'ordre)
docker compose up -d clickhouse        # ClickHouse → port 8124
docker compose up ingest               # Bronze — exit quand terminé
docker compose up dbt                  # Silver + Gold — exit quand terminé
docker compose up api                  # FastAPI → port 8000
docker compose up frontend             # React → port 5173

# Reset complet
docker compose down -v && docker compose up

# Rebuild un service
docker compose build <service> && docker compose up <service>

# Validation données
curl "http://localhost:8124/?query=SELECT+count()+FROM+bronze.raw_dvf_geo"
curl "http://localhost:8124/?query=SELECT+count()+FROM+silver.stg_dvf"
curl "http://localhost:8124/?query=SELECT+count()+FROM+gold.mart_prix_section"
curl http://localhost:8000/docs
```
