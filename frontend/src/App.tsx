import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import { AppDataProvider, useAppData } from './contexts/AppDataContext'
import BlogPage from './pages/BlogPage'
import BlogPostDetailPage from './pages/BlogPostDetailPage'
import CommitsFeedPage from './pages/CommitsFeedPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import PdfPage from './pages/PdfPage'
import RepoDetailPage from './pages/RepoDetailPage'
import SettingsPage from './pages/SettingsPage'

function RootRoute() {
  const { me, loading } = useAppData()
  if (loading) return <p style={{ padding: 40 }}>불러오는 중...</p>
  if (me) return <Navigate to="/dashboard" replace />
  return <LoginPage />
}

function App() {
  return (
    <AppDataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/repos/:id" element={<RepoDetailPage />} />
            <Route path="/commits" element={<CommitsFeedPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:id" element={<BlogPostDetailPage />} />
            <Route path="/pdf" element={<PdfPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppDataProvider>
  )
}

export default App
