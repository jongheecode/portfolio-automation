import { useRef } from 'react'

// 드래그 시작으로 보는 거리(픽셀) — 넘으면 실제 드래그처럼 창을 따라 움직인다.
const DRAG_START_DISTANCE = 8
// 클릭으로 인정하는 기준 — 뗄 때 원점에서 이 거리 안이고, 누른 지 이 시간 안이면 클릭.
// 거리만 보면 "드래그하다가 원위치로 돌아와서 뗀 것"도 클릭이 안 돼서 시간도 같이 본다.
const CLICK_MAX_DISTANCE = 8
const CLICK_MAX_DURATION_MS = 250

export function useWindowDrag(onClick?: () => void) {
  const origin = useRef<{ x: number; y: number; time: number } | null>(null)
  const dragging = useRef(false)

  return {
    onPointerDown(e: React.PointerEvent<HTMLElement>) {
      origin.current = { x: e.clientX, y: e.clientY, time: Date.now() }
      dragging.current = false
      window.overlay.dragStart()
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove(e: React.PointerEvent<HTMLElement>) {
      if (!origin.current) return
      const dx = e.clientX - origin.current.x
      const dy = e.clientY - origin.current.y
      if (!dragging.current && dx * dx + dy * dy < DRAG_START_DISTANCE * DRAG_START_DISTANCE) return
      dragging.current = true
      window.overlay.dragMove()
    },
    onPointerUp(e: React.PointerEvent<HTMLElement>) {
      if (!origin.current) return
      const dx = e.clientX - origin.current.x
      const dy = e.clientY - origin.current.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const duration = Date.now() - origin.current.time
      origin.current = null
      dragging.current = false
      window.overlay.dragEnd()
      if (distance < CLICK_MAX_DISTANCE && duration < CLICK_MAX_DURATION_MS) onClick?.()
    },
  }
}
