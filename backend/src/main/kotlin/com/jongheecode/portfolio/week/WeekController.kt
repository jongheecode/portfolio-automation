package com.jongheecode.portfolio.week

import com.jongheecode.portfolio.user.UserRepository
import com.jongheecode.portfolio.user.currentUser
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
class WeekController(
    private val weekService: WeekService,
    private val userRepository: UserRepository,
) {
    @GetMapping("/api/week")
    fun week(
        @AuthenticationPrincipal principal: OAuth2User,
        @RequestParam(required = false) weekStart: String?,
    ): WeekResponse = weekService.getWeek(userRepository.currentUser(principal), weekStart)

    @GetMapping("/api/weeks")
    fun weeks(
        @AuthenticationPrincipal principal: OAuth2User,
        @RequestParam(required = false) start: String?,
        @RequestParam(required = false) tz: String?,
    ): WeeksSummary {
        require(tz.isNullOrBlank() || tz == "Asia/Seoul") { "tz는 Asia/Seoul만 지원합니다" }
        return weekService.summarize(userRepository.currentUser(principal), start)
    }

    @PutMapping("/api/habits/{key}")
    fun updateTarget(
        @AuthenticationPrincipal principal: OAuth2User,
        @PathVariable key: String,
        @RequestBody request: UpdateHabitTargetRequest,
    ): HabitDto = weekService.updateTarget(userRepository.currentUser(principal), key, request.target)

    @PutMapping("/api/habits/PUBLISH_OUTSIDE/check")
    fun checkPublish(
        @AuthenticationPrincipal principal: OAuth2User,
        @RequestBody request: CheckHabitRequest,
    ): HabitDto = weekService.setPublishCheck(userRepository.currentUser(principal), request.weekStart, request.checked)

    @PostMapping("/api/plans")
    fun createPlan(
        @AuthenticationPrincipal principal: OAuth2User,
        @RequestBody request: CreatePlanRequest,
    ): PlanDto = weekService.createPlan(userRepository.currentUser(principal), request.title, request.dueOn)

    @PutMapping("/api/plans/{id}")
    fun updatePlan(
        @AuthenticationPrincipal principal: OAuth2User,
        @PathVariable id: Long,
        @RequestBody request: UpdatePlanRequest,
    ): PlanDto = weekService.updatePlan(userRepository.currentUser(principal), id, request)

    @DeleteMapping("/api/plans/{id}")
    fun deletePlan(
        @AuthenticationPrincipal principal: OAuth2User,
        @PathVariable id: Long,
    ) {
        weekService.deletePlan(userRepository.currentUser(principal), id)
    }
}
