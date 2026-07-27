package com.jongheecode.portfolio.pdf

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.io.ByteArrayOutputStream
import java.io.File
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Service
class PortfolioPdfService(
    // 로컬(Windows) 실행 전제 MVP: 한글 렌더링을 위해 OS에 설치된 맑은 고딕을 그대로 씀.
    // 다른 OS/서버에 배포할 때는 임베드 가능한 한글 폰트 파일을 리소스로 번들링해야 함.
    @Value("\${pdf.font-path:C:/Windows/Fonts/malgun.ttf}") private val fontPath: String,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun render(snapshot: PortfolioSnapshot): ByteArray {
        val html = buildHtml(snapshot)
        val output = ByteArrayOutputStream()
        val builder = PdfRendererBuilder()
        builder.useFastMode()

        val fontFile = File(fontPath)
        if (fontFile.exists()) {
            builder.useFont(fontFile, "PortfolioFont")
        } else {
            log.warn("한글 폰트 파일을 찾을 수 없습니다 ($fontPath). PDF에서 한글이 깨질 수 있습니다.")
        }

        builder.withHtmlContent(html, null)
        builder.toStream(output)
        builder.run()
        return output.toByteArray()
    }

    private fun buildHtml(snapshot: PortfolioSnapshot): String {
        val repoRows = snapshot.repos.sortedByDescending { it.commitCount }.joinToString("\n") { repo ->
            """
            <div class="repo">
              <div class="repo-header">
                <span class="repo-name">${escape(repo.fullName)}</span>
                <span class="repo-commits">${repo.commitCount} commits</span>
              </div>
              ${repo.description?.let { "<div class=\"repo-desc\">${escape(it)}</div>" } ?: ""}
              <div class="repo-meta">
                ${repo.language?.let { "<span>${escape(it)}</span>" } ?: ""}
                <span>${escape(repo.htmlUrl)}</span>
              </div>
            </div>
            """.trimIndent()
        }

        val generatedAtText = DateTimeFormatter.ofPattern("yyyy.MM.dd")
            .withZone(ZoneId.systemDefault())
            .format(snapshot.generatedAt)

        return """
            <!DOCTYPE html>
            <html xmlns="http://www.w3.org/1999/xhtml">
            <head>
              <meta charset="UTF-8"/>
              <style>
                @page { size: A4; margin: 40px; }
                body { font-family: 'PortfolioFont', sans-serif; color: #18181b; }
                h1 { font-size: 26px; margin: 0 0 4px; }
                .subtitle { color: #71717a; font-size: 13px; margin-bottom: 24px; }
                .stats { margin-bottom: 24px; }
                .stat { display: inline-block; width: 30%; padding: 12px 16px; border: 1px solid #e4e4e7; border-radius: 8px; margin-right: 12px; }
                .stat-label { font-size: 11px; color: #71717a; }
                .stat-value { font-size: 22px; font-weight: bold; }
                .repo { border: 1px solid #e4e4e7; border-radius: 8px; padding: 12px 16px; margin-bottom: 10px; }
                .repo-name { font-weight: bold; font-size: 14px; }
                .repo-commits { float: right; font-size: 12px; color: #71717a; }
                .repo-desc { font-size: 12px; color: #52525b; margin-top: 4px; }
                .repo-meta { font-size: 11px; color: #a1a1aa; margin-top: 6px; }
                .repo-meta span { margin-right: 12px; }
                .footer { margin-top: 30px; font-size: 10px; color: #a1a1aa; }
              </style>
            </head>
            <body>
              <h1>${escape(snapshot.username)}의 개발 포트폴리오</h1>
              <div class="subtitle">생성일 $generatedAtText</div>
              <div class="stats">
                <div class="stat"><div class="stat-label">추적 레포</div><div class="stat-value">${snapshot.totalRepos}</div></div>
                <div class="stat"><div class="stat-label">총 커밋</div><div class="stat-value">${snapshot.totalCommits}</div></div>
              </div>
              <div class="repos">
                $repoRows
              </div>
              <div class="footer">Portfolio Automation에서 자동 생성됨</div>
            </body>
            </html>
        """.trimIndent()
    }

    private fun escape(text: String): String = text
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
}
