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
}

export interface TrackedRepo {
  id: number
  owner: string
  name: string
  fullName: string
  htmlUrl: string
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
