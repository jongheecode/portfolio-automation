package com.jongheecode.portfolio.week

import com.jongheecode.portfolio.user.User
import org.springframework.data.jpa.repository.JpaRepository

interface HabitSettingRepository : JpaRepository<HabitSetting, Long> {
    fun findByUser(user: User): List<HabitSetting>
    fun findByUserAndKey(user: User, key: String): HabitSetting?
}
