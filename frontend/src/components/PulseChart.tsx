import { useId, useMemo, useState } from 'react'
import { smoothLine } from '../utils/activitySeries'

function PulseChart({
  values,
  labels,
  selectedIndex,
  onPick,
  height = 88,
  showAverage = false,
  showDots = true,
  ariaLabel,
}: {
  values: number[]
  labels?: string[]
  selectedIndex?: number
  onPick?: (index: number) => void
  height?: number
  showAverage?: boolean
  showDots?: boolean
  ariaLabel: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const uid = useId()
  const width = 840
  const pad = { l: 10, r: 10, t: 16, b: labels ? 26 : 10 }
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const max = Math.max(1, ...values)
  const avg = values.length ? values.reduce((s, n) => s + n, 0) / values.length : 0
  const points = useMemo(
    () =>
      values.map((count, i) => ({
        i,
        count,
        x: pad.l + (values.length <= 1 ? innerW / 2 : (i / (values.length - 1)) * innerW),
        y: pad.t + innerH - (count / max) * innerH,
      })),
    [values, innerW, innerH, max, pad.l, pad.t],
  )
  const line = smoothLine(points)
  const area = points.length
    ? `${line} L ${points[points.length - 1].x} ${pad.t + innerH} L ${points[0].x} ${pad.t + innerH} Z`
    : ''
  const active = hover ?? selectedIndex
  const activePt = active != null ? points[active] : undefined
  const avgY = pad.t + innerH - (avg / max) * innerH
  const summary = `${ariaLabel}. ${values.map((n, i) => `${labels?.[i] ?? i + 1} ${n}`).join(', ')}`

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={summary}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(event) => {
          const svg = event.currentTarget
          const rect = svg.getBoundingClientRect()
          const x = ((event.clientX - rect.left) / rect.width) * width
          let nearest = 0
          let dist = Infinity
          points.forEach((p, i) => {
            const d = Math.abs(p.x - x)
            if (d < dist) {
              dist = d
              nearest = i
            }
          })
          setHover(nearest)
        }}
        onPointerDown={() => {
          if (hover != null) onPick?.(hover)
        }}
        style={{ display: 'block', cursor: onPick ? 'pointer' : 'default', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--act-commit)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--act-commit)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {showAverage && (
          <line
            x1={pad.l}
            x2={width - pad.r}
            y1={avgY}
            y2={avgY}
            stroke="var(--muted2)"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
        )}
        {activePt && (
          <line
            x1={activePt.x}
            x2={activePt.x}
            y1={pad.t}
            y2={pad.t + innerH}
            stroke="var(--text)"
            strokeOpacity="0.22"
            strokeWidth="1"
          />
        )}
        <path d={area} fill={`url(#${uid}-fill)`} />
        <path
          className="wp-trace"
          pathLength={1}
          d={line}
          fill="none"
          stroke="var(--act-commit)"
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {showDots &&
          points.map((p) => (
            <circle
              key={p.i}
              cx={p.x}
              cy={p.y}
              r={active === p.i ? 4.2 : 3.2}
              fill="var(--text)"
              stroke="var(--act-commit)"
              strokeWidth="1.4"
            />
          ))}
        {labels?.map((label, i) => {
          const p = points[i]
          if (!p) return null
          return (
            <text
              key={label + i}
              x={p.x}
              y={height - 8}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize="11"
              fontFamily="var(--font-mono)"
            >
              {label}
            </text>
          )
        })}
      </svg>
      {hover != null && points[hover] && (
        <div
          style={{
            position: 'absolute',
            left: `${(points[hover].x / width) * 100}%`,
            top: 0,
            transform: 'translate(-50%, -8px)',
            background: 'var(--surface)',
            border: '1px solid var(--border2)',
            borderRadius: 8,
            padding: '4px 8px',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {labels?.[hover] ? `${labels[hover]} · ` : ''}
          {values[hover]}
        </div>
      )}
    </div>
  )
}

export default PulseChart
