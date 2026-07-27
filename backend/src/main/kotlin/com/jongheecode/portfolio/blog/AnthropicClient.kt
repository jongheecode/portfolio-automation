package com.jongheecode.portfolio.blog

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

data class AnthropicContentBlock(val type: String, val text: String?)
data class AnthropicMessageResponse(val content: List<AnthropicContentBlock>)
data class GeneratedPost(val title: String, val content: String)

@Component
class AnthropicClient(
    restClientBuilder: RestClient.Builder,
    private val objectMapper: ObjectMapper,
    @Value("\${anthropic.api-key}") private val apiKey: String,
) {
    private val restClient = restClientBuilder.baseUrl("https://api.anthropic.com").build()

    fun generatePost(repoName: String, commitSummaries: List<String>): GeneratedPost {
        val prompt = buildPrompt(repoName, commitSummaries)

        val response = restClient.post()
            .uri("/v1/messages")
            .header("x-api-key", apiKey)
            .header("anthropic-version", "2023-06-01")
            .contentType(MediaType.APPLICATION_JSON)
            .body(
                mapOf(
                    "model" to "claude-sonnet-5",
                    "max_tokens" to 2000,
                    "messages" to listOf(mapOf("role" to "user", "content" to prompt)),
                ),
            )
            .retrieve()
            .body(AnthropicMessageResponse::class.java)
            ?: error("Anthropic API 응답이 비어 있습니다")

        val text = response.content.firstOrNull { it.type == "text" }?.text
            ?: error("Anthropic API 응답에 텍스트가 없습니다")

        return parseGeneratedPost(text)
    }

    private fun parseGeneratedPost(text: String): GeneratedPost {
        val json = extractJson(text)
        val node = objectMapper.readTree(json)
        val title = node.get("title")?.asText() ?: "제목 없음"
        val content = node.get("content")?.asText() ?: text
        return GeneratedPost(title, content)
    }

    // 모델이 JSON 앞뒤로 부가 설명을 붙이는 경우를 대비해 첫 '{'~마지막 '}' 구간만 추출.
    private fun extractJson(text: String): String {
        val start = text.indexOf('{')
        val end = text.lastIndexOf('}')
        if (start == -1 || end == -1 || end < start) return text
        return text.substring(start, end + 1)
    }

    private fun buildPrompt(repoName: String, commitSummaries: List<String>): String {
        val commitsBlock = commitSummaries.joinToString("\n") { "- $it" }
        return """
            아래는 "$repoName" 레포지토리에서 최근 작업한 GitHub 커밋 목록입니다.
            이 커밋들을 바탕으로 개발자 개인 기술 블로그에 올릴 글의 초안을 한국어로 작성해줘.

            요구사항:
            - 실제로 어떤 기능/문제를 다뤘는지 자연스러운 산문으로 설명 (커밋 목록을 그대로 나열하지 말 것)
            - 과장된 수식어나 광고 문구 없이 담백하게
            - 마크다운 형식 (## 소제목 등 사용 가능)
            - 응답은 반드시 다음 JSON 형식으로만 줘: {"title": "글 제목", "content": "마크다운 본문"}
            - JSON 외의 다른 텍스트는 절대 포함하지 마

            커밋 목록:
            $commitsBlock
        """.trimIndent()
    }
}
