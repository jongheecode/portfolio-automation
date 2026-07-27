import { api } from '../api/client'
import { useTheme } from '../contexts/ThemeContext'
import Heatmap from '../components/Heatmap'

const DEMO_COMMITS = Array.from({ length: 60 }, () => {
  const d = new Date()
  d.setDate(d.getDate() - Math.floor(Math.random() * 180))
  return d.toISOString()
})

function LoginPage() {
  const { themeLabel, toggleTheme } = useTheme()

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.1fr 1fr' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 72, gap: 40, position: 'relative' }}>
        <button
          type="button"
          onClick={toggleTheme}
          style={{
            position: 'absolute',
            top: 28,
            left: 28,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--muted)',
            borderRadius: 8,
            padding: '7px 11px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
          {themeLabel}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth={1.6}>
              <path d="M2 12 L6 6 L9 9 L14 3" />
              <circle cx="14" cy="3" r="1.4" fill="#fff" stroke="none" />
            </svg>
          </div>
          <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em' }}>Portfolio Automation</span>
        </div>

        <div style={{ maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h1 style={{ margin: 0, fontSize: 42, lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 600 }}>
            코드를 남기면,
            <br />
            커리어가 기록됩니다.
          </h1>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: 'var(--muted)' }}>
            GitHub 커밋 기록을 기반으로 개발 활동을 자동으로 정리하고, 기술 블로그와 포트폴리오 PDF까지 이어지는
            개인 개발자용 워크스페이스.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 380 }}>
          <a href={api.loginUrl()}>
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                background: 'var(--gh-btn)',
                color: 'var(--gh-btn-fg)',
                border: '1px solid var(--gh-btn-border)',
                borderRadius: 10,
                padding: '14px 18px',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <svg width="19" height="19" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              GitHub로 로그인
            </button>
          </a>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted2)', lineHeight: 1.5 }}>
            로그인하면 공개 레포지토리의 커밋 메타데이터에 대한 읽기 권한을 요청합니다. 코드 내용은 저장하지 않습니다.
          </p>
        </div>
      </div>

      <div
        style={{
          borderLeft: '1px solid var(--border)',
          background: 'var(--bg2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            boxShadow: '0 24px 60px -24px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: "'Geist Mono', monospace" }}>this week</span>
            <span style={{ fontSize: 13, color: 'var(--green)', fontFamily: "'Geist Mono', monospace" }}>+37 commits</span>
          </div>
          <Heatmap committedAts={DEMO_COMMITS} weeks={18} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00B4AB' }} />
              <span style={{ color: 'var(--muted)', fontFamily: "'Geist Mono', monospace" }}>feat:</span>
              <span>홈 화면 위치 기반 추천 UI</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#A97BFF' }} />
              <span style={{ color: 'var(--muted)', fontFamily: "'Geist Mono', monospace" }}>fix:</span>
              <span>동시성 이슈 낙관적 락 적용</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f34b7d' }} />
              <span style={{ color: 'var(--muted)', fontFamily: "'Geist Mono', monospace" }}>feat:</span>
              <span>파이프 기반 IPC 데모 구현</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
