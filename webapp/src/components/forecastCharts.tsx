export interface SeriesPoint {
  hour: number
  v: number
}

export function waveColor(h: number): string {
  if (h < 0.5) return '#4ade80'
  if (h < 1.5) return '#facc15'
  if (h < 2.5) return '#fb923c'
  return '#ef4444'
}

// Formats the value range across a series, e.g. "0.2–0.6" — used so the
// chart's relative (min–max stretched) scaling always has concrete numbers next to it.
export function seriesRange(points: SeriesPoint[], decimals = 1): string {
  const values = points.map((p) => p.v)
  const min = Math.min(...values), max = Math.max(...values)
  if (max - min < 1 / 10 ** decimals) return max.toFixed(decimals)
  return `${min.toFixed(decimals)}–${max.toFixed(decimals)}`
}

export function WindSparkline({ points }: { points: SeriesPoint[] }) {
  const w = 120, h = 28
  const values = points.map((p) => p.v)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = Math.max(max - min, 0.5)
  const pts = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w
    const y = h - ((p.v - min) / range) * (h - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="wx-sparkline" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Bars scale relative to the series' own min–max range (not from zero), so
// small but real differences (e.g. 0.3–0.4 m) are still visible as varying
// height. Each bar is colored by its own absolute value via waveColor.
export function WaveBars({ points }: { points: SeriesPoint[] }) {
  const w = 120, h = 28
  const values = points.map((p) => p.v)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = Math.max(max - min, 0.1)
  const bw = w / points.length
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="wx-sparkline" preserveAspectRatio="none">
      {points.map((p, i) => {
        const bh = 6 + ((p.v - min) / range) * (h - 6)
        return <rect key={i} x={i * bw + 1} y={h - bh} width={Math.max(bw - 2, 1)} height={bh} fill={waveColor(p.v)} rx="1" />
      })}
    </svg>
  )
}
