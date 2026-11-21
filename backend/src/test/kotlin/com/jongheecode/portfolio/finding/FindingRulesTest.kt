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
    fun `AWS 액세스 키 형식을 잡는다`() {
        val files = listOf(
            DiffHunk(path = "backend/.env.local", staged = false, additions = 1, deletions = 0, patch = "+AWS_KEY=AKIAABCDEFGHIJKLMNOP"),
        )
        assertEquals("secret-leak", FindingRules.secretLeak(files)?.ruleId)
    }

    @Test
    fun `GitHub 토큰 형식을 잡는다`() {
        val files = listOf(
            DiffHunk(path = "backend/application.yml", staged = false, additions = 1, deletions = 0, patch = "+token: ghp_123456789012345678901234567890123456"),
        )
        assertEquals("secret-leak", FindingRules.secretLeak(files)?.ruleId)
    }

    @Test
    fun `변수명만 있고 실제 키 형식이 없으면 안 걸린다`() {
        val files = listOf(
            DiffHunk(path = "backend/AGENTS.md", staged = false, additions = 2, deletions = 0, patch = "+GEMINI_API_KEY 필요\n+accessToken = \"token\""),
        )
        assertEquals(null, FindingRules.secretLeak(files))
    }

    @Test
    fun `console_log가 추가되면 잡는다`() {
        val files = listOf(
            DiffHunk(path = "desktop/src/OverlayWidget.tsx", staged = false, additions = 1, deletions = 0, patch = "+console.log('debug', data)"),
        )
        assertEquals("debug-artifact", FindingRules.debugArtifact(files)?.ruleId)
    }

    @Test
    fun `debugger 문도 잡는다`() {
        val files = listOf(
            DiffHunk(path = "frontend/src/App.tsx", staged = false, additions = 1, deletions = 0, patch = "+debugger"),
        )
        assertEquals("debug-artifact", FindingRules.debugArtifact(files)?.ruleId)
    }

    @Test
    fun `console_error는 의도된 에러 처리라 안 걸린다`() {
        val files = listOf(
            DiffHunk(path = "desktop/src/useOverlayData.ts", staged = false, additions = 1, deletions = 0, patch = "+console.error('브랜치 초안 생성 실패', err)"),
        )
        assertEquals(null, FindingRules.debugArtifact(files))
    }

    @Test
    fun `kt 파일의 console_log 비슷한 문자열은 안 걸린다`() {
        val files = listOf(
            DiffHunk(path = "backend/Foo.kt", staged = false, additions = 1, deletions = 0, patch = "+// console.log 쓰지 말 것"),
        )
        assertEquals(null, FindingRules.debugArtifact(files))
    }

    @Test
    fun `env 파일이 스테이징되면 잡는다`() {
        val files = listOf(com.jongheecode.portfolio.git.WipFile("A", "backend/.env.local", 4, 0))
        val hit = FindingRules.envFileCommitted(files)
        assertEquals("env-file-committed", hit?.ruleId)
        assertEquals("backend/.env.local", hit?.filePath)
    }

    @Test
    fun `env example 파일은 안 걸린다`() {
        val files = listOf(com.jongheecode.portfolio.git.WipFile("A", "backend/.env.example", 4, 0))
        assertEquals(null, FindingRules.envFileCommitted(files))
    }

    @Test
    fun `상수 문자열 exec는 안 걸린다`() {
        val files = listOf(
            DiffHunk(path = "backend/Tool.kt", staged = false, additions = 1, deletions = 0, patch = "+exec(\"git status\")"),
        )
        assertEquals(null, FindingRules.evalOrExec(files))
    }

    @Test
    fun `루트 직속 파일만 걸치면 커밋 분리를 제안 안 한다`() {
        val files = listOf(
            com.jongheecode.portfolio.git.WipFile("M", "docker-compose.yml", 2, 1),
            com.jongheecode.portfolio.git.WipFile("M", "README.md", 3, 0),
            com.jongheecode.portfolio.git.WipFile("M", "backend/build.gradle.kts", 1, 1),
        )
        assertEquals(null, FindingRules.commitSplitSuggestion(files))
    }

    @Test
    fun `두 폴더가 걸치지만 변경량이 작으면 제안 안 한다`() {
        val files = listOf(
            com.jongheecode.portfolio.git.WipFile("M", "backend/config/SecurityConfig.kt", 1, 1),
            com.jongheecode.portfolio.git.WipFile("M", "desktop/electron/main.js", 1, 1),
        )
        assertEquals(null, FindingRules.commitSplitSuggestion(files))
    }

    @Test
    fun `두 폴더가 걸치고 변경량도 크면 제안한다`() {
        val files = listOf(
            com.jongheecode.portfolio.git.WipFile("M", "backend/config/SecurityConfig.kt", 40, 5),
            com.jongheecode.portfolio.git.WipFile("M", "desktop/electron/main.js", 20, 3),
        )
        val hit = FindingRules.commitSplitSuggestion(files)
        assertEquals("commit-split-suggestion", hit?.ruleId)
        assertEquals(FindingRules.FindingTier.STRUCTURE, hit?.tier)
    }

    @Test
    fun `desktop 폴더 안에서만 여러 파일 걸치는 건 제안 안 한다`() {
        val files = listOf(
            com.jongheecode.portfolio.git.WipFile("M", "desktop/electron/main.js", 60, 5),
            com.jongheecode.portfolio.git.WipFile("M", "desktop/electron/preload.js", 20, 2),
            com.jongheecode.portfolio.git.WipFile("M", "desktop/src/OverlayWidget.tsx", 30, 4),
        )
        assertEquals(null, FindingRules.commitSplitSuggestion(files))
    }

    @Test
    fun `200줄 넘는 커밋을 잡는다`() {
        val hit = FindingRules.largeCommit(additions = 160, deletions = 45)
        assertEquals("large-commit", hit?.ruleId)
        assertEquals(FindingRules.FindingTier.STRUCTURE, hit?.tier)
    }

    @Test
    fun `200줄 이하는 안 걸린다`() {
        assertEquals(null, FindingRules.largeCommit(additions = 100, deletions = 50))
    }

    @Test
    fun `짧은 커밋 메시지를 잡는다`() {
        val hit = FindingRules.weakCommitMessage("fix")
        assertEquals("weak-commit-message", hit?.ruleId)
        assertEquals(null, hit?.tier)
    }

    @Test
    fun `설명이 담긴 메시지는 안 걸린다`() {
        assertEquals(null, FindingRules.weakCommitMessage("오버레이 창 상태를 3개로 정리 + 클램프 도입"))
    }

    @Test
    fun `소스만 바뀌고 테스트가 없으면 잡는다`() {
        val files = listOf(com.jongheecode.portfolio.git.WipFile("M", "backend/src/main/kotlin/Foo.kt", 30, 2))
        assertEquals("no-test-touched", FindingRules.noTestTouched(files)?.ruleId)
    }

    @Test
    fun `테스트 파일도 같이 바뀌면 안 걸린다`() {
        val files = listOf(
            com.jongheecode.portfolio.git.WipFile("M", "backend/src/main/kotlin/Foo.kt", 30, 2),
            com.jongheecode.portfolio.git.WipFile("M", "backend/src/test/kotlin/FooTest.kt", 10, 0),
        )
        assertEquals(null, FindingRules.noTestTouched(files))
    }

    @Test
    fun `소스 변경이 없으면 안 걸린다`() {
        val files = listOf(com.jongheecode.portfolio.git.WipFile("M", "docs/notes.md", 5, 0))
        assertEquals(null, FindingRules.noTestTouched(files))
    }

    @Test
    fun `desktop만 바뀌면 테스트 관례가 없어 안 걸린다`() {
        val files = listOf(com.jongheecode.portfolio.git.WipFile("M", "desktop/src/OverlayWidget.tsx", 20, 3))
        assertEquals(null, FindingRules.noTestTouched(files))
    }

    @Test
    fun `추가된 TODO 줄 수를 센다`() {
        val files = listOf(
            DiffHunk(path = "a.kt", staged = false, additions = 2, deletions = 0, patch = "+// TODO: 나중에\n+val x = 1\n+// TODO: 이것도"),
            DiffHunk(path = "b.kt", staged = false, additions = 1, deletions = 0, patch = "-// TODO: 지워짐"),
        )
        assertEquals(2, FindingRules.newTodoCount(files))
    }
}
