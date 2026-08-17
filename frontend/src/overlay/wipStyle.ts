import type { CSSProperties } from 'react'

export function wipTagStyle(tag: string): CSSProperties {
  const color = tag === 'A' ? 'var(--act-draft)' : tag === 'D' ? 'var(--act-plan)' : 'var(--act-commit)'
  return {
    fontFamily: 'var(--font-mono)',
    fontSize: 10.5,
    width: 16,
    height: 16,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 3,
    flex: 'none',
    color,
    background: `color-mix(in srgb, ${color} 14%, transparent)`,
  }
}

export function shortPath(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/')
  if (parts.length <= 3) return path
  return `${parts[0]}/.../${parts.slice(-2).join('/')}`
}

export function wipBarStyle(additions: number, deletions: number): CSSProperties {
  return {
    width: Math.max(4, Math.round((additions + deletions) / 3)),
    height: 5,
    borderRadius: 3,
    background: 'var(--act-commit)',
    opacity: 0.75,
    flex: 'none',
  }
}
