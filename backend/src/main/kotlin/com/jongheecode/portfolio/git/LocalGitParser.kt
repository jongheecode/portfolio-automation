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

data class LocalCommitLog(
    val sha: String,
    val message: String,
    val committedAt: String,
    val files: Int,
    val additions: Int,
    val deletions: Int,
)
