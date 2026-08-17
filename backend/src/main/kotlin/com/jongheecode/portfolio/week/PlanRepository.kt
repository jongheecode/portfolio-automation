package com.jongheecode.portfolio.week

import com.jongheecode.portfolio.user.User
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface PlanRepository : JpaRepository<Plan, Long> {
    fun findByUserAndDueOnBetweenOrderByDueOnAscIdAsc(user: User, from: LocalDate, to: LocalDate): List<Plan>
    fun findByIdAndUser(id: Long, user: User): Plan?
}
