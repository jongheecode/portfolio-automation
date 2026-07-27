import type { CSSProperties } from 'react'

const wrapStyle: CSSProperties = {
  minHeight: 440,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 18,
  textAlign: 'center',
}

const previewStyle: CSSProperties = {
  marginTop: 10,
  width: '100%',
  maxWidth: 560,
  height: 200,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'repeating-linear-gradient(135deg, var(--panel) 0 14px, var(--panel2) 14px 28px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

function BlogPage() {
  return (
    <div style={wrapStyle}>
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
          background: 'var(--accent-soft)',
          padding: '5px 11px',
          borderRadius: 999,
        }}
      >
        2단계 · 예정
      </span>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>기술 블로그 자동 포스팅</h1>
      <p style={{ margin: 0, maxWidth: 520, textAlign: 'center', color: 'var(--muted)', fontSize: 15, lineHeight: 1.6 }}>
        수집된 커밋과 작업 내용을 바탕으로 초안을 만들어 블로그에 자동으로 발행합니다. 곧 이 자리에서 초안 편집과
        발행 흐름을 만나보실 수 있어요.
      </p>
      <div style={previewStyle}>
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12.5, color: 'var(--muted2)' }}>blog editor preview</span>
      </div>
    </div>
  )
}

export default BlogPage
