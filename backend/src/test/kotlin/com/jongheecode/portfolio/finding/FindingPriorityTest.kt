package com.jongheecode.portfolio.finding

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.time.Instant

class FindingPriorityTest {
    private fun candidate(tier: FindingRules.FindingTier?, message: String = "x") =
        FindingRules.Candidate(ruleId = "r", category = "c", tier = tier, message = message, evidence = null)

    @Test
    fun `보안이 있으면 최우선`() {
        val result = FindingPriority.pick(
            liveCandidates = listOf(
                candidate(FindingRules.FindingTier.STRUCTURE, "구조 문제"),
                candidate(FindingRules.FindingTier.SECURITY, "보안 문제"),
            ),
            persistedOpen = emptyList(),
            unpushedCount = 5,
            branchCommitCount = 3,
            uncommittedFileCount = 2,
        )
        assertEquals("보안 문제", result.message)
        assertEquals("SECURITY", result.tier)
    }

    @Test
    fun `추세 전용(tier null) 후보는 알약 경쟁에서 빠진다`() {
        val result = FindingPriority.pick(
            liveCandidates = listOf(candidate(null, "잔소리")),
            persistedOpen = emptyList(),
            unpushedCount = 3,
            branchCommitCount = 0,
            uncommittedFileCount = 0,
        )
        assertEquals("push 대기 3개", result.message)
        assertEquals("BACKLOG", result.tier)
    }

    @Test
    fun `라이브 후보가 없으면 저장된 OPEN 발견 중 가장 오래된 것`() {
        val older = FindingPriority.PersistedCandidate(1, FindingRules.FindingTier.SECURITY, "오래된 보안", null, Instant.parse("2026-08-01T00:00:00Z"))
        val newer = FindingPriority.PersistedCandidate(2, FindingRules.FindingTier.SECURITY, "최근 보안", null, Instant.parse("2026-08-20T00:00:00Z"))
        val result = FindingPriority.pick(
            liveCandidates = emptyList(),
            persistedOpen = listOf(newer, older),
            unpushedCount = 0,
            branchCommitCount = 0,
            uncommittedFileCount = 0,
        )
        assertEquals("오래된 보안", result.message)
        assertEquals(1L, result.findingId)
    }

    @Test
    fun `백로그 순서는 push 대기, 글감, 커밋 안 한 파일 순`() {
        val onlyBranch = FindingPriority.pick(emptyList(), emptyList(), unpushedCount = 0, branchCommitCount = 4, uncommittedFileCount = 2)
        assertEquals("글감 4개 쌓임", onlyBranch.message)

        val onlyFiles = FindingPriority.pick(emptyList(), emptyList(), unpushedCount = 0, branchCommitCount = 0, uncommittedFileCount = 2)
        assertEquals("커밋 안 한 파일 2개", onlyFiles.message)
    }

    @Test
    fun `아무것도 없으면 CLEAR`() {
        val result = FindingPriority.pick(emptyList(), emptyList(), unpushedCount = 0, branchCommitCount = 0, uncommittedFileCount = 0)
        assertEquals("다 내보냈어요", result.message)
        assertEquals("CLEAR", result.tier)
        assertEquals(null, result.findingId)
    }
}
