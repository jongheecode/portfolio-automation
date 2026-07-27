package com.jongheecode.portfolio.user

import org.springframework.security.oauth2.core.user.OAuth2User

fun UserRepository.currentUser(principal: OAuth2User): User {
    val githubId = (principal.attributes["id"] as Number).toLong()
    return findByGithubId(githubId) ?: error("인증된 사용자를 찾을 수 없습니다: githubId=$githubId")
}
