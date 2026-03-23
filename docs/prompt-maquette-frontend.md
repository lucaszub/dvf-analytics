# Prompt Maquette — Frontend DVF Analytics

> Prompt à coller dans un agent maquette (v0.dev, Galileo AI, Lovable).

---

Tu es un expert UI/UX. Génère une maquette haute fidélité d'une application web de visualisation de données immobilières pour la région Bretagne (France).

---

## CONTEXTE

Application data portfolio pour un atelier CGI. Stack : React + Deck.gl + FastAPI.
Audience : profils techniques data / architecture.
Ton visuel : sobre, professionnel, dark mode ou light mode neutre.
Pas de couleurs criards. Inspiration : dashboards data modernes (Hex, Linear, Vercel).

---

## LAYOUT GÉNÉRAL

Split view horizontal :
- Gauche (65%) : carte interactive plein écran
- Droite (35%) : panneau de contrôle + KPIs

---

## PARTIE GAUCHE — CARTE

- Carte choroplèthe de Bretagne entière au chargement
- Communes colorées par dégradé de couleur (prix médian au m²)
  - Couleur froide (bleu/vert) = prix bas
  - Couleur chaude (orange/rouge) = prix élevé
- Légende de couleur verticale avec échelle de prix (€/m²)
- Tooltip au survol d'une commune :
  - Nom de la commune
  - Prix médian au m² : X XXX €
  - Volume de transactions : XXX
  - Évolution vs N-1 : +X.X% (vert) ou -X.X% (rouge)
- Contrôles zoom +/- en bas à droite de la carte

---

## PARTIE DROITE — PANNEAU

### Section 1 : Filtres (en haut)

Trois filtres sous forme de dropdowns ou toggles :
1. Département : Tous / Côtes-d'Armor (22) / Finistère (29) / Ille-et-Vilaine (35) / Morbihan (56)
2. Type de bien : Tous / Appartement / Maison
3. Année : slider ou dropdown de 2018 à 2024

Bouton "Réinitialiser les filtres" discret en dessous.

### Section 2 : KPIs régionaux (milieu)

4 cartes KPI en grille 2x2 :
- Prix médian Bretagne : X XXX €/m²
- Prix médian département sélectionné : X XXX €/m²
- Commune la plus chère : [Nom] — X XXX €/m²
- Volume total transactions : XX XXX

### Section 3 : Graphique évolution (bas)

Sparkline ou bar chart mini montrant l'évolution du prix médian breton de 2018 à 2024.
Données fictives cohérentes : 2 200 €/m² (2018) → 3 100 €/m² (2024).

---

## HEADER

Barre fine en haut full-width :
- Gauche : titre **"DVF Analytics · Bretagne"** + badge "2018–2024"
- Droite : mention discrète "Données : data.gouv.fr · DGFiP"

---

## CONTRAINTES

- Desktop uniquement (1440px)
- Pas de sidebar, pas de navigation multi-pages
- Tous les éléments visibles sans scroll
- Données fictives mais réalistes pour la Bretagne
  - Prix médian ~2 800 €/m² à Rennes
  - Prix médian ~1 800 €/m² en zone rurale
- Montre les 4 départements clairement délimités sur la carte

---

## OUTILS RECOMMANDÉS

| Outil | Lien | Usage |
|---|---|---|
| v0.dev | https://v0.dev | Meilleur pour React directement exploitable |
| Galileo AI | https://www.usegalileo.ai | Maquette visuelle rapide |
| Lovable | https://lovable.dev | Prototype interactif complet |
