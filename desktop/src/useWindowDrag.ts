import { useRef } from 'react'

const THRESHOLD = 6

export function useWindowDrag(onClick?: () => void) {
  const origin = useRef<{ x: number; y: number } | null>(null)
  const moved = useRef(false)

  return {
    onPointerDown(e: React.PointerEvent<HTMLElement>) {
      origin.current = { x: e.clientX, y: e.clientY }
      moved.current = false
      window.overlay.dragStart()
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove(e: React.PointerEvent<HTMLElement>) {
      if (!origin.current) return
      const dx = e.clientX - origin.current.x
      const dy = e.clientY - origin.current.y
      if (!moved.current && dx * dx + dy * dy < THRESHOLD * THRESHOLD) return
      moved.current = true
      window.overlay.dragMove()
    },
    onPointerUp() {
      if (!origin.current) return
      origin.current = null
      window.overlay.dragEnd()
      if (!moved.current) onClick?.()
    },
  }
}
