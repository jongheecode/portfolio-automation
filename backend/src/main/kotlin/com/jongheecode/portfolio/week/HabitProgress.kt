package com.jongheecode.portfolio.week

object HabitProgress {
    fun current(key: String, commitDays: Int, weeklyPosts: Int, publishChecks: Int): Int =
        when (key) {
            HabitCatalog.COMMIT_DAYS -> commitDays
            HabitCatalog.WEEKLY_POST -> weeklyPosts
            HabitCatalog.PUBLISH_OUTSIDE -> publishChecks
            else -> 0
        }

    fun done(current: Int, target: Int): Boolean = current >= target
}
