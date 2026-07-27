package com.jongheecode.portfolio.commit

import com.jongheecode.portfolio.repo.TrackedRepo
import org.springframework.data.jpa.repository.JpaRepository

interface CommitRecordRepository : JpaRepository<CommitRecord, Long> {
    fun findByTrackedRepoOrderByCommittedAtDesc(trackedRepo: TrackedRepo): List<CommitRecord>
    fun existsByTrackedRepoAndSha(trackedRepo: TrackedRepo, sha: String): Boolean
    fun countByTrackedRepo(trackedRepo: TrackedRepo): Long
}
