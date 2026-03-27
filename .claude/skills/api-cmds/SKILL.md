---
name: api-cmds
description: Commandes de développement et test de l'API FastAPI
paths: ["api/**"]
---

# Commandes API

```bash
# Dev via Docker
docker compose up api
docker compose build api && docker compose up api

# Tests
docker compose run --rm api pytest

# Smoke tests endpoints
curl "http://localhost:8000/communes/?dept=35&annee=2023" | python3 -m json.tool | head -20
curl "http://localhost:8000/departements/?annee=2023"
curl "http://localhost:8000/bretagne/kpis?annee=2023"
curl "http://localhost:8000/communes/35238/sections?annee=2023" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d['features']),'features')"
curl "http://localhost:8000/sections/35238000AB/parcelles?annee=2023" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d['features']),'features')"
curl "http://localhost:8000/parcelles/35238000AB0005/mutations"

# Swagger
open http://localhost:8000/docs
```
