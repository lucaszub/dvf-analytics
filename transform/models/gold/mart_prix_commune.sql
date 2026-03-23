{{
    config(
        materialized='table',
        engine='MergeTree()',
        order_by='(code_commune, annee, type_local)'
    )
}}

/*
    Prix médian par commune × année × type.
    NULL guard : moins de 5 transactions → prix_median_m2 = NULL.
    Évolution N-1 via lagInFrame.
    Note: stg_communes joint en dernier pour contourner une limitation ClickHouse
    (colonnes de JOIN non visibles dans les CTEs suivantes).
*/

WITH base AS (
    SELECT
        code_commune,
        code_departement,
        annee,
        type_local,
        multiIf(
            count() >= 5, round(quantile(0.5)(prix_m2), 0),
            NULL
        )                                   AS prix_median_m2,
        round(avg(prix_m2), 0)              AS prix_moyen_m2,
        count()                             AS nb_transactions
    FROM {{ ref('stg_dvf') }}
    GROUP BY code_commune, code_departement, annee, type_local
),

with_lag AS (
    SELECT
        code_commune,
        code_departement,
        annee,
        type_local,
        prix_median_m2,
        prix_moyen_m2,
        nb_transactions,
        lagInFrame(prix_median_m2) OVER (
            PARTITION BY code_commune, type_local
            ORDER BY annee
            ROWS BETWEEN 1 PRECEDING AND CURRENT ROW
        ) AS prix_median_m2_lag,
        lagInFrame(annee) OVER (
            PARTITION BY code_commune, type_local
            ORDER BY annee
            ROWS BETWEEN 1 PRECEDING AND CURRENT ROW
        ) AS annee_lag
    FROM base
)

SELECT
    l.code_commune,
    c.nom_commune,
    l.code_departement,
    l.annee,
    l.type_local,
    l.prix_median_m2,
    l.prix_moyen_m2,
    l.nb_transactions,
    c.longitude,
    c.latitude,
    if(l.annee_lag = l.annee - 1, l.prix_median_m2_lag, NULL) AS prix_median_m2_n1,
    if(
        l.annee_lag = l.annee - 1
        AND l.prix_median_m2_lag > 0
        AND l.prix_median_m2 IS NOT NULL,
        round(
            (l.prix_median_m2 - l.prix_median_m2_lag) / l.prix_median_m2_lag * 100, 1
        ),
        NULL
    ) AS evolution_pct_n1
FROM with_lag AS l
LEFT JOIN {{ ref('stg_communes') }} AS c ON l.code_commune = c.code_commune
