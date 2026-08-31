package com.jongheecode.portfolio.finding

import java.time.Instant

object FindingPriority {
    data class PersistedCandidate(
        val id: Long,
        val tier: FindingRules.FindingTier,
        val message: String,
        val evidence: String?,
        val createdAt: Instant,
    )

    data class NextAction(
        val message: String,
        val tier: String,
        val evidence: String?,
        val findingId: Long?,
    )

    fun pick(
        liveCandidates: List<FindingRules.Candidate>,
        persistedOpen: List<PersistedCandidate>,
        unpushedCount: Int,
        branchCommitCount: Int,
        uncommittedFileCount: Int,
    ): NextAction {
        val pillEligibleLive = liveCandidates.filter { it.tier != null }

        forTier(FindingRules.FindingTier.SECURITY, pillEligibleLive, persistedOpen)?.let { return it }
        forTier(FindingRules.FindingTier.STRUCTURE, pillEligibleLive, persistedOpen)?.let { return it }

        if (unpushedCount > 0) return NextAction("push 대기 ${unpushedCount}개", "BACKLOG", null, null)
        if (branchCommitCount > 0) return NextAction("글감 ${branchCommitCount}개 쌓임", "BACKLOG", null, null)
        if (uncommittedFileCount > 0) return NextAction("커밋 안 한 파일 ${uncommittedFileCount}개", "BACKLOG", null, null)

        return NextAction("다 내보냈어요", "CLEAR", null, null)
    }

    private fun forTier(
        tier: FindingRules.FindingTier,
        liveCandidates: List<FindingRules.Candidate>,
        persistedOpen: List<PersistedCandidate>,
    ): NextAction? {
        liveCandidates.firstOrNull { it.tier == tier }?.let {
            return NextAction(it.message, tier.name, it.evidence, null)
        }
        persistedOpen.filter { it.tier == tier }.minByOrNull { it.createdAt }?.let {
            return NextAction(it.message, tier.name, it.evidence, it.id)
        }
        return null
    }
}
