package com.jongheecode.portfolio.week

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class HabitProgressTest {
    @Test
    fun `커밋 날 목표를 낮추면 완료로 바뀐다`() {
        val current = HabitProgress.current(HabitCatalog.COMMIT_DAYS, commitDays = 3, weeklyPosts = 0, publishChecks = 0)
        assertEquals(3, current)
        assertFalse(HabitProgress.done(current, 5))
        assertTrue(HabitProgress.done(current, 3))
    }

    @Test
    fun `밖에 글 올리기 체크 횟수로 완료한다`() {
        val current = HabitProgress.current(HabitCatalog.PUBLISH_OUTSIDE, commitDays = 5, weeklyPosts = 1, publishChecks = 1)
        assertEquals(1, current)
        assertTrue(HabitProgress.done(current, 1))
        assertFalse(HabitProgress.done(0, 1))
    }
}
