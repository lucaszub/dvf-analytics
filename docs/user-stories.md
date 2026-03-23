# User Stories — DVF Analytics Bretagne

> Backlog produit du projet. Organisé par épique. Chaque story suit le format : **En tant que** / **je veux** / **afin de** + critères d'acceptance.

---

## ÉPIQUE 1 — Pipeline Data

### US-01 — Ingestion DVF Bretagne

**En tant que** data engineer, **je veux** lancer `ingest.py` en une commande pour télécharger et charger les données DVF Bretagne + GeoJSON communes dans ClickHouse, **afin d'** avoir une base bronze reproductible et idempotente.

> ✅ Script idempotent (pas de doublon si relancé)
> ✅ Tables `raw_dvf` et `raw_communes` chargées
> ✅ Logs structurés : département / année / nb lignes

---

### US-02 — Nettoyage et typage silver

**En tant que** data engineer, **je veux** que les modèles dbt silver nettoient et typent les données DVF, **afin d'** éliminer les transactions aberrantes et d'enrichir chaque ligne avec le code commune INSEE.

> ✅ `prix > 0`, `surface > 0`, code commune valide
> ✅ Taux de jointure géo > 95%
> ✅ `type_local` restreint à Appartement / Maison
> ✅ Outliers filtrés : `prix_m2` entre 100 et 50 000 €

---

### US-03 — Modèles gold avec agrégations

**En tant que** data engineer, **je veux** des modèles gold avec les agrégations suivantes, **afin d'** exposer des métriques fiables prêtes à l'emploi :

```
mart_prix_commune
  code_commune, nom_commune, departement
  prix_median_m2
  prix_moyen_m2
  nb_transactions
  evolution_pct_n1

mart_prix_departement
  code_dept, nom_dept
  prix_median_m2_regional
  nb_transactions
  commune_plus_chere (nom + prix)
  commune_moins_chere (nom + prix)
  evolution_pct_n1

mart_prix_bretagne
  prix_median_m2_bretagne
  nb_transactions_total
  annee
```

> ✅ Médiane calculée via `quantile(0.5)` ClickHouse
> ✅ Évolution N-1 non nulle sur années 2019+
> ✅ Toutes les agrégations couvertes par des tests dbt

---

## ÉPIQUE 2 — Qualité & Engineering

### US-04 — Tests dbt intégrité

**En tant que** data engineer, **je veux** que tous les modèles dbt aient des tests `not_null`, `unique` et `relationships`, **afin de** garantir l'intégrité des données à chaque run.

> ✅ Clés primaires testées sur bronze, silver, gold
> ✅ Relations silver → gold vérifiées
> ✅ Tests custom : prix cohérents, surface non nulle

---

### US-05 — Lint SQL automatique

**En tant que** reviewer technique CGI, **je veux** que SQLFluff soit configuré en pre-commit hook, **afin de** garantir un style SQL uniforme sur tout le repo sans intervention manuelle.

> ✅ `.sqlfluff` configuré dialect ClickHouse
> ✅ Pre-commit bloque si violation de style

---

### US-06 — GitLab CI

**En tant que** membre de l'équipe, **je veux** qu'un pipeline GitLab CI lance `dbt build` + `dbt test` à chaque push sur `main`, **afin que** toute régression soit détectée automatiquement.

> ✅ `.gitlab-ci.yml` opérationnel
> ✅ Pipeline visible dans l'interface GitLab
> ✅ Échec si un test dbt ne passe pas

---

## ÉPIQUE 3 — API

### US-07 — Endpoints FastAPI

**En tant que** développeur front, **je veux** une API FastAPI exposant les tables gold avec les endpoints suivants, **afin de** consommer les données sans accès direct à ClickHouse :

```
GET /communes?dept=35&type=appartement&annee=2023
GET /departements
GET /bretagne/kpis
```

> ✅ **Swagger auto-généré** accessible sur `/docs`
> ✅ Réponse < 200ms sur requêtes filtrées
> ✅ CORS configuré pour le frontend local

---

## ÉPIQUE 4 — Visualisation Carte

### US-08 — Carte choroplèthe au chargement

**En tant qu'** analyste, **je veux** voir une carte choroplèthe Bretagne au chargement colorée par prix médian au m² par commune, **afin d'** avoir immédiatement une lecture spatiale du marché.

> ✅ Vue initiale : Bretagne entière, 4 départements visibles
> ✅ Dégradé de couleur cohérent (bas → haut prix)
> ✅ Chargement < 2s

---

### US-09 — Filtres dynamiques

**En tant qu'** analyste, **je veux** filtrer par département, type de bien (appartement / maison) et année, **afin de** comparer des sous-marchés précis.

> ✅ Filtres se reflètent immédiatement sur la carte
> ✅ Combinaison possible des 3 filtres
> ✅ Remise à zéro possible

---

### US-10 — Tooltip commune

**En tant qu'** analyste, **je veux** un tooltip au survol d'une commune affichant prix médian, volume de transactions et évolution N-1, **afin d'** avoir le détail sans quitter la carte.

> ✅ Tooltip positionné sans déborder de l'écran
> ✅ Évolution affichée avec signe +/- et couleur verte/rouge

---

### US-11 — Panneau KPIs

**En tant qu'** analyste, **je veux** un panneau KPIs visible à côté de la carte, **afin d'** avoir une synthèse régionale en un coup d'œil.

```
Prix médian Bretagne au m²
Prix médian département sélectionné
Commune la plus chère (nom + prix)
Commune la moins chère (nom + prix)
Volume total de transactions
```

> ✅ Se met à jour dynamiquement selon les filtres actifs
> ✅ Affiche l'année sélectionnée

---

## ÉPIQUE 5 — IA & Vitesse de Dev

### US-12 — SPEC.md avant le code

**En tant que** reviewer technique CGI, **je veux** un `SPEC.md` dans le repo qui décrit l'architecture avant tout code, **afin de** comprendre que le projet a été pensé en amont et pas développé à l'aveugle.

> ✅ `SPEC.md` committé avant tout autre fichier de code
> ✅ Contient : stack, structure repo, schémas de données, endpoints API

---

### US-13 — Section README workflow Claude Code

**En tant que** participant à l'atelier CGI, **je veux** une section `README` dédiée qui documente le workflow Claude Code utilisé, **afin d'** illustrer concrètement un dev IA-assisté sur un projet data.

```
Section README attendue :
- Commandes Claude Code utilisées
- Gains de temps estimés par étape
- What worked / what didn't
- Date premier commit → démo (vélocité réelle)
```

> ✅ Section présente dans le README à la racine du repo
> ✅ Honnête sur les limites (pas du marketing)
