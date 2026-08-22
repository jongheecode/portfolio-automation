import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import ActivityChart from '../components/ActivityChart'
import PulseChart from '../components/PulseChart'
import RepoScopeModal from '../components/RepoScopeModal'
import { useAppData } from '../contexts/AppDataContext'
import type { DraftStatus, Habit, Plan, SyncErrorCode, SyncState, WeekView } from '../types'
import {
  addDays,
  formatMonthDay,
  formatSeoulTime,
  mondayOf,
  overlayShortcutLabel,
  seoulToday,
  splitTweets,
  weekdayLabel,
} from '../utils/week'

const ERRORS = {
  token_expired: 'GitHub 연결이 만료됐어요. 다시 연결해 주세요.',
  rate_limited: 'GitHub 요청 한도에 걸렸어요. 잠시 후 다시 시도해 주세요.',
  no_access: '이 레포에 접근할 수 없어요. 조직 권한을 확인해 주세요.',
}

type ViewState = 'no-repo' | 'not-synced' | 'syncing' | 'error' | 'zero-week' | 'ready'

function dayCount(day: { commitCount?: number; commits: unknown[]; commitExtra: number }): number {
  return day.commitCount ?? day.commits.length + day.commitExtra
}

function errorCode(code?: string | null): SyncErrorCode {
  if (code === 'token_expired' || code === 'rate_limited' || code === 'no_access') return code
  return 'no_access'
}

function relativeSync(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return '방금 가져왔어요'
  if (mins < 60) return `${mins}분 전에 가져왔어요`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}시간 전에 가져왔어요`
  return `${Math.round(hours / 24)}일 전에 가져왔어요`
}

function DashboardPage() {
  const { trackedRepos, openAddRepo, reload } = useAppData()
  const navigate = useNavigate()
  const [weekStart, setWeekStart] = useState<string | undefined>(undefined)
  const [week, setWeek] = useState<WeekView | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(seoulToday())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>({ kind: 'never' })
  const [copied, setCopied] = useState<string | null>(null)
  const [excludeMerges, setExcludeMerges] = useState(true)
  const [repoFilter, setRepoFilter] = useState('all')
  const [narrow, setNarrow] = useState(() => window.innerWidth < 1000)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const today = seoulToday()
  const thisMonday = mondayOf(today)

  const load = useCallback(async (start?: string) => {
    setLoading(true)
    setError(null)
    try {
      const [data, status] = await Promise.all([api.week(start), api.syncStatus()])
      setWeek(data)
      setSyncState(status)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(weekStart)
  }, [load, weekStart])

  useEffect(() => {
    if (!week) return
    if (week.days.some((day) => day.date === today)) {
      setSelectedDate(today)
      return
    }
    const richest = [...week.days].sort((a, b) => dayCount(b) - dayCount(a))[0]
    setSelectedDate(richest?.date ?? week.weekStart)
  }, [week?.weekStart, today])

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 1000)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const lastSyncedAt = syncState.lastSyncedAt ?? null
  const commitCount = week?.days.reduce((sum, day) => sum + dayCount(day), 0) ?? 0
  const weekly = week?.weekly ?? []
  const lastWeekCount = weekly.length >= 2 ? weekly[weekly.length - 2].count : 0

  let viewState: ViewState = 'ready'
  if (trackedRepos.length === 0) viewState = 'no-repo'
  else if (syncState.kind === 'never') viewState = 'not-synced'
  else if (syncState.kind === 'syncing') viewState = 'syncing'
  else if (syncState.kind === 'error') viewState = 'error'
  else if (week && commitCount === 0) viewState = 'zero-week'

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!week) return
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setWeekStart(addDays(week.weekStart, -7))
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        setWeekStart(addDays(week.weekStart, 7))
      } else if (event.key === 't' || event.key === 'T') {
        event.preventDefault()
        setWeekStart(undefined)
        setSelectedDate(today)
      } else if (/^[1-7]$/.test(event.key)) {
        const day = week.days[Number(event.key) - 1]
        if (day) setSelectedDate(day.date)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [week, today, narrow])

  const selectedDay = week?.days.find((day) => day.date === selectedDate)
  const selectedPlans = week?.plans.filter((plan) => plan.dueOn === selectedDate) ?? []
  const viewingCurrent = week?.weekStart === thisMonday
  const dimmed = viewState === 'not-synced'
  const unwrittenCommitCount = week?.unwrittenCommitCount ?? 0
  const syncing = syncState.kind === 'syncing'

  const visibleCommits = useMemo(() => {
    let list = selectedDay?.commits ?? []
    if (excludeMerges) list = list.filter((c) => !c.isMerge && !c.isBot)
    if (repoFilter !== 'all') list = list.filter((c) => c.repoName === repoFilter)
    return list
  }, [selectedDay, excludeMerges, repoFilter])

  const repoNames = useMemo(() => {
    const names = new Set((selectedDay?.commits ?? []).map((c) => c.repoName))
    return [...names]
  }, [selectedDay])

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    window.setTimeout(() => setCopied(null), 1600)
  }

  async function handleSyncAll() {
    setError(null)
    setSyncState((prev) => ({ ...prev, kind: 'syncing' }))
    try {
      const next = await api.waitForSync()
      setSyncState(next)
      if (next.kind === 'error') {
        setError(ERRORS[errorCode(next.code)])
      }
      await reload()
      await load(week?.weekStart ?? weekStart)
    } catch (err) {
      setError((err as Error).message)
      const status = await api.syncStatus().catch(() => null)
      if (status) setSyncState(status)
    }
  }

  async function handleGenerate() {
    if (!week) return
    if (week.pack && !window.confirm('다시 만들면 이 주 초안을 덮어씁니다. 계속할까요?')) return
    setGenerating(true)
    setError(null)
    try {
      await api.createDraft(week.weekStart)
      await load(week.weekStart)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  if (viewState === 'no-repo') {
    return (
      <div style={{ ...panel, maxWidth: 520, margin: '48px auto', textAlign: 'center', padding: 32 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>추적할 레포를 먼저 등록해요</h1>
        <p style={{ margin: '0 0 20px', color: 'var(--muted)', fontSize: 14, lineHeight: 1.55 }}>
          GitHub 조직 레포를 포함해, 이번 주 파형에 올릴 저장소를 고르면 됩니다.
        </p>
        <button type="button" onClick={openAddRepo} style={primaryBtn}>
          레포 등록하기
        </button>
      </div>
    )
  }

  if (loading && !week) return <p style={{ color: 'var(--muted)', fontSize: 14 }}>불러오는 중...</p>
  if (!week) return <p style={{ color: 'var(--muted)' }}>{error ?? '주간 보드를 불러오지 못했습니다.'}</p>

  const waveValues = week.days.map((day) => dayCount(day))
  const selectedIndex = week.days.findIndex((day) => day.date === selectedDate)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" aria-label="이전 주" onClick={() => setWeekStart(addDays(week.weekStart, -7))} style={chevronBtn}>
            ‹
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
              {viewingCurrent ? '이번 주' : `${formatMonthDay(week.weekStart)} 주`}
            </h1>
            <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: 13 }}>
              {formatMonthDay(week.weekStart)} – {formatMonthDay(week.weekEnd)}
              <span style={{ marginLeft: 8, color: 'var(--act-commit)', fontFamily: 'var(--font-mono)' }}>
                {commitCount} 커밋
              </span>
            </p>
          </div>
          <button type="button" aria-label="다음 주" onClick={() => setWeekStart(addDays(week.weekStart, 7))} style={chevronBtn}>
            ›
          </button>
          {!viewingCurrent && (
            <button type="button" onClick={() => setWeekStart(undefined)} style={linkBtn}>
              오늘
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void handleSyncAll()}
            disabled={syncing}
            style={{ ...navBtn, opacity: syncing ? 0.6 : 1, cursor: syncing ? 'default' : 'pointer' }}
          >
            {syncing ? '가져오는 중...' : 'GitHub에서 가져오기'}
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating || (unwrittenCommitCount === 0 && !week.pack)}
            style={{
              ...primaryBtn,
              opacity: generating || (unwrittenCommitCount === 0 && !week.pack) ? 0.55 : 1,
              cursor: generating || (unwrittenCommitCount === 0 && !week.pack) ? 'default' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {generating ? '초안 작성 중...' : week.pack ? '초안 다시 만들기' : '초안 만들기'}
            {unwrittenCommitCount > 0 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'rgba(0,0,0,0.18)', borderRadius: 99, padding: '1px 7px' }}>
                {unwrittenCommitCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          fontSize: 13,
          color: viewState === 'error' ? 'var(--act-plan)' : 'var(--muted)',
        }}
      >
        <span>
          {viewState === 'syncing' && '가져오는 중'}
          {viewState === 'error' && `${ERRORS[errorCode(syncState.code)]} `}
          {viewState === 'ready' && lastSyncedAt ? relativeSync(lastSyncedAt) : null}
          {viewState === 'not-synced' && '아직 GitHub에서 가져오지 않았어요'}
          {viewState === 'zero-week' && (lastWeekCount > 0 ? `이번 주는 조용합니다. 지난주에는 ${lastWeekCount}개.` : '이번 주는 아직 기록이 없어요.')}
        </span>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {viewState === 'error' && (
            <>
              <a href={api.loginUrl()} style={linkBtn}>
                GitHub 다시 연결
              </a>
              <button type="button" onClick={() => void handleSyncAll()} style={linkBtn}>
                다시 시도
              </button>
            </>
          )}
          {viewState === 'zero-week' && lastWeekCount > 0 && (
            <button type="button" onClick={() => setWeekStart(addDays(week.weekStart, -7))} style={linkBtn}>
              지난주 보기
            </button>
          )}
          {!narrow && (
            <span style={{ color: 'var(--muted2)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              ← → 주 · 1–7 요일 · T 오늘 · {overlayShortcutLabel()} HUD
            </span>
          )}
          <button type="button" onClick={() => setScopeOpen(true)} style={linkBtn}>
            AI에 보낼 레포
          </button>
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)' }}>
        <Legend color="var(--act-commit)" label="커밋" />
        <Legend color="var(--act-plan)" label="계획" />
        <Legend color="var(--act-draft)" label="초안" />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrow ? '1fr' : '236px 1fr',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <aside style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr 1fr' : '1fr', gap: 16 }}>
          <section style={panel}>
            <div style={quietLabel}>습관</div>
            {week.habits.map((habit) => (
              <HabitRow
                key={habit.key}
                habit={habit}
                weekStart={week.weekStart}
                dayFlags={week.days.map((day) => dayCount(day) > 0)}
                onChange={(next) =>
                  setWeek((prev) =>
                    prev ? { ...prev, habits: prev.habits.map((h) => (h.key === next.key ? next : h)) } : prev,
                  )
                }
                onError={setError}
              />
            ))}
          </section>
          <PlanRail
            plans={week.plans}
            defaultDue={today}
            onChange={(plans) => setWeek((prev) => (prev ? { ...prev, plans } : prev))}
            onError={setError}
          />
        </aside>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, position: 'relative' }}>
          {viewState === 'not-synced' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'color-mix(in srgb, var(--bg) 35%, transparent)',
                borderRadius: 14,
              }}
            >
              <button type="button" onClick={() => void handleSyncAll()} style={primaryBtn}>
                GitHub에서 가져오기
              </button>
            </div>
          )}
          <section style={{ ...panel, opacity: dimmed ? 0.18 : 1, paddingBottom: 8 }}>
            <div style={quietLabel}>주간 신호</div>
            <PulseChart
              values={waveValues}
              selectedIndex={selectedIndex >= 0 ? selectedIndex : undefined}
              onPick={(index) => setSelectedDate(week.days[index].date)}
              height={92}
              ariaLabel="이번 주 커밋 파형"
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: narrow ? 'repeat(4, minmax(0, 1fr))' : 'repeat(7, minmax(0, 1fr))',
                gap: 8,
                marginTop: 8,
              }}
            >
              {week.days.map((day) => {
                const isToday = day.date === today
                const selected = day.date === selectedDate
                const commits = dayCount(day)
                const plans = week.plans.filter((plan) => plan.dueOn === day.date).length
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDate(day.date)}
                    style={{
                      border: `1px solid ${selected ? 'var(--act-commit)' : 'var(--border)'}`,
                      borderRadius: 12,
                      background: selected || isToday ? 'var(--cell-active)' : 'var(--cell)',
                      minHeight: 108,
                      padding: '10px 10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'inherit',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 12, color: isToday ? 'var(--act-commit)' : 'var(--muted)' }}>
                        {weekdayLabel(day.date)}
                      </span>
                      <span style={{ fontSize: 18, fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em' }}>
                        {Number(day.date.slice(8))}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 'auto' }}>
                      <CountChip color="var(--act-commit)" count={commits} label="커밋" />
                      <CountChip color="var(--act-plan)" count={plans} label="계획" />
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {viewState !== 'not-synced' && viewState !== 'zero-week' && (
            <section style={{ ...panel, minHeight: 120 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={quietLabel}>
                  {weekdayLabel(selectedDate)} {formatMonthDay(selectedDate)}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" checked={excludeMerges} onChange={(e) => setExcludeMerges(e.target.checked)} />
                    머지·봇 숨김
                  </label>
                  <select
                    value={repoFilter}
                    onChange={(e) => setRepoFilter(e.target.value)}
                    style={{ ...inputStyle, padding: '4px 8px' }}
                  >
                    <option value="all">모든 레포</option>
                    {repoNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {visibleCommits.length === 0 && selectedPlans.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>이 날은 아직 기록이 없어요.</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {visibleCommits.map((commit) => (
                  <div
                    key={commit.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: narrow ? '1fr auto' : 'minmax(0, 1.4fr) minmax(0, 2fr) auto auto',
                      gap: 10,
                      alignItems: 'center',
                      fontSize: 13,
                      color: 'var(--text)',
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'var(--panel2)',
                      borderLeft: '3px solid var(--act-commit)',
                    }}
                  >
                    <a
                      href={commit.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {commit.repoName}
                    </a>
                    <a
                      href={commit.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'inherit' }}
                    >
                      {commit.message}
                    </a>
                    {!narrow && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted2)', whiteSpace: 'nowrap' }}>
                        {commit.additions || commit.deletions
                          ? `+${commit.additions ?? 0} −${commit.deletions ?? 0}`
                          : ''}
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted2)', fontSize: 12 }}>
                        {formatSeoulTime(commit.committedAt)}
                      </span>
                      {selectedPlans[0] && (
                        <button
                          type="button"
                          onClick={async () => {
                            const plan = selectedPlans[0]
                            const ids = new Set(plan.linkedCommitIds ?? [])
                            if (ids.has(commit.id)) ids.delete(commit.id)
                            else ids.add(commit.id)
                            try {
                              const updated = await api.updatePlan(plan.id, { linkedCommitIds: [...ids] })
                              setWeek((prev) =>
                                prev ? { ...prev, plans: prev.plans.map((p) => (p.id === updated.id ? updated : p)) } : prev,
                              )
                            } catch (err) {
                              setError((err as Error).message)
                            }
                          }}
                          style={tinyBtn}
                        >
                          {(selectedPlans[0].linkedCommitIds ?? []).includes(commit.id) ? '연결 해제' : '계획에 연결'}
                        </button>
                      )}
                    </span>
                  </div>
                ))}
                {selectedPlans.map((plan) => (
                  <label key={plan.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={plan.done}
                      onChange={async (e) => {
                        try {
                          const updated = await api.updatePlan(plan.id, { done: e.target.checked })
                          setWeek((prev) =>
                            prev ? { ...prev, plans: prev.plans.map((p) => (p.id === updated.id ? updated : p)) } : prev,
                          )
                        } catch (err) {
                          setError((err as Error).message)
                        }
                      }}
                    />
                    <span style={{ color: plan.done ? 'var(--muted2)' : 'var(--text)', textDecoration: plan.done ? 'line-through' : 'none' }}>
                      {plan.title}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {week.pack && viewState !== 'not-synced' && (
        <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          <PackCard
            label="블로그"
            status={(week.pack.status as DraftStatus | undefined) ?? (week.pack.published ? 'published' : 'draft')}
            text={week.pack.content}
            copied={copied === 'blog'}
            onCopy={() => void copyText('blog', `# ${week.pack!.title}\n\n${week.pack!.content}`)}
            onRetry={
              week.pack.status === 'failed'
                ? async () => {
                    setRetrying(true)
                    try {
                      await api.retryPublish(week.pack!.id)
                      await load(week.weekStart)
                    } catch (err) {
                      setError((err as Error).message)
                    } finally {
                      setRetrying(false)
                    }
                  }
                : undefined
            }
            retrying={retrying}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{week.pack.title}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {previewLines(week.pack.content, 4)}
            </div>
            <button type="button" onClick={() => navigate(`/blog/${week.pack!.id}`)} style={{ ...navBtn, marginTop: 10 }}>
              편집으로
            </button>
          </PackCard>
          <PackCard
            label="LinkedIn"
            status="draft"
            text={week.pack.linkedinContent ?? ''}
            copied={copied === 'linkedin'}
            onCopy={() => void copyText('linkedin', week.pack!.linkedinContent ?? '')}
          >
            <div style={{ fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{week.pack.linkedinContent}</div>
          </PackCard>
          <PackCard
            label="X"
            status="draft"
            text={week.pack.twitterContent ?? ''}
            copied={copied === 'x'}
            onCopy={() => void copyText('x', week.pack!.twitterContent ?? '')}
          >
            {splitTweets(week.pack.twitterContent).map((tweet, index) => (
              <div key={index} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{tweet}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: tweet.length > 280 ? 'var(--act-plan)' : 'var(--muted2)' }}>
                    {tweet.length}자
                  </span>
                  <button type="button" onClick={() => void copyText(`x-${index}`, tweet)} style={tinyBtn}>
                    {copied === `x-${index}` ? '복사됨' : '이 트윗 복사'}
                  </button>
                </div>
              </div>
            ))}
          </PackCard>
        </div>
      )}

      <ActivityChart
        weekly={weekly}
        selectedStart={week.weekStart}
        onPick={(start) => {
          setWeekStart(start)
          setSelectedDate(start)
        }}
      />
      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted2)' }}>커밋 시각과 주 경계는 Asia/Seoul 기준입니다.</p>
      <RepoScopeModal open={scopeOpen} onClose={() => setScopeOpen(false)} />
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 99, background: color }} />
      {label}
    </span>
  )
}

function CountChip({ color, count, label }: { color: string; count: number; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: count === 0 ? 'var(--muted2)' : 'var(--text)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: 99, background: color, opacity: count === 0 ? 0.35 : 1 }} />
      {count} {label}
    </span>
  )
}

function habitDots(habit: Habit, dayFlags: boolean[]): boolean[] {
  if (habit.doneDays && habit.doneDays.length === 7) return habit.doneDays
  if (habit.key === 'COMMIT_DAYS') return dayFlags
  return Array.from({ length: 7 }, (_, i) => i < Math.min(habit.current, 7))
}

function HabitRow({
  habit,
  weekStart,
  dayFlags,
  onChange,
  onError,
}: {
  habit: Habit
  weekStart: string
  dayFlags: boolean[]
  onChange: (habit: Habit) => void
  onError: (message: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(habit.target))
  const dots = habitDots(habit, dayFlags)

  async function saveTarget() {
    const next = Number(draft)
    setEditing(false)
    if (!Number.isInteger(next) || next < 1 || next === habit.target) {
      setDraft(String(habit.target))
      return
    }
    try {
      onChange(await api.updateHabitTarget(habit.key, next))
    } catch (err) {
      onError((err as Error).message)
      setDraft(String(habit.target))
    }
  }

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
          {habit.key === 'PUBLISH_OUTSIDE' && (
            <input
              type="checkbox"
              checked={habit.done}
              onChange={async (e) => {
                try {
                  onChange(await api.checkPublishOutside(weekStart, e.target.checked))
                } catch (err) {
                  onError((err as Error).message)
                }
              }}
            />
          )}
          <span>{habit.title}</span>
        </label>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          {habit.current}/
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void saveTarget()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveTarget()
              }}
              style={{ width: 36, fontSize: 12, background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 5, padding: '1px 4px', fontFamily: 'var(--font-mono)' }}
            />
          ) : (
            <button type="button" onClick={() => setEditing(true)} style={linkBtn} title="목표 바꾸기">
              {habit.target}
            </button>
          )}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
        {dots.map((on, i) => (
          <span
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: 99,
              background: on ? (habit.done ? 'var(--act-draft)' : 'var(--act-commit)') : 'var(--panel2)',
            }}
          />
        ))}
      </div>
    </div>
  )
}

function PlanRail({
  plans,
  defaultDue,
  onChange,
  onError,
}: {
  plans: Plan[]
  defaultDue: string
  onChange: (plans: Plan[]) => void
  onError: (message: string) => void
}) {
  const [title, setTitle] = useState('')
  const [dueOn, setDueOn] = useState(defaultDue)
  const open = plans.filter((p) => !p.done)
  const closed = plans.filter((p) => p.done)

  async function addPlan() {
    if (!title.trim()) return
    try {
      const created = await api.createPlan(title.trim(), dueOn)
      onChange([...plans, created])
      setTitle('')
    } catch (err) {
      onError((err as Error).message)
    }
  }

  return (
    <section style={panel}>
      <div style={quietLabel}>계획</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="할 일 추가"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void addPlan()
          }}
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <button type="button" onClick={() => void addPlan()} style={navBtn}>
            추가
          </button>
        </div>
      </div>
      {[...open, ...closed].map((plan) => {
        const linked = plan.linkedCommitCount ?? 0
        return (
          <div key={plan.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={plan.done}
              onChange={async (e) => {
                try {
                  const updated = await api.updatePlan(plan.id, { done: e.target.checked })
                  onChange(plans.map((p) => (p.id === updated.id ? updated : p)))
                } catch (err) {
                  onError((err as Error).message)
                }
              }}
            />
            <div style={{ flex: 1, minWidth: 0, color: plan.done ? 'var(--muted2)' : 'var(--text)', textDecoration: plan.done ? 'line-through' : 'none' }}>
              <div>{plan.title}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted2)', fontFamily: 'var(--font-mono)' }}>
                {formatMonthDay(plan.dueOn)}
                {linked > 0 ? ` · 커밋 ${linked}` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await api.deletePlan(plan.id)
                  onChange(plans.filter((p) => p.id !== plan.id))
                } catch (err) {
                  onError((err as Error).message)
                }
              }}
              style={tinyBtn}
            >
              삭제
            </button>
          </div>
        )
      })}
      {plans.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>아직 계획이 없어요.</div>}
    </section>
  )
}

function PackCard({
  label,
  status,
  text,
  copied,
  onCopy,
  onRetry,
  retrying,
  children,
}: {
  label: string
  status: 'draft' | 'published' | 'failed'
  text: string
  copied: boolean
  onCopy: () => void
  onRetry?: () => void
  retrying?: boolean
  children: ReactNode
}) {
  const statusLabel = status === 'published' ? '발행됨' : status === 'failed' ? '실패' : '초안'
  const statusColor = status === 'published' ? 'var(--act-draft)' : status === 'failed' ? 'var(--act-plan)' : 'var(--muted)'
  return (
    <section style={{ ...panel, minHeight: 220 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={quietLabel}>{label}</div>
          <span style={{ fontSize: 11, color: statusColor, border: `1px solid ${statusColor}`, borderRadius: 99, padding: '1px 7px' }}>
            {statusLabel}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {onRetry && (
            <button type="button" onClick={onRetry} disabled={retrying} style={tinyBtn}>
              {retrying ? '재시도 중...' : '다시 발행'}
            </button>
          )}
          <button type="button" onClick={onCopy} disabled={!text} style={tinyBtn}>
            {copied ? '복사됨' : '복사'}
          </button>
        </div>
      </div>
      {children}
    </section>
  )
}

function previewLines(text: string, count: number): string {
  return text.split('\n').slice(0, count).join('\n')
}

const panel: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 14,
  background: 'var(--panel)',
  boxShadow: 'var(--card-shadow)',
  padding: '14px 14px 12px',
}

const quietLabel: CSSProperties = {
  fontSize: 13,
  color: 'var(--muted)',
}

const chevronBtn: CSSProperties = {
  width: 'var(--hit)',
  height: 'var(--hit)',
  background: 'var(--panel)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  fontSize: 22,
  lineHeight: 1,
  cursor: 'pointer',
}

const navBtn: CSSProperties = {
  background: 'var(--panel)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  cursor: 'pointer',
}

const primaryBtn: CSSProperties = {
  background: 'var(--act-commit)',
  color: '#10171c',
  border: 'none',
  borderRadius: 8,
  padding: '8px 14px',
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
}

const linkBtn: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--act-commit)',
  padding: 0,
  fontSize: 13,
  cursor: 'pointer',
}

const tinyBtn: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--muted)',
  borderRadius: 6,
  padding: '2px 7px',
  fontSize: 11.5,
  cursor: 'pointer',
}

const inputStyle: CSSProperties = {
  background: 'var(--panel2)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '6px 8px',
  fontSize: 13,
  fontFamily: 'inherit',
}

export default DashboardPage
