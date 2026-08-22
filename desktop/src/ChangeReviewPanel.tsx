import { useState } from 'react'
import type { DiffHunk, LocalDiffReview } from './overlayData'

export default function ChangeReviewPanel({
  review,
  compact,
}: {
  review: LocalDiffReview | null
  compact?: boolean
}) {
  const files = review?.files ?? []
  const [active, setActive] = useState(files[0]?.path ?? '')
  const selected = files.find((file) => file.path === active) ?? files[0]

  if (!review) {
    return <div className="review__empty">변경을 읽는 중…</div>
  }

  return (
    <div className="review">
      <div className="review__notes">
        {(review.notes.length ? review.notes : ['커밋 안 한 변경이 없습니다.']).map((note) => (
          <div key={note} className="review__note">{note}</div>
        ))}
      </div>
      {files.length > 0 && (
        <div className="review__files">
          {files.slice(0, compact ? 4 : 8).map((file) => (
            <button
              key={file.path}
              type="button"
              className={file.path === selected?.path ? 'review__file review__file--on' : 'review__file'}
              onClick={() => setActive(file.path)}
            >
              <span className="mono review__path">{file.path}</span>
              <span className="mono review__stat">+{file.additions} −{file.deletions}</span>
            </button>
          ))}
        </div>
      )}
      {selected && <DiffView file={selected} compact={compact} />}
    </div>
  )
}

function DiffView({ file, compact }: { file: DiffHunk; compact?: boolean }) {
  const lines = file.patch.split('\n').slice(0, compact ? 18 : 36)
  return (
    <pre className="review__diff">
      {lines.map((line, i) => (
        <div
          key={`${file.path}-${i}`}
          className={line.startsWith('+') ? 'review__add' : line.startsWith('-') ? 'review__del' : undefined}
        >
          {line || ' '}
        </div>
      ))}
    </pre>
  )
}
