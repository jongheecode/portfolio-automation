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

function PdfPage() {
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
        3단계 · 예정
      </span>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>포트폴리오 PDF 생성</h1>
      <p style={{ margin: 0, maxWidth: 520, textAlign: 'center', color: 'var(--muted)', fontSize: 15, lineHeight: 1.6 }}>
        추적한 프로젝트와 개발 활동을 한 장의 포트폴리오로 정리해 PDF로 내보냅니다. 취업·이직 시 그대로 첨부할 수
        있도록 준비 중입니다.
      </p>
      <div style={previewStyle}>
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12.5, color: 'var(--muted2)' }}>portfolio.pdf preview</span>
      </div>
    </div>
  )
}

export default PdfPage
