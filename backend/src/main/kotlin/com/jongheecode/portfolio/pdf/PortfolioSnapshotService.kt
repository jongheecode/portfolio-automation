package com.jongheecode.portfolio.pdf

import com.jongheecode.portfolio.commit.CommitRecordRepository
import com.jongheecode.portfolio.repo.TrackedRepoRepository
import com.jongheecode.portfolio.user.User
import org.springframework.stereotype.Service
import java.time.Instant

@Service
class PortfolioSnapshotService(
    private val trackedRepoRepository: TrackedRepoRepository,
    private val commitRecordRepository: CommitRecordRepository,
) {
    fun build(user: User): PortfolioSnapshot {
        val repoSummaries = trackedRepoRepository.findByUser(user).map { repo ->
            PortfolioRepoSummary(
                fullName = repo.fullName,
                description = repo.description,
                language = repo.language,
                commitCount = commitRecordRepository.countByTrackedRepo(repo),
                htmlUrl = repo.htmlUrl,
            )
        }

        return PortfolioSnapshot(
            username = user.username,
            avatarUrl = user.avatarUrl,
            generatedAt = Instant.now(),
            totalRepos = repoSummaries.size,
            totalCommits = repoSummaries.sumOf { it.commitCount },
            repos = repoSummaries,
        )
    }
}
