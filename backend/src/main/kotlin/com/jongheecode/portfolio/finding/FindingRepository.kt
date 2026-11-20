package com.jongheecode.portfolio.finding

import com.jongheecode.portfolio.commit.CommitRecord
import com.jongheecode.portfolio.user.User
import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant

interface FindingRepository : JpaRepository<Finding, Long> {
    fun existsByCommitAndRuleId(commit: CommitRecord, ruleId: String): Boolean
    fun findByCommit_TrackedRepo_UserAndStatusOrderByCreatedAtAsc(user: User, status: String): List<Finding>
    fun findByCommitIn(commits: List<CommitRecord>): List<Finding>
    fun countByCommit_TrackedRepo_UserAndRuleIdAndCreatedAtAfter(user: User, ruleId: String, after: Instant): Long
}
