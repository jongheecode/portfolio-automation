import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createDraftFromLocal,
  fetchLocalGit,
  fetchMe,
  fetchWeek,
  formatHm,
  UnauthorizedError,
  weekdayLabel,
  type Me,
} from './overlayData'
import type { WorkContextData } from './WorkContextPanel'

const HEAD_KEY = 'overlay-head-sha'
const POLL_INTERVAL_MS = 8000

interface State {
  me: Me | null
  loggedOut: boolean
  connectionOk: boolean
  hasLocalRepo: boolean
  data: WorkContextData | null
  weekStart: string | null
  newCommitTick: number
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
  })
  const tickRef = useRef(0)
  const authFails = useRef(0)

  const poll = useCallback(async () => {
    try {
      const me = await fetchMe()
      const [week, local] = await Promise.all([fetchWeek(), fetchLocalGit()])
      const active = local.active

      const weekTotal = week.days.reduce((sum, d) => sum + (d.commitCount ?? d.commits.length), 0)
      const weekPoints = week.days.map((d) => ({ wd: weekdayLabel(d.date), value: d.commitCount ?? d.commits.length }))

      if (!active) {
        authFails.current = 0
        setState((prev) => ({ ...prev, me, loggedOut: false, connectionOk: true, hasLocalRepo: false, data: null, weekStart: week.weekStart }))
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
        loggedOut: false,
        connectionOk: true,
        hasLocalRepo: true,
        data,
        weekStart: week.weekStart,
        newCommitTick: isNewCommit ? ++tickRef.current : prev.newCommitTick,
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

  return { ...state, refresh: poll, createBranchDraft }
}
