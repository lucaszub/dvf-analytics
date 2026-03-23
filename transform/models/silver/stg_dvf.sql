{{
    config(
        materialized='table',
        engine='MergeTree()',
        order_by='(code_departement, date_mutation)',
        partition_by='(code_departement, toYear(date_mutation))'
    )
}}

/*
    Agrégation par mutation : une vente DVF génère N lignes (une par lot).
    On agrège d'abord pour avoir une ligne par mutation avec la surface totale,
    puis on calcule prix_m2 = valeur_fonciere / surface_totale.

    Filtres appliqués :
    - nature_mutation = 'Vente' uniquement
    - type_local IN ('Appartement', 'Maison')
    - surface et valeur > 0
    - prix_m2 entre 500 et 25 000 €/m² (calibré sur données Bretagne)
*/

WITH mutations_agregees AS (
    SELECT
        id_mutation,
        max(date_mutation)          AS date_mutation,
        max(nature_mutation)        AS nature_mutation,
        max(valeur_fonciere)        AS valeur_fonciere,
        max(code_commune)           AS code_commune,
        max(nom_commune)            AS nom_commune,
        max(code_departement)       AS code_departement,
        max(code_postal)            AS code_postal,
        groupArray(type_local)[1]   AS type_local,
        sum(surface_reelle_bati)    AS surface_totale
    FROM {{ source('bronze', 'raw_dvf') }}
    WHERE
        nature_mutation = 'Vente'
        AND type_local IN ('Appartement', 'Maison')
        AND surface_reelle_bati > 0
        AND valeur_fonciere > 0
    GROUP BY id_mutation
)

SELECT
    id_mutation,
    date_mutation,
    toYear(date_mutation)           AS annee,
    code_commune,
    nom_commune,
    code_departement,
    code_postal,
    type_local,
    surface_totale                  AS surface_reelle_bati,
    valeur_fonciere,
    round(valeur_fonciere / surface_totale, 2) AS prix_m2
FROM mutations_agregees
WHERE
    valeur_fonciere / surface_totale BETWEEN 500 AND 25000
