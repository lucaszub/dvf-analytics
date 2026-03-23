{{
    config(
        materialized='table',
        engine='MergeTree()',
        order_by='(annee, type_local)'
    )
}}

/*
    Prix médian breton global par année × type.
    Calculé directement sur stg_dvf (pas d'agrégation d'agrégations).
    Évolution N-1 via CTE self-join.
*/

WITH base AS (
    SELECT
        annee,
        type_local,
        round(quantile(0.5)(prix_m2), 0)    AS prix_median_m2,
        round(avg(prix_m2), 0)              AS prix_moyen_m2,
        count()                             AS nb_transactions,
        countDistinct(code_commune)         AS nb_communes
    FROM {{ ref('stg_dvf') }}
    GROUP BY
        annee,
        type_local
),

with_prev AS (
    SELECT
        curr.*,
        prev.prix_median_m2 AS prix_median_m2_n1
    FROM base AS curr
    LEFT JOIN base AS prev
        ON curr.type_local = prev.type_local
        AND curr.annee = prev.annee + 1
)

SELECT
    annee,
    type_local,
    prix_median_m2,
    prix_moyen_m2,
    nb_transactions,
    nb_communes,
    prix_median_m2_n1,
    if(
        prix_median_m2_n1 > 0,
        round(
            (prix_median_m2 - prix_median_m2_n1) / prix_median_m2_n1 * 100, 1
        ),
        NULL
    ) AS evolution_pct_n1
FROM with_prev
