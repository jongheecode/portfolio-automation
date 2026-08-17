package com.jongheecode.portfolio.github

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Instant

class GithubActivityTest {
    @Test
    fun `PushEvent에서 조직 레포와 피처 브랜치를 모은다`() {
        val events = listOf(
            GithubEventDto(
                type = "PushEvent",
                repo = GithubEventRepo("Li-routi/Li-routi_Frontend"),
                payload = GithubEventPayload(ref = "refs/heads/feat/#188-shop-tabs-filter"),
                createdAt = Instant.parse("2026-08-13T08:45:39Z"),
            ),
            GithubEventDto(
                type = "PushEvent",
                repo = GithubEventRepo("Li-routi/Li-routi_Frontend"),
                payload = GithubEventPayload(ref = "refs/heads/feat/#174-shop-api"),
                createdAt = Instant.parse("2026-08-12T13:45:52Z"),
            ),
            GithubEventDto(
                type = "PullRequestEvent",
                repo = GithubEventRepo("Li-routi/Li-routi_Frontend"),
                payload = GithubEventPayload(ref = null),
                createdAt = Instant.parse("2026-08-13T11:49:45Z"),
            ),
            GithubEventDto(
                type = "PushEvent",
                repo = GithubEventRepo("jongheecode/old"),
                payload = GithubEventPayload(ref = "refs/heads/main"),
                createdAt = Instant.parse("2026-04-01T00:00:00Z"),
            ),
        )

        val targets = GithubActivity.targetsFromEvents(
            events,
            Instant.parse("2026-05-16T00:00:00Z"),
        )

        assertEquals(setOf("Li-routi/Li-routi_Frontend"), targets.keys)
        assertEquals(
            setOf("feat/#188-shop-tabs-filter", "feat/#174-shop-api"),
            targets.getValue("Li-routi/Li-routi_Frontend"),
        )
    }

    @Test
    fun `커밋 목록 쿼리에 author와 since와 브랜치를 넣는다`() {
        val query = GithubActivity.commitQuery(
            author = "jongheecode",
            since = Instant.parse("2026-05-16T00:00:00Z"),
            sha = "feat/#188-shop-tabs-filter",
            page = 1,
        )
        assertEquals("100", query["per_page"])
        assertEquals("1", query["page"])
        assertEquals("jongheecode", query["author"])
        assertEquals("2026-05-16T00:00:00Z", query["since"])
        assertEquals("feat/#188-shop-tabs-filter", query["sha"])
        assertTrue(query.containsKey("sha"))
    }

    @Test
    fun `이벤트에서 조직 레포 이름을 뽑는다`() {
        val events = listOf(
            GithubEventDto(
                type = "PushEvent",
                repo = GithubEventRepo("Li-routi/Li-routi_Frontend"),
                payload = GithubEventPayload(ref = "refs/heads/main"),
                createdAt = Instant.parse("2026-08-13T08:45:39Z"),
            ),
            GithubEventDto(
                type = "PullRequestEvent",
                repo = GithubEventRepo("Li-routi/Li-routi_Frontend"),
                createdAt = Instant.parse("2026-08-13T11:49:45Z"),
            ),
        )
        assertEquals(
            setOf("Li-routi/Li-routi_Frontend"),
            GithubActivity.repoFullNamesFromEvents(events),
        )
    }
}
