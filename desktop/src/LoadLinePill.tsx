// "적재선" (load line) 알약 — Overlay Direction.dc.html의 4a안(추천 시안) 구현.
// 배 흘수선처럼 기준선 아래로 세 개의 "문"(커밋 안 한 파일 / push 대기 / 글 안 씀)이
// 밀린 만큼 가라앉는다. 다 내보내면 완전히 평평한 한 줄이 된다.

const C_FILE = '#c8a05a'
const C_PUSH = '#6e9cc4'
const C_WRITE = '#7fae9b'
const BANDS: [number, number][] = [
  [14, 88],
  [90, 158],
  [160, 228],
]

function depthOf(n: number, cap: number): number {
  if (n <= 0) return 0
  return Math.min(cap, 3 + Math.round(Math.pow(n / 21, 0.62) * (cap - 3)))
}

function gatePath(x0: number, x1: number, depth: number): string {
  if (depth <= 0) return ''
  const y = 14
  const b = y + depth
  const r = Math.min(4, depth)
  return `M ${x0} ${y} L ${x0} ${b - r} Q ${x0} ${b} ${x0 + r} ${b} L ${x1 - r} ${b} Q ${x1} ${b} ${x1} ${b - r} L ${x1} ${y} Z`
}

export interface LoadLineCounts {
  uncommittedFiles: number
  unpushedCommits: number
  unwrittenCommits: number
}

export default function LoadLinePill({
  counts,
  cap = 17,
  showCounts = true,
}: {
  counts: LoadLineCounts
  cap?: number
  showCounts?: boolean
}) {
  const vals = [counts.uncommittedFiles, counts.unpushedCommits, counts.unwrittenCommits]
  const cols = [C_FILE, C_PUSH, C_WRITE]
  const gates = BANDS.map(([x0, x1], i) => {
    const depth = depthOf(vals[i], cap)
    return {
      path: gatePath(x0, x1, depth),
      color: cols[i],
      tx: (x0 + x1) / 2,
      count: vals[i] > 0 ? String(vals[i]) : '',
    }
  })

  return (
    <svg
      viewBox="0 0 240 36"
      width={240}
      height={36}
      style={{ display: 'block' }}
      role="img"
      aria-label={`커밋 안 한 파일 ${vals[0]}개, push 대기 ${vals[1]}개, 글로 안 쓴 커밋 ${vals[2]}개`}
    >
      <line x1={12} y1={14} x2={228} y2={14} stroke="#5a6368" strokeWidth={1.5} />
      {gates.map((g, i) => (
        <g key={i}>
          {g.path && <path d={g.path} fill={g.color} opacity={0.92} />}
          {showCounts && g.count && (
            <text
              x={g.tx}
              y={12}
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
              fontSize={11}
              fill="#c9d0d3"
            >
              {g.count}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}
