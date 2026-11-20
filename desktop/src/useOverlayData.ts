import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createDraftFromLocal,
  fetchLocalDiff,
  fetchLocalGit,
  fetchMe,
  fetchNextAction,
  fetchWeek,
  formatHm,
  UnauthorizedError,
  weekdayLabel,
  type LocalDiffReview,
  type Me,
  type NextAction,
} from './overlayData'
import type { OverlayToastData } from './OverlayToast'
import type { WorkContextData } from './WorkContextPanel'

const HEAD_KEY = 'overlay-head-sha'
const TOAST_DAY_KEY = 'overlay-toast-day'
const TOAST_COUNT_KEY = 'overlay-toast-count'
const EVENING_KEY = 'overlay-evening'
const FRIDAY_KEY = 'overlay-friday'
const POLL_INTERVAL_MS = 8000
const TOAST_CAP = 2

function seoulNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  return {
    hour: Number(parts.find((p) => p.type === 'hour')?.value ?? 0),
    minute: Number(parts.find((p) => p.type === 'minute')?.value ?? 0),
    isFriday: (parts.find((p) => p.type === 'weekday')?.value ?? '') === 'Fri',
  }
}

function takeToastSlot(): boolean {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  if (localStorage.getItem(TOAST_DAY_KEY) !== today) {
    localStorage.setItem(TOAST_DAY_KEY, today)
    localStorage.setItem(TOAST_COUNT_KEY, '0')
  }
  const used = Number(localStorage.getItem(TOAST_COUNT_KEY) ?? '0')
  if (used >= TOAST_CAP) return false
  localStorage.setItem(TOAST_COUNT_KEY, String(used + 1))
  return true
}

interface State {
  me: Me | null
  loggedOut: boolean
  connectionOk: boolean
  hasLocalRepo: boolean
  data: WorkContextData | null
  weekStart: string | null
  newCommitTick: number
  toast: OverlayToastData | null
  review: LocalDiffReview | null
  nextAction: NextAction | null
}

export function useOverlayData() {
  const [state, setState] = useState<State>({
    me: null,
    loggedOut: false,
    connectionOk: true,
    hasLocalRepo: true,
    data: null,
    weekStart: null,
    newCommitTick: 0,
    toast: null,
    review: null,
    nextAction: null,
  })
  const tickRef = useRef(0)
  const authFails = useRef(0)

  const poll = useCallback(async () => {
    try {
      const me = await fetchMe()
      const [week, local, nextAction] = await Promise.all([fetchWeek(), fetchLocalGit(), fetchNextAction()])
      const active = local.active

      const weekTotal = week.days.reduce((sum, d) => sum + (d.commitCount ?? d.commits.length), 0)
      const weekPoints = week.days.map((d) => ({ wd: weekdayLabel(d.date), value: d.commitCount ?? d.commits.length }))
      const openPlans = (week.plans ?? []).filter((plan) => !plan.done).length
      const unwritten = week.unwrittenCommitCount ?? 0
      const todayCount = active?.todayCommits.length ?? 0
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
      let toast: OverlayToastData | null = null
      const { hour, minute, isFriday } = seoulNow()
      if (hour === 18 && minute < 8 && todayCount > 0) {
        if (localStorage.getItem(EVENING_KEY) !== today && takeToastSlot()) {
          localStorage.setItem(EVENING_KEY, today)
          toast = {
            title: `오늘 ${todayCount}커밋`,
            body: openPlans > 0 ? `어제 계획 중 ${openPlans}개 남음` : '오늘 기록은 여기까지.',
          }
        } else if (isFriday && unwritten > 0 && localStorage.getItem(FRIDAY_KEY) !== today && takeToastSlot()) {
          localStorage.setItem(FRIDAY_KEY, today)
          toast = { title: '위클리 랩', body: `초안 ${Math.min(3, Math.ceil(unwritten / 4))}개 만들 재료가 모였어요` }
        }
      }

      if (!active) {
        authFails.current = 0
        setState((prev) => ({ ...prev, me, nextAction, loggedOut: false, connectionOk: true, hasLocalRepo: false, data: null, weekStart: week.weekStart, toast: toast ?? prev.toast }))
        return
      }

      const data: WorkContextData = {
        repoName: active.name,
        branch: active.branch ?? null,
        unpushedCount: active.unpushedCount,
        changedFileCount: active.changedFileCount,
        additions: active.additions,
        deletions: active.deletions,
        files: active.files.map((f) => ({ tag: f.tag as 'M' | 'A' | 'D', path: f.path, additions: f.additions, deletions: f.deletions })),
        lastCommitAge: active.lastCommitAge ?? null,
        todayCommits: active.todayCommits.map((c) => ({
          sha: c.sha,
          message: c.message,
          time: formatHm(c.committedAt),
          additions: c.additions,
          deletions: c.deletions,
          written: c.written,
        })),
        branchCommitCount: active.branchCommitCount,
        branchCommitMessages: active.branchCommitMessages,
        weekTotal,
        weekPoints,
      }

      const head = active.headSha
      const prevHead = localStorage.getItem(HEAD_KEY)
      const isNewCommit = Boolean(head && prevHead && head !== prevHead)
      if (head) localStorage.setItem(HEAD_KEY, head)

      authFails.current = 0
      setState((prev) => ({
        ...prev,
        me,
        nextAction,
        loggedOut: false,
        connectionOk: true,
        hasLocalRepo: true,
        data,
        weekStart: week.weekStart,
        newCommitTick: isNewCommit ? ++tickRef.current : prev.newCommitTick,
        toast: toast ?? prev.toast,
      }))
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        authFails.current += 1
        if (authFails.current >= 2) {
          setState((prev) => ({ ...prev, me: null, loggedOut: true, connectionOk: true }))
        }
      } else {
        setState((prev) => ({ ...prev, connectionOk: false }))
      }
    }
  }, [])

  const loadReview = useCallback(async () => {
    try {
      const review = await fetchLocalDiff()
      setState((prev) => ({ ...prev, review }))
    } catch {
      setState((prev) => ({ ...prev, review: null }))
    }
  }, [])

  const createBranchDraft = useCallback(async () => {
    if (!state.weekStart || !state.data || state.data.branchCommitMessages.length === 0) return
    try {
      await createDraftFromLocal(state.weekStart, state.data.branchCommitMessages)
    } catch (err) {
      console.error('브랜치 초안 생성 실패', err)
    }
    await poll()
  }, [state.weekStart, state.data, poll])

  useEffect(() => {
    void poll()
    const id = window.setInterval(() => void poll(), POLL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [poll])

  const dismissToast = useCallback(() => {
    setState((prev) => ({ ...prev, toast: null }))
  }, [])

  return { ...state, refresh: poll, createBranchDraft, dismissToast, loadReview }
}
