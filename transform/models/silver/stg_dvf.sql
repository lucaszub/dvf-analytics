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

    1. nature_mutation : Vente + VEFA + Adjudication (hors expropriation, échange)
    2. Bien unique par mutation hors dépendances — mutations multi-biens exclues
       (impossible d'attribuer la valeur foncière à chaque bien séparément)
    3. type_local IN ('Appartement', 'Maison')
    4. prix_m2 calculable (surface > 0) et <= 100 000 €/m² (seuil officiel)
*/

WITH nature_filter AS (
    SELECT *
    FROM {{ source('bronze', 'raw_dvf') }}
    WHERE
        nature_mutation IN (
            'Vente',
            'Vente en l''état futur d''achèvement',
            'Adjudication'
        )
        AND valeur_fonciere > 0
),

-- Compte le nombre de biens principaux (hors dépendances) par mutation
mutation_bien_count AS (
    SELECT
        id_mutation,
        countIf(type_local != 'Dépendance') AS nb_biens_principaux
    FROM nature_filter
    GROUP BY id_mutation
),

-- Garde uniquement les mutations à bien unique, type résidentiel, surface renseignée
filtered AS (
    SELECT n.*
    FROM nature_filter AS n
    WHERE
        n.id_mutation IN (
            SELECT id_mutation
            FROM mutation_bien_count
            WHERE nb_biens_principaux = 1
        )
        AND n.type_local IN ('Appartement', 'Maison')
        AND n.surface_reelle_bati > 0
),

mutations_agregees AS (
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
        sum(surface_reelle_bati)    AS surface_totale,
        max(longitude)              AS longitude,
        max(latitude)               AS latitude
    FROM filtered
    GROUP BY id_mutation
)

SELECT
    id_mutation,
    date_mutation,
    toYear(date_mutation)               AS annee,
    code_commune,
    nom_commune,
    code_departement,
    code_postal,
    type_local,
    surface_totale                      AS surface_reelle_bati,
    valeur_fonciere,
    round(valeur_fonciere / surface_totale, 2) AS prix_m2,
    longitude,
    latitude
FROM mutations_agregees
WHERE
    valeur_fonciere / surface_totale <= 100000
