import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppData } from '../contexts/AppDataContext'
import AddRepoModal from './AddRepoModal'
import OverlayToasts from '../overlay/OverlayToasts'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

function AppShell() {
  const { me, loading } = useAppData()
  const location = useLocation()
  const isDashboard = location.pathname === '/dashboard'

  if (loading) return <p style={{ padding: 40 }}>불러오는 중...</p>
  if (!me) return <Navigate to="/" replace />

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '244px 1fr', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg)' }}>
        <Topbar />
        <main
          style={{
            flex: 1,
            padding: isDashboard ? '24px 22px 48px' : '30px 34px 60px',
            maxWidth: isDashboard ? 1480 : 1180,
            width: '100%',
            margin: '0 auto',
          }}
        >
          <Outlet />
        </main>
      </div>
      <AddRepoModal />
      <OverlayToasts />
    </div>
  )
}

export default AppShell
