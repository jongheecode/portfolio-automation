package com.jongheecode.portfolio.finding

import com.jongheecode.portfolio.git.LocalGitService
import com.jongheecode.portfolio.git.WipFile
import com.jongheecode.portfolio.user.User
import org.springframework.stereotype.Service

@Service
class FindingService(
    private val localGitService: LocalGitService,
    private val findingRepository: FindingRepository,
) {
    fun nextAction(user: User): FindingPriority.NextAction {
        val active = localGitService.list(user).active
        val liveCandidates = if (active != null && active.ok) evaluateLive(user, active) else emptyList()

        val persistedOpen = findingRepository
            .findByCommit_TrackedRepo_UserAndStatusOrderByCreatedAtAsc(user, "OPEN")
            .mapNotNull { finding ->
                val tier = finding.tier?.let { runCatching { FindingRules.FindingTier.valueOf(it) }.getOrNull() } ?: return@mapNotNull null
                FindingPriority.PersistedCandidate(finding.id, tier, finding.message, finding.evidence, finding.createdAt)
            }

        return FindingPriority.pick(
            liveCandidates = liveCandidates,
            persistedOpen = persistedOpen,
            unpushedCount = active?.unpushedCount ?: 0,
            branchCommitCount = active?.branchCommitCount ?: 0,
            uncommittedFileCount = active?.changedFileCount ?: 0,
        )
    }

    fun updateStatus(user: User, id: Long, status: String): FindingDto {
        require(status == "DISMISSED" || status == "USED_IN_POST") { "알 수 없는 상태입니다: $status" }
        val finding = findingRepository.findById(id).orElseThrow { NoSuchElementException("발견을 찾을 수 없습니다: $id") }
        require(finding.commit.trackedRepo.user.id == user.id) { "권한이 없습니다" }
        finding.status = status
        return findingRepository.save(finding).toDto()
    }

    private fun evaluateLive(user: User, snapshot: com.jongheecode.portfolio.git.LocalGitSnapshot): List<FindingRules.Candidate> {
        val safeFiles = DiffSizeGuard.filter(localGitService.review(user).files)
        val wipFiles: List<WipFile> = snapshot.files
        val checks: List<() -> FindingRules.Candidate?> = listOf(
            { FindingRules.ipcHandlerMissingValidation(safeFiles) },
            { FindingRules.corsWildcard(safeFiles) },
            { FindingRules.electronInsecureFlags(safeFiles) },
            { FindingRules.evalOrExec(safeFiles) },
            { FindingRules.commitSplitSuggestion(wipFiles) },
            { FindingRules.largeCommit(snapshot.additions, snapshot.deletions) },
        )
        val results = mutableListOf<FindingRules.Candidate>()
        for (check in checks) {
            try {
                check()?.let { results += it }
            } catch (e: Exception) {
                // 규칙 하나가 죽어도 나머지 규칙과 폴링에 영향 없게 스킵한다.
            }
        }
        return results
    }
}
