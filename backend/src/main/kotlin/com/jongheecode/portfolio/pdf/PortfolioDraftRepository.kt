package com.jongheecode.portfolio.pdf

import com.jongheecode.portfolio.user.User
import org.springframework.data.jpa.repository.JpaRepository

interface PortfolioDraftRepository : JpaRepository<PortfolioDraft, Long> {
    fun findByUser(user: User): PortfolioDraft?
}
