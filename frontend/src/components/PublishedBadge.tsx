function PublishedBadge({ published }: { published: boolean }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: '3px 10px',
        borderRadius: 999,
        flexShrink: 0,
        color: published ? 'var(--green)' : 'var(--muted)',
        background: published ? 'color-mix(in srgb, var(--green) 16%, transparent)' : 'var(--panel2)',
      }}
    >
      {published ? '발행됨' : '초안'}
    </span>
  )
}

export default PublishedBadge
