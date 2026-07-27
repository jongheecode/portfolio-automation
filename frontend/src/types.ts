export interface Me {
  username: string
  avatarUrl: string | null
}

export interface GithubRepo {
  id: number
  name: string
  fullName: string
  htmlUrl: string
  isPrivate: boolean
  language: string | null
  description: string | null
}

export interface TrackedRepo {
  id: number
  owner: string
  name: string
  fullName: string
  htmlUrl: string
  language: string | null
  description: string | null
  commitCount: number
  lastSyncedAt: string | null
}

export interface CommitRecord {
  id: number
  sha: string
  message: string
  authorName: string
  committedAt: string
  htmlUrl: string
}

export interface BlogPostSummary {
  id: number
  title: string
  published: boolean
  createdAt: string
  commitCount: number
}

export interface BlogCommitRef {
  repoName: string
  message: string
  sha: string
  htmlUrl: string
}

export interface BlogPostDetail {
  id: number
  title: string
  content: string
  published: boolean
  createdAt: string
  commits: BlogCommitRef[]
}

export interface PortfolioRepoSummary {
  fullName: string
  description: string | null
  language: string | null
  commitCount: number
  htmlUrl: string
}

export interface PortfolioSnapshot {
  username: string
  avatarUrl: string | null
  generatedAt: string
  totalRepos: number
  totalCommits: number
  repos: PortfolioRepoSummary[]
}
