import { formatMonthDay } from '../utils/week'
import PulseChart from './PulseChart'

function ActivityChart({
  weekly,
  selectedStart,
  onPick,
}: {
  weekly: { weekStart: string; count: number }[]
  selectedStart: string
  onPick: (weekStart: string) => void
}) {
  const values = weekly.map((w) => w.count)
  const labels = weekly.map((w, i) => (i % 2 === 0 || i === weekly.length - 1 ? formatMonthDay(w.weekStart) : ''))
  const selectedIndex = weekly.findIndex((w) => w.weekStart === selectedStart)
  const avg = values.length ? Math.round(values.reduce((s, n) => s + n, 0) / values.length) : 0

  return (
    <section
      style={{
        border: '1px solid var(--border)',
        borderRadius: 14,
        background: 'var(--panel)',
        padding: '14px 16px 10px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>최근 12주</div>
        <span style={{ fontSize: 12, color: 'var(--muted2)', fontFamily: 'var(--font-mono)' }}>평균 {avg}</span>
      </div>
      <PulseChart
        values={values}
        labels={labels}
        selectedIndex={selectedIndex >= 0 ? selectedIndex : undefined}
        onPick={(index) => onPick(weekly[index].weekStart)}
        height={168}
        showAverage
        ariaLabel="최근 12주 커밋 곡선"
      />
    </section>
  )
}

export default ActivityChart
