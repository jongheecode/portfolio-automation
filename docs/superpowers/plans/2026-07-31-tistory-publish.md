# 티스토리 실제 발행 연동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 블로그 초안을 실제 Tistory 블로그에 발행할 수 있게 OAuth 연동과 발행 API 호출을 추가한다.

**Architecture:** Tistory OAuth로 access_token+블로그명을 받아 User에 저장하고, 블로그 글 편집 화면에서 마크다운을 HTML로 변환해 Tistory Open API로 전송한다. PDF에서 쓰던 commonmark 렌더링을 `MarkdownRenderer` 컴포넌트로 뽑아 재사용한다.

**Tech Stack:** 기존 Kotlin/Spring Boot 백엔드, React/TypeScript 프론트, commonmark(이미 의존성 있음), Tistory Open API(OAuth2 + REST).

## Global Constraints

- 이 프로젝트는 단위테스트가 없다. 각 태스크의 "테스트" 단계는 컴파일 확인(`./gradlew compileKotlin`, `npx tsc -b`)으로 대체하고, 마지막 태스크에서 브라우저로 실제 흐름을 확인한다.
- Tistory 앱 등록(App ID/Secret Key 발급)은 사용자가 직접 tistory.com/guide/api에서 로그인해서 해야 하는 작업이다 — 이 계획의 코드 구현은 그 자격증명 없이도 컴파일/빌드까지 전부 끝낼 수 있고, 실제 연동 테스트만 자격증명이 필요하다.
- 새 API는 기존 패턴대로 `@AuthenticationPrincipal OAuth2User` + `userRepository.currentUser(principal)`로 사용자를 구한다.
- 커밋 메시지는 한국어, 짧은 설명 스타일.

---

### Task 1: MarkdownRenderer 공용 컴포넌트로 분리

**Files:**
- Create: `backend/src/main/kotlin/com/jongheecode/portfolio/markdown/MarkdownRenderer.kt`
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PortfolioPdfService.kt`

**Interfaces:**
- Produces: `MarkdownRenderer.toHtml(markdown: String): String`

- [ ] **Step 1: MarkdownRenderer 작성**

`backend/src/main/kotlin/com/jongheecode/portfolio/markdown/MarkdownRenderer.kt`:

```kotlin
package com.jongheecode.portfolio.markdown

import org.commonmark.parser.Parser
import org.commonmark.renderer.html.HtmlRenderer
import org.springframework.stereotype.Component

@Component
class MarkdownRenderer {
    private val parser = Parser.builder().build()
    private val renderer = HtmlRenderer.builder().build()

    fun toHtml(markdown: String): String = renderer.render(parser.parse(markdown))
}
```

- [ ] **Step 2: PortfolioPdfService가 MarkdownRenderer를 쓰도록 수정**

`backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PortfolioPdfService.kt`에서 import 정리:

```kotlin
import com.jongheecode.portfolio.markdown.MarkdownRenderer
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.io.ByteArrayOutputStream
import java.io.File
```

(`org.commonmark.parser.Parser`, `org.commonmark.renderer.html.HtmlRenderer` import 두 줄은 삭제)

클래스 선언과 필드를 교체:

```kotlin
@Service
class PortfolioPdfService(
    private val markdownRenderer: MarkdownRenderer,
    // 로컬(Windows) 실행 전제 MVP: 한글 렌더링을 위해 OS에 설치된 맑은 고딕을 그대로 씀.
    // 다른 OS/서버에 배포할 때는 임베드 가능한 한글 폰트 파일을 리소스로 번들링해야 함.
    @Value("\${pdf.font-path:C:/Windows/Fonts/malgun.ttf}") private val fontPath: String,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun render(markdown: String): ByteArray {
        val bodyHtml = markdownRenderer.toHtml(markdown)
        val html = wrapHtml(bodyHtml)
```

(`markdownParser`/`htmlRenderer` 필드 선언과 `htmlRenderer.render(markdownParser.parse(markdown))` 줄은 삭제 — 위 `toHtml` 호출로 대체)

- [ ] **Step 3: 컴파일 확인**

Run: `cd backend && ./gradlew compileKotlin --console=plain`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: 커밋**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/markdown/ backend/src/main/kotlin/com/jongheecode/portfolio/pdf/PortfolioPdfService.kt
git commit -m "마크다운 렌더링을 MarkdownRenderer 공용 컴포넌트로 분리"
```

---

### Task 2: User/BlogPost 엔티티에 Tistory 필드 추가

**Files:**
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/user/User.kt`
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/blog/BlogPost.kt`
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/user/MeController.kt`

**Interfaces:**
- Produces: `User.tistoryAccessToken: String?`, `User.tistoryBlogName: String?`, `BlogPost.tistoryUrl: String?`, `MeResponse.tistoryConnected: Boolean`, `MeResponse.tistoryBlogName: String?`

- [ ] **Step 1: User에 필드 추가**

`backend/src/main/kotlin/com/jongheecode/portfolio/user/User.kt`에서 `accessToken` 필드 다음에 추가:

```kotlin
    var tistoryAccessToken: String? = null,

    var tistoryBlogName: String? = null,
```

- [ ] **Step 2: BlogPost에 필드 추가**

`backend/src/main/kotlin/com/jongheecode/portfolio/blog/BlogPost.kt`에서 `published` 필드 다음에 추가:

```kotlin
    var tistoryUrl: String? = null,
```

- [ ] **Step 3: MeController 응답에 연결 상태 추가**

`backend/src/main/kotlin/com/jongheecode/portfolio/user/MeController.kt` 전체를 다음으로 교체:

```kotlin
package com.jongheecode.portfolio.user

import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/me")
class MeController(
    private val userRepository: UserRepository,
) {
    @GetMapping
    fun me(@AuthenticationPrincipal principal: OAuth2User?): ResponseEntity<MeResponse> {
        if (principal == null) return ResponseEntity.status(401).build()
        val githubId = (principal.attributes["id"] as Number).toLong()
        val user = userRepository.findByGithubId(githubId) ?: return ResponseEntity.status(401).build()
        return ResponseEntity.ok(
            MeResponse(user.username, user.avatarUrl, user.tistoryAccessToken != null, user.tistoryBlogName),
        )
    }
}

data class MeResponse(
    val username: String,
    val avatarUrl: String?,
    val tistoryConnected: Boolean,
    val tistoryBlogName: String?,
)
```

- [ ] **Step 4: 컴파일 확인**

Run: `cd backend && ./gradlew compileKotlin --console=plain`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: 커밋**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/user/User.kt backend/src/main/kotlin/com/jongheecode/portfolio/blog/BlogPost.kt backend/src/main/kotlin/com/jongheecode/portfolio/user/MeController.kt
git commit -m "User/BlogPost에 티스토리 연동 필드 추가"
```

---

### Task 3: TistoryApiClient

**Files:**
- Create: `backend/src/main/kotlin/com/jongheecode/portfolio/tistory/TistoryApiClient.kt`

**Interfaces:**
- Produces: `TistoryApiClient.fetchAccessToken(code: String, redirectUri: String): String`, `TistoryApiClient.fetchBlogName(accessToken: String): String`, `TistoryApiClient.publishPost(accessToken: String, blogName: String, title: String, htmlContent: String): String`

- [ ] **Step 1: 작성**

`backend/src/main/kotlin/com/jongheecode/portfolio/tistory/TistoryApiClient.kt`:

```kotlin
package com.jongheecode.portfolio.tistory

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientResponseException

@Component
class TistoryApiClient(
    restClientBuilder: RestClient.Builder,
    private val objectMapper: ObjectMapper,
    @Value("\${tistory.client-id}") private val clientId: String,
    @Value("\${tistory.client-secret}") private val clientSecret: String,
) {
    private val restClient = restClientBuilder.baseUrl("https://www.tistory.com").build()

    fun fetchAccessToken(code: String, redirectUri: String): String {
        val response = callTistory {
            restClient.get()
                .uri { builder ->
                    builder.path("/oauth/access_token")
                        .queryParam("client_id", clientId)
                        .queryParam("client_secret", clientSecret)
                        .queryParam("redirect_uri", redirectUri)
                        .queryParam("code", code)
                        .queryParam("grant_type", "authorization_code")
                        .build()
                }
                .retrieve()
                .body(String::class.java)
        }
        // 이 엔드포인트는 JSON이 아니라 "access_token=xxxx" 평문으로 응답함.
        val token = response.substringAfter("access_token=", "").substringBefore("&").trim()
        return token.ifBlank { error("티스토리 토큰 발급 실패: $response") }
    }

    fun fetchBlogName(accessToken: String): String {
        val response = callTistory {
            restClient.get()
                .uri { builder ->
                    builder.path("/apis/blog/info")
                        .queryParam("access_token", accessToken)
                        .queryParam("output", "json")
                        .build()
                }
                .retrieve()
                .body(String::class.java)
        }
        val blogs = objectMapper.readTree(response).at("/tistory/item/blogs")
        val firstBlog = blogs.firstOrNull() ?: error("연결된 티스토리 블로그가 없습니다")
        val name = firstBlog.get("name")?.asText()
        return name?.takeIf { it.isNotBlank() } ?: error("티스토리 블로그 이름을 찾을 수 없습니다")
    }

    fun publishPost(accessToken: String, blogName: String, title: String, htmlContent: String): String {
        val body = LinkedMultiValueMap<String, String>().apply {
            add("access_token", accessToken)
            add("output", "json")
            add("blogName", blogName)
            add("title", title)
            add("content", htmlContent)
            add("visibility", "3")
        }
        val response = callTistory {
            restClient.post()
                .uri("/apis/post/write")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(body)
                .retrieve()
                .body(String::class.java)
        }
        val node = objectMapper.readTree(response).at("/tistory")
        val status = node.get("status")?.asText()
        check(status == "200") {
            "티스토리 발행 실패: ${node.get("error_message")?.asText() ?: response}"
        }
        val url = node.get("url")?.asText()
        return url?.takeIf { it.isNotBlank() } ?: error("티스토리 응답에 글 URL이 없습니다: $response")
    }

    private fun callTistory(block: () -> String?): String =
        try {
            block() ?: error("티스토리 API 응답이 비어 있습니다")
        } catch (e: RestClientResponseException) {
            throw IllegalStateException("티스토리 API 호출 실패: ${e.message}")
        }
}
```

- [ ] **Step 2: 컴파일 확인**

Run: `cd backend && ./gradlew compileKotlin --console=plain`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: 커밋**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/tistory/TistoryApiClient.kt
git commit -m "TistoryApiClient 추가 (OAuth 토큰 교환, 블로그 조회, 글 발행)"
```

---

### Task 4: TistoryController (OAuth 연결/해제) + application.yml 설정

**Files:**
- Create: `backend/src/main/kotlin/com/jongheecode/portfolio/tistory/TistoryController.kt`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/config/SecurityConfig.kt`

**Interfaces:**
- Consumes: `TistoryApiClient`, `UserRepository`
- Produces: `GET /api/tistory/authorize-url`, `GET /api/tistory/callback`, `DELETE /api/tistory/connection`

- [ ] **Step 1: application.yml에 설정 추가**

`backend/src/main/resources/application.yml`의 `gemini:` 블록 다음에 추가:

```yaml
tistory:
  client-id: ${TISTORY_CLIENT_ID:}
  client-secret: ${TISTORY_CLIENT_SECRET:}

backend:
  url: ${BACKEND_URL:http://localhost:8080}
```

- [ ] **Step 2: TistoryController 작성**

`backend/src/main/kotlin/com/jongheecode/portfolio/tistory/TistoryController.kt`:

```kotlin
package com.jongheecode.portfolio.tistory

import com.jongheecode.portfolio.user.UserRepository
import com.jongheecode.portfolio.user.currentUser
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.servlet.view.RedirectView
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

@RestController
@RequestMapping("/api/tistory")
@Transactional
class TistoryController(
    private val tistoryApiClient: TistoryApiClient,
    private val userRepository: UserRepository,
    @Value("\${tistory.client-id}") private val clientId: String,
    @Value("\${backend.url}") private val backendUrl: String,
    @Value("\${app.frontend-url}") private val frontendUrl: String,
) {
    private fun redirectUri() = "$backendUrl/api/tistory/callback"

    @GetMapping("/authorize-url")
    fun authorizeUrl(): Map<String, String> {
        val encodedRedirect = URLEncoder.encode(redirectUri(), StandardCharsets.UTF_8)
        val url = "https://www.tistory.com/oauth/authorize" +
            "?client_id=$clientId&redirect_uri=$encodedRedirect&response_type=code"
        return mapOf("url" to url)
    }

    @GetMapping("/callback")
    fun callback(@AuthenticationPrincipal principal: OAuth2User, @RequestParam code: String): RedirectView {
        val user = userRepository.currentUser(principal)
        val accessToken = tistoryApiClient.fetchAccessToken(code, redirectUri())
        val blogName = tistoryApiClient.fetchBlogName(accessToken)
        user.tistoryAccessToken = accessToken
        user.tistoryBlogName = blogName
        userRepository.save(user)
        return RedirectView("$frontendUrl/settings?tistory=connected")
    }

    @DeleteMapping("/connection")
    fun disconnect(@AuthenticationPrincipal principal: OAuth2User) {
        val user = userRepository.currentUser(principal)
        user.tistoryAccessToken = null
        user.tistoryBlogName = null
        userRepository.save(user)
    }
}
```

- [ ] **Step 3: SecurityConfig 확인** (수정 불필요, 확인만)

`SecurityConfig.kt`의 `authorizeHttpRequests`는 `/api/me`만 `permitAll`이고 나머지는 `anyRequest().authenticated()`이므로 `/api/tistory/*`는 자동으로 인증이 필요하다 — 별도 수정 불필요. 이 스텝은 코드 변경 없이 그냥 확인만 하고 넘어간다.

- [ ] **Step 4: 컴파일 확인**

Run: `cd backend && ./gradlew compileKotlin --console=plain`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: 커밋**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/tistory/TistoryController.kt backend/src/main/resources/application.yml
git commit -m "티스토리 OAuth 연결/해제 API 추가"
```

---

### Task 5: BlogPostController에 발행 API 추가

**Files:**
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/blog/BlogPostController.kt`

**Interfaces:**
- Consumes: `TistoryApiClient.publishPost`, `MarkdownRenderer.toHtml`
- Produces: `POST /api/blog-posts/{id}/publish-to-tistory`, `BlogPostDetail.tistoryUrl: String?`

- [ ] **Step 1: 생성자에 의존성 추가**

`backend/src/main/kotlin/com/jongheecode/portfolio/blog/BlogPostController.kt` 상단 import에 추가:

```kotlin
import com.jongheecode.portfolio.markdown.MarkdownRenderer
import com.jongheecode.portfolio.tistory.TistoryApiClient
```

`BlogPostController` 생성자에 추가:

```kotlin
    private val tistoryApiClient: TistoryApiClient,
    private val markdownRenderer: MarkdownRenderer,
```

- [ ] **Step 2: 발행 엔드포인트 추가**

`publish` 메서드(발행 상태 토글) 다음에 추가:

```kotlin
    @PostMapping("/{id}/publish-to-tistory")
    fun publishToTistory(@AuthenticationPrincipal principal: OAuth2User, @PathVariable id: Long): BlogPostDetail {
        val user = userRepository.currentUser(principal)
        val post = blogPostRepository.findByIdAndUser(id, user) ?: error("포스트를 찾을 수 없습니다: $id")
        check(user.tistoryAccessToken != null && user.tistoryBlogName != null) {
            "먼저 설정에서 티스토리를 연결해주세요"
        }
        check(post.tistoryUrl == null) { "이미 티스토리에 올린 글입니다" }

        val html = markdownRenderer.toHtml(post.content)
        val url = tistoryApiClient.publishPost(user.tistoryAccessToken!!, user.tistoryBlogName!!, post.title, html)
        post.tistoryUrl = url
        val saved = blogPostRepository.save(post)
        return saved.toDetail(commitRecordRepository.findByBlogPostOrderByCommittedAtAsc(saved))
    }
```

- [ ] **Step 3: BlogPostDetail에 tistoryUrl 추가**

`BlogPostDetail` data class를 다음으로 교체:

```kotlin
data class BlogPostDetail(
    val id: Long,
    val title: String,
    val content: String,
    val published: Boolean,
    val tistoryUrl: String?,
    val createdAt: Instant,
    val commits: List<BlogCommitRef>,
)
```

`toDetail` 확장 함수를 다음으로 교체:

```kotlin
private fun BlogPost.toDetail(commits: List<CommitRecord>) = BlogPostDetail(
    id,
    title,
    content,
    published,
    tistoryUrl,
    createdAt,
    commits.map { BlogCommitRef(it.trackedRepo.fullName, it.firstLine(), it.sha, it.htmlUrl) },
)
```

- [ ] **Step 4: 컴파일 확인**

Run: `cd backend && ./gradlew compileKotlin --console=plain`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: 커밋**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/blog/BlogPostController.kt
git commit -m "블로그 포스트를 티스토리로 발행하는 API 추가"
```

---

### Task 6: 프론트 타입/API 클라이언트 갱신

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/client.ts`

**Interfaces:**
- Produces: `Me.tistoryConnected`, `Me.tistoryBlogName`, `BlogPostDetail.tistoryUrl`, `api.tistoryAuthorizeUrl`, `api.disconnectTistory`, `api.publishToTistory`

- [ ] **Step 1: types.ts 수정**

`frontend/src/types.ts`의 `Me` 인터페이스를 다음으로 교체:

```typescript
export interface Me {
  username: string
  avatarUrl: string | null
  tistoryConnected: boolean
  tistoryBlogName: string | null
}
```

`BlogPostDetail` 인터페이스를 다음으로 교체:

```typescript
export interface BlogPostDetail {
  id: number
  title: string
  content: string
  published: boolean
  tistoryUrl: string | null
  createdAt: string
  commits: BlogCommitRef[]
}
```

- [ ] **Step 2: api/client.ts 수정**

`frontend/src/api/client.ts`의 `deleteBlogPost` 줄 다음에 추가:

```typescript
  tistoryAuthorizeUrl: () => apiFetch<{ url: string }>('/api/tistory/authorize-url'),
  disconnectTistory: () => apiFetch<void>('/api/tistory/connection', { method: 'DELETE' }),
  publishToTistory: (id: number) =>
    apiFetch<BlogPostDetail>(`/api/blog-posts/${id}/publish-to-tistory`, { method: 'POST' }),
```

- [ ] **Step 3: 타입체크**

Run: `cd frontend && npx tsc -b`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/types.ts frontend/src/api/client.ts
git commit -m "프론트 티스토리 타입/API 클라이언트 추가"
```

---

### Task 7: SettingsPage에 티스토리 연동 섹션 추가

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`

**Interfaces:**
- Consumes: `useAppData().me`, `api.tistoryAuthorizeUrl`, `api.disconnectTistory`

- [ ] **Step 1: 전체 교체**

`frontend/src/pages/SettingsPage.tsx` 전체를 다음으로 교체:

```tsx
import { useState } from 'react'
import { api } from '../api/client'
import { useAppData } from '../contexts/AppDataContext'
import { useTheme } from '../contexts/ThemeContext'

function SettingsPage() {
  const { me } = useAppData()
  const { themeLabel, toggleTheme } = useTheme()
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConnectTistory() {
    setConnecting(true)
    try {
      const { url } = await api.tistoryAuthorizeUrl()
      window.location.href = url
    } catch (err) {
      setError((err as Error).message)
      setConnecting(false)
    }
  }

  async function handleDisconnectTistory() {
    try {
      await api.disconnectTistory()
      window.location.reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 640 }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>설정</h1>

      {error && <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>{error}</p>}

      <div style={{ border: '1px solid var(--border)', borderRadius: 13, background: 'var(--panel)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>GitHub 연동</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>@{me?.username} 계정으로 연결됨</div>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--green)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} />
            연결됨
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>티스토리 연동</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
              {me?.tistoryConnected ? `${me.tistoryBlogName}.tistory.com에 발행` : '연결하면 블로그 글을 실제로 발행할 수 있어요'}
            </div>
          </div>
          {me?.tistoryConnected ? (
            <button
              type="button"
              onClick={handleDisconnectTistory}
              style={{ fontSize: 13, color: 'var(--muted)', background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer' }}
            >
              연결 해제
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnectTistory}
              disabled={connecting}
              style={{
                fontSize: 13,
                color: '#fff',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 7,
                padding: '5px 12px',
                cursor: connecting ? 'default' : 'pointer',
                opacity: connecting ? 0.6 : 1,
              }}
            >
              {connecting ? '이동 중...' : '연결하기'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>커밋 동기화</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
              레포 상세 페이지의 "지금 동기화" 버튼으로 수동으로 가져옵니다
            </div>
          </div>
          <span style={{ fontSize: 13, color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px' }}>
            수동
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>테마</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>밝기 모드를 전환합니다</div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            style={{
              fontSize: 13,
              color: 'var(--text)',
              background: 'var(--panel2)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              padding: '5px 12px',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            {themeLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
```

- [ ] **Step 2: 타입체크**

Run: `cd frontend && npx tsc -b`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/SettingsPage.tsx
git commit -m "설정 페이지에 티스토리 연동 섹션 추가"
```

---

### Task 8: BlogPostDetailPage에 "티스토리에 올리기" 버튼 추가

**Files:**
- Modify: `frontend/src/pages/BlogPostDetailPage.tsx`

**Interfaces:**
- Consumes: `useAppData().me`, `api.publishToTistory`

- [ ] **Step 1: me 가져오기 + 발행 핸들러 추가**

`frontend/src/pages/BlogPostDetailPage.tsx`에서 import에 추가:

```typescript
import { useAppData } from '../contexts/AppDataContext'
```

컴포넌트 함수 안, `const [error, setError] = useState<string | null>(null)` 다음 줄에 추가:

```typescript
  const { me } = useAppData()
  const [publishingToTistory, setPublishingToTistory] = useState(false)
```

`handleDelete` 함수 다음에 추가:

```typescript
  async function handlePublishToTistory() {
    setPublishingToTistory(true)
    try {
      const updated = await api.publishToTistory(postId)
      setPost(updated)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPublishingToTistory(false)
    }
  }
```

- [ ] **Step 2: 버튼 영역에 티스토리 버튼/링크 추가**

저장/발행/삭제 버튼이 있는 `<div style={{ display: 'flex', gap: 10 }}>...</div>` 블록(삭제 버튼 바로 다음, `</div>`로 닫히는 지점) 안에, `삭제` 버튼 다음에 추가:

```tsx
        {post.tistoryUrl ? (
          <a
            href={post.tistoryUrl}
            target="_blank"
            rel="noreferrer"
            style={{ ...buttonStyle('secondary'), display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
          >
            티스토리에서 보기
          </a>
        ) : (
          me?.tistoryConnected && (
            <button
              type="button"
              onClick={handlePublishToTistory}
              disabled={publishingToTistory}
              style={buttonStyle('primary')}
            >
              {publishingToTistory ? '올리는 중...' : '티스토리에 올리기'}
            </button>
          )
        )}
```

- [ ] **Step 3: 타입체크**

Run: `cd frontend && npx tsc -b`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/pages/BlogPostDetailPage.tsx
git commit -m "블로그 편집 화면에 티스토리 발행 버튼 추가"
```

---

### Task 9: 전체 빌드 확인 + 자격증명 안내 + 실사용 테스트 + 푸시

**Files:** 없음(검증 전용)

- [ ] **Step 1: 백엔드 전체 빌드**

Run: `cd backend && ./gradlew build --console=plain` (Postgres `docker compose up -d`로 떠 있어야 함)
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 2: 프론트 전체 빌드**

Run: `cd frontend && npm run build` 후 `dist/` 삭제
Expected: 에러 없이 빌드 완료

- [ ] **Step 3: 사용자에게 Tistory 앱 등록 요청** (여기서부터는 사용자 작업 필요)

다음을 사용자에게 안내하고 기다린다:
1. https://www.tistory.com/guide/api 에서 로그인 후 앱 등록
2. 서비스 URL: `http://localhost:5173`, CallBack: `http://localhost:8080/api/tistory/callback` (Tistory가 localhost를 거부하면 여기서 리스크가 현실화된 것 — 사용자와 함께 ngrok 등 대안 논의)
3. 발급받은 App ID/Secret Key를 `backend/.env.local`에 `TISTORY_CLIENT_ID`, `TISTORY_CLIENT_SECRET`로 추가(기존 GEMINI_API_KEY와 같은 방식, 값은 읽지 않고 source만 함)

- [ ] **Step 4: 브라우저로 실제 흐름 확인**

로그인 → 설정 페이지에서 "연결하기" → Tistory 로그인/승인 → 설정 페이지로 돌아와 연결됨 확인 → 블로그 글 편집 화면에서 "티스토리에 올리기" → 실제 Tistory 블로그에 글이 올라갔는지 확인.

- [ ] **Step 5: 서버 정리 + 최종 푸시**

`bootRun`/`npm run dev` 프로세스 종료 후:

```bash
git push
```
