package com.jongheecode.portfolio.github

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty
import java.time.Instant

@JsonIgnoreProperties(ignoreUnknown = true)
data class GithubEventDto(
    val type: String,
    val repo: GithubEventRepo,
    val payload: GithubEventPayload? = null,
    @JsonProperty("created_at") val createdAt: Instant,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class GithubEventRepo(
    val name: String,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class GithubEventPayload(
    val ref: String? = null,
)

object GithubActivity {
    fun targetsFromEvents(
        events: List<GithubEventDto>,
        since: Instant,
    ): Map<String, Set<String>> {
        val map = linkedMapOf<String, MutableSet<String>>()
        for (event in events) {
            if (event.type != "PushEvent") continue
            if (event.createdAt.isBefore(since)) continue
            val fullName = event.repo.name
            if (!fullName.contains('/')) continue
            val ref = event.payload?.ref ?: continue
            if (ref.startsWith("refs/tags/")) continue
            val branch = ref.removePrefix("refs/heads/")
            if (branch.isBlank()) continue
            map.getOrPut(fullName) { mutableSetOf() }.add(branch)
        }
        return map
    }

    fun commitQuery(
        author: String?,
        since: Instant?,
        sha: String?,
        page: Int,
    ): Map<String, String> {
        val query = linkedMapOf(
            "per_page" to "100",
            "page" to page.toString(),
        )
        if (!author.isNullOrBlank()) query["author"] = author
        if (since != null) query["since"] = since.toString()
        if (!sha.isNullOrBlank()) query["sha"] = sha
        return query
    }

    fun repoFullNamesFromEvents(events: List<GithubEventDto>): Set<String> =
        events.map { it.repo.name }.filter { it.contains('/') }.toSet()
}
