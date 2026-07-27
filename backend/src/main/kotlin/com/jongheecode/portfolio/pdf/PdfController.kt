package com.jongheecode.portfolio.pdf

import com.jongheecode.portfolio.user.UserRepository
import com.jongheecode.portfolio.user.currentUser
import org.springframework.http.ContentDisposition
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/portfolio-pdf")
class PdfController(
    private val portfolioDraftRepository: PortfolioDraftRepository,
    private val portfolioPdfService: PortfolioPdfService,
    private val userRepository: UserRepository,
) {
    @GetMapping
    fun download(@AuthenticationPrincipal principal: OAuth2User): ResponseEntity<ByteArray> {
        val user = userRepository.currentUser(principal)
        val draft = portfolioDraftRepository.findByUser(user)
            ?: error("먼저 포트폴리오 초안을 생성해주세요")
        val pdfBytes = portfolioPdfService.render(draft.content)

        val headers = HttpHeaders()
        headers.contentType = MediaType.APPLICATION_PDF
        headers.contentDisposition = ContentDisposition.attachment().filename("portfolio.pdf").build()

        return ResponseEntity.ok().headers(headers).body(pdfBytes)
    }
}
