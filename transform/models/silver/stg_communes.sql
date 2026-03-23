{{
    config(
        materialized='table',
        engine='MergeTree()',
        order_by='code_commune'
    )
}}

/*
    Référentiel communes avec coordonnées GPS centroïde.
    Dédoublonnage sur code_commune via argMax (au cas où doublons dans raw_communes).
    Filtré sur les communes qui ont au moins une transaction dans stg_dvf.
*/

SELECT
    code_commune,
    argMax(nom_commune, code_commune)   AS nom_commune,
    argMax(code_dept, code_commune)     AS code_dept,
    argMax(longitude, code_commune)     AS longitude,
    argMax(latitude, code_commune)      AS latitude
FROM {{ source('bronze', 'raw_communes') }}
WHERE code_commune IN (
    SELECT DISTINCT code_commune FROM {{ ref('stg_dvf') }}
)
GROUP BY code_commune
