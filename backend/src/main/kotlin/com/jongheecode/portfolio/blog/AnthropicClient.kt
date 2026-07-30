package com.jongheecode.portfolio.blog

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientResponseException

data class AnthropicContentBlock(val type: String, val text: String?)
data class AnthropicMessageResponse(val content: List<AnthropicContentBlock>)
data class GeneratedPost(val title: String, val content: String)

data class PortfolioRepoInput(
    val fullName: String,
    val description: String?,
    val language: String?,
    val languages: Map<String, Long>,
    val readme: String?,
    val recentCommitMessages: List<String>,
)

@Component
class AnthropicClient(
    restClientBuilder: RestClient.Builder,
    private val objectMapper: ObjectMapper,
    @Value("\${anthropic.api-key}") private val apiKey: String,
) {
    private val restClient = restClientBuilder.baseUrl("https://api.anthropic.com").build()

    fun generatePost(repoName: String, commitSummaries: List<String>): GeneratedPost {
        val text = callAnthropic(buildPrompt(repoName, commitSummaries), maxTokens = 2000)
        return parseGeneratedPost(text)
    }

    fun generatePortfolioDraft(sections: List<String>, repos: List<PortfolioRepoInput>): String {
        val text = callAnthropic(buildPortfolioPrompt(sections, repos), maxTokens = 4000)
        return stripMarkdownFence(text)
    }

    private fun callAnthropic(prompt: String, maxTokens: Int): String {
        val response = try {
            restClient.post()
                .uri("/v1/messages")
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .contentType(MediaType.APPLICATION_JSON)
                .body(
                    mapOf(
                        "model" to "claude-sonnet-5",
                        "max_tokens" to maxTokens,
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

    // 모델이 "코드펜스 쓰지 마"라는 지시를 무시하고 ```markdown ... ``` 로 감싸는 경우를 대비.
    private fun stripMarkdownFence(text: String): String {
        val trimmed = text.trim()
        if (!trimmed.startsWith("```")) return trimmed
        val withoutFirstLine = trimmed.substringAfter("\n")
        return withoutFirstLine.removeSuffix("```").trim()
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

    private fun extractApiErrorMessage(e: RestClientResponseException): String =
        runCatching { objectMapper.readTree(e.responseBodyAsString).at("/error/message").asText() }
            .getOrNull()
            ?.takeIf { it.isNotBlank() }
            ?: e.message
            ?: "알 수 없는 오류"

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
