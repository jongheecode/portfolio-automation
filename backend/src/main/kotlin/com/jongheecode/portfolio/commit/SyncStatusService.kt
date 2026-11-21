package com.jongheecode.portfolio.commit

import com.jongheecode.portfolio.user.User
import com.jongheecode.portfolio.user.UserRepository
import org.springframework.http.ResponseEntity
import org.springframework.scheduling.annotation.Async
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClientException
import java.time.Instant

data class SyncStateResponse(
    val kind: String,
    val lastSyncedAt: Instant? = null,
    val lastAttemptAt: Instant? = null,
    val autoSync: Boolean? = null,
    val code: String? = null,
)

@Service
class SyncExecutor(
    private val userRepository: UserRepository,
    private val commitSyncService: CommitSyncService,
) {
    @Transactional
    fun markSyncing(userId: Long) {
        val user = userRepository.findById(userId).orElseThrow()
        user.lastSyncKind = "syncing"
        user.lastSyncAttemptAt = Instant.now()
        user.lastSyncErrorCode = null
        userRepository.save(user)
    }

    @Transactional
    fun runNow(userId: Long) {
        val user = userRepository.findById(userId).orElseThrow()
        try {
            commitSyncService.syncAll(user)
            user.lastSyncKind = "ok"
            user.lastSyncedAt = Instant.now()
            user.lastSyncAttemptAt = Instant.now()
            user.lastSyncErrorCode = null
        } catch (e: HttpClientErrorException) {
            user.lastSyncKind = "error"
            user.lastSyncAttemptAt = Instant.now()
            user.lastSyncErrorCode = GithubSyncError.code(e)
        } catch (_: RestClientException) {
            // HTTP 에러 응답이 아니라 타임아웃/연결 실패 — "권한 없음"으로 보이면 사용자가 엉뚱하게
            // 조직 권한을 확인하러 간다. 네트워크 문제라고 구분해서 알려준다.
            user.lastSyncKind = "error"
            user.lastSyncAttemptAt = Instant.now()
            user.lastSyncErrorCode = GithubSyncError.NETWORK_ERROR
        } catch (_: Exception) {
            user.lastSyncKind = "error"
            user.lastSyncAttemptAt = Instant.now()
            user.lastSyncErrorCode = GithubSyncError.NO_ACCESS
        }
        userRepository.save(user)
    }
}

@Component
class SyncRunner(
    private val syncExecutor: SyncExecutor,
) {
    @Async
    fun run(userId: Long) {
        syncExecutor.runNow(userId)
    }
}

@Service
class SyncStatusService(
    private val userRepository: UserRepository,
    private val syncExecutor: SyncExecutor,
    private val syncRunner: SyncRunner,
) {
    fun status(user: User): SyncStateResponse = when (user.lastSyncKind) {
        "syncing" -> SyncStateResponse(kind = "syncing", lastAttemptAt = user.lastSyncAttemptAt, autoSync = user.autoSync)
        "ok" -> SyncStateResponse(kind = "ok", lastSyncedAt = user.lastSyncedAt, autoSync = user.autoSync)
        "error" -> SyncStateResponse(
            kind = "error",
            lastAttemptAt = user.lastSyncAttemptAt,
            code = user.lastSyncErrorCode ?: GithubSyncError.NO_ACCESS,
            autoSync = user.autoSync,
        )
        else -> SyncStateResponse(kind = "never", autoSync = user.autoSync)
    }

    @Transactional
    fun setAutoSync(user: User, enabled: Boolean): SyncStateResponse {
        user.autoSync = enabled
        userRepository.save(user)
        return status(user)
    }

    fun start(user: User): ResponseEntity<SyncStateResponse> {
        val latest = userRepository.findById(user.id).orElseThrow()
        if (latest.lastSyncKind == "syncing") {
            return ResponseEntity.accepted().body(status(latest))
        }
        syncExecutor.markSyncing(latest.id)
        syncRunner.run(latest.id)
        return ResponseEntity.accepted().body(status(userRepository.findById(latest.id).orElseThrow()))
    }

    fun enqueue(userId: Long) {
        val user = userRepository.findById(userId).orElse(null) ?: return
        if (user.lastSyncKind == "syncing") return
        syncExecutor.markSyncing(userId)
        syncRunner.run(userId)
    }

    @Scheduled(cron = "0 0 3,9,15,21 * * *", zone = "Asia/Seoul")
    fun scheduledSync() {
        userRepository.findByAutoSyncTrue().forEach { enqueue(it.id) }
    }
}
