// Dynamic price color scale — no hardcoded price thresholds.
// Breakpoints are computed from the actual data (p5 / p25 / p50 / p75 / p95).
// Palette: blue → light blue → neutral gray → orange → red  (no yellow).

const PALETTE = ['#2c7bb6', '#abd9e9', '#e8e8e8', '#fdae61', '#d7191c']

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

function pctValue(sorted: number[], p: number): number {
  return sorted[Math.min(Math.floor(p * sorted.length), sorted.length - 1)]
}

/**
 * Builds a color function calibrated to the supplied price array.
 * Stops are placed at p5 / p25 / p50 / p75 / p95 — fully dynamic, no hard rules.
 */
export function makeColorScale(prices: number[]): (price: number) => string {
  const valid = prices.filter(p => p > 0).sort((a, b) => a - b)
  if (valid.length === 0) return () => '#e5e7eb'

  const breaks = [
    pctValue(valid, 0.05),
    pctValue(valid, 0.25),
    pctValue(valid, 0.50),
    pctValue(valid, 0.75),
    pctValue(valid, 0.95),
  ]

  // Guarantee strictly increasing
  for (let i = 1; i < breaks.length; i++) {
    if (breaks[i] <= breaks[i - 1]) breaks[i] = breaks[i - 1] + 1
  }

  const stops: Array<[number, string]> = breaks.map((b, i) => [b, PALETTE[i]])

  return (price: number) => {
    if (price <= 0) return '#e5e7eb'
    if (price <= stops[0][0]) return stops[0][1]
    if (price >= stops[stops.length - 1][0]) return stops[stops.length - 1][1]
    for (let i = stops.length - 2; i >= 0; i--) {
      if (price >= stops[i][0]) {
        const [lo, colorLo] = stops[i]
        const [hi, colorHi] = stops[i + 1]
        const t = (price - lo) / (hi - lo)
        const [r1, g1, b1] = hexToRgb(colorLo)
        const [r2, g2, b2] = hexToRgb(colorHi)
        return rgbToHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t))
      }
    }
    return stops[0][1]
  }
}

/** Returns the 5 palette stops with their dynamic breakpoints, for legend display. */
export function makeColorStops(
  prices: number[]
): Array<{ price: number; color: string }> {
  const valid = prices.filter(p => p > 0).sort((a, b) => a - b)
  if (valid.length === 0) return []
  const pcts = [0.05, 0.25, 0.50, 0.75, 0.95]
  return pcts.map((p, i) => ({
    price: pctValue(valid, p),
    color: PALETTE[i],
  }))
}
