import { buildHeatmap } from '../utils/heatmap'

function Heatmap({ committedAts, weeks = 26 }: { committedAts: string[]; weeks?: number }) {
  const columns = buildHeatmap(committedAts, weeks)
  return (
    <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 2 }}>
      {columns.map((col, w) => (
        <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {col.map((cell) => (
            <div
              key={cell.date}
              title={`${cell.date}: ${cell.count}커밋`}
              style={{ width: 11, height: 11, borderRadius: 2, background: `var(--heat-${cell.level})` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export default Heatmap
