package com.jongheecode.portfolio.commit

import com.jongheecode.portfolio.user.User
import com.jongheecode.portfolio.user.UserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.ResourceAccessException
import java.util.Optional

class SyncExecutorTest {
    private lateinit var userRepository: UserRepository
    private lateinit var commitSyncService: CommitSyncService
    private lateinit var executor: SyncExecutor
    private lateinit var user: User

    @BeforeEach
    fun setUp() {
        user = User(id = 1, githubId = 1, username = "u", accessToken = "token")
        userRepository = mock(UserRepository::class.java)
        commitSyncService = mock(CommitSyncService::class.java)
        executor = SyncExecutor(userRepository, commitSyncService)
        `when`(userRepository.findById(1L)).thenReturn(Optional.of(user))
    }

    @Test
    fun `401은 token_expired로 기록한다`() {
        val error = HttpClientErrorException.create(HttpStatus.UNAUTHORIZED, "Unauthorized", HttpHeaders.EMPTY, ByteArray(0), null)
        `when`(commitSyncService.syncAll(user)).thenThrow(error)

        executor.runNow(1L)

        assertEquals("error", user.lastSyncKind)
        assertEquals(GithubSyncError.TOKEN_EXPIRED, user.lastSyncErrorCode)
    }

    @Test
    fun `연결 실패(타임아웃 등)는 no_access가 아니라 network_error로 기록한다`() {
        `when`(commitSyncService.syncAll(user)).thenThrow(ResourceAccessException("Connection timed out"))

        executor.runNow(1L)

        assertEquals("error", user.lastSyncKind)
        assertEquals(GithubSyncError.NETWORK_ERROR, user.lastSyncErrorCode)
    }

    @Test
    fun `알 수 없는 예외는 no_access로 기록한다`() {
        `when`(commitSyncService.syncAll(user)).thenThrow(RuntimeException("boom"))

        executor.runNow(1L)

        assertEquals("error", user.lastSyncKind)
        assertEquals(GithubSyncError.NO_ACCESS, user.lastSyncErrorCode)
    }

    @Test
    fun `성공하면 ok로 기록한다`() {
        `when`(commitSyncService.syncAll(user)).thenReturn(3 to 1)

        executor.runNow(1L)

        assertEquals("ok", user.lastSyncKind)
        assertEquals(null, user.lastSyncErrorCode)
    }
}
