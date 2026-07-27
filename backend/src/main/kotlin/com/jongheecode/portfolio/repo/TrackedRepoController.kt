package com.jongheecode.portfolio.repo

import com.jongheecode.portfolio.commit.CommitRecord
import com.jongheecode.portfolio.commit.CommitRecordRepository
import com.jongheecode.portfolio.commit.CommitSyncService
import com.jongheecode.portfolio.user.UserRepository
import com.jongheecode.portfolio.user.currentUser
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

@RestController
@RequestMapping("/api/tracked-repos")
class TrackedRepoController(
    private val trackedRepoRepository: TrackedRepoRepository,
    private val commitRecordRepository: CommitRecordRepository,
    private val commitSyncService: CommitSyncService,
    private val userRepository: UserRepository,
) {
    @GetMapping
    fun list(@AuthenticationPrincipal principal: OAuth2User): List<TrackedRepoResponse> {
        val user = userRepository.currentUser(principal)
        return trackedRepoRepository.findByUser(user).map { it.toResponse() }
    }

    @PostMapping
    fun track(
        @AuthenticationPrincipal principal: OAuth2User,
        @RequestBody request: TrackRepoRequest,
    ): TrackedRepoResponse {
        val user = userRepository.currentUser(principal)
        val fullName = "${request.owner}/${request.name}"
        check(!trackedRepoRepository.existsByUserAndFullName(user, fullName)) {
            "이미 등록된 레포입니다: $fullName"
        }
        val saved = trackedRepoRepository.save(
            TrackedRepo(
                user = user,
                owner = request.owner,
                name = request.name,
                fullName = fullName,
                htmlUrl = "https://github.com/$fullName",
            ),
        )
        return saved.toResponse()
    }

    @DeleteMapping("/{id}")
    fun untrack(@AuthenticationPrincipal principal: OAuth2User, @PathVariable id: Long) {
        val user = userRepository.currentUser(principal)
        val repo = trackedRepoRepository.findByIdAndUser(id, user)
            ?: error("레포를 찾을 수 없습니다: $id")
        trackedRepoRepository.delete(repo)
    }

    @PostMapping("/{id}/sync")
    fun sync(@AuthenticationPrincipal principal: OAuth2User, @PathVariable id: Long): SyncResponse {
        val user = userRepository.currentUser(principal)
        val repo = trackedRepoRepository.findByIdAndUser(id, user)
            ?: error("레포를 찾을 수 없습니다: $id")
        val savedCount = commitSyncService.sync(repo, user.accessToken)
        return SyncResponse(savedCount)
    }

    @GetMapping("/{id}/commits")
    fun commits(@AuthenticationPrincipal principal: OAuth2User, @PathVariable id: Long): List<CommitRecordResponse> {
        val user = userRepository.currentUser(principal)
        val repo = trackedRepoRepository.findByIdAndUser(id, user)
            ?: error("레포를 찾을 수 없습니다: $id")
        return commitRecordRepository.findByTrackedRepoOrderByCommittedAtDesc(repo).map { it.toResponse() }
    }
}

data class TrackRepoRequest(val owner: String, val name: String)
data class SyncResponse(val savedCount: Int)

data class TrackedRepoResponse(
    val id: Long,
    val owner: String,
    val name: String,
    val fullName: String,
    val htmlUrl: String,
    val lastSyncedAt: Instant?,
)

private fun TrackedRepo.toResponse() = TrackedRepoResponse(id, owner, name, fullName, htmlUrl, lastSyncedAt)

data class CommitRecordResponse(
    val id: Long,
    val sha: String,
    val message: String,
    val authorName: String,
    val committedAt: Instant,
    val htmlUrl: String,
)

private fun CommitRecord.toResponse() = CommitRecordResponse(id, sha, message, authorName, committedAt, htmlUrl)
