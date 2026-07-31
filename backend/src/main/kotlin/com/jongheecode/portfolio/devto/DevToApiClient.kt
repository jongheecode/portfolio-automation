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

    fun fetchUsername(apiKey: String): String {
        val response = callDevTo {
            restClient.get()
                .uri("/api/users/me")
                .header("api-key", apiKey)
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
