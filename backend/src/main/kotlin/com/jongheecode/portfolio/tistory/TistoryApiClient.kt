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
