{{
    config(
        materialized='table',
        engine='MergeTree()',
        order_by='(code_commune, section_id)'
    )
}}

/*
    Prix médian par section cadastrale × année × type.
    Optimisation mémoire : agrégation DVF sans geometry d'abord,
    puis join geometry en dernier.
    Seules les sections avec au moins une transaction sont matérialisées.
*/

WITH dvf_stats AS (
    SELECT
        substring(id_parcelle, 1, 10)    AS section_id,
        annee,
        type_local,
        round(quantile(0.5)(prix_m2), 0) AS prix_median_m2,
        count()                           AS nb_transactions
    FROM {{ ref('stg_dvf') }}
    WHERE id_parcelle != ''
    GROUP BY section_id, annee, type_local
)

SELECT
    s.id        AS section_id,
    s.commune   AS code_commune,
    s.geometry,
    d.annee,
    d.type_local,
    d.prix_median_m2,
    d.nb_transactions
FROM {{ ref('stg_sections') }} AS s
INNER JOIN dvf_stats AS d ON s.id = d.section_id
