package com.jongheecode.portfolio.git

object LocalGitParser {
    fun porcelain(status: String): List<Pair<String, String>> =
        status.lineSequence()
            .map { it.trimEnd() }
            .filter { it.length >= 4 }
            .mapNotNull { line ->
                val xy = line.take(2)
                val rest = line.drop(3).trim()
                if (rest.isEmpty()) return@mapNotNull null
                val path = rest.substringAfter(" -> ", rest).trim().trim('"')
                val tag = when {
                    xy.contains('?') -> "A"
                    xy.contains('A') -> "A"
                    xy.contains('D') && !xy.contains('M') -> "D"
                    else -> "M"
                }
                tag to path.replace('\\', '/')
            }
            .distinctBy { it.second }
            .toList()

    fun numstat(text: String): Map<String, Pair<Int, Int>> {
        val out = linkedMapOf<String, Pair<Int, Int>>()
        text.lineSequence().forEach { line ->
            val parts = line.split('\t')
            if (parts.size < 3) return@forEach
            val add = parts[0].toIntOrNull() ?: 0
            val del = parts[1].toIntOrNull() ?: 0
            val path = parts[2].substringAfter(" => ").replace('\\', '/')
            val prev = out[path] ?: (0 to 0)
            out[path] = (prev.first + add) to (prev.second + del)
        }
        return out
    }

    fun wipFiles(status: String, unstaged: String, staged: String): List<WipFile> {
        val stats = numstat(unstaged).toMutableMap()
        numstat(staged).forEach { (path, pair) ->
            val prev = stats[path] ?: (0 to 0)
            stats[path] = (prev.first + pair.first) to (prev.second + pair.second)
        }
        return porcelain(status).map { (tag, path) ->
            val (add, del) = stats[path] ?: (0 to 0)
            WipFile(tag, path, add, del)
        }
    }

    fun logEntries(text: String): List<LocalCommitLog> {
        val entries = mutableListOf<LocalCommitLog>()
        var current: LocalCommitLog? = null
        var files = 0
        var add = 0
        var del = 0
        fun flush() {
            val item = current ?: return
            entries += item.copy(files = files, additions = add, deletions = del)
            current = null
            files = 0
            add = 0
            del = 0
        }
        text.lineSequence().forEach { line ->
            if (line.startsWith("--\t") || line.startsWith("-- ")) {
                flush()
                val body = line.removePrefix("--").trim().trimStart('\t')
                val parts = body.split('\t')
                if (parts.size >= 3) {
                    current = LocalCommitLog(parts[0], parts[2], parts[1], 0, 0, 0)
                }
            } else {
                val parts = line.split('\t')
                if (parts.size >= 3 && (parts[0] == "-" || parts[0].toIntOrNull() != null)) {
                    files += 1
                    add += parts[0].toIntOrNull() ?: 0
                    del += parts[1].toIntOrNull() ?: 0
                }
            }
        }
        flush()
        return entries
    }

    fun parseUnifiedDiff(text: String, staged: Boolean, maxFiles: Int = 20, maxLines: Int = 80): List<DiffHunk> {
        if (text.isBlank()) return emptyList()
        val clipped = if (text.length > 80_000) text.take(80_000) else text
        return clipped.split(Regex("(?m)^diff --git "))
            .drop(1)
            .take(maxFiles)
            .mapNotNull { block ->
                val header = block.lineSequence().firstOrNull() ?: return@mapNotNull null
                val path = header.substringAfter(" b/", header.substringAfter(" "))
                    .trim()
                    .replace('\\', '/')
                    .ifBlank { return@mapNotNull null }
                val lines = block.lineSequence().drop(1).toList()
                var add = 0
                var del = 0
                val body = mutableListOf<String>()
                for (line in lines) {
                    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("index ") || line.startsWith("new file") || line.startsWith("deleted file")) {
                        continue
                    }
                    if (line.startsWith('+')) add += 1
                    if (line.startsWith('-') && !line.startsWith("---")) del += 1
                    if (body.size < maxLines) body += line
                }
                DiffHunk(path = path, staged = staged, additions = add, deletions = del, patch = body.joinToString("\n"))
            }
    }

    fun reviewNotes(files: List<DiffHunk>, changedFileCount: Int, additions: Int, deletions: Int): List<String> {
        val notes = mutableListOf<String>()
        if (changedFileCount == 0 && files.isEmpty()) {
            return listOf("커밋 안 한 변경이 없습니다.")
        }
        notes += "작업 중 ${changedFileCount}파일 · +$additions −$deletions"
        val deleted = files.filter { it.deletions > 0 && it.additions == 0 }.map { it.path.substringAfterLast('/') }
        if (deleted.isNotEmpty()) notes += "삭제에 가까운 파일: ${deleted.take(3).joinToString(", ")}"
        val large = files.filter { it.additions >= 80 }.map { "${it.path.substringAfterLast('/')} +${it.additions}" }
        if (large.isNotEmpty()) notes += "큰 덩어리: ${large.take(2).joinToString(", ")}"
        val source = files.any { it.path.contains("/src/") || it.path.endsWith(".kt") || it.path.endsWith(".ts") || it.path.endsWith(".tsx") }
        val tests = files.any { it.path.contains("test", ignoreCase = true) || it.path.contains(".spec.") }
        if (source && !tests) notes += "소스 변경은 있는데 테스트 파일 변경은 없습니다."
        val staged = files.count { it.staged }
        if (staged > 0) notes += "스테이징된 파일 ${staged}개"
        if (files.isEmpty() && changedFileCount > 0) notes += "새 파일은 diff에 안 잡힐 수 있어요. 위 목록을 확인하세요."
        return notes
    }

    fun ageLabel(seconds: Long): String {
        if (seconds < 60) return "마지막 커밋 방금 전"
        val minutes = seconds / 60
        if (minutes < 60) return "마지막 커밋 후 ${minutes}분"
        val hours = minutes / 60
        val rest = minutes % 60
        if (hours < 24) return "마지막 커밋 후 ${hours}시간 ${rest}분"
        return "마지막 커밋 후 ${hours / 24}일"
    }
}

data class WipFile(
    val tag: String,
    val path: String,
    val additions: Int,
    val deletions: Int,
)

data class DiffHunk(
    val path: String,
    val staged: Boolean,
    val additions: Int,
    val deletions: Int,
    val patch: String,
)

data class LocalDiffReview(
    val files: List<DiffHunk>,
    val notes: List<String>,
)

data class LocalCommitLog(
    val sha: String,
    val message: String,
    val committedAt: String,
    val files: Int,
    val additions: Int,
    val deletions: Int,
)
