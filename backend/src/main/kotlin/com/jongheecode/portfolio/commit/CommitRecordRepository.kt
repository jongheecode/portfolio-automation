package com.jongheecode.portfolio.commit

import com.jongheecode.portfolio.blog.BlogPost
import com.jongheecode.portfolio.repo.TrackedRepo
import com.jongheecode.portfolio.user.User
import org.springframework.data.jpa.repository.JpaRepository

interface CommitRecordRepository : JpaRepository<CommitRecord, Long> {
    fun findByTrackedRepoOrderByCommittedAtDesc(trackedRepo: TrackedRepo): List<CommitRecord>
    fun existsByTrackedRepoAndSha(trackedRepo: TrackedRepo, sha: String): Boolean
    fun countByTrackedRepo(trackedRepo: TrackedRepo): Long
    fun findByTrackedRepo_UserAndBlogPostIsNullOrderByCommittedAtAsc(user: User): List<CommitRecord>
    fun findByBlogPostOrderByCommittedAtAsc(blogPost: BlogPost): List<CommitRecord>
    fun countByBlogPost(blogPost: BlogPost): Long
    fun findByTrackedRepo_User(user: User): List<CommitRecord>
}
