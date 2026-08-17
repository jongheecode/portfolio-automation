import { useAppData } from '../contexts/AppDataContext'

function RepoScopeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { trackedRepos, setAiScope } = useAppData()
  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '80px 20px',
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 18,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>AI에 보낼 레포</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
              비공개 레포는 기본적으로 꺼져 있습니다. 켠 레포의 커밋 메시지만 초안 생성에 쓰입니다.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
          >
            닫기
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {trackedRepos.map((repo) => (
            <label
              key={repo.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 10,
                background: 'var(--panel2)',
                fontSize: 13,
              }}
            >
              <span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{repo.fullName}</span>
                {repo.isPrivate && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--muted2)' }}>private</span>
                )}
              </span>
              <input
                type="checkbox"
                checked={repo.aiScopeEnabled !== false}
                onChange={(e) => void setAiScope(repo.id, e.target.checked)}
              />
            </label>
          ))}
          {trackedRepos.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>추적 중인 레포가 없어요.</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RepoScopeModal
