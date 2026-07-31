package com.jongheecode.portfolio.devto

import com.jongheecode.portfolio.user.UserRepository
import com.jongheecode.portfolio.user.currentUser
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/devto")
@Transactional
class DevToController(
    private val devToApiClient: DevToApiClient,
    private val userRepository: UserRepository,
) {
    @PostMapping("/connection")
    fun connect(@AuthenticationPrincipal principal: OAuth2User, @RequestBody request: ConnectDevToRequest): ConnectDevToResponse {
        val user = userRepository.currentUser(principal)
        val username = try {
            devToApiClient.fetchUsername(request.apiKey)
        } catch (e: Exception) {
            error("dev.to API 키가 올바르지 않습니다: ${e.message}")
        }
        user.devtoApiKey = request.apiKey
        user.devtoUsername = username
        userRepository.save(user)
        return ConnectDevToResponse(username)
    }

    @DeleteMapping("/connection")
    fun disconnect(@AuthenticationPrincipal principal: OAuth2User) {
        val user = userRepository.currentUser(principal)
        user.devtoApiKey = null
        user.devtoUsername = null
        userRepository.save(user)
    }
}

data class ConnectDevToRequest(val apiKey: String)
data class ConnectDevToResponse(val username: String)
