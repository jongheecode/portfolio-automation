import { useState } from 'react'
import { api } from '../api/client'
import { useAppData } from '../contexts/AppDataContext'
import { useTheme } from '../contexts/ThemeContext'

function SettingsPage() {
  const { me } = useAppData()
  const { themeLabel, toggleTheme } = useTheme()
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConnectTistory() {
    setConnecting(true)
    try {
      const { url } = await api.tistoryAuthorizeUrl()
      window.location.href = url
    } catch (err) {
      setError((err as Error).message)
      setConnecting(false)
    }
  }

  async function handleDisconnectTistory() {
    try {
      await api.disconnectTistory()
      window.location.reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 640 }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>설정</h1>

      {error && <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>{error}</p>}

      <div style={{ border: '1px solid var(--border)', borderRadius: 13, background: 'var(--panel)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>GitHub 연동</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>@{me?.username} 계정으로 연결됨</div>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--green)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} />
            연결됨
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>티스토리 연동</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
              {me?.tistoryConnected ? `${me.tistoryBlogName}.tistory.com에 발행` : '연결하면 블로그 글을 실제로 발행할 수 있어요'}
            </div>
          </div>
          {me?.tistoryConnected ? (
            <button
              type="button"
              onClick={handleDisconnectTistory}
              style={{ fontSize: 13, color: 'var(--muted)', background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer' }}
            >
              연결 해제
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnectTistory}
              disabled={connecting}
              style={{
                fontSize: 13,
                color: '#fff',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 7,
                padding: '5px 12px',
                cursor: connecting ? 'default' : 'pointer',
                opacity: connecting ? 0.6 : 1,
              }}
            >
              {connecting ? '이동 중...' : '연결하기'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>커밋 동기화</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
              레포 상세 페이지의 "지금 동기화" 버튼으로 수동으로 가져옵니다
            </div>
          </div>
          <span style={{ fontSize: 13, color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px' }}>
            수동
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>테마</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>밝기 모드를 전환합니다</div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            style={{
              fontSize: 13,
              color: 'var(--text)',
              background: 'var(--panel2)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              padding: '5px 12px',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            {themeLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
