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
}
