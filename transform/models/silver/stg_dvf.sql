{{
    config(
        materialized='table',
        engine='MergeTree()',
        order_by='(code_departement, date_mutation)',
        partition_by='(code_departement, toYear(date_mutation))'
    )
}}

/*
    Filtres alignés sur la méthodologie officielle statistiques DVF (data.gouv.fr) :
    1. Bien unique par mutation hors dépendances — mutations multi-biens exclues
    2. type_local IN ('Appartement', 'Maison')
    3. prix_m2 calculable (surface > 0) et <= 100 000 €/m² (seuil officiel)
    Note : nature_mutation absent de raw_dvf_geo (source géolocalisée allégée).
*/

WITH base AS (
    SELECT *
    FROM {{ source('bronze', 'raw_dvf_geo') }}
    WHERE valeur_fonciere > 0
),

mutation_bien_count AS (
    SELECT
        id_mutation,
        countIf(type_local != 'Dépendance') AS nb_biens_principaux
    FROM base
    GROUP BY id_mutation
),

filtered AS (
    SELECT b.*
    FROM base AS b
    WHERE
        b.id_mutation IN (
            SELECT id_mutation
            FROM mutation_bien_count
            WHERE nb_biens_principaux = 1
        )
        AND b.type_local IN ('Appartement', 'Maison')
        AND b.surface_reelle_bati > 0
),

mutations_agregees AS (
    SELECT
        id_mutation,
        max(date_mutation)              AS date_mutation,
        max(valeur_fonciere)            AS valeur_fonciere,
        max(code_commune)               AS code_commune,
        max(nom_commune)                AS nom_commune,
        max(code_departement)           AS code_departement,
        max(code_postal)                AS code_postal,
        max(adresse_nom_voie)           AS adresse_nom_voie,
        groupArray(type_local)[1]       AS type_local,
        sum(surface_reelle_bati)        AS surface_totale,
        max(nombre_pieces_principales)  AS nombre_pieces_principales,
        max(id_parcelle)                AS id_parcelle,
        max(longitude)                  AS longitude,
        max(latitude)                   AS latitude
    FROM filtered
    GROUP BY id_mutation
)

SELECT
    id_mutation,
    date_mutation,
    toYear(date_mutation)                       AS annee,
    code_commune,
    nom_commune,
    code_departement,
    code_postal,
    adresse_nom_voie,
    type_local,
    surface_totale                              AS surface_reelle_bati,
    nombre_pieces_principales,
    valeur_fonciere,
    round(valeur_fonciere / surface_totale, 2)  AS prix_m2,
    id_parcelle,
    longitude,
    latitude
FROM mutations_agregees
WHERE valeur_fonciere / surface_totale <= 100000
