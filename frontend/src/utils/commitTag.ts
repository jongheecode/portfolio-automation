const TAG_COLORS: Record<string, string> = {
  feat: '#00B4AB',
  fix: '#f34b7d',
  refactor: '#A97BFF',
  chore: '#8a8a94',
  docs: '#3178c6',
  test: '#e3a008',
}

const KNOWN_TAGS = Object.keys(TAG_COLORS)

// conventional commit 접두어("feat: ...")를 파싱해서 태그/색을 뽑음. 접두어가 없거나
// 알 수 없는 타입이면 'chore'로 취급.
export function parseCommitTag(message: string): { tag: string; color: string } {
  const firstLine = message.split('\n')[0]
  const match = firstLine.match(/^(\w+)(\([^)]*\))?:/)
  const candidate = match?.[1]?.toLowerCase()
  const tag = candidate && KNOWN_TAGS.includes(candidate) ? candidate : 'chore'
  return { tag, color: TAG_COLORS[tag] }
}

export function commitTitle(message: string): string {
  const firstLine = message.split('\n')[0]
  return firstLine.replace(/^(\w+)(\([^)]*\))?:\s*/, '')
}
