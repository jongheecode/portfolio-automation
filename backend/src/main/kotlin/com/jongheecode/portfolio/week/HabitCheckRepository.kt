package com.jongheecode.portfolio.week

import com.jongheecode.portfolio.user.User
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface HabitCheckRepository : JpaRepository<HabitCheck, Long> {
    fun findByUserAndHabitKeyAndWeekStart(user: User, habitKey: String, weekStart: LocalDate): HabitCheck?
    fun deleteByUserAndHabitKeyAndWeekStart(user: User, habitKey: String, weekStart: LocalDate)
}
