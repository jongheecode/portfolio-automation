import FindingDetail from './FindingDetail'
import OverlayChrome from './OverlayChrome'
import WeekStrip from './WeekStrip'
import type { NextAction } from './overlayData'

export interface WipFile {
  tag: 'M' | 'A' | 'D'
  path: string
  additions: number
  deletions: number
}

export interface TodayCommitRow {
  sha: string
  message: string
  time: string
  additions: number
  deletions: number
  written: boolean
}

export interface WorkContextData {
  repoName: string
  branch: string | null
  unpushedCount: number
  changedFileCount: number
  additions: number
  deletions: number
  files: WipFile[]
  lastCommitAge: string | null
  todayCommits: TodayCommitRow[]
  branchCommitCount: number
  branchCommitMessages: string[]
  weekTotal: number
  weekPoints: { wd: string; value: number }[]
}

const C = {
  commit: '#6E9CC4',
  commitSoft: '#9BC0DD',
  plan: '#C8A05A',
  draft: '#7FAE9B',
  text: '#E7E9EA',
  muted: '#8E979C',
  muted2: '#5A6368',
  panel2: '#1B2024',
  border: '#262B2F',
  ink: '#0E1A16',
  sageLine: '#3A5C52',
}

const TAG_COLOR: Record<WipFile['tag'], string> = { M: C.commitSoft, A: C.draft, D: C.plan }
const TAG_BG: Record<WipFile['tag'], string> = {
  M: 'rgba(110,156,196,.16)',
  A: 'rgba(127,174,155,.16)',
  D: 'rgba(200,160,90,.16)',
}

export default function WorkContextPanel({
  data,
  variant,
  nextAction,
  onFindingHandled,
  onCreateBranchDraft,
  onOpenDashboard,
  onCollapse,
  onHide,
}: {
  data: WorkContextData
  variant: 'popover' | 'hud'
  nextAction: NextAction | null
  onFindingHandled: () => void
  onCreateBranchDraft: () => void
  onOpenDashboard: () => void
  onCollapse: () => void
  onHide: () => void
}) {
  if (variant === 'hud') {
    const visibleFiles = data.files.slice(0, 5)
    return (
      <div className="hud-shell">
        <OverlayChrome title={data.repoName} onCollapse={onCollapse} onHide={onHide} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: C.commit, flex: 'none' }} />
          <span className="mono" style={{ fontSize: 16 }}>{data.repoName}</span>
          {data.branch && (
            <span className="mono" style={{ padding: '4px 9px', borderRadius: 6, background: C.panel2, fontSize: 12.5, color: C.text }}>
              {data.branch}
            </span>
          )}
          {data.unpushedCount > 0 && (
            <span className="mono" style={{ padding: '4px 9px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, color: C.commitSoft }}>
              ↑{data.unpushedCount} push 대기
            </span>
          )}
          <span style={{ flex: 1 }} />
          {data.lastCommitAge && <span style={{ fontSize: 12, color: C.plan }}>{data.lastCommitAge}</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 18, minHeight: 0, flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: C.muted }}>작업 중 변경</span>
                <span style={{ fontSize: 12.5, color: C.muted2 }}>파일 {data.changedFileCount}개 · 커밋 안 됨</span>
              </div>
              <span style={{ flex: 1 }} />
              <span className="mono" style={{ fontSize: 22, color: C.commitSoft }}>+{data.additions}</span>
              <span className="mono" style={{ fontSize: 22, color: C.muted }}>−{data.deletions}</span>
            </div>
            <div style={{ height: 1, background: C.border }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {visibleFiles.map((f) => (
                <div key={f.path} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 96px', gap: 10, alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        width: 16,
                        height: 16,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 3,
                        flex: 'none',
                        color: TAG_COLOR[f.tag],
                        background: TAG_BG[f.tag],
                      }}
                    >
                      {f.tag}
                    </span>
                    <span className="mono" style={{ fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left' }}>
                      {f.path}
                    </span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                    <span className="mono" style={{ fontSize: 12, color: C.commitSoft }}>+{f.additions}</span>
                    <span className="mono" style={{ fontSize: 12, color: C.muted2 }}>−{f.deletions}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: C.muted }}>오늘 커밋</span>
              <span className="mono" style={{ fontSize: 13 }}>{data.todayCommits.length}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: C.muted2 }}>이번 주 {data.weekTotal}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {data.todayCommits.map((c) => (
                <div key={c.sha} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.panel2 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ fontSize: 13.5, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.message}</span>
                    <span style={{ flex: 1 }} />
                    <span className="mono" style={{ fontSize: 12, color: C.muted2, flex: 'none' }}>{c.time}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span className="mono" style={{ fontSize: 12, color: C.commitSoft }}>+{c.additions}</span>
                    <span className="mono" style={{ fontSize: 12, color: C.muted2 }}>−{c.deletions}</span>
                    <span style={{ flex: 1 }} />
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 7px',
                        borderRadius: 20,
                        whiteSpace: 'nowrap',
                        color: c.written ? C.draft : C.muted,
                        border: `1px solid ${c.written ? C.sageLine : C.border}`,
                      }}
                    >
                      {c.written ? '글에 포함됨' : '아직 안 씀'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {data.branchCommitCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(127,174,155,.08)', border: `1px solid ${C.sageLine}`, borderRadius: 10 }}>
                <span style={{ fontSize: 13, lineHeight: 1.45, color: C.text, flex: 1 }}>
                  이 브랜치 <span className="mono" style={{ color: C.draft }}>{data.branchCommitCount}커밋</span>이 글 하나가 됩니다.
                </span>
                <button
                  type="button"
                  onClick={onCreateBranchDraft}
                  style={{ height: 34, padding: '0 14px', background: C.draft, border: 0, borderRadius: 8, color: C.ink, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  초안 만들기
                </button>
              </div>
            )}
          </div>
        </div>

        <WeekStrip points={data.weekPoints} width={560} height={40} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="mono" style={{ fontSize: 11.5, padding: '3px 7px', border: `1px solid ${C.border}`, borderRadius: 5, color: C.muted }}>esc</span>
            <span style={{ fontSize: 12.5, color: C.muted }}>닫기</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="mono" style={{ fontSize: 11.5, padding: '3px 7px', border: `1px solid ${C.border}`, borderRadius: 5, color: C.muted }}>↵</span>
            <span style={{ fontSize: 12.5, color: C.muted }}>초안 만들기</span>
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: C.muted2 }}>이번 주 {data.weekTotal}커밋</span>
        </div>
      </div>
    )
  }

  const visibleFiles = data.files.slice(0, 3)
  const extraFiles = data.files.length - visibleFiles.length

  return (
    <div className="panel-shell">
      <OverlayChrome title={data.repoName} onCollapse={onCollapse} onHide={onHide} />
      {nextAction && <FindingDetail nextAction={nextAction} onHandled={onFindingHandled} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <span style={{ width: 9, height: 9, borderRadius: 2, background: C.commit, flex: 'none' }} />
        <span className="mono" style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.repoName}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {data.branch && (
            <span className="mono" style={{ padding: '3px 8px', borderRadius: 6, background: C.panel2, fontSize: 12, color: C.text }}>
            {data.branch}
          </span>
        )}
        {data.unpushedCount > 0 && (
            <span className="mono" style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 11.5, color: C.commitSoft }}>
            ↑{data.unpushedCount} push 대기
          </span>
        )}
        <span className="mono" style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 11.5, color: C.muted }}>
          {data.changedFileCount} 파일 변경
        </span>
      </div>

      {data.changedFileCount > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: 12, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.muted }}>작업 중 변경</span>
            <span style={{ flex: 1 }} />
            <span className="mono" style={{ fontSize: 12, color: C.commitSoft }}>+{data.additions}</span>
            <span className="mono" style={{ fontSize: 12, color: C.muted }}>−{data.deletions}</span>
          </div>
          {visibleFiles.map((f) => (
            <div key={f.path} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <span
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    width: 15,
                    height: 15,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 3,
                    flex: 'none',
                    color: TAG_COLOR[f.tag],
                    background: TAG_BG[f.tag],
                  }}
                >
                  {f.tag}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 12.5, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left' }}
                >
                  {f.path}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
                <span className="mono" style={{ fontSize: 11.5, color: C.commitSoft }}>+{f.additions}</span>
                <span className="mono" style={{ fontSize: 11.5, color: C.muted2 }}>−{f.deletions}</span>
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 2 }}>
            {extraFiles > 0 && <span style={{ fontSize: 12, color: C.muted2 }}>파일 {extraFiles}개 더</span>}
            <span style={{ flex: 1 }} />
            {data.lastCommitAge && <span style={{ fontSize: 12, color: C.plan }}>{data.lastCommitAge}</span>}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: C.muted }}>오늘 커밋</span>
          <span className="mono" style={{ fontSize: 12.5 }}>{data.todayCommits.length}</span>
        </div>
        {data.todayCommits.map((c) => (
          <div key={c.sha} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.message}</span>
              <span style={{ flex: 1 }} />
              <span className="mono" style={{ fontSize: 11.5, color: C.muted2, flex: 'none' }}>{c.time}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ fontSize: 11.5, color: C.commitSoft }}>+{c.additions}</span>
              <span className="mono" style={{ fontSize: 11.5, color: C.muted2 }}>−{c.deletions}</span>
              <span style={{ flex: 1 }} />
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 7px',
                  borderRadius: 20,
                  whiteSpace: 'nowrap',
                  color: c.written ? C.draft : C.muted,
                  border: `1px solid ${c.written ? C.sageLine : C.border}`,
                }}
              >
                {c.written ? '글에 포함됨' : '아직 안 씀'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {data.branchCommitCount > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, background: 'rgba(127,174,155,.08)', border: `1px solid ${C.sageLine}`, borderRadius: 10 }}>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: C.text }}>
            이 브랜치에서 <span className="mono" style={{ color: C.draft }}>{data.branchCommitCount}커밋</span> 했고 아직 글로 안 썼어요.
          </div>
          <button
            type="button"
            onClick={onCreateBranchDraft}
            style={{ height: 36, background: C.draft, border: 0, borderRadius: 8, color: C.ink, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
          >
            이 브랜치로 초안 만들기
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 12, color: C.muted2 }}>이번 주</span>
          <span className="mono" style={{ fontSize: 12, color: C.muted }}>{data.weekTotal} 커밋</span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onOpenDashboard} style={{ background: 'none', border: 'none', fontSize: 12, color: C.muted, cursor: 'pointer' }}>
            대시보드 열기
          </button>
        </div>
        <WeekStrip points={data.weekPoints} width={348} height={34} />
      </div>
    </div>
  )
}
