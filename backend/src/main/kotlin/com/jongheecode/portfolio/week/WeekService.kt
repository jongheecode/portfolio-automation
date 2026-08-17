package com.jongheecode.portfolio.week

import com.jongheecode.portfolio.blog.BlogPostRepository
import com.jongheecode.portfolio.commit.CommitRecordRepository
import com.jongheecode.portfolio.commit.PlanCommitLink
import com.jongheecode.portfolio.user.User
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import java.time.LocalDate

@Service
class WeekService(
    private val clock: Clock,
    private val habitSettingRepository: HabitSettingRepository,
    private val habitCheckRepository: HabitCheckRepository,
    private val planRepository: PlanRepository,
    private val commitRecordRepository: CommitRecordRepository,
    private val blogPostRepository: BlogPostRepository,
) {
    @Transactional
    fun getWeek(user: User, weekStartRaw: String?): WeekResponse {
        val weekStart = WeekDates.parseWeekStart(weekStartRaw) ?: WeekDates.currentWeekStart(clock)
        seedHabits(user)
        return buildWeek(user, weekStart)
    }

    @Transactional
    fun updateTarget(user: User, key: String, target: Int): HabitDto {
        val def = HabitCatalog.def(key) ?: throw NoSuchElementException("알 수 없는 습관입니다: $key")
        require(target >= 1) { "목표는 1 이상이어야 합니다" }
        seedHabits(user)
        val setting = habitSettingRepository.findByUserAndKey(user, key)
            ?: habitSettingRepository.save(HabitSetting(user = user, key = key, target = def.target))
        setting.target = target
        habitSettingRepository.save(setting)
        val weekStart = WeekDates.currentWeekStart(clock)
        return habitDto(user, setting, weekStart)
    }

    @Transactional
    fun setPublishCheck(user: User, weekStart: LocalDate, checked: Boolean): HabitDto {
        WeekDates.requireMonday(weekStart)
        seedHabits(user)
        val existing = habitCheckRepository.findByUserAndHabitKeyAndWeekStart(
            user,
            HabitCatalog.PUBLISH_OUTSIDE,
            weekStart,
        )
        if (checked && existing == null) {
            habitCheckRepository.save(
                HabitCheck(user = user, habitKey = HabitCatalog.PUBLISH_OUTSIDE, weekStart = weekStart),
            )
        } else if (!checked && existing != null) {
            habitCheckRepository.delete(existing)
        }
        val setting = habitSettingRepository.findByUserAndKey(user, HabitCatalog.PUBLISH_OUTSIDE)
            ?: error("습관을 찾을 수 없습니다")
        return habitDto(user, setting, weekStart)
    }

    @Transactional
    fun createPlan(user: User, title: String, dueOn: LocalDate): PlanDto {
        val trimmed = title.trim()
        require(trimmed.isNotEmpty()) { "제목을 입력해주세요" }
        require(trimmed.length <= 200) { "제목은 200자 이하여야 합니다" }
        val saved = planRepository.save(Plan(user = user, title = trimmed, dueOn = dueOn))
        return saved.toDto()
    }

    @Transactional
    fun updatePlan(user: User, id: Long, request: UpdatePlanRequest): PlanDto {
        val plan = planRepository.findByIdAndUser(id, user)
            ?: throw NoSuchElementException("계획을 찾을 수 없습니다: $id")
        request.title?.let {
            val trimmed = it.trim()
            require(trimmed.isNotEmpty()) { "제목을 입력해주세요" }
            plan.title = trimmed
        }
        request.dueOn?.let { plan.dueOn = it }
        request.done?.let { done ->
            plan.doneAt = if (done) Instant.now(clock) else null
        }
        request.linkedCommitIds?.let { ids ->
            plan.linkedCommitIds = ids.distinct().joinToString(",")
        }
        val saved = planRepository.save(plan)
        val weekStart = WeekDates.mondayOf(saved.dueOn)
        val dayCommits = weekCommits(user, weekStart).filter { WeekDates.seoulDate(it.committedAt) == saved.dueOn }
        return saved.toDto(
            weekStart,
            PlanCommitLink.uniqueCount(
                saved.title,
                dayCommits.map { it.id to it.firstLine() },
                saved.linkedIdSet(),
            ),
        )
    }

    @Transactional
    fun deletePlan(user: User, id: Long) {
        val plan = planRepository.findByIdAndUser(id, user)
            ?: throw NoSuchElementException("계획을 찾을 수 없습니다: $id")
        planRepository.delete(plan)
    }

    fun weekCommits(user: User, weekStart: LocalDate) =
        commitRecordRepository
            .findByTrackedRepo_UserAndCommittedAtGreaterThanEqualAndCommittedAtLessThanOrderByCommittedAtAsc(
                user,
                WeekDates.startInstant(weekStart),
                WeekDates.endExclusiveInstant(weekStart),
            )

    fun draftSourceCommits(user: User, weekStart: LocalDate, regenerate: Boolean): List<com.jongheecode.portfolio.commit.CommitRecord> {
        val scoped = weekCommits(user, weekStart).filter { it.trackedRepo.aiScopeEnabled }
        return if (regenerate) scoped else scoped.filter { it.blogPost == null }
    }

    private fun seedHabits(user: User) {
        val existing = habitSettingRepository.findByUser(user).associateBy { it.key }
        HabitCatalog.defaults.forEach { def ->
            if (existing[def.key] == null) {
                habitSettingRepository.save(HabitSetting(user = user, key = def.key, target = def.target))
            }
        }
    }

    private fun buildWeek(user: User, weekStart: LocalDate): WeekResponse {
        val weekEnd = WeekDates.weekEnd(weekStart)
        val commits = weekCommits(user, weekStart)
        val byDate = commits.groupBy { WeekDates.seoulDate(it.committedAt) }
        val planRows = planRepository.findByUserAndDueOnBetweenOrderByDueOnAscIdAsc(user, weekStart, weekEnd)
        val plansByDate = planRows.groupBy { it.dueOn }
        val days = (0L..6L).map { offset ->
            val date = weekStart.plusDays(offset)
            val all = byDate[date].orEmpty()
            WeekDayDto(
                date = date,
                commits = all.map { it.toWeekCommitDto() },
                commitExtra = 0,
                commitCount = all.size,
                planCount = plansByDate[date]?.size ?: 0,
            )
        }
        val commitDayFlags = (0L..6L).map { byDate[weekStart.plusDays(it)].orEmpty().isNotEmpty() }
        val settings = habitSettingRepository.findByUser(user).associateBy { it.key }
        val habits = HabitCatalog.defaults.map { def ->
            val setting = settings[def.key] ?: HabitSetting(user = user, key = def.key, target = def.target)
            habitDto(user, setting, weekStart, commitDays = byDate.keys.size, commitDayFlags = commitDayFlags)
        }
        val plans = planRows.map { plan ->
            val dayCommits = byDate[plan.dueOn].orEmpty()
            plan.toDto(
                weekStart,
                PlanCommitLink.uniqueCount(
                    plan.title,
                    dayCommits.map { it.id to it.firstLine() },
                    plan.linkedIdSet(),
                ),
            )
        }
        val packEntity = blogPostRepository.findByUserAndWeekStart(user, weekStart)
        val packCount = packEntity?.let { commitRecordRepository.countByBlogPost(it).toInt() } ?: 0
        val unwritten = commits.count { it.blogPost == null && it.trackedRepo.aiScopeEnabled }
        val weekly = weeklyPoints(user, WeekDates.currentWeekStart(clock))
        return WeekResponse(
            weekStart = weekStart,
            weekEnd = weekEnd,
            habits = habits,
            plans = plans,
            days = days,
            pack = packEntity?.toPackDto(packCount),
            weekly = weekly,
            unwrittenCommitCount = unwritten,
        )
    }

    fun summarize(user: User, weekStartRaw: String?): WeeksSummary {
        val week = getWeek(user, weekStartRaw)
        return WeeksSummary(
            days = week.days.map { WeekDayCountDto(it.date, it.commitCount, it.planCount) },
            weekly = week.weekly,
            unwrittenCommitCount = week.unwrittenCommitCount,
        )
    }

    fun weeklyPoints(user: User, endMonday: LocalDate): List<WeeklyPointDto> {
        val startMonday = endMonday.minusWeeks(11)
        val commits = commitRecordRepository
            .findByTrackedRepo_UserAndCommittedAtGreaterThanEqualAndCommittedAtLessThanOrderByCommittedAtAsc(
                user,
                WeekDates.startInstant(startMonday),
                WeekDates.endExclusiveInstant(endMonday),
            )
        return (0L..11L).map { offset ->
            val weekStart = startMonday.plusWeeks(offset)
            val from = WeekDates.startInstant(weekStart)
            val to = WeekDates.endExclusiveInstant(weekStart)
            WeeklyPointDto(
                weekStart = weekStart,
                count = commits.count { !it.committedAt.isBefore(from) && it.committedAt.isBefore(to) },
            )
        }
    }

    private fun habitDto(
        user: User,
        setting: HabitSetting,
        weekStart: LocalDate,
        commitDays: Int? = null,
        commitDayFlags: List<Boolean>? = null,
    ): HabitDto {
        val def = HabitCatalog.def(setting.key) ?: error("알 수 없는 습관입니다: ${setting.key}")
        val days = commitDays ?: weekCommits(user, weekStart)
            .map { WeekDates.seoulDate(it.committedAt) }
            .toSet()
            .size
        val weeklyPosts = blogPostRepository.countByUserAndWeekStart(user, weekStart).toInt()
        val publishChecks =
            if (habitCheckRepository.findByUserAndHabitKeyAndWeekStart(user, HabitCatalog.PUBLISH_OUTSIDE, weekStart) != null) 1 else 0
        val current = HabitProgress.current(setting.key, days, weeklyPosts, publishChecks)
        val done = HabitProgress.done(current, setting.target)
        val doneDays = when (setting.key) {
            HabitCatalog.COMMIT_DAYS -> commitDayFlags ?: List(7) { false }
            else -> List(7) { index -> index < current.coerceAtMost(7) }
        }
        return HabitDto(
            key = setting.key,
            title = def.title,
            target = setting.target,
            current = current,
            done = done,
            doneDays = doneDays,
        )
    }
}
