// Fixed price scale calibrated for Bretagne (€/m²)
// Mirrors explore.data.gouv.fr color conventions: green → yellow → orange → red
const STOPS: Array<[number, string]> = [
  [0,    '#1a9641'],  // deep green   — < 1000
  [1000, '#78c679'],  // green
  [1500, '#c2e699'],  // light green
  [2000, '#ffffbf'],  // yellow
  [2500, '#fee08b'],  // light orange
  [3000, '#fdae61'],  // orange
  [3500, '#f46d43'],  // orange-red
  [4500, '#d73027'],  // red
  [6000, '#a50026'],  // dark red
]

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t)
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

/** Fixed-scale color for a price per m² — same color meaning across all zoom levels. */
export function priceColor(prix: number): string {
  if (prix <= 0) return '#cccccc'

  for (let i = STOPS.length - 1; i >= 0; i--) {
    if (prix >= STOPS[i][0]) {
      if (i === STOPS.length - 1) return STOPS[i][1]
      const [lo, colorLo] = STOPS[i]
      const [hi, colorHi] = STOPS[i + 1]
      const t = (prix - lo) / (hi - lo)
      const [r1, g1, b1] = hexToRgb(colorLo)
      const [r2, g2, b2] = hexToRgb(colorHi)
      return rgbToHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t))
    }
  }
  return STOPS[0][1]
}
