package com.jongheecode.portfolio.user

import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.stereotype.Service

@Service
class CustomOAuth2UserService(
    private val userRepository: UserRepository,
) : DefaultOAuth2UserService() {

    override fun loadUser(userRequest: OAuth2UserRequest): OAuth2User {
        val oAuth2User = super.loadUser(userRequest)
        val attributes = oAuth2User.attributes

        val githubId = (attributes["id"] as Number).toLong()
        val username = attributes["login"] as String
        val avatarUrl = attributes["avatar_url"] as? String
        val accessToken = userRequest.accessToken.tokenValue

        val existing = userRepository.findByGithubId(githubId)
        if (existing != null) {
            existing.username = username
            existing.avatarUrl = avatarUrl
            existing.accessToken = accessToken
            userRepository.save(existing)
        } else {
            userRepository.save(
                User(
                    githubId = githubId,
                    username = username,
                    avatarUrl = avatarUrl,
                    accessToken = accessToken,
                ),
            )
        }

        return oAuth2User
    }
}
