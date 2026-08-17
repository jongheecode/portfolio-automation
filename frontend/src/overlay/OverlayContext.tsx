import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAppData } from '../contexts/AppDataContext'
import type { LocalGitResponse, LocalGitSnapshot, OverlayToast, WeekView } from '../types'
import { addDays, isOverlayShortcut, seoulToday, weekdayLabel } from '../utils/week'

const QUIET_KEY = 'weekpulse-quiet'
const TOAST_DAY_KEY = 'weekpulse-toast-day'
const TOAST_COUNT_KEY = 'weekpulse-toast-count'
const HEAD_KEY = 'weekpulse-head-sha'
const EVENING_KEY = 'weekpulse-evening'
const FRIDAY_KEY = 'weekpulse-friday'

type OverlayMode = 'closed' | 'popover' | 'hud'

interface OverlayContextValue {
  week: WeekView | null
  local: LocalGitResponse | null
  active: LocalGitSnapshot | null
  quiet: boolean
  mode: OverlayMode
  generating: boolean
  todayCount: number
  weekTotal: number
  todayIndex: number
  openPlans: number
  totalPlans: number
  remainingPlanLabel: string | null
  unwritten: number
  toasts: OverlayToast[]
  setQuiet: (value: boolean) => void
  togglePopover: () => void
  openHud: () => void
  close: () => void
  shiftWeek: (days: number) => void
  createDraft: () => Promise<void>
  createBranchDraft: () => Promise<void>
  watchPath: (path: string) => Promise<void>
  unwatch: (id: number) => Promise<void>
  dismissToast: (id: number) => void
}

const OverlayContext = createContext<OverlayContextValue | null>(null)

function seoulNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  return { hour, minute, isFriday: weekday === 'Fri' }
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  const { me } = useAppData()
  const navigate = useNavigate()
  const [week, setWeek] = useState<WeekView | null>(null)
  const [weekStart, setWeekStart] = useState<string | undefined>(undefined)
  const [local, setLocal] = useState<LocalGitResponse | null>(null)
  const [quiet, setQuietState] = useState(() => localStorage.getItem(QUIET_KEY) === '1')
  const [mode, setMode] = useState<OverlayMode>('closed')
  const [generating, setGenerating] = useState(false)
  const [toasts, setToasts] = useState<OverlayToast[]>([])
  const toastId = useRef(1)
  const toastCount = useRef(0)

  const loadWeek = useCallback(async (start?: string) => {
    try {
      setWeek(await api.week(start))
    } catch {
      /* keep */
    }
  }, [])

  const loadLocal = useCallback(async () => {
    try {
      setLocal(await api.localGit())
    } catch {
      /* keep */
    }
  }, [])

  useEffect(() => {
    if (!me) return
    void loadWeek(weekStart)
  }, [me, loadWeek, weekStart])

  useEffect(() => {
    if (!me) return
    void loadLocal()
    const id = window.setInterval(() => void loadLocal(), 8000)
    return () => window.clearInterval(id)
  }, [me, loadLocal])

  const pushToast = useCallback((title: string, body: string) => {
    const today = seoulToday()
    if (localStorage.getItem(TOAST_DAY_KEY) !== today) {
      localStorage.setItem(TOAST_DAY_KEY, today)
      localStorage.setItem(TOAST_COUNT_KEY, '0')
    }
    const used = Number(localStorage.getItem(TOAST_COUNT_KEY) ?? '0')
    if (used >= 2) return
    localStorage.setItem(TOAST_COUNT_KEY, String(used + 1))
    const id = toastId.current++
    setToasts((prev) => [...prev, { id, title, body }])
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000)
  }, [])

  const createDraft = useCallback(async () => {
    if (!week || generating) return
    if ((week.unwrittenCommitCount ?? 0) === 0 && !week.pack) return
    if (week.pack && !window.confirm('다시 만들면 이 주 초안을 덮어씁니다. 계속할까요?')) return
    setGenerating(true)
    try {
      const created = await api.createDraft(week.weekStart)
      setMode('closed')
      navigate(`/blog/${created.id}`)
    } finally {
      setGenerating(false)
    }
  }, [week, generating, navigate])

  const createBranchDraft = useCallback(async () => {
    if (!week || generating) return
    const messages = local?.active?.branchCommitMessages?.length
      ? local.active.branchCommitMessages
      : local?.active?.todayCommits.map((c) => c.message) ?? []
    if (messages.length === 0) {
      await createDraft()
      return
    }
    if (week.pack && !window.confirm('다시 만들면 이 주 초안을 덮어씁니다. 계속할까요?')) return
    setGenerating(true)
    try {
      const created = await api.createDraftFromLocal(week.weekStart, messages)
      setMode('closed')
      navigate(`/blog/${created.id}`)
    } finally {
      setGenerating(false)
    }
  }, [week, generating, navigate, local, createDraft])

  useEffect(() => {
    if (!me) return
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (isOverlayShortcut(event)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        setMode((prev) => (prev === 'hud' ? 'closed' : 'hud'))
        return
      }
      if (mode === 'closed') return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        setMode('closed')
      } else if (event.key === 'Enter' && mode === 'hud') {
        event.preventDefault()
        event.stopImmediatePropagation()
        void createBranchDraft()
      } else if (event.key === 'ArrowLeft' && mode === 'hud') {
        event.preventDefault()
        event.stopImmediatePropagation()
        setWeekStart((prev) => addDays(prev ?? week?.weekStart ?? seoulToday(), -7))
      } else if (event.key === 'ArrowRight' && mode === 'hud') {
        event.preventDefault()
        event.stopImmediatePropagation()
        setWeekStart((prev) => addDays(prev ?? week?.weekStart ?? seoulToday(), 7))
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [me, mode, week?.weekStart, createBranchDraft])

  const today = seoulToday()
  const todayIndex = week?.days.findIndex((day) => day.date === today) ?? -1
  const githubToday =
    todayIndex >= 0 ? (week?.days[todayIndex].commitCount ?? week?.days[todayIndex].commits.length ?? 0) : 0
  const todayCount = Math.max(githubToday, local?.active?.todayCommits.length ?? 0)
  const weekTotal = week?.days.reduce((sum, day) => sum + (day.commitCount ?? day.commits.length), 0) ?? 0
  const openPlans = week?.plans.filter((plan) => !plan.done).length ?? 0
  const totalPlans = week?.plans.length ?? 0
  const leftover = week?.plans.find((plan) => !plan.done)
  const remainingPlanLabel = leftover ? `${weekdayLabel(leftover.dueOn)} ${openPlans}개 남음` : null
  const unwritten = week?.unwrittenCommitCount ?? 0
  const active = local?.active ?? null

  useEffect(() => {
    if (!me || !active?.ok) return
    const day = seoulToday()
    if (localStorage.getItem(TOAST_DAY_KEY) !== day) {
      localStorage.setItem(TOAST_DAY_KEY, day)
      localStorage.setItem(TOAST_COUNT_KEY, '0')
      toastCount.current = 0
    }
    const head = active.headSha
    const prevHead = localStorage.getItem(HEAD_KEY)
    if (head && prevHead && head !== prevHead && todayCount > 0) {
      const last = active.todayCommits[0]
      const diff = last ? `+${last.additions} −${last.deletions}` : ''
      pushToast(`오늘 ${todayCount}번째`, `${diff} · 이번 주 ${weekTotal}개`.trim())
    }
    if (head) localStorage.setItem(HEAD_KEY, head)

    const { hour, minute, isFriday } = seoulNow()
    if (hour === 18 && minute < 8 && todayCount > 0) {
      if (localStorage.getItem(EVENING_KEY) !== day) {
        localStorage.setItem(EVENING_KEY, day)
        const leftoverPlans = openPlans
        pushToast(
          `오늘 ${todayCount}커밋`,
          leftoverPlans > 0 ? `어제 계획 중 ${leftoverPlans}개 남음` : '오늘 기록은 여기까지.',
        )
      }
      if (isFriday && unwritten > 0 && localStorage.getItem(FRIDAY_KEY) !== day) {
        localStorage.setItem(FRIDAY_KEY, day)
        pushToast('위클리 랩', `초안 ${Math.min(3, Math.ceil(unwritten / 4))}개 만들 재료가 모였어요`)
      }
    }
  }, [me, active?.headSha, active?.ok, todayCount, weekTotal, openPlans, unwritten, pushToast, active?.todayCommits])

  const setQuiet = useCallback((value: boolean) => {
    setQuietState(value)
    localStorage.setItem(QUIET_KEY, value ? '1' : '0')
  }, [])

  const value = useMemo<OverlayContextValue>(
    () => ({
      week,
      local,
      active,
      quiet,
      mode,
      generating,
      todayCount,
      weekTotal,
      todayIndex,
      openPlans,
      totalPlans,
      remainingPlanLabel,
      unwritten,
      toasts,
      setQuiet,
      togglePopover: () => setMode((prev) => (prev === 'popover' ? 'closed' : 'popover')),
      openHud: () => setMode('hud'),
      close: () => setMode('closed'),
      shiftWeek: (days) => setWeekStart((prev) => addDays(prev ?? week?.weekStart ?? today, days)),
      createDraft,
      createBranchDraft,
      watchPath: async (path: string) => {
        setLocal(await api.watchLocalGit(path))
      },
      unwatch: async (id: number) => {
        await api.unwatchLocalGit(id)
        setLocal(await api.localGit())
      },
      dismissToast: (id) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    }),
    [
      week,
      local,
      active,
      quiet,
      mode,
      generating,
      todayCount,
      weekTotal,
      todayIndex,
      openPlans,
      totalPlans,
      remainingPlanLabel,
      unwritten,
      toasts,
      setQuiet,
      createDraft,
      createBranchDraft,
      today,
    ],
  )

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>
}

export function useOverlay() {
  const ctx = useContext(OverlayContext)
  if (!ctx) throw new Error('useOverlay must be used within OverlayProvider')
  return ctx
}
