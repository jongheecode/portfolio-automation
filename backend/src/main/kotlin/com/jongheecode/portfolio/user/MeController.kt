package com.jongheecode.portfolio.user

import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/me")
class MeController(
    private val userRepository: UserRepository,
) {
    @GetMapping
    fun me(@AuthenticationPrincipal principal: OAuth2User?): ResponseEntity<MeResponse> {
        if (principal == null) return ResponseEntity.status(401).build()
        val githubId = (principal.attributes["id"] as Number).toLong()
        val user = userRepository.findByGithubId(githubId) ?: return ResponseEntity.status(401).build()
        return ResponseEntity.ok(MeResponse(user.username, user.avatarUrl))
    }
}

data class MeResponse(val username: String, val avatarUrl: String?)
