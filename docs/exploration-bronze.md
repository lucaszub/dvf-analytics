# Exploration Bronze — Analyse des données DVF Bretagne

> Document généré après exploration directe de `bronze.raw_dvf` et `bronze.raw_communes`.
> Sert de base pour valider l'architecture dbt avant implémentation.

---

## 1. Couverture géographique

**Requête :**
```sql
SELECT
    count()                     AS total,
    countDistinct(code_departement) AS depts,
    countDistinct(code_commune) AS communes,
    countDistinct(code_postal)  AS codes_postaux,
    countDistinct(id_parcelle)  AS parcelles
FROM bronze.raw_dvf
```

**Résultats :**

| Métrique | Valeur |
|----------|--------|
| Lignes totales | 1 175 331 |
| Départements | 4 |
| Communes | 1 206 |
| Codes postaux | 322 |
| Parcelles distinctes | 646 048 |

**Conclusion :** Les 4 niveaux de drill-down sont représentés dans la donnée. Le niveau code postal (322) est pertinent comme zoom intermédiaire entre département et commune.

---

## 2. Qualité des données — valeurs manquantes

**Requête :**
```sql
SELECT
    countIf(id_parcelle = '')       AS parcelle_vide,
    countIf(code_postal = '')       AS cp_vide,
    countIf(longitude = 0)          AS lon_zero,
    countIf(valeur_fonciere = 0)    AS vf_zero,
    countIf(surface_reelle_bati = 0) AS surf_zero,
    count()                         AS total
FROM bronze.raw_dvf
```

**Résultats :**

| Colonne | Vides / Zéros | % |
|---------|--------------|---|
| `id_parcelle` | 0 | 0% ✅ |
| `code_postal` | 8 204 | 0.7% ⚠️ |
| `longitude` = 0 | 24 161 | 2.1% ⚠️ |
| `valeur_fonciere` = 0 | 10 194 | 0.9% |
| `surface_reelle_bati` = 0 | 789 954 | **67%** ❗ |

**Conclusions :**
- `id_parcelle` est toujours présent → on peut s'appuyer dessus
- 67% des lignes n'ont pas de surface bâtie → ce sont des terrains, dépendances, etc. Ils ne peuvent pas avoir de prix/m² et doivent être exclus des marts de prix
- 2% sans coordonnées GPS → ces communes seront invisibles sur la carte (NULL guard nécessaire)
- 0.7% sans code postal → rural isolé, à tolérer

---

## 3. Distribution par type de bien

**Requête :**
```sql
SELECT
    type_local,
    count() AS n
FROM bronze.raw_dvf
GROUP BY type_local
ORDER BY n DESC
```

**Résultats :**

| Type | Transactions | % |
|------|-------------|---|
| *(vide — terrain/non classifié)* | 566 212 | 48% |
| Maison | 238 682 | 20% |
| Dépendance | 221 830 | 19% |
| Appartement | 116 666 | 10% |
| Local industriel, commercial ou assimilé | 31 941 | 3% |

**Conclusion :** Seulement 30% des lignes sont `Appartement` ou `Maison`. Les marts de prix filtrés sur ces deux types sont représentatifs du marché résidentiel. Les 70% restants n'ont généralement pas de surface bâtie → exclusion logique.

---

## 4. Prix médian réel par département

**Requête :**
```sql
SELECT
    code_departement,
    round(quantile(0.5)(valeur_fonciere / surface_reelle_bati)) AS prix_median_m2,
    count() AS n
FROM bronze.raw_dvf
WHERE surface_reelle_bati > 0
  AND valeur_fonciere > 0
  AND type_local IN ('Appartement', 'Maison')
GROUP BY code_departement
ORDER BY code_departement
```

**Résultats :**

| Département | Prix médian (€/m²) | N transactions |
|-------------|-------------------|----------------|
| 22 — Côtes-d'Armor | 1 951 | 76 399 |
| 29 — Finistère | 2 117 | 92 830 |
| 35 — Ille-et-Vilaine | 2 704 | 89 529 |
| 56 — Morbihan | 2 859 | 95 774 |

**Conclusion :** Ces chiffres calibrent les filtres outliers. Un `prix_m2` entre **500 et 25 000 €** capture la réalité bretonne avec une marge suffisante (ventes symboliques en bas, biens d'exception en haut).

---

## 5. Problème critique — multi-lignes par mutation

**Requête :**
```sql
SELECT
    count()                          AS nb_lignes,
    countDistinct(id_mutation)       AS mutations_uniques,
    round(count() / countDistinct(id_mutation), 2) AS lignes_par_mutation
FROM bronze.raw_dvf
```

*(résultat attendu : ~1.8 lignes par mutation en moyenne)*

**Requête — exemple de mutation multi-lots :**
```sql
SELECT
    id_mutation,
    count()                       AS n_lots,
    max(valeur_fonciere)          AS valeur_fonciere,
    sum(surface_reelle_bati)      AS surface_totale,
    max(valeur_fonciere) / sum(surface_reelle_bati) AS prix_m2_correct
FROM bronze.raw_dvf
WHERE surface_reelle_bati > 0
GROUP BY id_mutation
ORDER BY n_lots DESC
LIMIT 5
```

**Problème identifié :**

Une `id_mutation` = une vente. Mais une vente peut porter sur plusieurs lots (appartement + cave + parking). DVF génère **une ligne par lot**, toutes avec la même `valeur_fonciere`.

> Exemple : vente d'un appartement (45m²) + cave (8m²) = 2 lignes, `valeur_fonciere = 200 000€` sur chaque ligne.

**Si on calcule `prix_m2` sur bronze directement :**
- Ligne 1 : 200 000 / 45 = 4 444 €/m² ❌
- Ligne 2 : 200 000 / 8 = 25 000 €/m² ❌

**Calcul correct dans Silver :**
```sql
-- Agréger par mutation d'abord
valeur_fonciere = max(valeur_fonciere)   -- identique sur toutes les lignes d'une mutation
surface_totale  = sum(surface_reelle_bati)
prix_m2         = valeur_fonciere / surface_totale
-- → 200 000 / (45 + 8) = 3 774 €/m² ✅
```

**⚠️ C'est le point le plus critique de toute l'architecture dbt.**

---

## 6. Format id_parcelle

**Requête :**
```sql
SELECT
    id_parcelle,
    code_commune,
    code_postal
FROM bronze.raw_dvf
WHERE length(id_parcelle) > 0
LIMIT 5
```

**Exemples :**
```
56053000AA0143   56053   56250
56155000YN0294   56155   56760
56143000AW0184   56143   56190
```

**Format :** `DDDDDSSSSNNNN` = code INSEE commune (5 chiffres) + section cadastrale (2 lettres) + numéro de parcelle (4 chiffres)

**Requête — parcelles avec le plus de transactions :**
```sql
SELECT
    id_parcelle,
    count() AS n
FROM bronze.raw_dvf
WHERE length(id_parcelle) > 0
GROUP BY id_parcelle
ORDER BY n DESC
LIMIT 5
```

**Résultats :**
```
56260000AR0080   1474   ← copropriété / lotissement
56260000AH0107    932
350930000K0849    807
56260000AH0157    582
```

**Conclusion :** Certaines parcelles ont des centaines voire milliers de transactions (copros, lotissements). Calculer un "prix médian de la parcelle" serait incohérent : ce n'est pas la parcelle qui a une valeur, ce sont les lots individuels dedans. **→ Pas de `mart_parcelle`, on expose les transactions individuelles via l'API directement sur `stg_dvf`.**

---

## 7. Table des communes

**Requête :**
```sql
SELECT
    count()                  AS n_communes,
    countDistinct(code_dept) AS depts
FROM bronze.raw_communes
```

**Résultat :** 1 202 communes, 4 départements.

---

## 8. Nature des mutations (à valider)

**Requête à lancer :**
```sql
SELECT
    nature_mutation,
    count() AS n
FROM bronze.raw_dvf
GROUP BY nature_mutation
ORDER BY n DESC
```

> ⏳ **Non encore exécutée** — à valider avant de décider si on filtre uniquement les `'Vente'` ou si on inclut d'autres natures (adjudications, échanges...).

---

## Architecture dbt recommandée

### Silver

| Modèle | Rôle | Clé de déduplication |
|--------|------|---------------------|
| `stg_dvf` | 1 ligne par mutation, filtre Vente + Appart/Maison, prix_m2 correct | `id_mutation` |
| `stg_communes` | Coords GPS centroïde par commune | `code_commune` |

### Gold

| Modèle | Granularité | Rows estimées | Statut |
|--------|------------|--------------|--------|
| `mart_prix_bretagne` | annee × type | ~10 | SPEC original |
| `mart_prix_departement` | dept × annee × type | ~40 | SPEC original |
| `mart_prix_code_postal` | CP × annee × type | ~3 000 | **NOUVEAU** |
| `mart_prix_commune` | commune × annee × type | ~12 000 | SPEC original |
| *(pas de mart parcelle)* | → API query directe sur stg_dvf | — | Décision d'archi |

### NULL guard (tous les marts Gold)

```sql
CASE
    WHEN count() >= 5 THEN quantile(0.5)(prix_m2)
    ELSE NULL
END AS prix_median_m2
```
Communes/CP avec moins de 5 transactions → `prix_median_m2 = NULL` → point gris sur la carte.

### Évolution N-1 (pattern CTE, tous les marts)

```sql
WITH current AS (
    SELECT code_commune, annee, type_local,
           quantile(0.5)(prix_m2) AS prix_median_m2
    FROM {{ ref('stg_dvf') }}
    GROUP BY code_commune, annee, type_local
),
with_prev AS (
    SELECT c.*,
           p.prix_median_m2 AS prix_median_m2_n1
    FROM current c
    LEFT JOIN current p
        ON  c.code_commune = p.code_commune
        AND c.type_local   = p.type_local
        AND c.annee        = p.annee + 1
)
SELECT *,
    if(prix_median_m2_n1 > 0,
       round((prix_median_m2 - prix_median_m2_n1) / prix_median_m2_n1 * 100, 1),
       NULL
    ) AS evolution_pct_n1
FROM with_prev
```

> Préféré à `lagInFrame` qui est moins prévisible avec le driver dbt-clickhouse.

---

## Questions en attente de validation

1. **Parcelle** → Confirmes-tu que le niveau parcelle = liste de transactions depuis l'API (pas de mart) ?

2. **Terrains / Dépendances** → Les exclure des marts de prix uniquement, ou veux-tu un mart séparé pour les terrains (prix au m² de terrain) ?

3. **`nature_mutation`** → Filtrer sur `'Vente'` uniquement ? (exclut adjudications, donations, échanges) — requête ci-dessus à lancer pour voir la distribution.
