package com.jongheecode.portfolio.commit

object PlanCommitLink {
    fun keywords(title: String): List<String> =
        title
            .split(Regex("\\s+"))
            .map { it.replace(Regex("[^\\p{L}\\p{N}]"), "") }
            .filter { it.length >= 2 }

    fun count(title: String, messages: List<String>): Int {
        val keys = keywords(title)
        if (keys.isEmpty()) return 0
        return messages.count { message -> keys.any { key -> message.contains(key, ignoreCase = true) } }
    }

    fun uniqueCount(title: String, commits: List<Pair<Long, String>>, extraIds: Set<Long>): Int {
        val keys = keywords(title)
        val matched = commits
            .filter { (_, message) -> keys.any { key -> message.contains(key, ignoreCase = true) } }
            .map { it.first }
            .toSet()
        val existing = commits.map { it.first }.toSet()
        return (matched + extraIds.filter { it in existing }).size
    }
}
