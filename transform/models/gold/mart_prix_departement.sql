{{
    config(
        materialized='table',
        engine='MergeTree()',
        order_by='(code_departement, annee, type_local)'
    )
}}

/*
    Prix médian par département × année × type.
    commune_plus_chere / commune_moins_chere basées sur la médiane par commune
    (et non sur la transaction individuelle la plus haute/basse).
    Évolution N-1 via lagInFrame.
*/

WITH commune_medians AS (
    SELECT
        code_departement,
        annee,
        type_local,
        nom_commune,
        round(quantile(0.5)(prix_m2), 0) AS prix_median_commune
    FROM {{ ref('stg_dvf') }}
    GROUP BY code_departement, annee, type_local, nom_commune
),

dept_stats AS (
    SELECT
        code_departement,
        annee,
        type_local,
        round(quantile(0.5)(prix_m2), 0)    AS prix_median_m2,
        round(avg(prix_m2), 0)              AS prix_moyen_m2,
        count()                             AS nb_transactions
    FROM {{ ref('stg_dvf') }}
    GROUP BY code_departement, annee, type_local
),

commune_extremes AS (
    SELECT
        code_departement,
        annee,
        type_local,
        argMax(nom_commune, prix_median_commune) AS commune_plus_chere,
        argMin(nom_commune, prix_median_commune) AS commune_moins_chere
    FROM commune_medians
    GROUP BY code_departement, annee, type_local
),

base AS (
    SELECT
        d.code_departement,
        d.annee,
        d.type_local,
        d.prix_median_m2,
        d.prix_moyen_m2,
        d.nb_transactions,
        e.commune_plus_chere,
        e.commune_moins_chere
    FROM dept_stats AS d
    LEFT JOIN commune_extremes AS e
        ON d.code_departement = e.code_departement
        AND d.annee = e.annee
        AND d.type_local = e.type_local
),

with_lag AS (
    SELECT
        code_departement,
        annee,
        type_local,
        prix_median_m2,
        prix_moyen_m2,
        nb_transactions,
        commune_plus_chere,
        commune_moins_chere,
        lagInFrame(prix_median_m2) OVER (
            PARTITION BY code_departement, type_local
            ORDER BY annee
            ROWS BETWEEN 1 PRECEDING AND CURRENT ROW
        ) AS prix_median_m2_lag,
        lagInFrame(annee) OVER (
            PARTITION BY code_departement, type_local
            ORDER BY annee
            ROWS BETWEEN 1 PRECEDING AND CURRENT ROW
        ) AS annee_lag
    FROM base
)

SELECT
    code_departement,
    annee,
    type_local,
    prix_median_m2,
    prix_moyen_m2,
    nb_transactions,
    commune_plus_chere,
    commune_moins_chere,
    if(annee_lag = annee - 1, prix_median_m2_lag, NULL) AS prix_median_m2_n1,
    if(
        annee_lag = annee - 1 AND prix_median_m2_lag > 0,
        round(
            (prix_median_m2 - prix_median_m2_lag) / prix_median_m2_lag * 100, 1
        ),
        NULL
    ) AS evolution_pct_n1
FROM with_lag
