import OverlayChrome from './OverlayChrome'

export interface OverlayToastData {
  title: string
  body: string
}

export default function OverlayToast({
  toast,
  onOpen,
  onCollapse,
  onHide,
}: {
  toast: OverlayToastData
  onOpen: () => void
  onCollapse: () => void
  onHide: () => void
}) {
  return (
    <div className="overlay-toast">
      <OverlayChrome onCollapse={onCollapse} onHide={onHide} />
      <button type="button" className="overlay-toast__hit" onClick={onOpen}>
        <div className="overlay-toast__title">{toast.title}</div>
        <div className="overlay-toast__body">{toast.body}</div>
      </button>
    </div>
  )
}
