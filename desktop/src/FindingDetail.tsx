import { useState } from 'react'
import { updateFindingStatus, type NextAction } from './overlayData'

const SUGGESTED_COMMAND: Record<string, (evidence: string) => string> = {
  STRUCTURE: () => 'git add <파일들> && git commit -m "..."',
}

export default function FindingDetail({ nextAction, onHandled }: { nextAction: NextAction; onHandled: () => void }) {
  const [copied, setCopied] = useState(false)

  if (nextAction.tier === 'CLEAR' || nextAction.tier === 'BACKLOG') return null

  const command = nextAction.tier === 'STRUCTURE' ? SUGGESTED_COMMAND.STRUCTURE(nextAction.evidence ?? '') : null

  async function copyCommand() {
    if (!command) return
    await navigator.clipboard.writeText(command)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  async function markStatus(status: 'DISMISSED' | 'USED_IN_POST') {
    if (nextAction.findingId == null) return
    await updateFindingStatus(nextAction.findingId, status)
    onHandled()
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
    </div>
  )
}
