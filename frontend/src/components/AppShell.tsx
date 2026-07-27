import { Navigate, Outlet } from 'react-router-dom'
import { useAppData } from '../contexts/AppDataContext'
import AddRepoModal from './AddRepoModal'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

function AppShell() {
  const { me, loading } = useAppData()

  if (loading) return <p style={{ padding: 40 }}>불러오는 중...</p>
  if (!me) return <Navigate to="/" replace />

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '244px 1fr', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg)' }}>
        <Topbar />
        <main style={{ flex: 1, padding: '30px 34px 60px', maxWidth: 1180, width: '100%', margin: '0 auto' }}>
          <Outlet />
        </main>
      </div>
      <AddRepoModal />
    </div>
  )
}

export default AppShell
