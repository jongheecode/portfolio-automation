package com.jongheecode.portfolio.config

import com.jongheecode.portfolio.user.CustomOAuth2UserService
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatus
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configurers.oauth2.client.OAuth2LoginConfigurer
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

@Configuration
class SecurityConfig(
    private val customOAuth2UserService: CustomOAuth2UserService,
    @Value("\${app.frontend-url}") private val frontendUrl: String,
) {

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
            }
            .logout { logout ->
                logout.logoutSuccessHandler { _, response, _ -> response.status = HttpStatus.NO_CONTENT.value() }
            }

        return http.build()
    }

    private fun corsConfigurationSource(): CorsConfigurationSource {
        val configuration = CorsConfiguration().apply {
            allowedOrigins = listOf(frontendUrl)
            allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "OPTIONS")
            allowedHeaders = listOf("*")
            allowCredentials = true
        }
        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/**", configuration)
        return source
    }
}
