function PublishedBadge({
  published,
  status,
}: {
  published: boolean
  status?: 'draft' | 'published' | 'failed' | null
}) {
  const kind = status ?? (published ? 'published' : 'draft')
  const label = kind === 'published' ? '발행됨' : kind === 'failed' ? '실패' : '초안'
  const color = kind === 'published' ? 'var(--green)' : kind === 'failed' ? 'var(--act-plan)' : 'var(--muted)'
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: '3px 10px',
        borderRadius: 999,
        flexShrink: 0,
        color,
        background: kind === 'draft' ? 'var(--panel2)' : `color-mix(in srgb, ${color} 16%, transparent)`,
      }}
    >
      {label}
    </span>
  )
}

export default PublishedBadge
