{{
    config(
        materialized='table',
        engine='MergeTree()',
        order_by='(commune, id)'
    )
}}

-- Parcelles cadastrales — sélection directe sans agrégation.
-- Pas de GROUP BY : raw_parcelles est TRUNCATE + reload à chaque ingestion,
-- les ids sont déjà uniques par construction.

SELECT
    id,
    commune,
    section,
    numero,
    contenance,
    geometry
FROM {{ source('bronze', 'raw_parcelles') }}
