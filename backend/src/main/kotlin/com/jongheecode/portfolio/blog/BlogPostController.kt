package com.jongheecode.portfolio.blog

import com.jongheecode.portfolio.commit.CommitRecord
import com.jongheecode.portfolio.commit.CommitRecordRepository
import com.jongheecode.portfolio.devto.DevToApiClient
import com.jongheecode.portfolio.user.UserRepository
import com.jongheecode.portfolio.user.currentUser
import com.jongheecode.portfolio.week.GenerateWeekRequest
import com.jongheecode.portfolio.week.WeekDates
import com.jongheecode.portfolio.week.WeekService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@RestController
@RequestMapping("/api/blog-posts")
@Transactional
class BlogPostController(
    private val blogPostRepository: BlogPostRepository,
    private val commitRecordRepository: CommitRecordRepository,
    private val geminiClient: GeminiClient,
    private val userRepository: UserRepository,
    private val devToApiClient: DevToApiClient,
    private val weekService: WeekService,
) {
    @GetMapping
    fun list(@AuthenticationPrincipal principal: OAuth2User): List<BlogPostSummary> {
        val user = userRepository.currentUser(principal)
        return blogPostRepository.findByUserOrderByCreatedAtDesc(user)
            .map { it.toSummary(commitRecordRepository.countByBlogPost(it)) }
    }

    @PostMapping("/generate-week")
    fun generateWeek(
        @AuthenticationPrincipal principal: OAuth2User,
        @RequestBody request: GenerateWeekRequest,
    ): BlogPostDetail {
        val user = userRepository.currentUser(principal)
        val weekStart = WeekDates.requireMonday(request.weekStart)
        val existing = blogPostRepository.findByUserAndWeekStart(user, weekStart)
        val commits = weekService.draftSourceCommits(user, weekStart, regenerate = existing != null)
        check(commits.isNotEmpty()) { "초안에 넣을 커밋이 없습니다. GitHub에서 가져오거나 AI 전송 레포를 확인해 주세요." }

        val summaries = commits.map { "[${it.trackedRepo.fullName}] ${it.firstLine()}" }
        return saveWeekPack(user, weekStart, existing, commits, summaries)
    }

    fun generateFromSummaries(
        @AuthenticationPrincipal principal: OAuth2User,
        weekStart: java.time.LocalDate,
        summaries: List<String>,
    ): BlogPostDetail {
        val user = userRepository.currentUser(principal)
        val monday = WeekDates.requireMonday(weekStart)
        check(summaries.isNotEmpty()) { "초안에 넣을 커밋이 없습니다." }
        val existing = blogPostRepository.findByUserAndWeekStart(user, monday)
        return saveWeekPack(user, monday, existing, emptyList(), summaries)
    }

    private fun saveWeekPack(
        user: com.jongheecode.portfolio.user.User,
        weekStart: java.time.LocalDate,
        existing: BlogPost?,
        commits: List<CommitRecord>,
        summaries: List<String>,
    ): BlogPostDetail {
        val generated = geminiClient.generateWeekPack(summaries)

        if (existing != null) {
            commitRecordRepository.findByBlogPostOrderByCommittedAtAsc(existing).forEach { it.blogPost = null }
        }
        val post = existing ?: BlogPost(user = user, title = generated.title, content = generated.content)
        post.title = generated.title
        post.content = generated.content
        post.linkedinContent = generated.linkedin
        post.twitterContent = generated.twitter
        post.weekStart = weekStart
        post.updatedAt = Instant.now()
        post.publishStatus = if (post.published) "published" else "draft"
        val saved = blogPostRepository.save(post)
        commits.forEach { it.blogPost = saved }
        commitRecordRepository.saveAll(commits)
        return saved.toDetail(commits)
    }

    @GetMapping("/{id}")
    fun detail(@AuthenticationPrincipal principal: OAuth2User, @PathVariable id: Long): BlogPostDetail {
        val user = userRepository.currentUser(principal)
        val post = blogPostRepository.findByIdAndUser(id, user) ?: error("포스트를 찾을 수 없습니다: $id")
        return post.toDetail(commitRecordRepository.findByBlogPostOrderByCommittedAtAsc(post))
    }

    @PutMapping("/{id}")
    fun update(
        @AuthenticationPrincipal principal: OAuth2User,
        @PathVariable id: Long,
        @RequestBody request: UpdateBlogPostRequest,
    ): BlogPostDetail {
        val user = userRepository.currentUser(principal)
        val post = blogPostRepository.findByIdAndUser(id, user) ?: error("포스트를 찾을 수 없습니다: $id")
        post.title = request.title
        post.content = request.content
        request.linkedinContent?.let { post.linkedinContent = it }
        request.twitterContent?.let { post.twitterContent = it }
        post.updatedAt = Instant.now()
        val saved = blogPostRepository.save(post)
        return saved.toDetail(commitRecordRepository.findByBlogPostOrderByCommittedAtAsc(saved))
    }

    @PostMapping("/{id}/publish")
    fun publish(@AuthenticationPrincipal principal: OAuth2User, @PathVariable id: Long): BlogPostDetail {
        val user = userRepository.currentUser(principal)
        val post = blogPostRepository.findByIdAndUser(id, user) ?: error("포스트를 찾을 수 없습니다: $id")
        post.published = true
        post.publishStatus = "published"
        post.publishedUrl = post.publishedUrl ?: post.devtoUrl
        post.updatedAt = Instant.now()
        val saved = blogPostRepository.save(post)
        return saved.toDetail(commitRecordRepository.findByBlogPostOrderByCommittedAtAsc(saved))
    }

    @PostMapping("/{id}/publish-to-devto")
    fun publishToDevTo(@AuthenticationPrincipal principal: OAuth2User, @PathVariable id: Long): BlogPostDetail {
        val user = userRepository.currentUser(principal)
        val post = blogPostRepository.findByIdAndUser(id, user) ?: error("포스트를 찾을 수 없습니다: $id")
        check(user.devtoApiKey != null) { "먼저 설정에서 dev.to를 연결해주세요" }
        return try {
            val url = devToApiClient.publishArticle(user.devtoApiKey!!, post.title, post.content)
            post.devtoUrl = url
            post.publishedUrl = url
            post.published = true
            post.publishStatus = "published"
            post.updatedAt = Instant.now()
            val saved = blogPostRepository.save(post)
            saved.toDetail(commitRecordRepository.findByBlogPostOrderByCommittedAtAsc(saved))
        } catch (e: Exception) {
            post.publishStatus = "failed"
            post.updatedAt = Instant.now()
            blogPostRepository.save(post)
            throw e
        }
    }

    @DeleteMapping("/{id}")
    fun delete(@AuthenticationPrincipal principal: OAuth2User, @PathVariable id: Long) {
        val user = userRepository.currentUser(principal)
        val post = blogPostRepository.findByIdAndUser(id, user) ?: error("포스트를 찾을 수 없습니다: $id")
        val commits = commitRecordRepository.findByBlogPostOrderByCommittedAtAsc(post)
        commits.forEach { it.blogPost = null }
        commitRecordRepository.saveAll(commits)
        blogPostRepository.delete(post)
    }
}

data class UpdateBlogPostRequest(
    val title: String,
    val content: String,
    val linkedinContent: String? = null,
    val twitterContent: String? = null,
)

data class BlogPostSummary(
    val id: Long,
    val title: String,
    val published: Boolean,
    val createdAt: Instant,
    val commitCount: Long,
    val status: String = "draft",
    val publishedUrl: String? = null,
)

data class BlogPostDetail(
    val id: Long,
    val title: String,
    val content: String,
    val published: Boolean,
    val devtoUrl: String?,
    val linkedinContent: String?,
    val twitterContent: String?,
    val weekStart: java.time.LocalDate?,
    val createdAt: Instant,
    val commits: List<BlogCommitRef>,
    val status: String = "draft",
    val publishedUrl: String? = null,
    val updatedAt: Instant? = null,
)

data class BlogCommitRef(val repoName: String, val message: String, val sha: String, val htmlUrl: String)

private fun BlogPost.toSummary(commitCount: Long) =
    BlogPostSummary(id, title, published, createdAt, commitCount, publishStatus, publishedUrl ?: devtoUrl)

private fun BlogPost.toDetail(commits: List<CommitRecord>) = BlogPostDetail(
    id,
    title,
    content,
    published,
    devtoUrl,
    linkedinContent,
    twitterContent,
    weekStart,
    createdAt,
    commits.map { BlogCommitRef(it.trackedRepo.fullName, it.firstLine(), it.sha, it.htmlUrl) },
    publishStatus,
    publishedUrl ?: devtoUrl,
    updatedAt,
)
