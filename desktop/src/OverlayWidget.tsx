import { useEffect, useState } from 'react'
import LoadLinePill from './LoadLinePill'
import TrayIndicator from './TrayIndicator'
import WorkContextPanel from './WorkContextPanel'
import { useOverlayData } from './useOverlayData'

declare global {
  interface Window {
    overlay: {
      setMode: (mode: 'collapsed' | 'popover' | 'hud') => void
      onForceHud: (callback: () => void) => () => void
      dragStart: () => void
      dragMove: () => void
      dragEnd: () => void
      openDashboard: () => void
      openSettings: () => void
      openLogin: () => Promise<void>
      onLoginComplete: (callback: () => void) => () => void
      hide: () => void
      quit: () => void
      menu: () => void
    }
  }
}

type Mode = 'collapsed' | 'popover' | 'hud'
const AUTO_POPOVER_MS = 5000

export default function OverlayWidget() {
  const { me, loggedOut, connectionOk, hasLocalRepo, data, newCommitTick, refresh, createBranchDraft } =
    useOverlayData()
  void me
  const [mode, setModeState] = useState<Mode>('collapsed')

  function setMode(next: Mode) {
    setModeState(next)
    window.overlay.setMode(next)
  }

  useEffect(() => {
    return window.overlay.onForceHud(() => setMode('hud'))
  }, [])

  useEffect(() => {
    return window.overlay.onLoginComplete(() => void refresh())
  }, [refresh])

  useEffect(() => {
    if (newCommitTick === 0) return
    setMode('popover')
    const id = window.setTimeout(() => setMode('collapsed'), AUTO_POPOVER_MS)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newCommitTick])

  useEffect(() => {
    if (mode === 'collapsed') return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMode('collapsed')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  if (loggedOut) {
    return <TrayIndicator label="로그인" dotColor="#C8A05A" onOpenPopover={() => void window.overlay.openLogin()} />
  }

  if (mode === 'collapsed') {
    if (connectionOk && hasLocalRepo && data) {
      // 적재선(Overlay Direction.dc.html 4a안): 커밋 안 한 파일 / push 대기 / 글 안 쓴 커밋이
      // 기준선 아래로 얼마나 밀렸는지 한 실루엣으로 보여준다. 다 내보내면 평평한 한 줄.
      return (
        <TrayIndicator onOpenPopover={() => setMode('popover')}>
          <LoadLinePill
            counts={{
              uncommittedFiles: data.changedFileCount,
              unpushedCommits: data.unpushedCount,
              unwrittenCommits: data.branchCommitCount,
            }}
          />
        </TrayIndicator>
      )
    }
    const label = !connectionOk ? '연결 안 됨' : '레포 없음'
    return (
      <TrayIndicator
        label={label}
        dotColor="#8E979C"
        onOpenPopover={() => window.overlay.openSettings()}
      />
    )
  }

  if (!data) {
    const message = !connectionOk
      ? '백엔드에 연결할 수 없어요. Docker/서버가 떠 있는지 확인해주세요.'
      : '감시 중인 로컬 레포가 없어요. 브라우저 대시보드에서 등록해주세요.'
    return (
      <div className="empty-state">{message}</div>
    )
  }

  return (
    <WorkContextPanel
      data={data}
      variant={mode === 'hud' ? 'hud' : 'popover'}
      onCreateBranchDraft={() => void createBranchDraft()}
      onOpenDashboard={() => window.overlay.openDashboard()}
    />
  )
}
