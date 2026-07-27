package com.jongheecode.portfolio.blog

import com.jongheecode.portfolio.user.User
import org.springframework.data.jpa.repository.JpaRepository

interface BlogPostRepository : JpaRepository<BlogPost, Long> {
    fun findByUserOrderByCreatedAtDesc(user: User): List<BlogPost>
    fun findByIdAndUser(id: Long, user: User): BlogPost?
}
