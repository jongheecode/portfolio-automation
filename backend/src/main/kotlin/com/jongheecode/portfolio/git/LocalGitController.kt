package com.jongheecode.portfolio.git

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

@RestController
@RequestMapping("/api/local-git")
class LocalGitController(
    private val localGitService: LocalGitService,
    private val userRepository: UserRepository,
) {
    @GetMapping
    fun list(@AuthenticationPrincipal principal: OAuth2User): LocalGitResponse =
        localGitService.list(userRepository.currentUser(principal))

    @PostMapping
    fun add(
        @AuthenticationPrincipal principal: OAuth2User,
        @RequestBody request: WatchLocalRepoRequest,
    ): LocalGitResponse = localGitService.add(userRepository.currentUser(principal), request.path)

    @DeleteMapping("/{id}")
    fun remove(@AuthenticationPrincipal principal: OAuth2User, @PathVariable id: Long) {
        localGitService.remove(userRepository.currentUser(principal), id)
    }
}

data class WatchLocalRepoRequest(val path: String)
