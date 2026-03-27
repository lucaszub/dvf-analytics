{{
    config(
        materialized='table',
        engine='MergeTree()',
        order_by='(commune, id)'
    )
}}

-- Sections cadastrales — sélection directe sans agrégation.
-- Pas de GROUP BY : raw_sections est TRUNCATE + reload à chaque ingestion.

SELECT
    id,
    commune,
    section,
    contenance,
    geometry
FROM {{ source('bronze', 'raw_sections') }}
