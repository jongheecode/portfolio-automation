package com.jongheecode.portfolio.week

import com.jongheecode.portfolio.user.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import org.hibernate.annotations.ColumnDefault
import java.time.Instant
import java.time.LocalDate

@Entity
@Table(name = "plans")
class Plan(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,

    @Column(nullable = false, length = 200)
    var title: String,

    @Column(nullable = false)
    var dueOn: LocalDate,

    var doneAt: Instant? = null,

    @Column(length = 2000)
    @ColumnDefault("''")
    var linkedCommitIds: String? = "",

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),
) {
    fun linkedIdSet(): Set<Long> =
        (linkedCommitIds ?: "").split(',').mapNotNull { it.trim().toLongOrNull() }.toSet()
}
