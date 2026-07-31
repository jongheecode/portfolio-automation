package com.jongheecode.portfolio.devto

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientResponseException

@Component
class DevToApiClient(
    restClientBuilder: RestClient.Builder,
    private val objectMapper: ObjectMapper,
) {
    private val restClient = restClientBuilder.baseUrl("https://dev.to").build()

    companion object {
        // dev.to가 Java 기본 User-Agent(Java/x.x.x)를 봇으로 판단해 403으로 차단하는 문제 회피용.
        private const val USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    }

    fun fetchUsername(apiKey: String): String {
        val response = callDevTo {
            restClient.get()
                // dev.to CDN이 이 엔드포인트의 401 응답을 api-key 헤더와 무관하게 URL 기준으로 캐싱하는
                // 문제가 있어(Vary: api-key 없음), 매 요청마다 다른 쿼리 파라미터로 캐시를 우회한다.
                .uri("/api/users/me?_={cacheBust}", System.nanoTime())
                .header("api-key", apiKey)
                .header("User-Agent", USER_AGENT)
                .retrieve()
                .body(String::class.java)
        }
        val username = objectMapper.readTree(response).get("username")?.asText()
        return username?.takeIf { it.isNotBlank() } ?: error("dev.to 응답에서 username을 찾을 수 없습니다")
    }

    fun publishArticle(apiKey: String, title: String, markdownContent: String): String {
        val body = mapOf(
            "article" to mapOf(
                "title" to title,
                "body_markdown" to markdownContent,
                "published" to true,
            ),
        )
        val response = callDevTo {
            restClient.post()
                .uri("/api/articles")
                .header("api-key", apiKey)
                .header("User-Agent", USER_AGENT)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String::class.java)
        }
        val url = objectMapper.readTree(response).get("url")?.asText()
        return url?.takeIf { it.isNotBlank() } ?: error("dev.to 응답에 글 URL이 없습니다: $response")
    }

    private fun callDevTo(block: () -> String?): String =
        try {
            block() ?: error("dev.to API 응답이 비어 있습니다")
        } catch (e: RestClientResponseException) {
            throw IllegalStateException("dev.to API 호출 실패: ${extractApiErrorMessage(e)}")
        }

    private fun extractApiErrorMessage(e: RestClientResponseException): String =
        runCatching { objectMapper.readTree(e.responseBodyAsString).get("error")?.asText() }
            .getOrNull()
            ?.takeIf { it.isNotBlank() }
            ?: e.message
            ?: "알 수 없는 오류"
}
