package com.jongheecode.portfolio.finding

import com.jongheecode.portfolio.commit.CommitRecord
import com.jongheecode.portfolio.git.LocalGitService
import com.jongheecode.portfolio.repo.TrackedRepo
import com.jongheecode.portfolio.user.User
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import java.time.Instant
import java.util.Optional

class FindingServiceTest {
    private lateinit var findingRepository: FindingRepository
    private lateinit var findingService: FindingService
    private lateinit var owner: User
    private lateinit var finding: Finding

    @BeforeEach
    fun setUp() {
        owner = User(id = 1, githubId = 1, username = "owner", accessToken = "token")
        val trackedRepo = TrackedRepo(user = owner, owner = "owner", name = "repo", fullName = "owner/repo", htmlUrl = "https://github.com/owner/repo")
        val commit = CommitRecord(
            trackedRepo = trackedRepo,
            sha = "abc123",
            message = "fix",
            authorName = "owner",
            committedAt = Instant.now(),
            htmlUrl = "https://github.com/owner/repo/commit/abc123",
        )
        finding = Finding(id = 10, commit = commit, ruleId = "commit-split-suggestion", category = "구조", message = "여러 폴더가 같이 바뀜")
        findingRepository = mock(FindingRepository::class.java)
        findingService = FindingService(mock(LocalGitService::class.java), findingRepository)
    }

    @Test
    fun `알 수 없는 상태값은 거부한다`() {
        assertThrows(IllegalArgumentException::class.java) {
            findingService.updateStatus(owner, finding.id, "DONE")
        }
    }

    @Test
    fun `존재하지 않는 발견은 거부한다`() {
        `when`(findingRepository.findById(999L)).thenReturn(Optional.empty())
        assertThrows(NoSuchElementException::class.java) {
            findingService.updateStatus(owner, 999L, "DISMISSED")
        }
    }

    @Test
    fun `다른 사용자의 발견은 거부한다`() {
        val stranger = User(id = 2, githubId = 2, username = "stranger", accessToken = "token")
        `when`(findingRepository.findById(finding.id)).thenReturn(Optional.of(finding))
        assertThrows(IllegalArgumentException::class.java) {
            findingService.updateStatus(stranger, finding.id, "DISMISSED")
        }
    }

    @Test
    fun `본인 발견은 상태를 바꾸고 저장한다`() {
        `when`(findingRepository.findById(finding.id)).thenReturn(Optional.of(finding))
        `when`(findingRepository.save(finding)).thenReturn(finding)

        val dto = findingService.updateStatus(owner, finding.id, "USED_IN_POST")

        assertEquals("USED_IN_POST", finding.status)
        assertEquals("USED_IN_POST", dto.status)
        assertEquals(finding.id, dto.id)
    }
}
