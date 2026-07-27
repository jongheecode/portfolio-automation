package com.jongheecode.portfolio.github

import com.fasterxml.jackson.annotation.JsonProperty
import org.springframework.core.ParameterizedTypeReference
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.time.Instant

data class GithubRepoDto(
    val id: Long,
    val name: String,
    @JsonProperty("full_name") val fullName: String,
    @JsonProperty("html_url") val htmlUrl: String,
    @JsonProperty("private") val isPrivate: Boolean,
)

data class GithubCommitDto(
    val sha: String,
    val commit: GithubCommitDetail,
    @JsonProperty("html_url") val htmlUrl: String,
)

data class GithubCommitDetail(
    val message: String,
    val author: GithubCommitAuthor,
)

data class GithubCommitAuthor(
    val name: String,
    val date: Instant,
)

@Component
class GithubApiClient(restClientBuilder: RestClient.Builder) {

    private val restClient = restClientBuilder.baseUrl("https://api.github.com").build()

    fun listRepos(accessToken: String): List<GithubRepoDto> =
        restClient.get()
            .uri("/user/repos?per_page=100&sort=updated")
            .header("Authorization", "Bearer $accessToken")
            .retrieve()
            .body(object : ParameterizedTypeReference<List<GithubRepoDto>>() {})
            ?: emptyList()

    fun listCommits(accessToken: String, owner: String, repo: String): List<GithubCommitDto> =
        restClient.get()
            .uri("/repos/$owner/$repo/commits?per_page=50")
            .header("Authorization", "Bearer $accessToken")
            .retrieve()
            .body(object : ParameterizedTypeReference<List<GithubCommitDto>>() {})
            ?: emptyList()
}
