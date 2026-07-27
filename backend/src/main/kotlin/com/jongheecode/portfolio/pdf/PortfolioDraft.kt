package com.jongheecode.portfolio.pdf

import com.jongheecode.portfolio.user.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.Lob
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "portfolio_drafts")
class PortfolioDraft(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    val user: User,

    @Lob
    @Column(nullable = false)
    var content: String,

    @Column(nullable = false)
    var includedRepoIds: String,

    @Column(nullable = false)
    var includedSections: String,

    @Column(nullable = false)
    var updatedAt: Instant = Instant.now(),
)
