package com.jongheecode.portfolio.repo

import com.jongheecode.portfolio.github.GithubApiClient
import com.jongheecode.portfolio.github.GithubRepoDto
import com.jongheecode.portfolio.user.UserRepository
import com.jongheecode.portfolio.user.currentUser
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

// 로그인한 사용자의 GitHub 레포 목록을 실시간으로 조회 (DB에 저장하지 않음).
@RestController
@RequestMapping("/api/github")
class GithubRepoController(
    private val githubApiClient: GithubApiClient,
    private val userRepository: UserRepository,
) {
    @GetMapping("/repos")
    fun listRepos(@AuthenticationPrincipal principal: OAuth2User): List<GithubRepoResponse> {
        val user = userRepository.currentUser(principal)
        return githubApiClient.listRepos(user.accessToken).map { it.toResponse() }
    }
}

data class GithubRepoResponse(
    val id: Long,
    val name: String,
    val fullName: String,
    val htmlUrl: String,
    val isPrivate: Boolean,
    val language: String?,
    val description: String?,
)

private fun GithubRepoDto.toResponse() =
    GithubRepoResponse(id, name, fullName, htmlUrl, isPrivate, language, description)
