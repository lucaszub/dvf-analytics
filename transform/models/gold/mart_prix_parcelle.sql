{{
    config(
        materialized='table',
        engine='MergeTree()',
        order_by='(code_commune, parcelle_id)'
    )
}}

/*
    Prix médian par parcelle cadastrale × année × type.
    Optimisation mémoire : agrégation DVF sans geometry d'abord,
    puis join geometry en dernier pour éviter GROUP BY sur 5.4M geometry strings.
    Seules les parcelles avec au moins une transaction sont matérialisées.
*/

WITH dvf_stats AS (
    SELECT
        id_parcelle,
        annee,
        type_local,
        round(quantile(0.5)(prix_m2), 0) AS prix_median_m2,
        count()                           AS nb_transactions
    FROM {{ ref('stg_dvf') }}
    WHERE id_parcelle != ''
    GROUP BY id_parcelle, annee, type_local
)

SELECT
    p.id        AS parcelle_id,
    p.commune   AS code_commune,
    p.geometry,
    d.annee,
    d.type_local,
    d.prix_median_m2,
    d.nb_transactions
FROM {{ ref('stg_parcelles') }} AS p
INNER JOIN dvf_stats AS d ON p.id = d.id_parcelle
