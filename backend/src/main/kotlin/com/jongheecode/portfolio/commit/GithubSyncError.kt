package com.jongheecode.portfolio.commit

import org.springframework.http.HttpStatus
import org.springframework.web.client.HttpClientErrorException

object GithubSyncError {
    const val TOKEN_EXPIRED = "token_expired"
    const val RATE_LIMITED = "rate_limited"
    const val NO_ACCESS = "no_access"
    const val NETWORK_ERROR = "network_error"

    fun code(error: HttpClientErrorException): String {
        val status = error.statusCode.value()
        if (status == HttpStatus.UNAUTHORIZED.value()) return TOKEN_EXPIRED
        if (status == HttpStatus.FORBIDDEN.value()) {
            val remaining = error.responseHeaders?.getFirst("X-RateLimit-Remaining")
            if (remaining == "0") return RATE_LIMITED
            return NO_ACCESS
        }
        return NO_ACCESS
    }
}
