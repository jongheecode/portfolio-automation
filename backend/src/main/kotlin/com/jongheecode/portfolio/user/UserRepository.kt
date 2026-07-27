package com.jongheecode.portfolio.user

import org.springframework.data.jpa.repository.JpaRepository

interface UserRepository : JpaRepository<User, Long> {
    fun findByGithubId(githubId: Long): User?
}
