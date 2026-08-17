package com.jongheecode.portfolio.github

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty
import com.jongheecode.portfolio.commit.GithubSyncError
import org.springframework.core.ParameterizedTypeReference
import org.springframework.stereotype.Component
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClient
import org.springframework.web.util.UriBuilder
import java.time.Instant

data class GithubRepoDto(
    val id: Long,
    val name: String,
    @JsonProperty("full_name") val fullName: String,
    @JsonProperty("html_url") val htmlUrl: String,
    @JsonProperty("private") val isPrivate: Boolean,
    val language: String?,
    val description: String?,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class GithubCommitDto(
    val sha: String,
    val commit: GithubCommitDetail,
    @JsonProperty("html_url") val htmlUrl: String,
    val author: GithubUserRef? = null,
    val parents: List<GithubParentDto> = emptyList(),
    val stats: GithubCommitStats? = null,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class GithubCommitDetail(
    val message: String,
    val author: GithubCommitAuthor,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class GithubCommitAuthor(
    val name: String,
    val date: Instant,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class GithubUserRef(
    val login: String? = null,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class GithubParentDto(
    val sha: String,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class GithubCommitStats(
    val additions: Int = 0,
    val deletions: Int = 0,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class GithubOrgDto(
    val login: String,
)

@Component
class GithubApiClient(restClientBuilder: RestClient.Builder) {

    private val restClient = restClientBuilder.baseUrl("https://api.github.com").build()

    companion object {
        private val SKIP_COMMIT_STATUSES = setOf(404, 409, 422)
    }

    fun listRepos(accessToken: String, username: String): List<GithubRepoDto> {
        val byFullName = linkedMapOf<String, GithubRepoDto>()
        for (repo in paginateRepos("/user/repos", accessToken) { builder ->
            builder.queryParam("sort", "pushed")
                .queryParam("affiliation", "owner,collaborator,organization_member")
        }) {
            byFullName[repo.fullName] = repo
        }
        for (org in listOrgs(accessToken)) {
            for (repo in paginateRepos("/orgs/${org.login}/repos", accessToken) { builder ->
                builder.queryParam("sort", "pushed").queryParam("type", "all")
            }) {
                byFullName.putIfAbsent(repo.fullName, repo)
            }
        }
        val events = listUserEvents(accessToken, username)
        for (fullName in GithubActivity.repoFullNamesFromEvents(events)) {
            if (fullName in byFullName) continue
            fetchRepo(accessToken, fullName)?.let { byFullName[it.fullName] = it }
        }
        return byFullName.values.toList()
    }

    fun listUserEvents(accessToken: String, username: String): List<GithubEventDto> {
        val authenticated = paginateEvents("/users/$username/events", accessToken)
        val public = paginateEvents("/users/$username/events/public", accessToken)
        return (authenticated + public).distinctBy { "${it.type}|${it.repo.name}|${it.createdAt}|${it.payload?.ref}" }
    }

    fun listCommits(
        accessToken: String,
        owner: String,
        repo: String,
        author: String? = null,
        since: Instant? = null,
        sha: String? = null,
    ): List<GithubCommitDto> {
        val all = mutableListOf<GithubCommitDto>()
        try {
            for (page in 1..3) {
                val query = GithubActivity.commitQuery(author, since, sha, page)
                val pageItems = restClient.get()
                    .uri { uri ->
                        val builder = uri.path("/repos/{owner}/{repo}/commits")
                        query.forEach { (key, value) -> builder.queryParam(key, value) }
                        builder.build(owner, repo)
                    }
                    .header("Authorization", "Bearer $accessToken")
                    .retrieve()
                    .body(object : ParameterizedTypeReference<List<GithubCommitDto>>() {})
                    ?: emptyList()
                all += pageItems
                if (pageItems.size < 100) break
            }
        } catch (e: HttpClientErrorException) {
            val status = e.statusCode.value()
            if (status == 403 && GithubSyncError.code(e) != GithubSyncError.RATE_LIMITED) return emptyList()
            if (status in SKIP_COMMIT_STATUSES) return emptyList()
            throw e
        }
        return all
    }

    fun fetchCommit(accessToken: String, owner: String, repo: String, sha: String): GithubCommitDto? =
        try {
            restClient.get()
                .uri("/repos/{owner}/{repo}/commits/{sha}", owner, repo, sha)
                .header("Authorization", "Bearer $accessToken")
                .retrieve()
                .body(GithubCommitDto::class.java)
        } catch (e: HttpClientErrorException) {
            val status = e.statusCode.value()
            if (status == 401 || GithubSyncError.code(e) == GithubSyncError.RATE_LIMITED) throw e
            if (status in SKIP_COMMIT_STATUSES || status == 403) null else throw e
        }

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

    private fun listOrgs(accessToken: String): List<GithubOrgDto> =
        try {
            restClient.get()
                .uri { uri -> uri.path("/user/orgs").queryParam("per_page", 100).build() }
                .header("Authorization", "Bearer $accessToken")
                .retrieve()
                .body(object : ParameterizedTypeReference<List<GithubOrgDto>>() {})
                ?: emptyList()
        } catch (e: HttpClientErrorException) {
            if (e.statusCode.value() in SKIP_COMMIT_STATUSES) emptyList() else throw e
        }

    fun fetchRepo(accessToken: String, fullName: String): GithubRepoDto? {
        val parts = fullName.split('/', limit = 2)
        if (parts.size != 2) return null
        return try {
            restClient.get()
                .uri("/repos/${parts[0]}/${parts[1]}")
                .header("Authorization", "Bearer $accessToken")
                .retrieve()
                .body(GithubRepoDto::class.java)
        } catch (e: HttpClientErrorException) {
            if (e.statusCode.value() in SKIP_COMMIT_STATUSES) null else throw e
        }
    }

    private fun paginateRepos(
        path: String,
        accessToken: String,
        extra: (UriBuilder) -> UriBuilder,
    ): List<GithubRepoDto> {
        val all = mutableListOf<GithubRepoDto>()
        try {
            for (page in 1..3) {
                val pageItems = restClient.get()
                    .uri { uri ->
                        extra(
                            uri.path(path).queryParam("per_page", 100).queryParam("page", page),
                        ).build()
                    }
                    .header("Authorization", "Bearer $accessToken")
                    .retrieve()
                    .body(object : ParameterizedTypeReference<List<GithubRepoDto>>() {})
                    ?: emptyList()
                all += pageItems
                if (pageItems.size < 100) break
            }
        } catch (e: HttpClientErrorException) {
            if (e.statusCode.value() in SKIP_COMMIT_STATUSES) return all
            throw e
        }
        return all
    }

    private fun paginateEvents(path: String, accessToken: String): List<GithubEventDto> {
        val all = mutableListOf<GithubEventDto>()
        try {
            for (page in 1..3) {
                val pageItems = restClient.get()
                    .uri { uri ->
                        uri.path(path).queryParam("per_page", 100).queryParam("page", page).build()
                    }
                    .header("Authorization", "Bearer $accessToken")
                    .retrieve()
                    .body(object : ParameterizedTypeReference<List<GithubEventDto>>() {})
                    ?: emptyList()
                all += pageItems
                if (pageItems.size < 100) break
            }
        } catch (e: HttpClientErrorException) {
            if (e.statusCode.value() in SKIP_COMMIT_STATUSES) return all
            throw e
        }
        return all
    }
}
