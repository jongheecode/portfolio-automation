import { buildHeatmap } from '../utils/heatmap'

function Heatmap({
  committedAts,
  weeks = 26,
  selectedStart,
  selectedEnd,
  onPick,
}: {
  committedAts: string[]
  weeks?: number
  selectedStart?: string
  selectedEnd?: string
  onPick?: (date: string) => void
}) {
  const columns = buildHeatmap(committedAts, weeks)
  return (
    <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 2 }}>
      {columns.map((col, w) => (
        <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {col.map((cell) => {
            const selected = !!selectedStart && !!selectedEnd && cell.date >= selectedStart && cell.date <= selectedEnd
            return (
              <button
                key={cell.date}
                type="button"
                title={`${cell.date}: ${cell.count}커밋`}
                onClick={() => onPick?.(cell.date)}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  padding: 0,
                  border: selected ? '1px solid var(--accent)' : '1px solid transparent',
                  background: `var(--heat-${cell.level})`,
                  cursor: onPick ? 'pointer' : 'default',
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default Heatmap
