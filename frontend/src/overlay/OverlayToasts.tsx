import { useOverlay } from './OverlayContext'

function OverlayToasts() {
  const { toasts, dismissToast, openHud } = useOverlay()
  if (toasts.length === 0) return null
  return (
    <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 80, display: 'flex', flexDirection: 'column', gap: 8, width: 320 }}>
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => {
            dismissToast(toast.id)
            openHud()
          }}
          className="overlay-toast"
          style={{
            textAlign: 'left',
            background: 'color-mix(in srgb, var(--panel) 94%, transparent)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border2)',
            borderRadius: 12,
            padding: '12px 14px',
            color: 'inherit',
            cursor: 'pointer',
            boxShadow: '0 16px 40px rgba(0,0,0,.35)',
            animation: 'overlay-toast .22s cubic-bezier(.2,.8,.2,1) both',
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{toast.title}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>{toast.body}</div>
        </button>
      ))}
    </div>
  )
}

export default OverlayToasts
