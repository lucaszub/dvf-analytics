{{
    config(
        materialized='table',
        engine='MergeTree()',
        order_by='(code_departement, annee, type_local)'
    )
}}

/*
    Prix médian par département × année × type.
    Inclut commune_plus_chere et commune_moins_chere via argMax/argMin.
    Évolution N-1 via CTE self-join.
*/

WITH base AS (
    SELECT
        code_departement,
        annee,
        type_local,
        round(quantile(0.5)(prix_m2), 0)    AS prix_median_m2,
        round(avg(prix_m2), 0)              AS prix_moyen_m2,
        count()                             AS nb_transactions,
        argMax(nom_commune, prix_m2)        AS commune_plus_chere,
        argMin(nom_commune, prix_m2)        AS commune_moins_chere
    FROM {{ ref('stg_dvf') }}
    GROUP BY
        code_departement,
        annee,
        type_local
),

with_prev AS (
    SELECT
        curr.*,
        prev.prix_median_m2 AS prix_median_m2_n1
    FROM base AS curr
    LEFT JOIN base AS prev
        ON curr.code_departement = prev.code_departement
        AND curr.type_local = prev.type_local
        AND curr.annee = prev.annee + 1
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
    prix_median_m2_n1,
    if(
        prix_median_m2_n1 > 0,
        round(
            (prix_median_m2 - prix_median_m2_n1) / prix_median_m2_n1 * 100, 1
        ),
        NULL
    ) AS evolution_pct_n1
FROM with_prev
