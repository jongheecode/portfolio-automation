package com.jongheecode.portfolio.commit

import com.jongheecode.portfolio.user.UserRepository
import com.jongheecode.portfolio.user.currentUser
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/sync")
class SyncController(
    private val syncStatusService: SyncStatusService,
    private val userRepository: UserRepository,
) {
    @GetMapping("/status")
    fun status(@AuthenticationPrincipal principal: OAuth2User): SyncStateResponse =
        syncStatusService.status(userRepository.currentUser(principal))

    @PostMapping
    fun start(@AuthenticationPrincipal principal: OAuth2User): ResponseEntity<SyncStateResponse> =
        syncStatusService.start(userRepository.currentUser(principal))

    @PutMapping("/auto")
    fun auto(
        @AuthenticationPrincipal principal: OAuth2User,
        @RequestBody request: AutoSyncRequest,
    ): SyncStateResponse = syncStatusService.setAutoSync(userRepository.currentUser(principal), request.enabled)
}

data class AutoSyncRequest(val enabled: Boolean)
