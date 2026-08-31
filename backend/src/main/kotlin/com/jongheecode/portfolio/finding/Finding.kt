package com.jongheecode.portfolio.finding

import com.jongheecode.portfolio.commit.CommitRecord
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
    name = "findings",
    uniqueConstraints = [UniqueConstraint(columnNames = ["commit_id", "rule_id"])],
)
class Finding(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "commit_id", nullable = false)
    val commit: CommitRecord,

    @Column(nullable = false)
    val ruleId: String,

    @Column(nullable = false)
    val category: String,

    /** FindingRules.FindingTier.name, or null for a trend-only rule that never competes for the pill. */
    val tier: String? = null,

    @Column(nullable = false, length = 500)
    val message: String,

    @Column(length = 2000)
    val evidence: String? = null,

    @Column(nullable = false)
    var status: String = "OPEN",

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),
)

data class FindingDto(
    val id: Long,
    val ruleId: String,
    val category: String,
    val tier: String?,
    val message: String,
    val evidence: String?,
    val status: String,
)

fun Finding.toDto() = FindingDto(id, ruleId, category, tier, message, evidence, status)

data class NextActionDto(
    val message: String,
    val tier: String,
    val evidence: String?,
    val findingId: Long?,
)

fun FindingPriority.NextAction.toDto() = NextActionDto(message, tier, evidence, findingId)
