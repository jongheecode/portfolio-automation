package com.jongheecode.portfolio.commit

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.web.client.HttpClientErrorException
import java.nio.charset.StandardCharsets

class CommitMetaTest {
    @Test
    fun `부모 2개면 머지 커밋이다`() {
        assertTrue(CommitMeta.isMerge(listOf("a", "b")))
        assertFalse(CommitMeta.isMerge(listOf("a")))
    }

    @Test
    fun `봇 로그인을 가려낸다`() {
        assertTrue(CommitMeta.isBot("dependabot[bot]"))
        assertTrue(CommitMeta.isBot("github-actions[bot]"))
        assertTrue(CommitMeta.isBot("renovate-bot"))
        assertFalse(CommitMeta.isBot("jongheecode"))
        assertFalse(CommitMeta.isBot(null))
    }
}

class GithubSyncErrorTest {
    @Test
    fun `401은 토큰 만료다`() {
        assertEquals("token_expired", GithubSyncError.code(http(HttpStatus.UNAUTHORIZED)))
    }

    @Test
    fun `남은 할당 0이면 rate limit이다`() {
        val headers = HttpHeaders()
        headers.add("X-RateLimit-Remaining", "0")
        assertEquals("rate_limited", GithubSyncError.code(http(HttpStatus.FORBIDDEN, headers)))
    }

    @Test
    fun `그 외 403은 접근 없음이다`() {
        assertEquals("no_access", GithubSyncError.code(http(HttpStatus.FORBIDDEN)))
    }

    private fun http(status: HttpStatus, headers: HttpHeaders = HttpHeaders()) =
        HttpClientErrorException.create(status, status.reasonPhrase, headers, ByteArray(0), StandardCharsets.UTF_8)
}

class PlanCommitLinkTest {
    @Test
    fun `같은 날 제목 키워드가 메시지에 있으면 연결한다`() {
        assertEquals(
            2,
            PlanCommitLink.count("상점 필터", listOf("feat: 상점 탭 필터", "fix: 상점 결제", "docs: readme")),
        )
        assertEquals(0, PlanCommitLink.count("리뷰", listOf("feat: shop")))
        assertEquals(
            3,
            PlanCommitLink.uniqueCount(
                "상점 필터",
                listOf(1L to "feat: 상점 탭 필터", 2L to "fix: 상점 결제", 3L to "docs: readme"),
                setOf(3L),
            ),
        )
    }
}
