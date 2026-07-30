import type { CSSProperties } from 'react'

// 카드/테이블, 리스트/타임라인 같은 두 값 토글 버튼에 공통으로 쓰는 스타일.
export function segmentButtonStyle(active: boolean): CSSProperties {
  return {
    border: 'none',
    borderRadius: 6,
    padding: '5px 13px',
    fontSize: 12.5,
    fontWeight: 500,
    cursor: 'pointer',
    background: active ? 'var(--panel)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--muted)',
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.25)' : 'none',
  }
}
