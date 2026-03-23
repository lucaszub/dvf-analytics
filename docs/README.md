# DVF Analytics — Pipeline Data Bretagne

## Objectif

Ce projet est un terrain d'apprentissage pratique autour de la **data engineering** et de l'**IA appliquée au développement**. Il s'appuie sur un dataset public réel pour construire un pipeline de bout en bout — de l'ingestion brute jusqu'à la visualisation — en utilisant des outils open-source proches de ce qu'on retrouve en contexte professionnel.

L'idée n'est pas de livrer un produit fini, mais d'**apprendre en faisant** : comprendre comment les couches d'un pipeline data s'articulent, comment l'IA peut accélérer chaque étape, et comment les bonnes pratiques (tests, documentation, linting, CI) se mettent concrètement en place.

---

## Dataset — Pourquoi DVF ?

La Demande de Valeur Foncière (DVF) est un jeu de données public publié par la DGFiP, recensant l'ensemble des transactions immobilières en France depuis 2018.

- Données réelles, volumineuses (~10M transactions nationales)
- Problématiques concrètes : qualité de données, jointures géographiques, agrégations hiérarchiques
- Périmètre Bretagne choisi pour rester maîtrisable (~354k transactions, 4 départements)

---

## Ce qu'on apprend ici

### Data Engineering

- Construire un pipeline **medallion** (Bronze → Silver → Gold) sur des données réelles
- Utiliser **dbt** pour la transformation : modèles SQL testés, documentés, versionnés
- Orchestrer des services avec **Docker Compose** (ClickHouse, ingestion, API, frontend)
- Comprendre **ClickHouse** comme moteur OLAP columnar (analogue à Snowflake/BigQuery)
- Appliquer les standards qualité dès le local : tests dbt, SQLFluff, CI/CD

### IA & Dev Velocity

- Utiliser **Claude** (via Claude Code) comme copilote sur l'ensemble du projet : génération de modèles dbt, endpoints FastAPI, composants React, tests
- Travailler avec un **SPEC.md comme source de vérité** — écrire la spec d'abord, coder ensuite avec l'IA
- Comprendre comment bien prompter pour obtenir du code production-ready (contexte, contraintes, exemples)
- Mesurer ce que l'IA accélère réellement et où elle crée de la dette technique si mal utilisée

---

## Architecture Technique

### Stack

| Couche | Outil | Rôle |
|---|---|---|
| Ingestion | Python | Téléchargement DVF + GeoJSON communes, chargement ClickHouse |
| Stockage | ClickHouse (Docker) | Moteur OLAP columnar |
| Transformation | dbt-clickhouse | Medallion architecture, tests, documentation |
| Qualité SQL | SQLFluff + pre-commit | Lint automatique sur commit |
| CI | GitLab CI | dbt build + tests à chaque push |
| API | FastAPI | Exposition des agrégats gold |
| Visualisation | React + Deck.gl + Recharts | Carte interactive, filtres dynamiques |

### Pipeline

```
[data.gouv.fr — DVF CSV]  +  [geo.api.gouv.fr — GeoJSON communes]
            │
            ▼  python ingest.py
    ┌───────────────────┐
    │    ClickHouse     │
    │     (bronze)      │  raw_dvf, raw_communes
    └───────┬───────────┘
            │  dbt run
            ▼
    ┌───────────────────┐
    │      silver       │  stg_dvf (nettoyé, typé)
    │                   │  stg_communes (geo enrichi)
    └───────┬───────────┘
            │  dbt run
            ▼
    ┌───────────────────┐
    │       gold        │  mart_prix_commune
    │                   │  mart_prix_departement
    │                   │  mart_evolution_annuelle
    └───────┬───────────┘
            │  FastAPI
            ▼
    ┌───────────────────┐
    │   Frontend React  │  Carte choroplèthe + filtres dept / type / année
    └───────────────────┘
```

### Medallion Architecture

**Bronze** — données brutes chargées telles quelles depuis la source, sans transformation.

**Silver** — nettoyage, typage fort, jointure géographique. Élimination des outliers, standardisation des types de biens, enrichissement avec coordonnées GPS.

**Gold** — agrégats prêts à consommer : prix médian par commune, par département, évolution annuelle. Exposés via FastAPI, consommés par le frontend.

### Transférabilité cloud

Toute la couche de transformation est en **dbt**. Passer de ClickHouse à Snowflake = changer le profil de connexion dans `profiles.yml`. La logique SQL, les tests, la documentation — tout est identique.

```
Local (ClickHouse)  ──▶  même dbt project  ──▶  Prod (Snowflake / BigQuery / Redshift)
```

---

## Roadmap

### Étape 1 — Infrastructure & Ingestion ✅
- ClickHouse via Docker Compose
- Script `ingest.py` : téléchargement + chargement bronze
- Bronze validé (~354k lignes)

### Étape 2 — Transformation dbt
- Modèles silver : nettoyage, typage, jointure géo
- Modèles gold : agrégats prix commune + département
- Tests dbt + documentation `schema.yml`

### Étape 3 — API & Visualisation
- FastAPI : endpoints gold → JSON
- Frontend React : carte + filtres dynamiques
- GitLab CI opérationnel

---

## Pages du projet

- [SPEC.md](./SPEC.md) — spécification technique complète
- [PLAN.md](./PLAN.md) — roadmap détaillée par étape
- [User Stories](./user-stories.md)
- [Base de code Frontend](./base-code-frontend.md)
- [Prompt Maquette Frontend](./prompt-maquette-frontend.md)



