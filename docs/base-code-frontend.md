# Base de code Frontend — Analyse & Fondations

> Analyse du code généré par v0.dev. Ce document sert de référence pour implémenter le vrai frontend connecté à FastAPI + ClickHouse.

---

## Stack technique utilisée

| Outil | Rôle |
|---|---|
| React 18 + TypeScript | Framework UI |
| Tailwind CSS | Styling utility-first |
| shadcn/ui | Composants UI (select, slider, card...) |
| @deck.gl/react • @deck.gl/layers | Carte interactive avec ScatterplotLayer |
| Recharts (AreaChart) | Graphique évolution prix |
| lucide-react | Icônes (TrendingUp, MapPin, Home, ZoomIn...) |
| Vite | Build tool (index.html + main.tsx) |

---

## Architecture des composants

```
App.tsx
├── Header.tsx           ← barre titre + badge années + source
├── MapView.tsx          ← DeckGL ScatterplotLayer + tooltip + zoom + légende
└── ControlPanel.tsx     ← conteneur panneau droit (gère l'état global)
    ├── Filters.tsx      ← 3 filtres : département / type / année slider
    ├── KPICards.tsx     ← grille 2x2 des indicateurs clés
    └── TrendChart.tsx   ← AreaChart Recharts évolution 2018→2024
```

**Layout** : `h-screen flex-col` → Header fixe + body flex-row 65%/35%

---

## Interface de données clé — `CommuneData`

C'est le type central qui circule dans toute l'app. À mapper directement sur la réponse FastAPI `GET /communes`.

```typescript
export interface CommuneData {
  id: string;                        // code INSEE commune
  name: string;                      // nom commune
  department: string;                // nom département
  departmentCode: string;            // '22' | '29' | '35' | '56'
  pricePerSqm: number;               // prix médian au m²
  transactions: number;              // volume de transactions
  evolution: number;                 // évolution % vs N-1
  coordinates: [number, number];     // [longitude, latitude] ← ordre Deck.gl
}
```

---

## MapView — Deck.gl

### Configuration initiale

```typescript
const INITIAL_VIEW_STATE = {
  longitude: -2.8,   // Centre Bretagne
  latitude: 48.2,
  zoom: 7.5,
  pitch: 0,
  bearing: 0,
};
```

### Layer utilisé : `ScatterplotLayer`

Note importante : v0 a généré des **cercles proportionnels** (taille = volume de transactions) et non une vraie choroplèthe par commune. C'est un choix valable pour la démo avec des données fictives.

```typescript
const layer = new ScatterplotLayer({
  id: 'communes-layer',
  data: filteredData,
  getPosition: (d) => [d.coordinates[0], d.coordinates[1]],
  getRadius: (d) => Math.sqrt(d.transactions) * 20,  // rayon proportionnel
  getFillColor: (d) => [...getPriceColor(d.pricePerSqm), 180],  // couleur = prix
  getLineColor: [255, 255, 255],
  lineWidthMinPixels: 1,
  pickable: true,                   // active le hover
  radiusMinPixels: 8,
  radiusMaxPixels: 60,
  onHover: (info) => { ... },       // tooltip dynamique
});
```

### Palette de couleurs prix

```typescript
function getPriceColor(price: number): [number, number, number] {
  if (price < 2000) return [70, 130, 180];    // bleu   → prix bas
  if (price < 3000) return [100, 160, 150];   // teal
  if (price < 4000) return [220, 160, 80];    // amber
  return [230, 90, 70];                        // rouge  → prix élevé
}
```

### Tooltip

Positionné dynamiquement avec `cursorPosition.x + 15 / y + 15`. Affiche nom, prix, transactions, évolution colorée vert/rouge.

---

## ControlPanel — gestion d'état

L'état global des filtres est géré dans `ControlPanel` (pas dans `App`). À noter : `selectedDepartment` remonte jusqu'à `App` pour être passé à `MapView`.

```typescript
// État local ControlPanel
const [selectedPropertyType, setSelectedPropertyType] = useState('all');
const [selectedYear, setSelectedYear] = useState(2024);

// État remonté dans App
const [selectedDepartment, setSelectedDepartment] = useState('all');
```

### Calcul des KPIs (mock actuel)

Les KPIs sont calculés côté front via `useMemo` sur les données statiques. En production : à remplacer par un appel `GET /bretagne/kpis?dept=XX&type=YY&annee=ZZ`.

```typescript
const kpis = useMemo(() => {
  const filtered = selectedDepartment === 'all'
    ? brittanyCommunesData
    : brittanyCommunesData.filter(c => c.departmentCode === selectedDepartment);

  // Moyenne arithmétique utilisée — à remplacer par la vraie médiane FastAPI
  const departmentMedianPrice = filtered.map(c => c.pricePerSqm)
    .reduce((a, b) => a + b, 0) / filtered.length;
  ...
}, [selectedDepartment]);
```

---

## TrendChart — Recharts AreaChart

```typescript
// Données historiques fictives — à remplacer par GET /bretagne/kpis groupé par année
export const historicalPrices = [
  { year: '2018', price: 2200 },
  { year: '2019', price: 2350 },
  ...
  { year: '2023', price: 2980 },
];
```

Gradient sous la courbe : `linearGradient` de gris-20% à transparent. Tooltip dark sur fond `#1f2937`.

---

## Ce qu'il faut adapter pour connecter FastAPI

| Composant actuel | À remplacer par |
|---|---|
| `brittanyCommunesData` statique | `fetch('/communes?dept=XX&type=YY&annee=ZZ')` |
| `historicalPrices` statique | `fetch('/bretagne/kpis')` groupé par année |
| Calcul KPIs côté front | `fetch('/bretagne/kpis?dept=XX')` |
| Moyenne arithmétique | Médiane réelle depuis ClickHouse |
| Données mock 28 communes | ~200k transactions Bretagne via gold layer |

---

## Éléments à garder tels quels

- Architecture composants (propre, bien découpée)
- Gestion état avec `useState` + `useMemo`
- Configuration Deck.gl `ScatterplotLayer` (juste à brancher les vraies données)
- `Intl.NumberFormat('fr-FR')` pour le formatage prix
- Tooltip dynamique cursor-follow
- Palette de couleurs prix (cohérente avec les tranches du dataset réel)
- Layout 65/35 + Header

---

## Installation

```bash
npm install
npm run dev
```

Dépendances clés à ajouter si manquantes :

```bash
npm install @deck.gl/react @deck.gl/layers recharts lucide-react
npm install -D tailwindcss @types/react
```
