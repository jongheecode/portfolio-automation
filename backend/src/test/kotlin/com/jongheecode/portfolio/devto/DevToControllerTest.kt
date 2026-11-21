package com.jongheecode.portfolio.devto

import com.jongheecode.portfolio.user.User
import com.jongheecode.portfolio.user.UserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.core.user.OAuth2User

class DevToControllerTest {
    private lateinit var devToApiClient: DevToApiClient
    private lateinit var userRepository: UserRepository
    private lateinit var controller: DevToController
    private lateinit var user: User
    private lateinit var principal: OAuth2User

    @BeforeEach
    fun setUp() {
        user = User(id = 1, githubId = 123, username = "owner", accessToken = "token")
        devToApiClient = mock(DevToApiClient::class.java)
        userRepository = mock(UserRepository::class.java)
        controller = DevToController(devToApiClient, userRepository)
        principal = mock(OAuth2User::class.java)
        `when`(principal.attributes).thenReturn(mapOf("id" to 123))
        `when`(userRepository.findByGithubId(123L)).thenReturn(user)
    }

    @Test
    fun `네트워크 실패 메시지는 API 키 탓으로 뭉개지 않고 그대로 보여준다`() {
        `when`(devToApiClient.fetchUsername("key")).thenThrow(IllegalStateException("dev.to에 연결할 수 없습니다: Connection refused"))

        val ex = assertThrows(IllegalStateException::class.java) {
            controller.connect(principal, ConnectDevToRequest("key"))
        }
        assertEquals("dev.to에 연결할 수 없습니다: Connection refused", ex.message)
    }

    @Test
    fun `성공하면 username을 저장하고 응답으로 돌려준다`() {
        `when`(devToApiClient.fetchUsername("key")).thenReturn("gildong")

        val response = controller.connect(principal, ConnectDevToRequest("key"))

        assertEquals("gildong", response.username)
        assertEquals("gildong", user.devtoUsername)
        assertEquals("key", user.devtoApiKey)
    }
}
