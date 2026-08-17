package com.jongheecode.portfolio.git

import com.jongheecode.portfolio.user.User
import org.springframework.data.jpa.repository.JpaRepository

interface LocalWatchedRepoRepository : JpaRepository<LocalWatchedRepo, Long> {
    fun findByUserOrderByIdAsc(user: User): List<LocalWatchedRepo>
    fun findByIdAndUser(id: Long, user: User): LocalWatchedRepo?
    fun existsByUserAndPath(user: User, path: String): Boolean
}
