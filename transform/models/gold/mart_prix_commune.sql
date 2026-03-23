{{
    config(
        materialized='table',
        engine='MergeTree()',
        order_by='(code_commune, annee, type_local)'
    )
}}

/*
    Prix médian par commune × année × type.
    NULL guard : moins de 5 transactions → prix_median_m2 = NULL (point gris sur carte).
    Évolution N-1 via CTE self-join (plus prévisible que lagInFrame avec dbt-clickhouse).
*/

WITH base AS (
    SELECT
        d.code_commune,
        c.nom_commune,
        d.code_departement,
        d.annee,
        d.type_local,
        CASE
            WHEN count() >= 5
                THEN round(quantile(0.5)(d.prix_m2), 0)
            ELSE NULL
        END AS prix_median_m2,
        round(avg(d.prix_m2), 0)        AS prix_moyen_m2,
        count()                         AS nb_transactions,
        c.longitude,
        c.latitude
    FROM {{ ref('stg_dvf') }} AS d
    LEFT JOIN {{ ref('stg_communes') }} AS c
        ON d.code_commune = c.code_commune
    GROUP BY
        d.code_commune,
        c.nom_commune,
        d.code_departement,
        d.annee,
        d.type_local,
        c.longitude,
        c.latitude
),

with_prev AS (
    SELECT
        curr.*,
        prev.prix_median_m2 AS prix_median_m2_n1
    FROM base AS curr
    LEFT JOIN base AS prev
        ON curr.code_commune = prev.code_commune
        AND curr.type_local = prev.type_local
        AND curr.annee = prev.annee + 1
)

SELECT
    code_commune,
    nom_commune,
    code_departement,
    annee,
    type_local,
    prix_median_m2,
    prix_moyen_m2,
    nb_transactions,
    longitude,
    latitude,
    prix_median_m2_n1,
    if(
        prix_median_m2_n1 > 0 AND prix_median_m2 IS NOT NULL,
        round(
            (prix_median_m2 - prix_median_m2_n1) / prix_median_m2_n1 * 100, 1
        ),
        NULL
    ) AS evolution_pct_n1
FROM with_prev
