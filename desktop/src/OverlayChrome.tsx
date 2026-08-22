import { useWindowDrag } from './useWindowDrag'

export default function OverlayChrome({
  title,
  onCollapse,
  onHide,
}: {
  title?: string
  onCollapse?: () => void
  onHide?: () => void
}) {
  const drag = useWindowDrag()
  return (
    <div className="chrome">
      <button type="button" className="chrome__drag" {...drag} title="드래그해서 이동">
        {title ?? 'Week Pulse'}
      </button>
      {onCollapse && (
        <button type="button" className="chrome__btn" onClick={onCollapse} title="알약으로 접기">
          접기
        </button>
      )}
      {onHide && (
        <button type="button" className="chrome__btn" onClick={onHide} title="숨기기 · Alt+Ctrl+W">
          숨기기
        </button>
      )}
      <button type="button" className="chrome__btn chrome__btn--quit" onClick={() => window.overlay.quit()} title="오버레이 종료">
        종료
      </button>
    </div>
  )
}
