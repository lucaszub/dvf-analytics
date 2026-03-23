{{
    config(
        materialized='table',
        engine='MergeTree()',
        order_by='(code_postal, annee, type_local)'
    )
}}

/*
    Prix médian par code postal × année × type.
    Niveau intermédiaire entre commune et département (322 codes postaux en Bretagne).
    NULL guard : < 5 transactions → NULL.
*/

WITH base AS (
    SELECT
        code_postal,
        code_departement,
        annee,
        type_local,
        CASE
            WHEN count() >= 5
                THEN round(quantile(0.5)(prix_m2), 0)
            ELSE NULL
        END AS prix_median_m2,
        round(avg(prix_m2), 0)          AS prix_moyen_m2,
        count()                         AS nb_transactions
    FROM {{ ref('stg_dvf') }}
    WHERE code_postal != ''
    GROUP BY
        code_postal,
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
        ON curr.code_postal = prev.code_postal
        AND curr.type_local = prev.type_local
        AND curr.annee = prev.annee + 1
)

SELECT
    code_postal,
    code_departement,
    annee,
    type_local,
    prix_median_m2,
    prix_moyen_m2,
    nb_transactions,
    prix_median_m2_n1,
    if(
        prix_median_m2_n1 > 0 AND prix_median_m2 IS NOT NULL,
        round(
            (prix_median_m2 - prix_median_m2_n1) / prix_median_m2_n1 * 100, 1
        ),
        NULL
    ) AS evolution_pct_n1
FROM with_prev
