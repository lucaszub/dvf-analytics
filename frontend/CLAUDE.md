# frontend/ — React + Deck.gl

Carte interactive des prix immobiliers DVF Bretagne avec drill-down par zoom sur polygones.
Contexte global : voir [CLAUDE.md racine](../CLAUDE.md) · Interfaces TS : [docs/SPEC.md](../docs/SPEC.md)

## Architecture de rendu — zoom-driven

Pas de cercles. Uniquement des **polygones GeoJsonLayer** colorés par prix_median_m2.

| Zoom | Niveau | Source API | Layer |
|------|--------|------------|-------|
| < 8 | Département | `/departements` | GeoJsonLayer polygones depts |
| 8–11 | Commune | `/communes?dept=...` | GeoJsonLayer polygones communes |
| 11–14 | Section cadastrale | `/communes/{code}/sections` | GeoJsonLayer polygones sections |
| ≥ 14 | Parcelle | `/sections/{id}/parcelles` | GeoJsonLayer polygones parcelles |

Chargement à la demande : chaque changement de zoom level déclenche un fetch vers l'API.
Au clic sur une parcelle → panel latéral avec les mutations (`/parcelles/{id}/mutations`).

## Deck.gl — GeoJsonLayer (UNIQUEMENT)

```typescript
import { GeoJsonLayer } from '@deck.gl/layers';

new GeoJsonLayer({
  id: 'sections-layer',
  data: geoJsonFeatureCollection,    // fetch depuis API
  filled: true,
  stroked: true,
  getLineColor: [255, 255, 255, 80],
  getLineWidth: 1,
  getFillColor: (f) => getPriceColor(f.properties.prix_median_m2),
  pickable: true,
  onClick: ({ object }) => handleFeatureClick(object),
})
```

**Aucun ScatterplotLayer.** Les données GeoJSON viennent de l'API (pas de fichiers statiques dans nginx).

## Zoom thresholds

```typescript
const ZOOM_DEPT = 8;
const ZOOM_COMMUNE = 11;
const ZOOM_SECTION = 14;
// ≥ 14 → parcelles
```

## Couleur prix_m2

```typescript
function getPriceColor(price: number | null): [number, number, number, number] {
  if (price === null) return [180, 180, 180, 100]; // gris = pas de données
  if (price < 2000)   return [70, 130, 180, 200];  // bleu
  if (price < 3000)   return [100, 160, 150, 200]; // teal
  if (price < 4000)   return [220, 160, 80, 200];  // amber
  return               [230, 90, 70, 200];          // rouge
}
```

## Interfaces TypeScript clés

```typescript
// Réponse GeoJSON API (/sections, /parcelles)
interface GeoFeatureResponse {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: object;   // MultiPolygon (sections) | Polygon (parcelles)
    properties: {
      id: string;
      code_commune: string;
      prix_median_m2: number | null;
      nb_transactions: number;
      annee?: number;
      type_local?: string;
    };
  }>;
}

// Mutation individuelle (panel au clic sur parcelle)
interface MutationData {
  id_mutation: string;
  date_mutation: string;
  type_local: string;
  valeur_fonciere: number;
  surface_reelle_bati: number;
  prix_m2: number;
  adresse_nom_voie: string;
}

// Commune (mis à jour)
interface CommuneData {
  id: string;
  name: string;
  department: string;
  departmentCode: string;
  pricePerSqm: number;
  transactions: number;
  evolution: number;
  longitude: number;
  latitude: number;
}
```

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `src/types.ts` | Toutes les interfaces TS |
| `src/data/api.ts` | Client API — tous les fetches |
| `src/components/Map.tsx` | Carte principale + gestion zoom levels |
| `src/components/MutationPanel.tsx` | Panel latéral mutations au clic parcelle |
| `src/components/Sidebar.tsx` | Filtres (dept, type, annee) |
| `src/components/KpiCard.tsx` | KPI cards |
| `src/utils/colors.ts` | `getPriceColor()` |
| `src/components/ui/` | Composants shadcn/ui |

## Règles

- **GeoJsonLayer uniquement** — pas de ScatterplotLayer
- GeoJSON depuis l'API FastAPI — pas de fichiers JSON statiques dans le frontend
- `null` géré partout : `prix_median_m2` peut être null (zones sans transactions)
- `BASE_URL = ''` dans `api.ts` — URLs relatives, proxiées par nginx en prod

## View state initial (Bretagne)

```typescript
const INITIAL_VIEW_STATE = {
  longitude: -2.8,
  latitude: 48.2,
  zoom: 7.5,
  pitch: 0,
  bearing: 0,
};
```

## Commandes

```bash
docker compose up frontend
cd frontend && npm run dev
cd frontend && npm run build
```

## Skills disponibles

- `/shadcn` — ajouter/modifier des composants shadcn/ui, debug styling
