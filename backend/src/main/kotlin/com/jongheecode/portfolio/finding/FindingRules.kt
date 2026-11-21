package com.jongheecode.portfolio.finding

import com.jongheecode.portfolio.git.DiffHunk
import com.jongheecode.portfolio.git.WipFile

object FindingRules {
    enum class FindingTier { SECURITY, STRUCTURE, BACKLOG }

    data class Candidate(
        val ruleId: String,
        val category: String,
        val tier: FindingTier?,
        val message: String,
        val evidence: String?,
        val filePath: String? = null,
    )

    private fun addedLines(file: DiffHunk): Sequence<String> =
        file.patch.lineSequence().filter { it.startsWith("+") && !it.startsWith("+++") }

    fun ipcHandlerMissingValidation(files: List<DiffHunk>): Candidate? {
        val handlerPattern = Regex("""ipcMain\.(on|handle)\s*\(""")
        val hit = files.firstOrNull { file ->
            val added = addedLines(file).toList()
            val hasNewHandler = added.any { handlerPattern.containsMatchIn(it) }
            val hasCheck = added.any { it.contains("typeof") || it.contains("length") || it.contains("JSON.parse") }
            hasNewHandler && !hasCheck
        } ?: return null
        return Candidate(
            ruleId = "ipc-handler-missing-validation",
            category = "보안",
            tier = FindingTier.SECURITY,
            message = "IPC 크기/타입 검증 확인해볼 것",
            evidence = "${hit.path} — 새 ipcMain 핸들러가 추가됐는데 근처에 길이/타입 체크가 안 보여요.",
            filePath = hit.path,
        )
    }

    fun corsWildcard(files: List<DiffHunk>): Candidate? {
        val pattern = Regex("""allowedOrigins?\s*=.*\*|@CrossOrigin\(\s*"\*"\s*\)""")
        val hit = files.firstOrNull { file -> addedLines(file).any { pattern.containsMatchIn(it) } } ?: return null
        return Candidate(
            ruleId = "cors-wildcard",
            category = "보안",
            tier = FindingTier.SECURITY,
            message = "CORS 와일드카드 확인해볼 것",
            evidence = "${hit.path} — 오리진에 와일드카드(*)가 추가된 것 같아요.",
            filePath = hit.path,
        )
    }

    fun electronInsecureFlags(files: List<DiffHunk>): Candidate? {
        val patterns = listOf(
            Regex("""nodeIntegration\s*:\s*true"""),
            Regex("""contextIsolation\s*:\s*false"""),
            Regex("""webSecurity\s*:\s*false"""),
        )
        val hit = files.firstOrNull { file -> addedLines(file).any { line -> patterns.any { it.containsMatchIn(line) } } } ?: return null
        return Candidate(
            ruleId = "electron-insecure-flags",
            category = "보안",
            tier = FindingTier.SECURITY,
            message = "Electron 보안 플래그 확인해볼 것",
            evidence = "${hit.path} — nodeIntegration/contextIsolation/webSecurity 플래그가 위험한 값으로 바뀐 것 같아요.",
            filePath = hit.path,
        )
    }

    fun evalOrExec(files: List<DiffHunk>): Candidate? {
        val evalPattern = Regex("""\beval\s*\(""")
        val execPattern = Regex("""exec\s*\(\s*["'`][^"'`]*\$\{|exec\s*\(\s*["'`][^"'`]*"\s*\+""")
        val hit = files.firstOrNull { file ->
            addedLines(file).any { line -> evalPattern.containsMatchIn(line) || execPattern.containsMatchIn(line) }
        } ?: return null
        return Candidate(
            ruleId = "eval-or-exec",
            category = "보안",
            tier = FindingTier.SECURITY,
            message = "eval/exec 사용 확인해볼 것",
            evidence = "${hit.path} — eval( 또는 문자열을 이어붙인 exec(가 추가된 것 같아요.",
            filePath = hit.path,
        )
    }

    // 실제 비밀값만 알려주는 서명 — 변수명(GEMINI_API_KEY 등)이나 플레이스홀더는 안 잡게 특정 발급 형식만 본다.
    private val SECRET_PATTERNS = listOf(
        Regex("""AKIA[0-9A-Z]{16}"""), // AWS access key
        Regex("""gh[pousr]_[A-Za-z0-9]{36}"""), // GitHub 토큰(ghp_/gho_/ghu_/ghs_/ghr_)
        Regex("""AIza[0-9A-Za-z\-_]{35}"""), // Google API key
        Regex("""-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----"""),
    )

    fun secretLeak(files: List<DiffHunk>): Candidate? {
        val hit = files.firstOrNull { file -> addedLines(file).any { line -> SECRET_PATTERNS.any { it.containsMatchIn(line) } } } ?: return null
        return Candidate(
            ruleId = "secret-leak",
            category = "보안",
            tier = FindingTier.SECURITY,
            message = "비밀값이 커밋에 들어간 것 같아요",
            evidence = "${hit.path} — 발급된 키/토큰 형식의 문자열이 추가됐어요. 커밋 전에 지우고 .env.local로 옮기세요.",
            filePath = hit.path,
        )
    }

    // .env.example/.sample/.template은 레포에 커밋되는 게 정상이라 빼고, 진짜 .env류만 본다.
    private val ENV_SAFE_SUFFIXES = setOf("example", "sample", "template")
    private val ENV_FILENAME = Regex("""^\.env(?:\.(.+))?$""")

    fun envFileCommitted(wipFiles: List<WipFile>): Candidate? {
        val hit = wipFiles.firstOrNull { file ->
            val match = ENV_FILENAME.find(file.path.substringAfterLast('/'))
            match != null && match.groupValues[1].lowercase() !in ENV_SAFE_SUFFIXES
        } ?: return null
        return Candidate(
            ruleId = "env-file-committed",
            category = "보안",
            tier = FindingTier.SECURITY,
            message = "환경 파일이 커밋에 들어갈 것 같아요",
            evidence = "${hit.path} — .gitignore에 있어야 할 파일이 스테이징됐어요.",
            filePath = hit.path,
        )
    }

    private val ROOT_LEVEL_FILES = setOf(
        "docker-compose.yml", "README.md", ".gitignore", "AGENTS.md",
    )

    private fun topLevelFolders(paths: List<String>): Set<String> =
        paths.mapNotNull { raw ->
            val path = raw.trim()
            if (path in ROOT_LEVEL_FILES) return@mapNotNull null
            val slash = path.indexOf('/')
            if (slash < 0) return@mapNotNull null
            path.substring(0, slash)
        }.toSet()

    fun commitSplitSuggestion(wipFiles: List<WipFile>): Candidate? {
        val folders = topLevelFolders(wipFiles.map { it.path })
        if (folders.size < 2) return null
        val totalLines = wipFiles.sumOf { it.additions + it.deletions }
        if (totalLines < 50 && wipFiles.size < 4) return null
        val sortedFolders = folders.sorted()
        val evidence = sortedFolders.joinToString("; ") { folder ->
            val filesInFolder = wipFiles.filter { it.path.startsWith("$folder/") }.joinToString(", ") { it.path }
            "$folder: $filesInFolder"
        }
        return Candidate(
            ruleId = "commit-split-suggestion",
            category = "구조",
            tier = FindingTier.STRUCTURE,
            message = "${sortedFolders.joinToString("·")}이 같이 바뀜 (의도한 거면 넘어가도 됨)",
            evidence = evidence,
        )
    }

    fun largeCommit(additions: Int, deletions: Int): Candidate? {
        val total = additions + deletions
        if (total < 200) return null
        return Candidate(
            ruleId = "large-commit",
            category = "구조",
            tier = FindingTier.STRUCTURE,
            message = "한 커밋에 ${total}줄 — 200줄 넘음",
            evidence = "+$additions -$deletions",
        )
    }

    private val WEAK_MESSAGES = setOf("fix", "wip", "update", "temp", "fix bug", "임시", "수정")

    fun weakCommitMessage(message: String): Candidate? {
        val firstLine = message.lineSequence().first().trim()
        val weak = firstLine.length < 8 || firstLine.lowercase() in WEAK_MESSAGES
        if (!weak) return null
        return Candidate(
            ruleId = "weak-commit-message",
            category = "기록",
            tier = null,
            message = "커밋 메시지가 짧음: \"$firstLine\"",
            evidence = null,
        )
    }

    private fun isSourceFile(path: String) =
        path.endsWith(".kt") || path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".js")

    private fun isTestFile(path: String) =
        path.contains("test", ignoreCase = true) || path.contains(".spec.")

    fun noTestTouched(wipFiles: List<com.jongheecode.portfolio.git.WipFile>): Candidate? {
        // desktop/frontend는 AGENTS.md 관례상 테스트가 없음 — backend 변경에만 의미 있는 신호.
        val sourceTouched = wipFiles.any { it.path.startsWith("backend/") && isSourceFile(it.path) }
        val testTouched = wipFiles.any { isTestFile(it.path) }
        if (!sourceTouched || testTouched) return null
        return Candidate(
            ruleId = "no-test-touched",
            category = "테스트",
            tier = null,
            message = "소스만 바뀌고 테스트 파일 변경 없음",
            evidence = null,
        )
    }

    fun newTodoCount(files: List<DiffHunk>): Int =
        files.sumOf { file -> addedLines(file).count { it.contains("TODO") } }
}
