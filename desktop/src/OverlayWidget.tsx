import { useEffect, useRef, useState } from 'react'
import OverlayChrome from './OverlayChrome'
import OverlayToast from './OverlayToast'
import TrayIndicator from './TrayIndicator'
import WorkContextPanel from './WorkContextPanel'
import { useOverlayData } from './useOverlayData'

declare global {
  interface Window {
    overlay: {
      setMode: (mode: 'collapsed' | 'toast' | 'popover' | 'hud') => void
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
      showInFolder: (repoPath: string, relativePath: string) => void
    }
  }
}

type Mode = 'collapsed' | 'toast' | 'popover' | 'hud'
const AUTO_POPOVER_MS = 5000
const AUTO_TOAST_MS = 5000

const TIER_COLOR: Record<string, string> = {
  SECURITY: '#C4693A',
  STRUCTURE: '#6E9CC4',
  BACKLOG: '#8E979C',
  CLEAR: '#7FAE9B',
}

export default function OverlayWidget() {
  const { me, loggedOut, connectionOk, hasLocalRepo, data, newCommitTick, toast, nextAction, refresh, createBranchDraft, dismissToast } =
    useOverlayData()
  void me
  const [mode, setModeState] = useState<Mode>('collapsed')
  // 자동으로 뜬 팝오버/토스트는 마우스가 올라가 있는 동안 닫히면 안 된다 — 읽는 중에
  // 사라지는 게 가장 거슬리는 부분이었다. ref라서 effect 재실행 없이 타이머가 매번 확인한다.
  const hoveringRef = useRef(false)
  const autoCloseProps = {
    onMouseEnter: () => { hoveringRef.current = true },
    onMouseLeave: () => { hoveringRef.current = false },
  }

  function setMode(next: Mode) {
    setModeState(next)
    window.overlay.setMode(next)
  }

  useEffect(() => {
    return window.overlay.onForceHud(() => {
      if (loggedOut) {
        setMode('collapsed')
        void window.overlay.openLogin()
        return
      }
      setMode('hud')
    })
  }, [loggedOut])

  useEffect(() => {
    return window.overlay.onLoginComplete(() => void refresh())
  }, [refresh])

  useEffect(() => {
    if (newCommitTick === 0) return
    setMode('popover')
    let id: number
    const tryClose = () => {
      if (hoveringRef.current) {
        id = window.setTimeout(tryClose, AUTO_POPOVER_MS)
      } else {
        setMode('collapsed')
      }
    }
    id = window.setTimeout(tryClose, AUTO_POPOVER_MS)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newCommitTick])

  useEffect(() => {
    if (!toast || loggedOut || mode === 'popover' || mode === 'hud') return
    setMode('toast')
    let id: number
    const tryClose = () => {
      if (hoveringRef.current) {
        id = window.setTimeout(tryClose, AUTO_TOAST_MS)
      } else {
        dismissToast()
        setMode('collapsed')
      }
    }
    id = window.setTimeout(tryClose, AUTO_TOAST_MS)
    return () => window.clearTimeout(id)
  }, [toast, loggedOut, mode, dismissToast])

  useEffect(() => {
    if (mode === 'collapsed') return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        dismissToast()
        setMode('collapsed')
      }
      if (e.key === 'Enter' && mode === 'hud') void createBranchDraft()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, createBranchDraft, dismissToast])

  if (loggedOut) {
    return <TrayIndicator label="로그인" dotColor="#C8A05A" onOpenPopover={() => void window.overlay.openLogin()} />
  }

  if (mode === 'toast' && toast) {
    return (
      <div style={{ width: '100%', height: '100%' }} {...autoCloseProps}>
        <OverlayToast
          toast={toast}
          onOpen={() => {
            dismissToast()
            setMode('hud')
          }}
          onCollapse={() => {
            dismissToast()
            setMode('collapsed')
          }}
          onHide={() => window.overlay.hide()}
        />
      </div>
    )
  }

  if (mode === 'collapsed' || mode === 'toast') {
    if (connectionOk && hasLocalRepo && data) {
      return (
        <TrayIndicator
          label={nextAction?.message ?? ''}
          dotColor={TIER_COLOR[nextAction?.tier ?? 'BACKLOG']}
          onOpenPopover={() => setMode('popover')}
        />
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
      <div className="empty-state">
        <OverlayChrome onCollapse={() => setMode('collapsed')} onHide={() => window.overlay.hide()} />
        <div>{message}</div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%' }} {...autoCloseProps}>
      <WorkContextPanel
        data={data}
        variant={mode === 'hud' ? 'hud' : 'popover'}
        nextAction={nextAction}
        onFindingHandled={() => void refresh()}
        onCreateBranchDraft={() => void createBranchDraft()}
        onOpenDashboard={() => window.overlay.openDashboard()}
        onCollapse={() => setMode('collapsed')}
        onHide={() => window.overlay.hide()}
      />
    </div>
  )
}
