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
    private val portfolioSnapshotService: PortfolioSnapshotService,
    private val portfolioPdfService: PortfolioPdfService,
    private val userRepository: UserRepository,
) {
    @GetMapping("/summary")
    fun summary(@AuthenticationPrincipal principal: OAuth2User): PortfolioSnapshot {
        val user = userRepository.currentUser(principal)
        return portfolioSnapshotService.build(user)
    }

    @GetMapping
    fun download(@AuthenticationPrincipal principal: OAuth2User): ResponseEntity<ByteArray> {
        val user = userRepository.currentUser(principal)
        val snapshot = portfolioSnapshotService.build(user)
        val pdfBytes = portfolioPdfService.render(snapshot)

        val headers = HttpHeaders()
        headers.contentType = MediaType.APPLICATION_PDF
        headers.contentDisposition = ContentDisposition.attachment().filename("portfolio.pdf").build()

        return ResponseEntity.ok().headers(headers).body(pdfBytes)
    }
}
