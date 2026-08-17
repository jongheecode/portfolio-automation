import { useNavigate } from 'react-router-dom'
import PulseChart from '../components/PulseChart'
import { formatOverlayDate, formatSeoulTime, overlayShortcutLabel, seoulToday } from '../utils/week'
import { useOverlay } from './OverlayContext'
import { shortPath, wipTagStyle } from './wipStyle'

function OverlayPopover() {
  const navigate = useNavigate()
  const {
    week,
    active,
    todayCount,
    weekTotal,
    todayIndex,
    unwritten,
    close,
    openHud,
    createDraft,
    createBranchDraft,
    generating,
  } = useOverlay()
  if (!week) return null

  const values = week.days.map((day) => day.commitCount ?? day.commits.length)
  const shortcut = overlayShortcutLabel()
  const wip = !!active?.ok && active.changedFileCount > 0
  const todayCommits =
    active?.ok && active.todayCommits.length
      ? active.todayCommits
      : (week.days[todayIndex]?.commits ?? []).slice(0, 3).map((c) => ({
          sha: c.sha ?? String(c.id),
          message: c.message,
          committedAt: c.committedAt ?? '',
          files: 0,
          additions: c.additions ?? 0,
          deletions: c.deletions ?? 0,
          written: false,
        }))
  const showBranchDraft = !!active?.ok && (active.branchCommitCount > 0 || active.todayCommits.length > 0)
  const branchCount = active?.branchCommitCount || active?.todayCommits.length || 0
  const extraFiles = Math.max(0, (active?.changedFileCount ?? 0) - 3)

  return (
    <div
      className="overlay-pop"
      style={{
        position: 'absolute',
        top: 48,
        right: 0,
        width: 380,
        maxHeight: 'calc(100vh - 80px)',
        overflow: 'auto',
        background: 'color-mix(in srgb, var(--panel) 95%, transparent)',
        backdropFilter: 'blur(24px)',
        border: '1px solid var(--border2)',
        borderRadius: 14,
        boxShadow: '0 24px 60px rgba(0,0,0,.45)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        zIndex: 30,
        animation: 'overlay-pop .22s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--act-commit)', flex: 'none' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {active?.name ?? '로컬 git 없음'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted2)', flex: 'none' }}>{active?.parentLabel ?? ''}</span>
        </div>
        {active?.ok ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--panel2)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              {active.branch}
            </span>
            {active.unpushedCount > 0 && (
              <span style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border2)', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--act-commit)' }}>
                ↑{active.unpushedCount} push 대기
              </span>
            )}
            {active.changedFileCount > 0 && (
              <span style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border2)', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--muted)' }}>
                {active.changedFileCount} 파일 변경
              </span>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: 'var(--muted2)' }}>
            {active?.error ?? '설정에서 로컬 폴더를 등록하면 push 안 한 커밋이 보입니다.'}
          </div>
        )}
      </div>

      {wip && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: 12, background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>작업 중 변경</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--act-commit)' }}>+{active.additions}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted2)' }}>−{active.deletions}</span>
          </div>
          {active.files.slice(0, 3).map((file) => (
            <div key={file.path} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <span style={wipTagStyle(file.tag)}>{file.tag}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {shortPath(file.path)}
                </span>
              </span>
              <span style={{ display: 'flex', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
                <span style={{ color: 'var(--act-commit)' }}>+{file.additions}</span>
                <span style={{ color: 'var(--muted2)' }}>−{file.deletions}</span>
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {extraFiles > 0 && <span style={{ fontSize: 12, color: 'var(--muted2)' }}>파일 {extraFiles}개 더</span>}
            <span style={{ flex: 1 }} />
            {active.lastCommitAge && <span style={{ fontSize: 12, color: 'var(--act-plan)' }}>{active.lastCommitAge}</span>}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>오늘 커밋</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{todayCount}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--muted2)' }}>{formatOverlayDate(seoulToday())}</span>
        </div>
        {todayCommits.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--muted2)' }}>아직 오늘 커밋이 없어요.</div>}
        {todayCommits.slice(0, 3).map((commit) => (
          <div key={commit.sha} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{commit.message}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--muted2)', flex: 'none' }}>
                {formatSeoulTime(commit.committedAt)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {commit.files > 0 && <span style={{ fontSize: 11.5, color: 'var(--muted2)' }}>{commit.files} 파일</span>}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--act-commit)' }}>+{commit.additions}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--muted2)' }}>−{commit.deletions}</span>
              <span style={{ flex: 1 }} />
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 7px',
                  borderRadius: 20,
                  color: commit.written ? 'var(--act-draft)' : 'var(--muted2)',
                  border: `1px solid ${commit.written ? 'var(--act-draft)' : 'var(--border2)'}`,
                }}
              >
                {commit.written ? '글에 포함됨' : '아직 안 씀'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showBranchDraft && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, background: 'color-mix(in srgb, var(--act-draft) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--act-draft) 35%, var(--border))', borderRadius: 10 }}>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            이 브랜치에서 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--act-draft)' }}>{branchCount}커밋</span> 했고 아직 글로 안 썼어요.
          </div>
          <button
            type="button"
            onClick={() => void createBranchDraft()}
            disabled={generating}
            style={{
              height: 36,
              background: 'var(--act-draft)',
              border: 0,
              borderRadius: 8,
              color: '#0E1A16',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: generating ? 'default' : 'pointer',
            }}
          >
            {generating ? '작성 중...' : '이 브랜치로 초안 만들기'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--muted2)' }}>이번 주</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{weekTotal} 커밋</span>
          {unwritten > 0 && <span style={{ fontSize: 12, color: 'var(--muted2)' }}>· 안 쓴 {unwritten}</span>}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => { close(); navigate('/dashboard') }} style={{ background: 'none', border: 0, fontSize: 12, color: 'var(--muted)', cursor: 'pointer', padding: 0 }}>
            대시보드 열기
          </button>
        </div>
        <PulseChart values={values} selectedIndex={todayIndex >= 0 ? todayIndex : undefined} height={40} showDots ariaLabel="이번 주 미니 파형" />
      </div>

      {!showBranchDraft && (
        <button
          type="button"
          onClick={() => void createDraft()}
          disabled={generating || (unwritten === 0 && !week.pack)}
          style={{
            height: 38,
            background: 'var(--act-commit)',
            border: 0,
            borderRadius: 9,
            color: '#10171C',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: generating || (unwritten === 0 && !week.pack) ? 0.55 : 1,
          }}
        >
          {generating ? '초안 작성 중...' : '초안 만들기'}
        </button>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={openHud} style={{ background: 'none', border: 0, fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--muted2)', cursor: 'pointer' }}>
          {shortcut}
        </button>
      </div>
    </div>
  )
}

export default OverlayPopover
