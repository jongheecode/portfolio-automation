package com.jongheecode.portfolio.pdf

import com.jongheecode.portfolio.blog.GeminiClient
import com.jongheecode.portfolio.blog.PortfolioRepoInput
import com.jongheecode.portfolio.commit.CommitRecordRepository
import com.jongheecode.portfolio.github.GithubApiClient
import com.jongheecode.portfolio.repo.TrackedRepoRepository
import com.jongheecode.portfolio.user.UserRepository
import com.jongheecode.portfolio.user.currentUser
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.client.RestClientException
import java.time.Instant

@RestController
@RequestMapping("/api/portfolio-draft")
@Transactional
class PortfolioDraftController(
    private val portfolioDraftRepository: PortfolioDraftRepository,
    private val trackedRepoRepository: TrackedRepoRepository,
    private val commitRecordRepository: CommitRecordRepository,
    private val githubApiClient: GithubApiClient,
    private val geminiClient: GeminiClient,
    private val userRepository: UserRepository,
) {
    @GetMapping
    fun get(@AuthenticationPrincipal principal: OAuth2User): PortfolioDraftResponse {
        val user = userRepository.currentUser(principal)
        val draft = portfolioDraftRepository.findByUser(user)
        return draft?.toResponse() ?: PortfolioDraftResponse(
            content = "",
            includedRepoIds = emptyList(),
            includedSections = emptyList(),
            updatedAt = null,
        )
    }

    @PostMapping("/generate")
    fun generate(
        @AuthenticationPrincipal principal: OAuth2User,
        @RequestBody request: GenerateDraftRequest,
    ): PortfolioDraftResponse {
        val user = userRepository.currentUser(principal)
        val selectedRepos = trackedRepoRepository.findByUser(user).filter { it.includeInPortfolio }
        check(selectedRepos.isNotEmpty()) { "최소 1개 레포를 선택해주세요" }

        val repoInputs = try {
            selectedRepos.map { repo ->
                val readme = githubApiClient.fetchReadme(user.accessToken, repo.owner, repo.name)?.take(4000)
                val languages = githubApiClient.fetchLanguages(user.accessToken, repo.owner, repo.name)
                val commits = commitRecordRepository.findByTrackedRepoOrderByCommittedAtDesc(repo)
                    .take(15)
                    .map { it.firstLine() }
                PortfolioRepoInput(repo.fullName, repo.description, repo.language, languages, readme, commits)
            }
        } catch (e: RestClientException) {
            throw IllegalStateException("GitHub 정보를 가져오는 데 실패했습니다: ${e.message}")
        }

        val content = geminiClient.generatePortfolioDraft(request.sections, repoInputs)
        val repoIdsCsv = selectedRepos.joinToString(",") { it.id.toString() }
        val sectionsCsv = request.sections.joinToString(",")

        val existing = portfolioDraftRepository.findByUser(user)
        val draft = if (existing != null) {
            existing.content = content
            existing.includedRepoIds = repoIdsCsv
            existing.includedSections = sectionsCsv
            existing.updatedAt = Instant.now()
            existing
        } else {
            PortfolioDraft(user = user, content = content, includedRepoIds = repoIdsCsv, includedSections = sectionsCsv)
        }

        return portfolioDraftRepository.save(draft).toResponse()
    }

    @PutMapping
    fun update(
        @AuthenticationPrincipal principal: OAuth2User,
        @RequestBody request: UpdateDraftRequest,
    ): PortfolioDraftResponse {
        val user = userRepository.currentUser(principal)
        val draft = portfolioDraftRepository.findByUser(user) ?: error("아직 생성된 초안이 없습니다")
        draft.content = request.content
        draft.updatedAt = Instant.now()
        return portfolioDraftRepository.save(draft).toResponse()
    }
}

data class GenerateDraftRequest(val sections: List<String>)
data class UpdateDraftRequest(val content: String)

data class PortfolioDraftResponse(
    val content: String,
    val includedRepoIds: List<Long>,
    val includedSections: List<String>,
    val updatedAt: Instant?,
)

private fun PortfolioDraft.toResponse() = PortfolioDraftResponse(
    content,
    includedRepoIds.split(",").filter { it.isNotBlank() }.map { it.toLong() },
    includedSections.split(",").filter { it.isNotBlank() },
    updatedAt,
)
