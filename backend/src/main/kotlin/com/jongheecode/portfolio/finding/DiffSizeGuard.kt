package com.jongheecode.portfolio.finding

import com.jongheecode.portfolio.git.DiffHunk

object DiffSizeGuard {
    private val EXCLUDED_PATTERNS = listOf(
        Regex("""(^|/)package-lock\.json$"""),
        Regex("""(^|/)yarn\.lock$"""),
        Regex("""(^|/)pnpm-lock\.yaml$"""),
        Regex("""(^|/)(build|dist|node_modules|\.gradle)/"""),
    )
    private const val MAX_PATCH_CHARS = 20_000

    fun filter(files: List<DiffHunk>): List<DiffHunk> =
        files.filter { file ->
            EXCLUDED_PATTERNS.none { it.containsMatchIn(file.path) } && file.patch.length <= MAX_PATCH_CHARS
        }
}
