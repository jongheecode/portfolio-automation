import { useWindowDrag } from './useWindowDrag'

interface Props {
  label?: string
  dotColor?: string
  onOpenPopover: () => void
  children?: React.ReactNode
}

export default function TrayIndicator({ label = '', dotColor = '#6E9CC4', onOpenPopover, children }: Props) {
  const drag = useWindowDrag(onOpenPopover)

  return (
    <div className="tray" onContextMenu={(e) => { e.preventDefault(); window.overlay.menu() }}>
      <button type="button" className="tray__main" {...drag} title="클릭해서 열기 · 드래그해서 이동">
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
