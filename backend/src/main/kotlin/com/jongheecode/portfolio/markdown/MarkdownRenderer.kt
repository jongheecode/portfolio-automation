package com.jongheecode.portfolio.markdown

import org.commonmark.parser.Parser
import org.commonmark.renderer.html.HtmlRenderer
import org.springframework.stereotype.Component

@Component
class MarkdownRenderer {
    private val parser = Parser.builder().build()
    private val renderer = HtmlRenderer.builder().build()

    fun toHtml(markdown: String): String = renderer.render(parser.parse(markdown))
}
