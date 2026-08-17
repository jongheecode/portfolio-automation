package com.jongheecode.portfolio.week

object HabitCatalog {
    const val COMMIT_DAYS = "COMMIT_DAYS"
    const val WEEKLY_POST = "WEEKLY_POST"
    const val PUBLISH_OUTSIDE = "PUBLISH_OUTSIDE"

    data class Def(val key: String, val title: String, val target: Int)

    val defaults: List<Def> = listOf(
        Def(COMMIT_DAYS, "커밋한 날", 5),
        Def(WEEKLY_POST, "글 초안", 1),
        Def(PUBLISH_OUTSIDE, "밖에 글 올리기", 1),
    )

    fun def(key: String): Def? = defaults.find { it.key == key }
}
