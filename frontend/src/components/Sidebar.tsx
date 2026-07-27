import type { CSSProperties, ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAppData } from '../contexts/AppDataContext'

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--muted2)',
  padding: '4px 10px 6px',
}

const soonBadgeStyle: CSSProperties = {
  marginLeft: 'auto',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--muted2)',
  border: '1px solid var(--border)',
  borderRadius: 5,
  padding: '1px 6px',
}

function NavItem({ to, label, icon, badge }: { to: string; label: string; icon: ReactNode; badge?: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 10px',
        borderRadius: 8,
        fontSize: 13.5,
        transition: 'background .12s, color .12s',
        background: isActive ? 'var(--accent-soft)' : 'transparent',
        color: isActive ? 'var(--text)' : 'var(--muted)',
        fontWeight: isActive ? 600 : 500,
      })}
    >
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
      {badge && <span style={soonBadgeStyle}>{badge}</span>}
    </NavLink>
  )
}

function Sidebar() {
  const { me, logout } = useAppData()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <aside
      style={{
        borderRight: '1px solid var(--border)',
        background: 'var(--bg2)',
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 14px',
        gap: 22,
        position: 'sticky',
        top: 0,
        height: '100vh',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth={1.6}>
            <path d="M2 12 L6 6 L9 9 L14 3" />
            <circle cx="14" cy="3" r="1.4" fill="#fff" stroke="none" />
          </svg>
        </div>
        <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>Portfolio Automation</span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={sectionLabelStyle}>워크스페이스</div>
        <NavItem
          to="/dashboard"
          label="대시보드"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <rect x="2" y="2" width="5" height="5" rx="1" />
              <rect x="9" y="2" width="5" height="5" rx="1" />
              <rect x="2" y="9" width="5" height="5" rx="1" />
              <rect x="9" y="9" width="5" height="5" rx="1" />
            </svg>
          }
        />
        <NavItem
          to="/commits"
          label="커밋 기록"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="8" cy="8" r="2.4" />
              <path d="M8 1.2v3.9M8 10.6v4.2" />
            </svg>
          }
        />
        <div style={sectionLabelStyle}>자동화</div>
        <NavItem
          to="/blog"
          label="블로그 포스팅"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <rect x="2.5" y="2" width="11" height="12" rx="1.5" />
              <path d="M5 5.5h6M5 8h6M5 10.5h3.5" />
            </svg>
          }
        />
        <NavItem
          to="/pdf"
          label="포트폴리오 PDF"
          badge="곧"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M8 2v7M8 9l3-3M8 9L5 6" />
              <path d="M2.5 11v2.5h11V11" />
            </svg>
          }
        />
      </nav>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <NavItem
          to="/settings"
          label="설정"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="8" cy="8" r="2.2" />
              <circle cx="8" cy="8" r="6" />
            </svg>
          }
        />
        <div style={{ height: 1, background: 'var(--border)', margin: '8px 6px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px' }}>
          {me?.avatarUrl && (
            <img
              src={me.avatarUrl}
              alt=""
              style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border2)' }}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {me?.username}
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="로그아웃"
            style={{ background: 'transparent', border: 'none', color: 'var(--muted2)', cursor: 'pointer', padding: 4 }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M6 2.5H3.5v11H6M10 5l3 3-3 3M13 8H6.5" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
