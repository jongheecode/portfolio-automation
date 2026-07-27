import { useAppData } from '../contexts/AppDataContext'
import { useTheme } from '../contexts/ThemeContext'

function SettingsPage() {
  const { me } = useAppData()
  const { themeLabel, toggleTheme } = useTheme()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 640 }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>설정</h1>
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
