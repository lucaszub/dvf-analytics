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

// Blue → Amber → Red (standard heatmap, lisible sur fond clair)
const LOW  = '#3b82f6'
const MID  = '#f59e0b'
const HIGH = '#ef4444'

export function priceColor(prix: number, min: number, max: number): string {
  if (max === min) return MID
  const t = Math.max(0, Math.min(1, (prix - min) / (max - min)))
  const [r1, g1, b1] = t < 0.5 ? hexToRgb(LOW)  : hexToRgb(MID)
  const [r2, g2, b2] = t < 0.5 ? hexToRgb(MID)  : hexToRgb(HIGH)
  const t2 = t < 0.5 ? t * 2 : (t - 0.5) * 2
  return rgbToHex(lerp(r1, r2, t2), lerp(g1, g2, t2), lerp(b1, b2, t2))
}
