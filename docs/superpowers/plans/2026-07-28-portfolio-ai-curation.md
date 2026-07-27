# 포트폴리오 AI 큐레이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 추적 레포를 그대로 나열하던 포트폴리오 PDF를, 레포/섹션 선택 → Claude가 마크다운 초안 생성 → 사용자 편집 → PDF 변환 흐름으로 바꾼다.

**Architecture:** 백엔드에 `PortfolioDraft`(사용자당 1행, 마크다운 본문) 엔티티를 추가하고, 선택된 레포의 README/언어비중/커밋을 모아 Claude에 보내 초안을 만든다. PDF는 이제 저장된 마크다운을 commonmark로 HTML 변환 후 기존 openhtmltopdf 파이프라인에 태운다. 프론트는 체크박스 + 마크다운 에디터로 재구성한다.

**Tech Stack:** Kotlin/Spring Boot 3.3(백엔드), React/TypeScript/Vite(프론트), commonmark-java(신규, 마크다운→HTML), 기존 AnthropicClient/openhtmltopdf 재사용.

## Global Constraints

- 이 프로젝트는 단위테스트가 없다(스캐폴드가 만든 `contextLoads()` 스모크 테스트 하나뿐). 각 태스크의 "테스트" 단계는 `./gradlew compileKotlin`(백엔드) / `npx tsc -b`(프론트) 컴파일 확인 + 마지막 태스크에서의 브라우저 수동 확인으로 대체한다. 새 단위테스트를 추가하지 않는다 — 기존 컨벤션을 따른다.
- 커밋 메시지는 한국어, 기존 커밋 스타일(`N단계: ...` 또는 짧은 설명)을 따른다.
- 모든 신규 API는 기존 패턴대로 `@AuthenticationPrincipal OAuth2User` + `userRepository.currentUser(principal)`로 사용자를 구한다.
- lazy 연관관계(`trackedRepo`, `user` 등)를 세션 밖에서 접근하는 코드가 있으면 컨트롤러에 `@Transactional`을 붙인다(이미 `BlogPostController`에 적용된 패턴).

---

### Task 1: TrackedRepo에 includeInPortfolio 추가 + 선택 토글 API

**Files:**
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/repo/TrackedRepo.kt`
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/repo/TrackedRepoController.kt`

**Interfaces:**
- Produces: `TrackedRepo.includeInPortfolio: Boolean` (mutable), `TrackedRepoResponse.includeInPortfolio: Boolean`, `PUT /api/tracked-repos/{id}/portfolio-selection`

- [ ] **Step 1: TrackedRepo에 필드 추가**

`backend/src/main/kotlin/com/jongheecode/portfolio/repo/TrackedRepo.kt`에서 `lastSyncedAt` 필드 위에 추가:

```kotlin
    var includeInPortfolio: Boolean = false,

    var lastSyncedAt: Instant? = null,
```

- [ ] **Step 2: TrackedRepoResponse/toResponse에 필드 추가**

`backend/src/main/kotlin/com/jongheecode/portfolio/repo/TrackedRepoController.kt`의 `TrackedRepoResponse`를 다음으로 교체:

```kotlin
data class TrackedRepoResponse(
    val id: Long,
    val owner: String,
    val name: String,
    val fullName: String,
    val htmlUrl: String,
    val language: String?,
    val description: String?,
    val commitCount: Long,
    val includeInPortfolio: Boolean,
    val lastSyncedAt: Instant?,
)

private fun TrackedRepo.toResponse(commitCount: Long) =
    TrackedRepoResponse(id, owner, name, fullName, htmlUrl, language, description, commitCount, includeInPortfolio, lastSyncedAt)
```

- [ ] **Step 3: 선택 토글 엔드포인트 추가**

같은 파일의 `TrackedRepoController` 클래스 안, `sync` 메서드 다음에 추가:

```kotlin
    @PutMapping("/{id}/portfolio-selection")
    fun setPortfolioSelection(
        @AuthenticationPrincipal principal: OAuth2User,
        @PathVariable id: Long,
        @RequestBody request: PortfolioSelectionRequest,
    ): TrackedRepoResponse {
        val user = userRepository.currentUser(principal)
        val repo = trackedRepoRepository.findByIdAndUser(id, user)
            ?: error("레포를 찾을 수 없습니다: $id")
        repo.includeInPortfolio = request.include
        val saved = trackedRepoRepository.save(repo)
        return saved.toResponse(commitRecordRepository.countByTrackedRepo(saved))
    }
```

파일 하단 데이터 클래스들 옆에 추가:

```kotlin
data class PortfolioSelectionRequest(val include: Boolean)
```

- [ ] **Step 4: 컴파일 확인**

Run: `cd backend && ./gradlew compileKotlin --console=plain`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: 커밋**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/repo/
git commit -m "포트폴리오 레포 선택(토글) 필드/API 추가"
```

---

### Task 2: GithubApiClient에 README/언어비중 조회 추가

**Files:**
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/github/GithubApiClient.kt`

**Interfaces:**
- Produces: `GithubApiClient.fetchReadme(accessToken: String, owner: String, repo: String): String?`, `GithubApiClient.fetchLanguages(accessToken: String, owner: String, repo: String): Map<String, Long>`

- [ ] **Step 1: import 추가**

파일 상단 import 목록에 추가:

```kotlin
import org.springframework.web.client.HttpClientErrorException
```

- [ ] **Step 2: 메서드 추가**

`GithubApiClient` 클래스의 `listCommits` 메서드 다음에 추가:

```kotlin
    fun fetchReadme(accessToken: String, owner: String, repo: String): String? =
        try {
            restClient.get()
                .uri("/repos/$owner/$repo/readme")
                .header("Authorization", "Bearer $accessToken")
                .header("Accept", "application/vnd.github.raw")
                .retrieve()
                .body(String::class.java)
        } catch (e: HttpClientErrorException.NotFound) {
            null
        }

    fun fetchLanguages(accessToken: String, owner: String, repo: String): Map<String, Long> =
        restClient.get()
            .uri("/repos/$owner/$repo/languages")
            .header("Authorization", "Bearer $accessToken")
            .retrieve()
            .body(object : ParameterizedTypeReference<Map<String, Long>>() {})
            ?: emptyMap()
```

- [ ] **Step 3: 컴파일 확인**

Run: `cd backend && ./gradlew compileKotlin --console=plain`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: 커밋**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/github/GithubApiClient.kt
git commit -m "GitHub README/언어비중 조회 API 추가"
```

---

### Task 3: PortfolioDraft 엔티티 + 레포지토리

**Files:**
- Create: `backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PortfolioDraft.kt`
- Create: `backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PortfolioDraftRepository.kt`

**Interfaces:**
- Produces: `PortfolioDraft(id, user, content, includedRepoIds, includedSections, updatedAt)`, `PortfolioDraftRepository.findByUser(user: User): PortfolioDraft?`

- [ ] **Step 1: 엔티티 작성**

`backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PortfolioDraft.kt`:

```kotlin
package com.jongheecode.portfolio.pdf

import com.jongheecode.portfolio.user.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.Lob
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "portfolio_drafts")
class PortfolioDraft(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    val user: User,

    @Lob
    @Column(nullable = false)
    var content: String,

    @Column(nullable = false)
    var includedRepoIds: String,

    @Column(nullable = false)
    var includedSections: String,

    @Column(nullable = false)
    var updatedAt: Instant = Instant.now(),
)
```

- [ ] **Step 2: 레포지토리 작성**

`backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PortfolioDraftRepository.kt`:

```kotlin
package com.jongheecode.portfolio.pdf

import com.jongheecode.portfolio.user.User
import org.springframework.data.jpa.repository.JpaRepository

interface PortfolioDraftRepository : JpaRepository<PortfolioDraft, Long> {
    fun findByUser(user: User): PortfolioDraft?
}
```

- [ ] **Step 3: 컴파일 확인**

Run: `cd backend && ./gradlew compileKotlin --console=plain`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: 커밋**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PortfolioDraft.kt backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PortfolioDraftRepository.kt
git commit -m "PortfolioDraft 엔티티 추가"
```

---

### Task 4: AnthropicClient에 포트폴리오 초안 생성 추가

**Files:**
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/blog/AnthropicClient.kt`

**Interfaces:**
- Consumes: `AnthropicClient`의 기존 `restClient`, `apiKey`, `extractApiErrorMessage` (그대로 재사용)
- Produces: `AnthropicClient.generatePortfolioDraft(sections: List<String>, repos: List<PortfolioRepoInput>): String`, `data class PortfolioRepoInput`

- [ ] **Step 1: PortfolioRepoInput 데이터 클래스 추가**

`AnthropicClient.kt` 상단 데이터 클래스들 옆에 추가:

```kotlin
data class PortfolioRepoInput(
    val fullName: String,
    val description: String?,
    val language: String?,
    val languages: Map<String, Long>,
    val readme: String?,
    val recentCommitMessages: List<String>,
)
```

- [ ] **Step 2: generatePortfolioDraft 메서드 추가**

`AnthropicClient` 클래스 안, `generatePost` 메서드 다음에 추가:

```kotlin
    fun generatePortfolioDraft(sections: List<String>, repos: List<PortfolioRepoInput>): String {
        val prompt = buildPortfolioPrompt(sections, repos)

        val response = try {
            restClient.post()
                .uri("/v1/messages")
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .contentType(MediaType.APPLICATION_JSON)
                .body(
                    mapOf(
                        "model" to "claude-sonnet-5",
                        "max_tokens" to 4000,
                        "messages" to listOf(mapOf("role" to "user", "content" to prompt)),
                    ),
                )
                .retrieve()
                .body(AnthropicMessageResponse::class.java)
        } catch (e: RestClientResponseException) {
            throw IllegalStateException("Anthropic API 호출 실패: ${extractApiErrorMessage(e)}")
        }
            ?: error("Anthropic API 응답이 비어 있습니다")

        return response.content.firstOrNull { it.type == "text" }?.text
            ?: error("Anthropic API 응답에 텍스트가 없습니다")
    }

    private fun buildPortfolioPrompt(sections: List<String>, repos: List<PortfolioRepoInput>): String {
        val sectionNames = mapOf(
            "intro" to "자기소개",
            "challenges" to "각 프로젝트의 어려웠던 점과 해결 과정",
            "strengths" to "강점/약점",
            "techstack" to "기술 스택 종합 요약",
        )
        val sectionInstructions = sections.mapNotNull { sectionNames[it] }
            .joinToString("\n") { "- $it 섹션 포함" }

        val repoBlocks = repos.joinToString("\n\n") { r ->
            val langSummary = r.languages.entries.sortedByDescending { it.value }
                .joinToString(", ") { "${it.key}(${it.value}bytes)" }
            val commits = r.recentCommitMessages.joinToString("\n") { "  - $it" }
            """
            ### ${r.fullName}
            설명: ${r.description ?: "없음"}
            주 언어: ${r.language ?: "알 수 없음"}
            언어 비중: ${langSummary.ifBlank { "정보 없음" }}
            README: ${r.readme?.let { "\n$it" } ?: "없음"}
            최근 커밋:
            $commits
            """.trimIndent()
        }

        return """
            아래 GitHub 프로젝트 정보를 바탕으로 개발자 개인 포트폴리오 문서를 한국어 마크다운으로 작성해줘.

            포함할 섹션:
            $sectionInstructions
            - 프로젝트별 카드: 한 줄 소개 + 주요 기능/역할 (각 프로젝트마다 ## 소제목으로 구분)

            요구사항:
            - 문서 최상단에 "# (이름 없이) 개발 포트폴리오" 같은 제목을 하나 넣어줘
            - "강점/약점" 섹션은 README/커밋만으로는 알 수 없는 성격 판단이니, 언어 다양성/커밋 패턴에서 조심스럽게 추측하는 톤으로 쓰고 "직접 검토가 필요하다"는 취지를 문서에 넣지 마(초안이니 자연스럽게 서술만)
            - 과장된 수식어 없이 담백하게, 실제 README/커밋 내용에 기반해서 작성 (근거 없는 내용 지어내지 마)
            - 응답은 마크다운 본문만 줘. 다른 설명이나 JSON 래핑 없이.

            프로젝트 정보:
            $repoBlocks
        """.trimIndent()
    }
```

- [ ] **Step 3: 컴파일 확인**

Run: `cd backend && ./gradlew compileKotlin --console=plain`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: 커밋**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/blog/AnthropicClient.kt
git commit -m "Anthropic 포트폴리오 초안 생성 프롬프트 추가"
```

---

### Task 5: PortfolioDraftController (조회/생성/수정)

**Files:**
- Create: `backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PortfolioDraftController.kt`

**Interfaces:**
- Consumes: `TrackedRepoRepository.findByUser`, `CommitRecordRepository.findByTrackedRepoOrderByCommittedAtDesc`, `GithubApiClient.fetchReadme/fetchLanguages`, `AnthropicClient.generatePortfolioDraft`, `PortfolioDraftRepository`
- Produces: `GET /api/portfolio-draft`, `POST /api/portfolio-draft/generate`, `PUT /api/portfolio-draft`, 응답 타입 `PortfolioDraftResponse`

- [ ] **Step 1: 컨트롤러 작성**

`backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PortfolioDraftController.kt`:

```kotlin
package com.jongheecode.portfolio.pdf

import com.jongheecode.portfolio.blog.AnthropicClient
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
import java.time.Instant

@RestController
@RequestMapping("/api/portfolio-draft")
@Transactional
class PortfolioDraftController(
    private val portfolioDraftRepository: PortfolioDraftRepository,
    private val trackedRepoRepository: TrackedRepoRepository,
    private val commitRecordRepository: CommitRecordRepository,
    private val githubApiClient: GithubApiClient,
    private val anthropicClient: AnthropicClient,
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

        val repoInputs = selectedRepos.map { repo ->
            val readme = githubApiClient.fetchReadme(user.accessToken, repo.owner, repo.name)?.take(4000)
            val languages = githubApiClient.fetchLanguages(user.accessToken, repo.owner, repo.name)
            val commits = commitRecordRepository.findByTrackedRepoOrderByCommittedAtDesc(repo)
                .take(15)
                .map { it.message.lineSequence().first() }
            PortfolioRepoInput(repo.fullName, repo.description, repo.language, languages, readme, commits)
        }

        val content = anthropicClient.generatePortfolioDraft(request.sections, repoInputs)
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
```

- [ ] **Step 2: 컴파일 확인**

Run: `cd backend && ./gradlew compileKotlin --console=plain`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: 커밋**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PortfolioDraftController.kt
git commit -m "포트폴리오 초안 조회/생성/수정 API 추가"
```

---

### Task 6: PDF를 마크다운 기반으로 교체 + 기존 스냅샷 코드 제거

**Files:**
- Modify: `backend/build.gradle.kts`
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PortfolioPdfService.kt`
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PdfController.kt`
- Delete: `backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PortfolioSnapshot.kt`
- Delete: `backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PortfolioSnapshotService.kt`

**Interfaces:**
- Consumes: `PortfolioDraftRepository.findByUser`
- Produces: `PortfolioPdfService.render(markdown: String): ByteArray`, `GET /api/portfolio-pdf` (기존 URL 유지, 내부 로직만 교체)

- [ ] **Step 1: commonmark 의존성 추가**

`backend/build.gradle.kts`의 `dependencies` 블록, `openhtmltopdf-pdfbox` 줄 다음에 추가:

```kotlin
	implementation("org.commonmark:commonmark:0.22.0")
```

- [ ] **Step 2: PortfolioPdfService를 마크다운 기반으로 재작성**

`backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PortfolioPdfService.kt` 전체를 다음으로 교체:

```kotlin
package com.jongheecode.portfolio.pdf

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder
import org.commonmark.parser.Parser
import org.commonmark.renderer.html.HtmlRenderer
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.io.ByteArrayOutputStream
import java.io.File

@Service
class PortfolioPdfService(
    // 로컬(Windows) 실행 전제 MVP: 한글 렌더링을 위해 OS에 설치된 맑은 고딕을 그대로 씀.
    // 다른 OS/서버에 배포할 때는 임베드 가능한 한글 폰트 파일을 리소스로 번들링해야 함.
    @Value("\${pdf.font-path:C:/Windows/Fonts/malgun.ttf}") private val fontPath: String,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val markdownParser = Parser.builder().build()
    private val htmlRenderer = HtmlRenderer.builder().build()

    fun render(markdown: String): ByteArray {
        val bodyHtml = htmlRenderer.render(markdownParser.parse(markdown))
        val html = wrapHtml(bodyHtml)

        val output = ByteArrayOutputStream()
        val builder = PdfRendererBuilder()
        builder.useFastMode()

        val fontFile = File(fontPath)
        if (fontFile.exists()) {
            builder.useFont(fontFile, "PortfolioFont")
        } else {
            log.warn("한글 폰트 파일을 찾을 수 없습니다 ($fontPath). PDF에서 한글이 깨질 수 있습니다.")
        }

        builder.withHtmlContent(html, null)
        builder.toStream(output)
        builder.run()
        return output.toByteArray()
    }

    private fun wrapHtml(bodyHtml: String): String = """
        <!DOCTYPE html>
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta charset="UTF-8"/>
          <style>
            @page { size: A4; margin: 40px; }
            body { font-family: 'PortfolioFont', sans-serif; color: #18181b; line-height: 1.6; }
            h1 { font-size: 26px; margin: 0 0 16px; }
            h2 { font-size: 18px; margin: 24px 0 8px; border-bottom: 1px solid #e4e4e7; padding-bottom: 6px; }
            h3 { font-size: 15px; margin: 16px 0 6px; }
            p { margin: 0 0 10px; font-size: 13px; }
            ul { margin: 0 0 10px; padding-left: 20px; }
            li { font-size: 13px; margin-bottom: 4px; }
            strong { font-weight: bold; }
            hr { border: none; border-top: 1px solid #e4e4e7; margin: 20px 0; }
          </style>
        </head>
        <body>
        $bodyHtml
        </body>
        </html>
    """.trimIndent()
}
```

- [ ] **Step 3: PdfController를 PortfolioDraft 기반으로 재작성**

`backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PdfController.kt` 전체를 다음으로 교체:

```kotlin
package com.jongheecode.portfolio.pdf

import com.jongheecode.portfolio.user.UserRepository
import com.jongheecode.portfolio.user.currentUser
import org.springframework.http.ContentDisposition
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/portfolio-pdf")
class PdfController(
    private val portfolioDraftRepository: PortfolioDraftRepository,
    private val portfolioPdfService: PortfolioPdfService,
    private val userRepository: UserRepository,
) {
    @GetMapping
    fun download(@AuthenticationPrincipal principal: OAuth2User): ResponseEntity<ByteArray> {
        val user = userRepository.currentUser(principal)
        val draft = portfolioDraftRepository.findByUser(user)
            ?: error("먼저 포트폴리오 초안을 생성해주세요")
        val pdfBytes = portfolioPdfService.render(draft.content)

        val headers = HttpHeaders()
        headers.contentType = MediaType.APPLICATION_PDF
        headers.contentDisposition = ContentDisposition.attachment().filename("portfolio.pdf").build()

        return ResponseEntity.ok().headers(headers).body(pdfBytes)
    }
}
```

- [ ] **Step 4: 안 쓰는 스냅샷 파일 삭제**

```bash
rm backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PortfolioSnapshot.kt
rm backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PortfolioSnapshotService.kt
```

- [ ] **Step 5: 컴파일 확인**

Run: `cd backend && ./gradlew compileKotlin --console=plain`
Expected: `BUILD SUCCESSFUL` (참조가 남아있으면 여기서 에러로 드러남)

- [ ] **Step 6: 커밋**

```bash
git add backend/build.gradle.kts backend/src/main/kotlin/com/jongheecode/portfolio/pdf/
git commit -m "PDF 생성을 마크다운 기반으로 교체, 스냅샷 나열 방식 제거"
```

---

### Task 7: 프론트 타입/API 클라이언트 갱신

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/client.ts`

**Interfaces:**
- Produces: `TrackedRepo.includeInPortfolio: boolean`, `PortfolioDraft` 타입, `api.setPortfolioInclusion`, `api.portfolioDraft`, `api.generatePortfolioDraft`, `api.updatePortfolioDraft`

- [ ] **Step 1: types.ts 수정**

`frontend/src/types.ts`의 `TrackedRepo` 인터페이스에 필드 추가:

```typescript
export interface TrackedRepo {
  id: number
  owner: string
  name: string
  fullName: string
  htmlUrl: string
  language: string | null
  description: string | null
  commitCount: number
  includeInPortfolio: boolean
  lastSyncedAt: string | null
}
```

`PortfolioSnapshot`/`PortfolioRepoSummary` 인터페이스는 삭제하고 그 자리에 추가:

```typescript
export interface PortfolioDraft {
  content: string
  includedRepoIds: number[]
  includedSections: string[]
  updatedAt: string | null
}

export type PortfolioSection = 'intro' | 'challenges' | 'strengths' | 'techstack'
```

- [ ] **Step 2: api/client.ts 수정**

`frontend/src/api/client.ts` 상단 import에서 `PortfolioSnapshot`을 `PortfolioDraft, PortfolioSection`으로 교체:

```typescript
import type {
  BlogPostDetail,
  BlogPostSummary,
  CommitRecord,
  GithubRepo,
  Me,
  PortfolioDraft,
  PortfolioSection,
  TrackedRepo,
} from '../types'
```

`trackRepo` 메서드 다음에 추가:

```typescript
  setPortfolioInclusion: (id: number, include: boolean) =>
    apiFetch<TrackedRepo>(`/api/tracked-repos/${id}/portfolio-selection`, {
      method: 'PUT',
      body: JSON.stringify({ include }),
    }),
```

`portfolioSummary`/`portfolioPdfUrl` 두 줄을 지우고 아래로 교체:

```typescript
  portfolioDraft: () => apiFetch<PortfolioDraft>('/api/portfolio-draft'),
  generatePortfolioDraft: (sections: PortfolioSection[]) =>
    apiFetch<PortfolioDraft>('/api/portfolio-draft/generate', {
      method: 'POST',
      body: JSON.stringify({ sections }),
    }),
  updatePortfolioDraft: (content: string) =>
    apiFetch<PortfolioDraft>('/api/portfolio-draft', {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
  portfolioPdfUrl: () => `${API_BASE_URL}/api/portfolio-pdf`,
```

- [ ] **Step 3: 타입체크**

Run: `cd frontend && npx tsc -b`
Expected: 에러 없음 (단, `PdfPage.tsx`가 아직 옛 타입을 쓰고 있어서 Task 10 전까지는 에러가 남을 수 있음 — Task 10에서 함께 해결)

- [ ] **Step 4: 커밋은 Task 10과 함께**

이 태스크는 Task 10과 같이 커밋한다(타입만 바꾸면 PdfPage.tsx가 당장 깨지므로 별도 커밋하지 않음).

---

### Task 8: 공용 MarkdownEditor 컴포넌트 분리

**Files:**
- Create: `frontend/src/components/MarkdownEditor.tsx`
- Modify: `frontend/src/pages/BlogPostDetailPage.tsx`

**Interfaces:**
- Produces: `MarkdownEditor({ value, onChange }: { value: string; onChange: (v: string) => void })`

- [ ] **Step 1: MarkdownEditor 작성**

`frontend/src/components/MarkdownEditor.tsx`:

```tsx
import { marked } from 'marked'
import { useState } from 'react'

function segStyle(active: boolean) {
  return {
    border: 'none',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 12.5,
    fontWeight: 500,
    cursor: 'pointer',
    background: active ? 'var(--panel)' : 'var(--panel2)',
    color: active ? 'var(--text)' : 'var(--muted)',
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.25)' : 'none',
  } as const
}

function MarkdownEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [showPreview, setShowPreview] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={() => setShowPreview(false)} style={segStyle(!showPreview)}>
          편집
        </button>
        <button type="button" onClick={() => setShowPreview(true)} style={segStyle(showPreview)}>
          미리보기
        </button>
      </div>

      {showPreview ? (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            background: 'var(--panel)',
            padding: '20px 24px',
            minHeight: 320,
            lineHeight: 1.7,
          }}
          // 이 앱은 1인 사용자 전용이라 본인이 생성/수정한 마크다운만 렌더링함 (외부 입력 없음)
          dangerouslySetInnerHTML={{ __html: marked.parse(value, { async: false }) }}
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '16px 18px',
            minHeight: 320,
            background: 'var(--panel)',
            color: 'var(--text)',
            fontFamily: "'Geist Mono', monospace",
            fontSize: 13.5,
            lineHeight: 1.6,
            resize: 'vertical',
          }}
        />
      )}
    </div>
  )
}

export default MarkdownEditor
```

- [ ] **Step 2: BlogPostDetailPage가 MarkdownEditor를 쓰도록 교체**

`frontend/src/pages/BlogPostDetailPage.tsx`에서 `import { marked } from 'marked'` 줄을 지우고 대신:

```typescript
import MarkdownEditor from '../components/MarkdownEditor'
```

`const [showPreview, setShowPreview] = useState(false)` 줄을 삭제한다.

아래 블록(편집/미리보기 토글 버튼 2개 + `showPreview ? (미리보기 div) : (textarea)` 전체)을:

```tsx
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={() => setShowPreview(false)} style={segStyle(!showPreview)}>
          편집
        </button>
        <button type="button" onClick={() => setShowPreview(true)} style={segStyle(showPreview)}>
          미리보기
        </button>
      </div>

      {showPreview ? (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            background: 'var(--panel)',
            padding: '20px 24px',
            minHeight: 320,
            lineHeight: 1.7,
          }}
          // 이 앱은 1인 사용자 전용이라 본인이 생성/수정한 마크다운만 렌더링함 (외부 입력 없음)
          dangerouslySetInnerHTML={{ __html: marked.parse(content, { async: false }) }}
        />
      ) : (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '16px 18px',
            minHeight: 320,
            background: 'var(--panel)',
            color: 'var(--text)',
            fontFamily: "'Geist Mono', monospace",
            fontSize: 13.5,
            lineHeight: 1.6,
            resize: 'vertical',
          }}
        />
      )}
```

다음 한 줄로 교체:

```tsx
      <MarkdownEditor value={content} onChange={setContent} />
```

파일 하단의 `function segStyle(active: boolean) { ... }` 함수 정의 전체를 삭제한다(더 이상 이 파일에서 쓰이지 않음 — `buttonStyle` 함수는 저장/발행/삭제 버튼에 계속 쓰이므로 그대로 둔다).

- [ ] **Step 3: 타입체크**

Run: `cd frontend && npx tsc -b`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/MarkdownEditor.tsx frontend/src/pages/BlogPostDetailPage.tsx
git commit -m "블로그/포트폴리오가 공유하는 MarkdownEditor 컴포넌트 분리"
```

---

### Task 9: AppDataContext에 포트폴리오 선택 토글 추가

**Files:**
- Modify: `frontend/src/contexts/AppDataContext.tsx`

**Interfaces:**
- Consumes: `api.setPortfolioInclusion`
- Produces: `AppDataContextValue.setPortfolioInclusion: (id: number, include: boolean) => Promise<void>`

- [ ] **Step 1: 컨텍스트 값/함수 추가**

`frontend/src/contexts/AppDataContext.tsx`의 `AppDataContextValue` 인터페이스에 추가:

```typescript
  setPortfolioInclusion: (id: number, include: boolean) => Promise<void>
```

`untrackRepo` 함수 다음에 함수 추가:

```typescript
  async function setPortfolioInclusion(id: number, include: boolean) {
    try {
      const updated = await api.setPortfolioInclusion(id, include)
      setTrackedRepos((prev) => prev.map((repo) => (repo.id === id ? updated : repo)))
    } catch (err) {
      setError((err as Error).message)
    }
  }
```

Provider의 `value={{ ... }}` 객체에 추가:

```typescript
        setPortfolioInclusion,
```

- [ ] **Step 2: 타입체크**

Run: `cd frontend && npx tsc -b`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/contexts/AppDataContext.tsx
git commit -m "AppDataContext에 포트폴리오 레포 선택 토글 추가"
```

---

### Task 10: PdfPage 재구성 (섹션/레포 체크박스 + 초안 생성/편집)

**Files:**
- Modify: `frontend/src/pages/PdfPage.tsx`

**Interfaces:**
- Consumes: `useAppData().trackedRepos`, `setPortfolioInclusion`, `api.portfolioDraft/generatePortfolioDraft/updatePortfolioDraft/portfolioPdfUrl`, `MarkdownEditor`

- [ ] **Step 1: PdfPage.tsx 전체 교체**

`frontend/src/pages/PdfPage.tsx` 전체를 다음으로 교체:

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAppData } from '../contexts/AppDataContext'
import MarkdownEditor from '../components/MarkdownEditor'
import { languageColor } from '../utils/languageColor'
import type { PortfolioDraft, PortfolioSection } from '../types'

const SECTIONS: { key: PortfolioSection; label: string; hint?: string }[] = [
  { key: 'intro', label: '자기소개' },
  { key: 'challenges', label: '어려웠던 점과 해결 과정' },
  { key: 'strengths', label: '강점/약점', hint: 'AI 추측이라 직접 검토가 특히 필요합니다' },
  { key: 'techstack', label: '기술 스택 종합 요약' },
]

function PdfPage() {
  const { trackedRepos, setPortfolioInclusion } = useAppData()
  const [sections, setSections] = useState<Set<PortfolioSection>>(new Set(['intro', 'techstack']))
  const [draft, setDraft] = useState<PortfolioDraft | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .portfolioDraft()
      .then((d) => {
        setDraft(d)
        setContent(d.content)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function toggleSection(key: PortfolioSection) {
    setSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const result = await api.generatePortfolioDraft(Array.from(sections))
      setDraft(result)
      setContent(result.content)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    try {
      const updated = await api.updatePortfolioDraft(content)
      setDraft(updated)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (loading) return <p>불러오는 중...</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>포트폴리오 PDF</h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
          넣을 프로젝트와 항목을 고르면 AI가 초안을 써주고, 수정한 뒤 PDF로 내려받습니다.
        </p>
      </div>

      {error && <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>{error}</p>}

      <div>
        <div style={{ fontSize: 12, color: 'var(--muted2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          포함할 항목
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {SECTIONS.map((s) => (
            <label
              key={s.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 13,
                cursor: 'pointer',
                background: sections.has(s.key) ? 'var(--accent-soft)' : 'var(--panel)',
              }}
            >
              <input type="checkbox" checked={sections.has(s.key)} onChange={() => toggleSection(s.key)} />
              {s.label}
              {s.hint && sections.has(s.key) && (
                <span style={{ fontSize: 11.5, color: 'var(--muted2)' }}>({s.hint})</span>
              )}
            </label>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: 'var(--muted2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          포함할 프로젝트
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 13, background: 'var(--panel)', overflow: 'hidden' }}>
          {trackedRepos.map((repo) => (
            <label
              key={repo.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={repo.includeInPortfolio}
                onChange={(e) => setPortfolioInclusion(repo.id, e.target.checked)}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{repo.fullName}</div>
                {repo.description && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>{repo.description}</div>}
              </div>
              {repo.language && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)', flexShrink: 0 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: languageColor(repo.language) }} />
                  {repo.language}
                </span>
              )}
            </label>
          ))}
          {trackedRepos.length === 0 && (
            <p style={{ padding: '20px 18px', fontSize: 13.5, color: 'var(--muted)' }}>추적 중인 레포가 없습니다.</p>
          )}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 16px',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: generating ? 'default' : 'pointer',
            opacity: generating ? 0.6 : 1,
          }}
        >
          {generating ? '초안 작성 중...' : draft?.content ? 'AI로 다시 생성' : 'AI로 초안 생성'}
        </button>
      </div>

      {draft?.content && (
        <>
          <div style={{ fontSize: 12, color: 'var(--muted2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            포트폴리오 편집
          </div>
          <MarkdownEditor value={content} onChange={setContent} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={handleSave}
              style={{
                background: 'var(--panel2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '9px 16px',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              저장
            </button>
            <a
              href={api.portfolioPdfUrl()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '9px 16px',
                fontSize: 13.5,
                fontWeight: 600,
              }}
            >
              PDF 생성
            </a>
          </div>
        </>
      )}
    </div>
  )
}

export default PdfPage
```

- [ ] **Step 2: 타입체크**

Run: `cd frontend && npx tsc -b`
Expected: 에러 없음

- [ ] **Step 3: 커밋** (Task 7의 타입/클라이언트 변경도 함께)

```bash
git add frontend/src/types.ts frontend/src/api/client.ts frontend/src/pages/PdfPage.tsx
git commit -m "포트폴리오 PDF 페이지를 레포/섹션 선택 + AI 초안 편집 흐름으로 재구성"
```

---

### Task 11: 전체 빌드 확인 + 브라우저 스모크 테스트 + 최종 커밋/푸시

**Files:** 없음(검증 전용)

- [ ] **Step 1: 백엔드 전체 빌드**

Run: `cd backend && ./gradlew build --console=plain` (Postgres 컨테이너 `docker compose up -d`로 떠 있어야 함)
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 2: 프론트 전체 빌드**

Run: `cd frontend && npm run build` 후 `dist/` 삭제
Expected: 에러 없이 빌드 완료

- [ ] **Step 3: 로컬 서버 기동**

`backend/.env.local`을 source해서 `./gradlew bootRun`, 별도로 `npm run dev`. 이전 세션에서 남은 8080/5173 프로세스가 있으면 먼저 종료.

- [ ] **Step 4: 브라우저로 실제 흐름 확인**

`/pdf` 페이지에서: 레포 1~2개 체크 → 섹션 체크(자기소개, 기술스택 정도) → "AI로 초안 생성" → 에디터에 마크다운 나오는지 확인 → 편집 → 저장 → "PDF 생성" 눌러서 다운로드된 PDF 내용 확인(한글 렌더링 포함).

Anthropic 크레딧이 아직 없다면 이 단계에서 에러 메시지가 화면에 명확히 뜨는지만 확인하고, 크레딧이 채워진 뒤 다시 확인.

- [ ] **Step 5: 서버 정리**

브라우저 테스트 후 `bootRun`/`npm run dev` 프로세스 종료 (포트 8080/5173 확인).

- [ ] **Step 6: 최종 푸시**

```bash
git push
```
