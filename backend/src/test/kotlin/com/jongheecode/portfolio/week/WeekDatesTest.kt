package com.jongheecode.portfolio.week

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import java.time.Clock
import java.time.Instant
import java.time.LocalDate

class WeekDatesTest {
    @Test
    fun `서울 일요일 23시은 그 주 월요일에 속한다`() {
        val clock = Clock.fixed(Instant.parse("2026-08-16T14:00:00Z"), WeekDates.ZONE)
        assertEquals(LocalDate.of(2026, 8, 10), WeekDates.currentWeekStart(clock))
    }

    @Test
    fun `서울 월요일 0시 30분은 새 주다`() {
        val clock = Clock.fixed(Instant.parse("2026-08-16T15:30:00Z"), WeekDates.ZONE)
        assertEquals(LocalDate.of(2026, 8, 17), WeekDates.currentWeekStart(clock))
    }

    @Test
    fun `월요일이 아닌 weekStart는 거부한다`() {
        assertThrows(IllegalArgumentException::class.java) {
            WeekDates.requireMonday(LocalDate.of(2026, 8, 12))
        }
    }

    @Test
    fun `커밋 Instant를 서울 날짜로 자른다`() {
        val sundayNight = Instant.parse("2026-08-16T14:00:00Z")
        val mondayMorning = Instant.parse("2026-08-16T15:30:00Z")
        assertEquals(LocalDate.of(2026, 8, 16), WeekDates.seoulDate(sundayNight))
        assertEquals(LocalDate.of(2026, 8, 17), WeekDates.seoulDate(mondayMorning))
    }

    @Test
    fun `주 범위는 일요일 밤을 포함하고 다음 월요일 새벽은 제외한다`() {
        val weekStart = LocalDate.of(2026, 8, 10)
        val sundayNight = Instant.parse("2026-08-16T14:00:00Z")
        val nextMondayMorning = Instant.parse("2026-08-16T15:30:00Z")
        val from = WeekDates.startInstant(weekStart)
        val to = WeekDates.endExclusiveInstant(weekStart)
        assertEquals(true, !sundayNight.isBefore(from) && sundayNight.isBefore(to))
        assertEquals(false, nextMondayMorning.isBefore(to))
    }
}
