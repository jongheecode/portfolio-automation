package com.jongheecode.portfolio.blog

import com.jongheecode.portfolio.user.User
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface BlogPostRepository : JpaRepository<BlogPost, Long> {
    fun findByUserOrderByCreatedAtDesc(user: User): List<BlogPost>
    fun findByIdAndUser(id: Long, user: User): BlogPost?
    fun findByUserAndWeekStart(user: User, weekStart: LocalDate): BlogPost?
    fun countByUserAndWeekStart(user: User, weekStart: LocalDate): Long
    fun findByUserAndPublishStatusOrderByCreatedAtDesc(user: User, publishStatus: String): List<BlogPost>
}
