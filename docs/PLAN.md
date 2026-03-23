# Plan de build — DVF Analytics

> Chaque étape doit être **validée avant de passer à la suivante**.
> On ne code pas l'étape N+1 si l'étape N ne tourne pas.

---

## Vue d'ensemble

```
Étape 1 → ClickHouse tourne dans Docker
Étape 2 → ingest.py charge les données (bronze ok)
Étape 3 → dbt transforme (silver + gold ok)
Étape 4 → FastAPI expose les endpoints
Étape 5 → Frontend React affiche la carte
Étape 6 → Tout s'enchaîne avec docker compose up
```

---

## Étape 1 — ClickHouse dans Docker

**Ce qu'on fait :**
- `docker-compose.yml` minimaliste avec uniquement le service `clickhouse`
- Healthcheck configuré
- Volume persistant

**Critère de validation :**
```bash
docker compose up -d clickhouse
curl http://localhost:8123/ping
# → "Ok."
```

**On s'arrête là et on valide ensemble.**

---

## Étape 2 — Ingestion (bronze)

**Ce qu'on fait :**
- Script `ingestion/ingest.py` + `config.py` + `requirements.txt`
- Crée les tables `bronze.raw_dvf` et `bronze.raw_communes` dans ClickHouse
- Télécharge les CSV DVF (22, 29, 35, 56 × 2018-2024) et le GeoJSON communes
- Idempotent
- `Dockerfile` pour le service `ingest`

**Critère de validation :**
```bash
docker compose up ingest
# → logs : [INFO] Chargement 35/2023 — 28 432 lignes ...
# → [INFO] Ingestion terminée. raw_dvf: ~200k lignes, raw_communes: ~xxx lignes

# Vérification directe :
curl "http://localhost:8123/?query=SELECT+count()+FROM+bronze.raw_dvf"
# → ~200000
```

**On s'arrête là et on valide ensemble.**

---

## Étape 3 — Transformations dbt (silver + gold)

**Ce qu'on fait :**
- Projet dbt complet : `dbt_project.yml`, `profiles.yml`, `.sqlfluff`
- Modèles silver : `stg_dvf.sql`, `stg_communes.sql` + `schema.yml` avec tests
- Modèles gold : `mart_prix_commune.sql`, `mart_prix_departement.sql`, `mart_prix_bretagne.sql`
- `Dockerfile` pour le service `dbt`

**Critère de validation :**
```bash
docker compose up dbt
# → dbt run : OK (6 models)
# → dbt test : OK (x tests passed)

# Vérification :
curl "http://localhost:8123/?query=SELECT+count()+FROM+gold.mart_prix_commune"
# → quelques milliers de lignes (commune × année × type)
```

**On s'arrête là et on valide ensemble.**

---

## Étape 4 — API FastAPI

**Ce qu'on fait :**
- `api/main.py` + routers `communes.py`, `departements.py`, `kpis.py`
- Connexion à ClickHouse via `clickhouse-driver`
- Endpoints : `GET /communes`, `GET /departements`, `GET /bretagne/kpis`, `GET /bretagne/historique`
- CORS configuré pour `localhost:5173`
- `Dockerfile` pour le service `api`

**Critère de validation :**
```bash
docker compose up api
# → Swagger dispo sur http://localhost:8000/docs

curl "http://localhost:8000/communes?dept=35&annee=2023" | head
# → JSON avec pricePerSqm, transactions, coordinates...

curl "http://localhost:8000/bretagne/kpis"
# → { prix_median_bretagne: ..., nb_transactions_total: ... }
```

**On s'arrête là et on valide ensemble.**

---

## Étape 5 — Frontend React

**Ce qu'on fait :**
- Récupération et adaptation du code v0.dev (cf. `base-code-frontend.md`)
- Remplacement des données mock par les vrais appels `fetch` vers FastAPI
- Build Vite → assets statiques
- `Dockerfile` multi-stage : build Vite → nginx serve
- Configuration nginx

**Critère de validation :**
```bash
docker compose up frontend
# → http://localhost:5173 → carte Bretagne qui s'affiche
# → Filtres fonctionnels (département / type / année)
# → Tooltip au survol
# → KPIs qui changent selon les filtres
```

**On s'arrête là et on valide ensemble.**

---

## Étape 6 — Intégration finale `docker compose up`

**Ce qu'on fait :**
- `docker-compose.yml` complet avec tous les services et les `depends_on`
- Test du démarrage propre depuis zéro (volume supprimé)
- `README.md` final avec juste les 2 commandes nécessaires

**Critère de validation :**
```bash
docker compose down -v      # reset complet
docker compose up           # tout depuis zéro

# Après ~5 minutes :
# → http://localhost:5173 fonctionne
# → Les données sont réelles (pas de mock)
# → Relancer docker compose up une 2ème fois = démarrage instantané (données déjà là)
```

**Livrable validé.**

---

## Ce qu'on ne fait PAS (dans ce sprint)

- GitLab CI (hors scope démo locale)
- SQLFluff pre-commit (optionnel, peut être ajouté ensuite)
- Déploiement cloud
- Authentification
- Tests unitaires Python
