# DVF Analytics — Pipeline Data Bretagne | Portfolio CGI

## Business Case

La Demande de Valeur Foncière (DVF) est un jeu de données public publié par la DGFiP, recensant l'ensemble des transactions immobilières en France depuis 2018. Ce projet construit un pipeline de données analytiques complet sur ce dataset, en local, avec des outils open-source — et démontre comment la même architecture se déploie nativement sur **Snowflake** en contexte client.

> **Objectif** : prouver qu'un pipeline data de niveau production — testé, documenté, versionné — peut être livré rapidement avec les bons outils et les bonnes pratiques, jusqu'à une visualisation cartographique interactive. Ce projet sert de **démonstrateur technique** pour un atelier interne CGI.

---

## Contexte & Pertinence

### Pourquoi DVF ?

- Données publiques, réelles, volumineuses (~10M transactions sur la période)
- Problématiques concrètes : qualité de données, jointures géographiques, agrégations hiérarchiques
- Sujet parlant pour n'importe quel interlocuteur (immobilier, territoires, décision publique)
- Directement transposable à des cas clients CGI (collectivités, DGITM, data publique)

### Pourquoi Bretagne ?

- Périmètre maîtrisé (~200k transactions) pour une démo rapide et propre
- Hiérarchie géographique complète : **Bretagne → 4 départements → communes → codes postaux**
- Suffisant pour illustrer toutes les transformations sans surcharger la démo

### Transférabilité Snowflake

Toute la couche de transformation est écrite en **dbt**. Passer de ClickHouse à Snowflake = changer le profil de connexion dans `profiles.yml`. La logique SQL, les tests, la documentation — tout est identique.

```
Local (ClickHouse)  ──▶  même dbt project  ──▶  Prod (Snowflake / BigQuery / Redshift)
```

---

## Architecture Technique

### Stack

| Couche | Outil | Rôle |
|---|---|---|
| Ingestion | Script Python | Téléchargement DVF + COG INSEE, chargement ClickHouse |
| Stockage | ClickHouse (Docker) | Moteur OLAP columnar, analogue à Snowflake |
| Transformation | dbt-clickhouse | Medallion architecture, tests, documentation |
| Qualité | SQLFluff + pre-commit | Lint SQL automatique |
| CI | GitLab CI | dbt build + tests à chaque push |
| API données | FastAPI | Exposition des agrégats gold vers le front |
| Visualisation | Frontend custom (React + Deck.gl) | Carte choroplèthe interactive, filtres dynamiques |

### Schéma de Pipeline

```
[data.gouv.fr — DVF CSV]  +  [INSEE COG — GeoJSON communes]
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
            │
            ▼  FastAPI
    ┌───────────────────┐
    │   Frontend React  │
    │   + Deck.gl       │  Carte choroplèthe interactive
    │                   │  Filtres : dept / type / année
    └───────────────────┘
```

### Medallion Architecture

**Bronze** — données brutes chargées telles quelles depuis la source officielle, sans transformation.

**Silver** — nettoyage, typage fort, jointure géographique avec le Code Officiel Géographique INSEE. C'est ici qu'on élimine les outliers, qu'on standardise les types de biens, et qu'on enrichit chaque transaction avec ses coordonnées.

**Gold** — modèles analytiques prêts à la consommation : prix médian par commune, par département, évolution annuelle, volume de transactions. Ces tables sont exposées via FastAPI et consommées par le frontend.

---

## Bonnes Pratiques Démontrées

### Qualité de données — Tests dbt

- `not_null` et `unique` sur toutes les clés
- `relationships` entre les couches (silver → gold)
- Tests custom : prix cohérents (> 0), surface non nulle, code commune valide

### Documentation auto-générée

Chaque modèle dbt dispose d'une description, chaque colonne est documentée dans le `schema.yml`. Le `dbt docs generate` produit un site de documentation navigable — équivalent d'un Data Catalog léger.

### Lint SQL — SQLFluff

Règle de style SQL uniforme appliquée via pre-commit hook. Chaque commit valide automatiquement la cohérence syntaxique des modèles.

### CI/CD — GitLab CI

À chaque push sur `main` : dbt build complet + tous les tests. Pipeline visible, traçable, reproductible par n'importe quel membre de l'équipe.

---

## Analyse Géographique

### Hiérarchie des granularités

```
France
  └── Bretagne
        ├── Côtes-d'Armor (22)
        ├── Finistère (29)
        ├── Ille-et-Vilaine (35)   ← focus Rennes
        └── Morbihan (56)
              └── Communes
                    └── Codes postaux
```

### Indicateurs clés affichés sur la carte

- **Prix médian au m²** par commune (couleur choroplèthe)
- **Volume de transactions** par département et par année
- **Évolution annuelle** des prix (2018 → 2024)
- **Distribution des types de biens** : appartements vs maisons
- **Spread prix** : écart entre les communes les moins et les plus chères

---

## Roadmap Projet

### Étape 1 — Infrastructure & Ingestion

- Setup ClickHouse via Docker Compose
- Script `ingest.py` : téléchargement + chargement bronze
- Chargement COG INSEE communes + GeoJSON
- Modèles bronze validés

### Étape 2 — Transformation dbt

- Modèles silver : nettoyage, typage, jointure géo
- Modèles gold : agrégats prix commune + département
- Tests dbt complets
- Documentation `schema.yml`

### Étape 3 — API & Visualisation

- FastAPI : endpoints gold → JSON consommable par le front
- Frontend React : carte choroplèthe + filtres dynamiques
- GitLab CI opérationnel
- `SPEC.md` + `README.md` finalisés

---

## Ce que ce projet démontre

> Pour un profil **Data Engineer / Solution Architect**, ce projet illustre la capacité à :
> - Concevoir une architecture data de bout en bout (ingestion → transformation → API → frontend)
> - Appliquer les standards production dès le développement local
> - Rendre le pipeline reproductible et transférable (cloud-agnostic via dbt)
> - Documenter et tester rigoureusement chaque couche de transformation
> - Livrer un résultat visuel concret et interactif sur des données réelles et publiques

---

## Liens

- GitLab : *à renseigner*
- Dashboard carte : *à renseigner après déploiement*
- dbt Docs : *à renseigner*

## Pages du projet

- [SPEC.md](./SPEC.md)
- [User Stories](./user-stories.md)
- [Prompt Maquette Frontend](./prompt-maquette-frontend.md)
- [Base de code Frontend](./base-code-frontend.md)
