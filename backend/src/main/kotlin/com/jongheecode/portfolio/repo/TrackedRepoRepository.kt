package com.jongheecode.portfolio.repo

import com.jongheecode.portfolio.user.User
import org.springframework.data.jpa.repository.JpaRepository

interface TrackedRepoRepository : JpaRepository<TrackedRepo, Long> {
    fun findByUser(user: User): List<TrackedRepo>
    fun findByIdAndUser(id: Long, user: User): TrackedRepo?
    fun existsByUserAndFullName(user: User, fullName: String): Boolean
}
