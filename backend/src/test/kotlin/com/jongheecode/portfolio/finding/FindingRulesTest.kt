package com.jongheecode.portfolio.finding

import com.jongheecode.portfolio.git.DiffHunk
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class FindingRulesTest {
    @Test
    fun `락파일과 빌드 산출물은 규칙 평가 대상에서 뺀다`() {
        val files = listOf(
            DiffHunk(path = "frontend/package-lock.json", staged = false, additions = 5000, deletions = 0, patch = "+eval(x)"),
            DiffHunk(path = "desktop/dist/bundle.js", staged = false, additions = 200, deletions = 0, patch = "+eval(x)"),
            DiffHunk(path = "desktop/electron/main.js", staged = false, additions = 2, deletions = 0, patch = "+ipcMain.on('x', () => {})"),
        )
        val safe = DiffSizeGuard.filter(files)
        assertEquals(1, safe.size)
        assertEquals("desktop/electron/main.js", safe[0].path)
    }

    @Test
    fun `너무 큰 patch 하나는 걸러낸다`() {
        val huge = DiffHunk(path = "backend/Big.kt", staged = false, additions = 1, deletions = 0, patch = "+".repeat(20_001))
        assertEquals(0, DiffSizeGuard.filter(listOf(huge)).size)
    }

    @Test
    fun `ipcMain 핸들러가 새로 생겼는데 근처에 검증이 없으면 걸린다`() {
        val files = listOf(
            DiffHunk(
                path = "desktop/electron/main.js",
                staged = false,
                additions = 3,
                deletions = 0,
                patch = "+ipcMain.on('overlay:resize', (event, size) => {\n+  mainWindow.setBounds(size)\n+})",
            ),
        )
        val hit = FindingRules.ipcHandlerMissingValidation(files)
        assertEquals("ipc-handler-missing-validation", hit?.ruleId)
        assertEquals(FindingRules.FindingTier.SECURITY, hit?.tier)
    }

    @Test
    fun `ipcMain 핸들러 근처에 길이 체크가 있으면 안 걸린다`() {
        val files = listOf(
            DiffHunk(
                path = "desktop/electron/main.js",
                staged = false,
                additions = 3,
                deletions = 0,
                patch = "+ipcMain.on('overlay:resize', (event, size) => {\n+  if (typeof size.width !== 'number') return\n+  mainWindow.setBounds(size)\n+})",
            ),
        )
        assertEquals(null, FindingRules.ipcHandlerMissingValidation(files))
    }

    @Test
    fun `CORS 와일드카드를 잡는다`() {
        val files = listOf(
            DiffHunk(path = "backend/SecurityConfig.kt", staged = false, additions = 1, deletions = 0, patch = "+allowedOrigins = listOf(\"*\")"),
        )
        assertEquals("cors-wildcard", FindingRules.corsWildcard(files)?.ruleId)
    }

    @Test
    fun `정상 오리진 목록은 안 걸린다`() {
        val files = listOf(
            DiffHunk(path = "backend/SecurityConfig.kt", staged = false, additions = 1, deletions = 0, patch = "+allowedOrigins = listOf(frontendUrl, desktopUrl)"),
        )
        assertEquals(null, FindingRules.corsWildcard(files))
    }

    @Test
    fun `nodeIntegration true를 잡는다`() {
        val files = listOf(
            DiffHunk(path = "desktop/electron/main.js", staged = false, additions = 1, deletions = 0, patch = "+nodeIntegration: true,"),
        )
        assertEquals("electron-insecure-flags", FindingRules.electronInsecureFlags(files)?.ruleId)
    }

    @Test
    fun `contextIsolation true는 안 걸린다`() {
        val files = listOf(
            DiffHunk(path = "desktop/electron/main.js", staged = false, additions = 1, deletions = 0, patch = "+contextIsolation: true,"),
        )
        assertEquals(null, FindingRules.electronInsecureFlags(files))
    }

    @Test
    fun `문자열 결합 exec를 잡는다`() {
        val files = listOf(
            DiffHunk(path = "backend/Tool.kt", staged = false, additions = 1, deletions = 0, patch = "+exec(\"rm -rf \${userInput}\")"),
        )
        assertEquals("eval-or-exec", FindingRules.evalOrExec(files)?.ruleId)
    }

    @Test
    fun `상수 문자열 exec는 안 걸린다`() {
        val files = listOf(
            DiffHunk(path = "backend/Tool.kt", staged = false, additions = 1, deletions = 0, patch = "+exec(\"git status\")"),
        )
        assertEquals(null, FindingRules.evalOrExec(files))
    }
}
