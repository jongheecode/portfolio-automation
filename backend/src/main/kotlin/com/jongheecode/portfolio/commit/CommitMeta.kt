package com.jongheecode.portfolio.commit

object CommitMeta {
    private val KNOWN_BOTS = setOf(
        "dependabot[bot]",
        "github-actions[bot]",
        "renovate[bot]",
        "imgbot[bot]",
        "codecov[bot]",
        "semantic-release-bot",
        "greenkeeper[bot]",
    )

    fun isMerge(parentShas: List<String>): Boolean = parentShas.size >= 2

    fun isBot(login: String?): Boolean {
        if (login.isNullOrBlank()) return false
        val lower = login.lowercase()
        return lower.endsWith("[bot]") || lower.endsWith("-bot") || KNOWN_BOTS.any { it.equals(login, ignoreCase = true) }
    }
}
