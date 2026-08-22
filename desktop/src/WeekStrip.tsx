interface Point {
  wd: string
  value: number
}

function smooth(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? pts[i + 1]
    d += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)}, ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)}, ${p2.x} ${p2.y}`
  }
  return d
}

export default function WeekStrip({ points, width, height }: { points: Point[]; width: number; height: number }) {
  const base = height - 6
  const top = 6
  const max = Math.max(1, ...points.map((p) => p.value))
  const col = width / Math.max(1, points.length)
  const coords = points.map((p, i) => ({
    x: Math.round(col * (i + 0.5)),
    y: Math.round(base - (p.value / max) * (base - top)),
  }))
  const line = smooth(coords)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <path d={line} fill="none" stroke="#6E9CC4" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
      <line x1={0} y1={base} x2={width} y2={base} stroke="#262B2F" strokeWidth={1} />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={points[i].value === 0 ? 2.5 : 3.5} fill={points[i].value === 0 ? '#3F464B' : '#6E9CC4'} stroke="#171B1E" strokeWidth={2} />
      ))}
    </svg>
  )
}
