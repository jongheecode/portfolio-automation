package com.jongheecode.portfolio.repo

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
import jakarta.persistence.UniqueConstraint
import java.time.Instant

@Entity
@Table(
    name = "tracked_repos",
    uniqueConstraints = [UniqueConstraint(columnNames = ["user_id", "full_name"])],
)
class TrackedRepo(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,

    @Column(nullable = false)
    val owner: String,

    @Column(nullable = false)
    val name: String,

    @Column(nullable = false)
    val fullName: String,

    @Column(nullable = false)
    val htmlUrl: String,

    var lastSyncedAt: Instant? = null,

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),
)
