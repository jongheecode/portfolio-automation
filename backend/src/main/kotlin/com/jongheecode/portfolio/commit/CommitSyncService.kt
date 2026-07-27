package com.jongheecode.portfolio.commit

import com.jongheecode.portfolio.github.GithubApiClient
import com.jongheecode.portfolio.repo.TrackedRepo
import com.jongheecode.portfolio.repo.TrackedRepoRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class CommitSyncService(
    private val githubApiClient: GithubApiClient,
    private val commitRecordRepository: CommitRecordRepository,
    private val trackedRepoRepository: TrackedRepoRepository,
) {
    // MVP는 폴링 방식(사용자가 sync를 트리거)만 지원.
    // 나중에 GitHub webhook으로 전환할 때도 이 메서드를 그대로 재사용하면 됨.
    @Transactional
    fun sync(trackedRepo: TrackedRepo, accessToken: String): Int {
        val commits = githubApiClient.listCommits(accessToken, trackedRepo.owner, trackedRepo.name)
        var savedCount = 0
        for (dto in commits) {
            if (commitRecordRepository.existsByTrackedRepoAndSha(trackedRepo, dto.sha)) continue
            commitRecordRepository.save(
                CommitRecord(
                    trackedRepo = trackedRepo,
                    sha = dto.sha,
                    message = dto.commit.message,
                    authorName = dto.commit.author.name,
                    committedAt = dto.commit.author.date,
                    htmlUrl = dto.htmlUrl,
                ),
            )
            savedCount++
        }
        trackedRepo.lastSyncedAt = Instant.now()
        trackedRepoRepository.save(trackedRepo)
        return savedCount
    }
}
