package com.jongheecode.portfolio.config

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletRequestWrapper
import jakarta.servlet.http.HttpServletResponse
import jakarta.servlet.http.HttpSession
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

/**
 * 오버레이가 로그인 전에 /api/me 를 폴링하면 익명 세션이 만들어지고
 * 방금 받은 GitHub 로그인 쿠키를 덮어쓴다. API는 기존 세션만 쓴다.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class ApiSessionFilter : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        if (request.requestURI.startsWith("/api/")) {
            filterChain.doFilter(ExistingSessionOnlyRequest(request), response)
        } else {
            filterChain.doFilter(request, response)
        }
    }
}

private class ExistingSessionOnlyRequest(request: HttpServletRequest) : HttpServletRequestWrapper(request) {
    override fun getSession(): HttpSession? = super.getSession(false)

    override fun getSession(create: Boolean): HttpSession? = super.getSession(false)
}
