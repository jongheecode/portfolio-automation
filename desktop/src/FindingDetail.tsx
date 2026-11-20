import { useState } from 'react'
import { updateFindingStatus, type NextAction } from './overlayData'

// ruleId 기준: 이미 만든 커밋(large-commit 등)에는 "나눠 커밋" 명령이 맞지 않는다.
const SUGGESTED_COMMAND: Record<string, string> = {
  'commit-split-suggestion': 'git add <파일들> && git commit -m "..."',
}

export default function FindingDetail({ nextAction, onHandled }: { nextAction: NextAction; onHandled: () => void }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (nextAction.tier === 'CLEAR' || nextAction.tier === 'BACKLOG') return null

  const command = (nextAction.ruleId && SUGGESTED_COMMAND[nextAction.ruleId]) || null

  async function copyCommand() {
    if (!command) return
    try {
      await navigator.clipboard.writeText(command)
      setError(null)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('복사 실패 — 명령어를 직접 선택해 복사하세요')
    }
  }

  async function markStatus(status: 'DISMISSED' | 'USED_IN_POST') {
    if (nextAction.findingId == null) return
    try {
      await updateFindingStatus(nextAction.findingId, status)
      setError(null)
      onHandled()
    } catch {
      setError('실패, 다시 시도')
    }
  }

  return (
    <div className="finding-detail">
      {nextAction.evidence && <div className="finding-detail__evidence mono">{nextAction.evidence}</div>}
      {command && (
        <div className="finding-detail__command">
          <code className="mono">{command}</code>
          <button type="button" onClick={() => void copyCommand()}>
            {copied ? '복사됨' : '명령어 복사'}
          </button>
        </div>
      )}
      {nextAction.findingId != null && (
        <div className="finding-detail__actions">
          <button type="button" onClick={() => void markStatus('DISMISSED')}>넘기기</button>
          <button type="button" onClick={() => void markStatus('USED_IN_POST')}>글에 넣었음</button>
        </div>
      )}
      {error && <div className="finding-detail__error" role="alert">{error}</div>}
    </div>
  )
}
