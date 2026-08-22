import { useRef } from 'react'

interface Props {
  label?: string
  dotColor?: string
  onOpenPopover: () => void
  children?: React.ReactNode
}

export default function TrayIndicator({ label = '', dotColor = '#6E9CC4', onOpenPopover, children }: Props) {
  const dragging = useRef(false)
  const moved = useRef(false)

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    dragging.current = true
    moved.current = false
    window.overlay.dragStart()
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove() {
    if (!dragging.current) return
    moved.current = true
    window.overlay.dragMove()
  }

  function handlePointerUp() {
    if (!dragging.current) return
    dragging.current = false
    window.overlay.dragEnd()
    if (!moved.current) onOpenPopover()
  }

  return (
    <div className="tray" onContextMenu={(e) => { e.preventDefault(); window.overlay.menu() }}>
      <button
        type="button"
        className="tray__main"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        title="클릭해서 열기 · 드래그해서 이동"
      >
        {children ?? (
          <>
            <span className="tray__dot" style={{ background: dotColor, boxShadow: `0 0 8px ${dotColor}` }} />
            <span className="tray__label">{label}</span>
          </>
        )}
      </button>
      <button
        type="button"
        className="tray__hide"
        title="숨기기 · Alt+Ctrl+W로 다시 열기"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          window.overlay.hide()
        }}
      >
        ×
      </button>
    </div>
  )
}
