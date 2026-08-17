import { overlayShortcutLabel } from '../utils/week'
import { useOverlay } from './OverlayContext'
import OverlayHud from './OverlayHud'
import OverlayPopover from './OverlayPopover'

function OverlayTray() {
  const { quiet, todayCount, active, mode, togglePopover, close } = useOverlay()
  const shortcut = overlayShortcutLabel()
  const wip = !!active?.ok && active.changedFileCount > 0
  const emptyDay = todayCount === 0 && !wip
  const label = quiet
    ? wip
      ? 'WIP'
      : '오늘'
    : wip
      ? `+${active.additions}`
      : emptyDay
        ? '오늘'
        : `오늘 ${todayCount}`
  const dot = wip ? 'var(--act-plan)' : emptyDay ? 'var(--muted2)' : 'var(--act-commit)'

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={togglePopover}
        title={`작업 컨텍스트 · ${shortcut}`}
        aria-label={`작업 컨텍스트, ${label}`}
        aria-expanded={mode === 'popover'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 8px',
          borderRadius: 6,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          cursor: 'pointer',
          height: 36,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: dot,
            boxShadow: emptyDay ? 'none' : `0 0 8px ${dot}`,
          }}
        />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{label}</span>
      </button>
      {mode === 'popover' && (
        <>
          <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
          <OverlayPopover />
        </>
      )}
      {mode === 'hud' && <OverlayHud />}
    </div>
  )
}

export default OverlayTray
