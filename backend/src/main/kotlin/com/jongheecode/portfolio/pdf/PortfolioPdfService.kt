package com.jongheecode.portfolio.pdf

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder
import org.commonmark.parser.Parser
import org.commonmark.renderer.html.HtmlRenderer
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.io.ByteArrayOutputStream
import java.io.File

@Service
class PortfolioPdfService(
    // 로컬(Windows) 실행 전제 MVP: 한글 렌더링을 위해 OS에 설치된 맑은 고딕을 그대로 씀.
    // 다른 OS/서버에 배포할 때는 임베드 가능한 한글 폰트 파일을 리소스로 번들링해야 함.
    @Value("\${pdf.font-path:C:/Windows/Fonts/malgun.ttf}") private val fontPath: String,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val markdownParser = Parser.builder().build()
    private val htmlRenderer = HtmlRenderer.builder().build()

    fun render(markdown: String): ByteArray {
        val bodyHtml = htmlRenderer.render(markdownParser.parse(markdown))
        val html = wrapHtml(bodyHtml)

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

    private fun wrapHtml(bodyHtml: String): String = """
        <!DOCTYPE html>
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta charset="UTF-8"/>
          <style>
            @page { size: A4; margin: 40px; }
            body { font-family: 'PortfolioFont', sans-serif; color: #18181b; line-height: 1.6; }
            h1 { font-size: 26px; margin: 0 0 16px; }
            h2 { font-size: 18px; margin: 24px 0 8px; border-bottom: 1px solid #e4e4e7; padding-bottom: 6px; }
            h3 { font-size: 15px; margin: 16px 0 6px; }
            p { margin: 0 0 10px; font-size: 13px; }
            ul { margin: 0 0 10px; padding-left: 20px; }
            li { font-size: 13px; margin-bottom: 4px; }
            strong { font-weight: bold; }
            hr { border: none; border-top: 1px solid #e4e4e7; margin: 20px 0; }
          </style>
        </head>
        <body>
        $bodyHtml
        </body>
        </html>
    """.trimIndent()
}
