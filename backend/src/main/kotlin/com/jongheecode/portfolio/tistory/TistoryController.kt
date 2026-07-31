package com.jongheecode.portfolio.tistory

import com.jongheecode.portfolio.user.UserRepository
import com.jongheecode.portfolio.user.currentUser
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.servlet.view.RedirectView
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

@RestController
@RequestMapping("/api/tistory")
@Transactional
class TistoryController(
    private val tistoryApiClient: TistoryApiClient,
    private val userRepository: UserRepository,
    @Value("\${tistory.client-id}") private val clientId: String,
    @Value("\${backend.url}") private val backendUrl: String,
    @Value("\${app.frontend-url}") private val frontendUrl: String,
) {
    private fun redirectUri() = "$backendUrl/api/tistory/callback"

    @GetMapping("/authorize-url")
    fun authorizeUrl(): Map<String, String> {
        val encodedRedirect = URLEncoder.encode(redirectUri(), StandardCharsets.UTF_8)
        val url = "https://www.tistory.com/oauth/authorize" +
            "?client_id=$clientId&redirect_uri=$encodedRedirect&response_type=code"
        return mapOf("url" to url)
    }

    @GetMapping("/callback")
    fun callback(@AuthenticationPrincipal principal: OAuth2User, @RequestParam code: String): RedirectView {
        val user = userRepository.currentUser(principal)
        val accessToken = tistoryApiClient.fetchAccessToken(code, redirectUri())
        val blogName = tistoryApiClient.fetchBlogName(accessToken)
        user.tistoryAccessToken = accessToken
        user.tistoryBlogName = blogName
        userRepository.save(user)
        return RedirectView("$frontendUrl/settings?tistory=connected")
    }

    @DeleteMapping("/connection")
    fun disconnect(@AuthenticationPrincipal principal: OAuth2User) {
        val user = userRepository.currentUser(principal)
        user.tistoryAccessToken = null
        user.tistoryBlogName = null
        userRepository.save(user)
    }
}
