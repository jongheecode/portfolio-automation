package com.jongheecode.portfolio.week

import com.jongheecode.portfolio.blog.BlogPost
import com.jongheecode.portfolio.commit.CommitRecord
import com.jongheecode.portfolio.commit.PlanCommitLink
import java.time.Instant
import java.time.LocalDate

data class WeekResponse(
    val weekStart: LocalDate,
    val weekEnd: LocalDate,
    val habits: List<HabitDto>,
    val plans: List<PlanDto>,
    val days: List<WeekDayDto>,
    val pack: WeekPackDto?,
    val weekly: List<WeeklyPointDto> = emptyList(),
    val unwrittenCommitCount: Int = 0,
)

data class WeeksSummary(
    val days: List<WeekDayCountDto>,
    val weekly: List<WeeklyPointDto>,
    val unwrittenCommitCount: Int,
)

data class WeekDayCountDto(
    val date: LocalDate,
    val commitCount: Int,
    val planCount: Int,
)

data class WeeklyPointDto(
    val weekStart: LocalDate,
    val count: Int,
)

data class HabitDto(
    val key: String,
    val title: String,
    val target: Int,
    val current: Int,
    val done: Boolean,
    val doneDays: List<Boolean> = emptyList(),
)

data class PlanDto(
    val id: Long,
    val title: String,
    val dueOn: LocalDate,
    val done: Boolean,
    val dayIndex: Int = 0,
    val linkedCommitCount: Int = 0,
    val linkedCommitIds: List<Long> = emptyList(),
)

data class WeekDayDto(
    val date: LocalDate,
    val commits: List<WeekCommitDto>,
    val commitExtra: Int = 0,
    val commitCount: Int = 0,
    val planCount: Int = 0,
)

data class WeekCommitDto(
    val id: Long,
    val sha: String = "",
    val repoName: String,
    val message: String,
    val htmlUrl: String,
    val committedAt: Instant? = null,
    val authorName: String? = null,
    val additions: Int = 0,
    val deletions: Int = 0,
    val isMerge: Boolean = false,
    val isBot: Boolean = false,
)

data class WeekPackDto(
    val id: Long,
    val title: String,
    val content: String,
    val linkedinContent: String?,
    val twitterContent: String?,
    val published: Boolean,
    val devtoUrl: String?,
    val status: String = "draft",
    val publishedUrl: String? = null,
    val sourceCommitCount: Int = 0,
    val updatedAt: Instant? = null,
)

data class UpdateHabitTargetRequest(val target: Int)
data class CheckHabitRequest(val weekStart: LocalDate, val checked: Boolean)
data class CreatePlanRequest(val title: String, val dueOn: LocalDate)
data class UpdatePlanRequest(
    val title: String? = null,
    val dueOn: LocalDate? = null,
    val done: Boolean? = null,
    val linkedCommitIds: List<Long>? = null,
)
data class GenerateWeekRequest(val weekStart: LocalDate)

fun Plan.toDto(weekStart: LocalDate? = null, linkedCommitCount: Int = 0): PlanDto {
    val dayIndex = weekStart?.let { dueOn.toEpochDay().minus(it.toEpochDay()).toInt().coerceIn(0, 6) } ?: 0
    return PlanDto(id, title, dueOn, doneAt != null, dayIndex, linkedCommitCount, linkedIdSet().toList())
}

fun BlogPost.toPackDto(sourceCommitCount: Int = 0) = WeekPackDto(
    id = id,
    title = title,
    content = content,
    linkedinContent = linkedinContent,
    twitterContent = twitterContent,
    published = published,
    devtoUrl = devtoUrl,
    status = publishStatus,
    publishedUrl = publishedUrl ?: devtoUrl,
    sourceCommitCount = sourceCommitCount,
    updatedAt = updatedAt,
)

fun CommitRecord.toWeekCommitDto() = WeekCommitDto(
    id = id,
    sha = sha,
    repoName = trackedRepo.fullName,
    message = firstLine(),
    htmlUrl = htmlUrl,
    committedAt = committedAt,
    authorName = authorName,
    additions = additions,
    deletions = deletions,
    isMerge = isMerge,
    isBot = isBot,
)
