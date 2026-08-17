package com.jongheecode.portfolio.blog

import com.jongheecode.portfolio.week.GenerateWeekRequest
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/drafts")
class DraftController(
    private val blogPostController: BlogPostController,
) {
    @PostMapping
    fun create(
        @AuthenticationPrincipal principal: OAuth2User,
        @RequestBody request: GenerateWeekRequest,
    ): BlogPostDetail = blogPostController.generateWeek(principal, request)

    @GetMapping
    fun list(
        @AuthenticationPrincipal principal: OAuth2User,
        @RequestParam(required = false) status: String?,
    ): List<BlogPostSummary> {
        val posts = blogPostController.list(principal)
        if (status.isNullOrBlank()) return posts
        return posts.filter { it.status == status }
    }

    @PostMapping("/from-local")
    fun fromLocal(
        @AuthenticationPrincipal principal: OAuth2User,
        @RequestBody request: FromLocalDraftRequest,
    ): BlogPostDetail = blogPostController.generateFromSummaries(principal, request.weekStart, request.summaries)

    @PostMapping("/{id}/publish/retry")
    fun retry(
        @AuthenticationPrincipal principal: OAuth2User,
        @PathVariable id: Long,
    ): BlogPostDetail = blogPostController.publishToDevTo(principal, id)
}

data class FromLocalDraftRequest(
    val weekStart: java.time.LocalDate,
    val summaries: List<String>,
)
