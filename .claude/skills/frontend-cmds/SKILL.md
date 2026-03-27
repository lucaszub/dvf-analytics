---
name: frontend-cmds
description: Commandes de développement frontend React/Vite
paths: ["frontend/**"]
---

# Commandes Frontend

```bash
# Dev local (hors Docker)
cd frontend && npm install
cd frontend && npm run dev        # Vite → http://localhost:5173

# Build production
cd frontend && npm run build

# Via Docker
docker compose up frontend
docker compose build frontend && docker compose up frontend

# Tester les endpoints API utilisés par le frontend
curl "http://localhost:8000/communes/?dept=35&annee=2023"
curl "http://localhost:8000/communes/35238/sections?annee=2023"
curl "http://localhost:8000/sections/35238000AB/parcelles?annee=2023"
curl "http://localhost:8000/parcelles/35238000AB0005/mutations"
curl "http://localhost:8000/bretagne/kpis"
curl "http://localhost:8000/bretagne/historique"
```
