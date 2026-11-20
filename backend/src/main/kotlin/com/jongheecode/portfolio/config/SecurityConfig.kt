package com.jongheecode.portfolio.config

import com.jongheecode.portfolio.user.CustomOAuth2UserService
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatus
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configurers.oauth2.client.OAuth2LoginConfigurer
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

@Configuration
class SecurityConfig(
    private val customOAuth2UserService: CustomOAuth2UserService,
    @Value("\${app.frontend-url}") private val frontendUrl: String,
    // 데스크톱 오버레이(Electron+Vite dev server)는 프론트와 다른 포트에서 뜨는 별개 오리진이라 CORS 허용 목록에 추가.
    @Value("\${app.desktop-url:http://localhost:5174}") private val desktopUrl: String,
) {
    private val log = LoggerFactory.getLogger(SecurityConfig::class.java)


    @Bean
    fun filterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .cors { it.configurationSource(corsConfigurationSource()) }
            .csrf { it.disable() }
            .authorizeHttpRequests {
                it.requestMatchers("/api/me").permitAll()
                it.anyRequest().authenticated()
            }
            .oauth2Login { oauth2: OAuth2LoginConfigurer<HttpSecurity> ->
                oauth2
                    .userInfoEndpoint { it.userService(customOAuth2UserService) }
                    .successHandler(
                        SimpleUrlAuthenticationSuccessHandler("$frontendUrl/dashboard").apply {
                            setAlwaysUseDefaultTargetUrl(true)
                        },
                    )
                    .failureHandler { request, response, exception ->
                        log.error("GitHub OAuth 로그인 실패: {}", exception.message, exception)
                        SimpleUrlAuthenticationFailureHandler("/login?error")
                            .onAuthenticationFailure(request, response, exception)
                    }
            }
            .requestCache { it.disable() }
            .logout { logout ->
                logout.logoutSuccessHandler { _, response, _ -> response.status = HttpStatus.NO_CONTENT.value() }
            }

        return http.build()
    }

    private fun corsConfigurationSource(): CorsConfigurationSource {
        val configuration = CorsConfiguration().apply {
            allowedOrigins = listOf(frontendUrl, desktopUrl)
            allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            allowedHeaders = listOf("*")
            allowCredentials = true
        }
        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/**", configuration)
        return source
    }
}
