package com.jongheecode.portfolio.week

import java.time.Clock
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeParseException

object WeekDates {
    val ZONE: ZoneId = ZoneId.of("Asia/Seoul")

    fun currentWeekStart(clock: Clock): LocalDate = mondayOf(LocalDate.now(clock.withZone(ZONE)))

    fun mondayOf(date: LocalDate): LocalDate = date.with(DayOfWeek.MONDAY)

    fun requireMonday(date: LocalDate): LocalDate {
        require(date.dayOfWeek == DayOfWeek.MONDAY) { "weekStart는 월요일이어야 합니다" }
        return date
    }

    fun parseWeekStart(raw: String?): LocalDate? {
        if (raw.isNullOrBlank()) return null
        val date = try {
            LocalDate.parse(raw)
        } catch (_: DateTimeParseException) {
            throw IllegalArgumentException("weekStart는 YYYY-MM-DD 월요일이어야 합니다")
        }
        return requireMonday(date)
    }

    fun seoulDate(instant: Instant): LocalDate = instant.atZone(ZONE).toLocalDate()

    fun weekEnd(weekStart: LocalDate): LocalDate = requireMonday(weekStart).plusDays(6)

    fun startInstant(weekStart: LocalDate): Instant =
        requireMonday(weekStart).atStartOfDay(ZONE).toInstant()

    fun endExclusiveInstant(weekStart: LocalDate): Instant =
        requireMonday(weekStart).plusDays(7).atStartOfDay(ZONE).toInstant()
}
