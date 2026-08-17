import { useNavigate } from 'react-router-dom'
import PulseChart from '../components/PulseChart'
import { formatSeoulTime, weekdayLabel } from '../utils/week'
import { useOverlay } from './OverlayContext'
import { shortPath, wipBarStyle, wipTagStyle } from './wipStyle'

function Kbd({ children }: { children: string }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, padding: '3px 7px', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--muted)' }}>
      {children}
    </span>
  )
}

function OverlayHud() {
  const {
    week,
    active,
    quiet,
    todayIndex,
    todayCount,
    weekTotal,
    unwritten,
    close,
    createBranchDraft,
    generating,
  } = useOverlay()
  const navigate = useNavigate()
  if (!week) return null

  const values = week.days.map((day) => day.commitCount ?? day.commits.length)
  const wip = !!active?.ok && active.changedFileCount > 0
  const todayCommits = active?.ok && active.todayCommits.length
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
  const extraFiles = Math.max(0, (active?.changedFileCount ?? 0) - 5)

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'color-mix(in srgb, var(--bg) 64%, transparent)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        className="overlay-hud"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="작업 컨텍스트"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 'min(880px, calc(100vw - 32px))',
          transform: 'translate(-50%, -50%)',
          background: 'color-mix(in srgb, var(--panel) 93%, transparent)',
          backdropFilter: 'blur(30px)',
          border: '1px solid var(--border2)',
          borderRadius: 18,
          boxShadow: '0 40px 90px rgba(0,0,0,.5)',
          padding: '24px 26px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          animation: 'overlay-hud .2s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--act-commit)', flex: 'none' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16 }}>{active?.name ?? 'Week Pulse'}</span>
          {active?.ok && (
            <span style={{ padding: '4px 9px', borderRadius: 6, background: 'var(--panel2)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
              {active.branch}
            </span>
          )}
          {!!active?.unpushedCount && (
            <span style={{ padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border2)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--act-commit)' }}>
              ↑{active.unpushedCount} push 대기
            </span>
          )}
          <span style={{ flex: 1 }} />
          {active?.lastCommitAge && <span style={{ fontSize: 12, color: 'var(--act-plan)' }}>{active.lastCommitAge}</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: wip ? '1.05fr 1fr' : '1fr', gap: 18 }}>
          {wip && active && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: 'color-mix(in srgb, var(--panel2) 72%, transparent)', border: '1px solid var(--border2)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>작업 중 변경</span>
                  <span style={{ fontSize: 12.5, color: 'var(--muted2)' }}>파일 {active.changedFileCount}개 · 커밋 안 됨</span>
                </div>
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--act-commit)' }}>+{active.additions}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--muted2)' }}>−{active.deletions}</span>
              </div>
              <div style={{ height: 1, background: 'var(--border2)' }} />
              {active.files.slice(0, 5).map((file) => (
                <div key={file.path} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={wipTagStyle(file.tag)}>{file.tag}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shortPath(file.path)}
                    </span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--act-commit)' }}>+{file.additions}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted2)' }}>−{file.deletions}</span>
                    <span style={wipBarStyle(file.additions, file.deletions)} />
                  </span>
                </div>
              ))}
              {extraFiles > 0 && <span style={{ fontSize: 12, color: 'var(--muted2)' }}>파일 {extraFiles}개 더</span>}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>오늘 커밋</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{quiet ? (todayIndex >= 0 ? values[todayIndex] : todayCount) : todayCount}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: 'var(--muted2)' }}>이번 주 {weekTotal}</span>
            </div>
            {todayCommits.slice(0, 3).map((commit) => (
              <div key={commit.sha} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border2)', background: 'color-mix(in srgb, var(--panel2) 50%, transparent)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{commit.message}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted2)' }}>{formatSeoulTime(commit.committedAt)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  {commit.files > 0 && <span style={{ fontSize: 12, color: 'var(--muted2)' }}>{commit.files} 파일</span>}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--act-commit)' }}>+{commit.additions}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted2)' }}>−{commit.deletions}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, color: commit.written ? 'var(--act-draft)' : 'var(--muted2)', border: `1px solid ${commit.written ? 'var(--act-draft)' : 'var(--border2)'}` }}>
                    {commit.written ? '글에 포함됨' : '아직 안 씀'}
                  </span>
                </div>
              </div>
            ))}
            {todayCommits.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted2)' }}>오늘은 아직 커밋이 없어요.</div>}
            {showBranchDraft && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'color-mix(in srgb, var(--act-draft) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--act-draft) 35%, var(--border))', borderRadius: 10 }}>
                <span style={{ fontSize: 13, lineHeight: 1.45, flex: 1 }}>
                  이 브랜치 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--act-draft)' }}>{branchCount}커밋</span>이 글 하나가 됩니다.
                </span>
                <button
                  type="button"
                  onClick={() => void createBranchDraft()}
                  disabled={generating}
                  style={{ height: 34, padding: '0 14px', background: 'var(--act-draft)', border: 0, borderRadius: 8, color: '#0E1A16', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {generating ? '작성 중...' : '초안 만들기'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <PulseChart values={values} selectedIndex={todayIndex >= 0 ? todayIndex : undefined} height={40} ariaLabel="이번 주 커밋 스트립" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {week.days.map((day, i) => (
                <div key={day.date} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: i === todayIndex ? 'var(--text)' : 'var(--muted2)' }}>{weekdayLabel(day.date)}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: quiet && i !== todayIndex ? 'transparent' : 'var(--muted)' }}>
                    {values[i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Kbd>esc</Kbd>
              <span style={{ fontSize: 12.5, color: 'var(--muted2)' }}>닫기</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Kbd>↵</Kbd>
              <span style={{ fontSize: 12.5, color: 'var(--muted2)' }}>초안</span>
            </span>
            <button type="button" onClick={() => { close(); navigate('/dashboard') }} style={{ background: 'none', border: 0, color: 'var(--muted)', fontSize: 12.5, cursor: 'pointer' }}>
              대시보드
            </button>
            {unwritten > 0 && <span style={{ fontSize: 12, color: 'var(--muted2)' }}>안 쓴 {unwritten}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default OverlayHud
