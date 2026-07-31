export interface Me {
  username: string
  avatarUrl: string | null
  devtoConnected: boolean
  devtoUsername: string | null
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
  includeInPortfolio: boolean
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
  devtoUrl: string | null
  createdAt: string
  commits: BlogCommitRef[]
}

export interface PortfolioDraft {
  content: string
  includedRepoIds: number[]
  includedSections: string[]
  updatedAt: string | null
}

export type PortfolioSection = 'intro' | 'challenges' | 'strengths' | 'techstack'
