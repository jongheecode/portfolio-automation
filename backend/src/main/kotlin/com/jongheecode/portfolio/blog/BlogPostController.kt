package com.jongheecode.portfolio.blog

import com.jongheecode.portfolio.commit.CommitRecord
import com.jongheecode.portfolio.commit.CommitRecordRepository
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
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

@RestController
@RequestMapping("/api/blog-posts")
class BlogPostController(
    private val blogPostRepository: BlogPostRepository,
    private val commitRecordRepository: CommitRecordRepository,
    private val anthropicClient: AnthropicClient,
    private val userRepository: UserRepository,
) {
    @GetMapping
    fun list(@AuthenticationPrincipal principal: OAuth2User): List<BlogPostSummary> {
        val user = userRepository.currentUser(principal)
        return blogPostRepository.findByUserOrderByCreatedAtDesc(user)
            .map { it.toSummary(commitRecordRepository.countByBlogPost(it)) }
    }

    @PostMapping("/generate")
    fun generate(@AuthenticationPrincipal principal: OAuth2User): BlogPostDetail {
        val user = userRepository.currentUser(principal)
        val commits = commitRecordRepository.findByTrackedRepo_UserAndBlogPostIsNullOrderByCommittedAtAsc(user)
        check(commits.isNotEmpty()) { "아직 블로그에 포함되지 않은 새 커밋이 없습니다. 먼저 레포를 동기화해주세요." }

        val repoNames = commits.map { it.trackedRepo.fullName }.distinct().joinToString(", ")
        val summaries = commits.map { "[${it.trackedRepo.name}] ${it.message.lineSequence().first()}" }
        val generated = anthropicClient.generatePost(repoNames, summaries)

        val saved = blogPostRepository.save(BlogPost(user = user, title = generated.title, content = generated.content))
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
        val saved = blogPostRepository.save(post)
        return saved.toDetail(commitRecordRepository.findByBlogPostOrderByCommittedAtAsc(saved))
    }

    @PostMapping("/{id}/publish")
    fun publish(@AuthenticationPrincipal principal: OAuth2User, @PathVariable id: Long): BlogPostDetail {
        val user = userRepository.currentUser(principal)
        val post = blogPostRepository.findByIdAndUser(id, user) ?: error("포스트를 찾을 수 없습니다: $id")
        post.published = true
        val saved = blogPostRepository.save(post)
        return saved.toDetail(commitRecordRepository.findByBlogPostOrderByCommittedAtAsc(saved))
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

data class UpdateBlogPostRequest(val title: String, val content: String)

data class BlogPostSummary(
    val id: Long,
    val title: String,
    val published: Boolean,
    val createdAt: Instant,
    val commitCount: Long,
)

data class BlogPostDetail(
    val id: Long,
    val title: String,
    val content: String,
    val published: Boolean,
    val createdAt: Instant,
    val commits: List<BlogCommitRef>,
)

data class BlogCommitRef(val repoName: String, val message: String, val sha: String, val htmlUrl: String)

private fun BlogPost.toSummary(commitCount: Long) = BlogPostSummary(id, title, published, createdAt, commitCount)

private fun BlogPost.toDetail(commits: List<CommitRecord>) = BlogPostDetail(
    id,
    title,
    content,
    published,
    createdAt,
    commits.map { BlogCommitRef(it.trackedRepo.fullName, it.message.lineSequence().first(), it.sha, it.htmlUrl) },
)
