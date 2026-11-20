package com.jongheecode.portfolio.finding

import com.jongheecode.portfolio.user.UserRepository
import com.jongheecode.portfolio.user.currentUser
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/findings")
class FindingController(
    private val findingService: FindingService,
    private val userRepository: UserRepository,
) {
    @GetMapping("/next-action")
    fun nextAction(@AuthenticationPrincipal principal: OAuth2User): NextActionDto =
        findingService.nextAction(userRepository.currentUser(principal)).toDto()

    @GetMapping("/live")
    fun live(@AuthenticationPrincipal principal: OAuth2User): List<LiveFindingDto> =
        findingService.liveFindings(userRepository.currentUser(principal)).map { it.toLiveDto() }

    @PatchMapping("/{id}")
    fun updateStatus(
        @AuthenticationPrincipal principal: OAuth2User,
        @PathVariable id: Long,
        @RequestBody request: UpdateFindingStatusRequest,
    ): FindingDto = findingService.updateStatus(userRepository.currentUser(principal), id, request.status)
}

data class UpdateFindingStatusRequest(val status: String)
