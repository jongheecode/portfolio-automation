import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAppData } from '../contexts/AppDataContext'
import { useTheme } from '../contexts/ThemeContext'
import RepoScopeModal from '../components/RepoScopeModal'
import { useOverlay } from '../overlay/OverlayContext'
import { overlayShortcutLabel } from '../utils/week'

function SettingsPage() {
  const { me, trackedRepos } = useAppData()
  const { quiet, setQuiet, local, watchPath, unwatch } = useOverlay()
  const [localPath, setLocalPath] = useState('')
  const { themeLabel, toggleTheme } = useTheme()
  const [apiKey, setApiKey] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoSync, setAutoSync] = useState(me?.autoSync !== false)
  const [savingAuto, setSavingAuto] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [desktopRunning, setDesktopRunning] = useState<boolean | null>(null)
  const [desktopBusy, setDesktopBusy] = useState(false)

  useEffect(() => {
    api.syncStatus().then((status) => {
      if (status.autoSync != null) setAutoSync(status.autoSync)
    }).catch(() => {})
    api.overlayStatus().then((status) => setDesktopRunning(status.running)).catch(() => {})
  }, [])

  async function handleConnectDevTo() {
    if (!apiKey.trim()) return
    setConnecting(true)
    setError(null)
    try {
      await api.connectDevTo(apiKey.trim())
      window.location.reload()
    } catch (err) {
      setError((err as Error).message)
      setConnecting(false)
    }
  }

  async function handleDisconnectDevTo() {
    try {
      await api.disconnectDevTo()
      window.location.reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleAutoSync(enabled: boolean) {
    setSavingAuto(true)
    setError(null)
    try {
      const next = await api.setAutoSync(enabled)
      setAutoSync(next.autoSync !== false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSavingAuto(false)
    }
  }

  const scopedCount = trackedRepos.filter((repo) => repo.aiScopeEnabled !== false).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 640 }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>설정</h1>

      {error && <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>{error}</p>}

      <div style={{ border: '1px solid var(--border)', borderRadius: 13, background: 'var(--panel)', boxShadow: 'var(--card-shadow)', overflow: 'hidden' }}>
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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>dev.to 연동</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
              {me?.devtoConnected ? `@${me.devtoUsername}로 발행` : '연결하면 블로그 글을 실제로 발행할 수 있어요'}
            </div>
          </div>
          {me?.devtoConnected ? (
            <button
              type="button"
              onClick={handleDisconnectDevTo}
              style={{ fontSize: 13, color: 'var(--muted)', background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer' }}
            >
              연결 해제
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="dev.to API 키"
                style={{
                  fontSize: 13,
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                  padding: '5px 10px',
                  background: 'var(--panel2)',
                  color: 'var(--text)',
                  width: 200,
                }}
              />
              <button
                type="button"
                onClick={handleConnectDevTo}
                disabled={connecting || !apiKey.trim()}
                style={{
                  fontSize: 13,
                  color: '#fff',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 7,
                  padding: '5px 12px',
                  cursor: connecting ? 'default' : 'pointer',
                  opacity: connecting || !apiKey.trim() ? 0.6 : 1,
                }}
              >
                {connecting ? '연결 중...' : '연결하기'}
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>자동 동기화</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
              하루 네 번(03·09·15·21시, 서울)과 로그인 직후에 GitHub에서 가져옵니다
            </div>
          </div>
          <button
            type="button"
            disabled={savingAuto}
            onClick={() => void handleAutoSync(!autoSync)}
            style={{
              fontSize: 13,
              color: autoSync ? '#142028' : 'var(--muted)',
              background: autoSync ? 'var(--act-commit)' : 'var(--panel2)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              padding: '5px 12px',
              cursor: savingAuto ? 'default' : 'pointer',
            }}
          >
            {autoSync ? '켜짐' : '꺼짐'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>AI에 보낼 레포</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
              {trackedRepos.length}개 중 {scopedCount}개가 초안 생성에 포함됩니다
            </div>
          </div>
          <button
            type="button"
            onClick={() => setScopeOpen(true)}
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
            범위 설정
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>데스크톱 오버레이</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
              {desktopRunning == null ? '상태를 확인하는 중' : desktopRunning ? '실행 중 · 화면에서 안 보이면 끄고 다시 켜보세요' : '꺼져 있음'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={desktopBusy || desktopRunning === true}
              onClick={() => {
                setDesktopBusy(true)
                void api.startOverlay()
                  .then((status) => setDesktopRunning(status.running))
                  .catch((err) => setError((err as Error).message))
                  .finally(() => setDesktopBusy(false))
              }}
              style={{
                fontSize: 13,
                color: 'var(--text)',
                background: 'var(--panel2)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                padding: '5px 12px',
                cursor: desktopBusy || desktopRunning === true ? 'default' : 'pointer',
              }}
            >
              켜기
            </button>
            <button
              type="button"
              disabled={desktopBusy || desktopRunning === false}
              onClick={() => {
                setDesktopBusy(true)
                void api.stopOverlay()
                  .then((status) => setDesktopRunning(status.running))
                  .catch((err) => setError((err as Error).message))
                  .finally(() => setDesktopBusy(false))
              }}
              style={{
                fontSize: 13,
                color: desktopRunning ? '#142028' : 'var(--muted)',
                background: desktopRunning ? 'var(--act-plan)' : 'var(--panel2)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                padding: '5px 12px',
                cursor: desktopBusy || desktopRunning === false ? 'default' : 'pointer',
              }}
            >
              끄기
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>오버레이 조용한 모드</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
              켜면 트레이에 숫자 없이 "오늘"만 보이고, HUD도 오늘 값만 강조합니다. {overlayShortcutLabel()} 로 HUD를 엽니다.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setQuiet(!quiet)}
            style={{
              fontSize: 13,
              color: quiet ? '#142028' : 'var(--muted)',
              background: quiet ? 'var(--act-commit)' : 'var(--panel2)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              padding: '5px 12px',
              cursor: 'pointer',
            }}
          >
            {quiet ? '켜짐' : '꺼짐'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>로컬 git 감시</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
              이 컴퓨터의 폴더를 등록하면 push 안 한 커밋·작업 중 파일이 오버레이에 보입니다.
            </div>
          </div>
          {(local?.repos ?? []).map((repo) => (
            <div key={repo.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: repo.ok ? (repo.changedFileCount > 0 ? 'var(--act-plan)' : 'var(--act-commit)') : 'var(--muted2)', flex: 'none' }} />
              <span style={{ fontFamily: 'var(--font-mono)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {repo.path}
                {repo.ok ? ` · ${repo.branch ?? ''}` : ` · ${repo.error ?? '읽기 실패'}`}
              </span>
              <button type="button" onClick={() => void unwatch(repo.id)} style={{ fontSize: 12, color: 'var(--muted)', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
                해제
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              placeholder="C:\Users\jongh\Desktop\Portfolio"
              style={{ flex: 1, fontSize: 13, border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px', background: 'var(--panel2)', color: 'var(--text)' }}
            />
            <button
              type="button"
              onClick={() => {
                if (!localPath.trim()) return
                void watchPath(localPath.trim()).then(() => setLocalPath('')).catch((err) => setError((err as Error).message))
              }}
              style={{ fontSize: 13, color: 'var(--text)', background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer' }}
            >
              등록
            </button>
          </div>
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
      <RepoScopeModal open={scopeOpen} onClose={() => setScopeOpen(false)} />
    </div>
  )
}

export default SettingsPage
