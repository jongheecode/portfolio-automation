import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAppData } from '../contexts/AppDataContext'
import { useTheme } from '../contexts/ThemeContext'

const TITLES: Record<string, string> = {
  '/dashboard': '대시보드',
  '/commits': '커밋 기록',
  '/blog': '블로그 포스팅',
  '/pdf': '포트폴리오 PDF',
  '/settings': '설정',
}

function Topbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams()
  const { openAddRepo } = useAppData()
  const { toggleTheme } = useTheme()

  const isRepoDetail = location.pathname.startsWith('/repos/') && !!params.id
  const pageTitle = isRepoDetail ? '커밋 타임라인' : TITLES[location.pathname] ?? '대시보드'

  return (
    <header
      style={{
        height: 60,
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 26px',
        position: 'sticky',
        top: 0,
        background: 'var(--bg-blur)',
        backdropFilter: 'blur(8px)',
        zIndex: 5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
        {isRepoDetail && (
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7}>
              <path d="M10 3L5 8l5 5" />
            </svg>
            뒤로
          </button>
        )}
        <span>{pageTitle}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '7px 11px',
            width: 200,
            color: 'var(--muted2)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <span style={{ fontSize: 13 }}>레포·커밋 검색</span>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          title="테마 전환"
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            color: 'var(--muted)',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="8" cy="8" r="3.2" />
            <path d="M8 1v1.4M8 13.6V15M15 8h-1.4M2.4 8H1M12.9 3.1l-1 1M4.1 11.9l-1 1M12.9 12.9l-1-1M4.1 4.1l-1-1" />
          </svg>
        </button>
        <button
          type="button"
          onClick={openAddRepo}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M8 3v10M3 8h10" />
          </svg>
          GitHub 레포 추가
        </button>
      </div>
    </header>
  )
}

export default Topbar
