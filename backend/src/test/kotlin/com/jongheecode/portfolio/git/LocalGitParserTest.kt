package com.jongheecode.portfolio.git

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class LocalGitParserTest {
    @Test
    fun `porcelain과 numstat을 WIP 파일로 합친다`() {
        val status = """
            M  backend/WeekService.kt
             M frontend/src/pages/DashboardPage.tsx
            ?? frontend/src/overlay/OverlayHud.tsx
             D frontend/src/legacy/HeatMap.tsx
        """.trimIndent()
        val unstaged = """
            64	40	frontend/src/pages/DashboardPage.tsx
            0	96	frontend/src/legacy/HeatMap.tsx
        """.trimIndent()
        val staged = """
            128	12	backend/WeekService.kt
        """.trimIndent()
        val files = LocalGitParser.wipFiles(status, unstaged, staged)
        assertEquals(4, files.size)
        assertEquals("M", files[0].tag)
        assertEquals(128, files[0].additions)
        assertEquals("A", files[2].tag)
        assertEquals("D", files[3].tag)
        assertEquals(96, files[3].deletions)
    }

    @Test
    fun `오늘 커밋 로그를 파싱한다`() {
        val text = """
            --	abc	2026-08-14T09:12:00+09:00	feat: 주간 요약 API 추가
            128	12	a.kt
            4	0	b.kt
            --	def	2026-08-14T11:40:00+09:00	refactor: 스케줄러 분리
            86	74	c.kt
        """.trimIndent()
        val logs = LocalGitParser.logEntries(text)
        assertEquals(2, logs.size)
        assertEquals("feat: 주간 요약 API 추가", logs[0].message)
        assertEquals(2, logs[0].files)
        assertEquals(132, logs[0].additions)
        assertEquals(74, logs[1].deletions)
    }

    @Test
    fun `unified diff를 파일 단위로 자른다`() {
        val diff = """
            diff --git a/desktop/src/OverlayWidget.tsx b/desktop/src/OverlayWidget.tsx
            index 111..222 100644
            --- a/desktop/src/OverlayWidget.tsx
            +++ b/desktop/src/OverlayWidget.tsx
            @@ -1,3 +1,4 @@
            +import OverlayToast from './OverlayToast'
             import TrayIndicator from './TrayIndicator'
             import WorkContextPanel from './WorkContextPanel'
            diff --git a/frontend/src/legacy/HeatMap.tsx b/frontend/src/legacy/HeatMap.tsx
            deleted file mode 100644
            --- a/frontend/src/legacy/HeatMap.tsx
            +++ /dev/null
            @@ -1,2 +0,0 @@
            -export default function HeatMap() { return null }
            -// gone
        """.trimIndent()
        val files = LocalGitParser.parseUnifiedDiff(diff, staged = false)
        assertEquals(2, files.size)
        assertEquals("desktop/src/OverlayWidget.tsx", files[0].path)
        assertEquals(1, files[0].additions)
        assertEquals("frontend/src/legacy/HeatMap.tsx", files[1].path)
        assertEquals(2, files[1].deletions)
        val notes = LocalGitParser.reviewNotes(files, 2, 1, 2)
        assertEquals(true, notes.any { it.contains("테스트") || it.contains("삭제") || it.contains("작업 중") })
    }

    @Test
    fun `커밋 후 경과를 읽기 쉬운 문장으로 만든다`() {
        assertEquals("마지막 커밋 후 42분", LocalGitParser.ageLabel(42 * 60))
        assertEquals("마지막 커밋 후 1시간 42분", LocalGitParser.ageLabel(102 * 60))
    }
}
