package com.jongheecode.portfolio.finding

import com.jongheecode.portfolio.git.LocalGitService
import com.jongheecode.portfolio.git.WipFile
import com.jongheecode.portfolio.user.User
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class FindingService(
    private val localGitService: LocalGitService,
    private val findingRepository: FindingRepository,
) {
    fun nextAction(user: User): FindingPriority.NextAction {
        val active = localGitService.list(user).active
        val liveCandidates = if (active != null && active.ok) evaluateLive(active) else emptyList()

        val persistedOpen = findingRepository
            .findByCommit_TrackedRepo_UserAndStatusOrderByCreatedAtAsc(user, "OPEN")
            .mapNotNull { finding ->
                val tier = finding.tier?.let { runCatching { FindingRules.FindingTier.valueOf(it) }.getOrNull() } ?: return@mapNotNull null
                FindingPriority.PersistedCandidate(finding.id, tier, finding.message, finding.evidence, finding.createdAt, finding.ruleId)
            }

        return FindingPriority.pick(
            liveCandidates = liveCandidates,
            persistedOpen = persistedOpen,
            unpushedCount = active?.unpushedCount ?: 0,
            branchCommitCount = active?.branchCommitCount ?: 0,
            uncommittedFileCount = active?.changedFileCount ?: 0,
        )
    }

    // open-in-view=false라 finding.commit(LAZY) 권한 체크가 세션 안에서 돌아야 한다.
    @Transactional
    fun updateStatus(user: User, id: Long, status: String): FindingDto {
        require(status == "DISMISSED" || status == "USED_IN_POST") { "알 수 없는 상태입니다: $status" }
        val finding = findingRepository.findById(id).orElseThrow { NoSuchElementException("발견을 찾을 수 없습니다: $id") }
        require(finding.commit.trackedRepo.user.id == user.id) { "권한이 없습니다" }
        finding.status = status
        return findingRepository.save(finding).toDto()
    }

    private fun evaluateLive(snapshot: com.jongheecode.portfolio.git.LocalGitSnapshot): List<FindingRules.Candidate> {
        val safeFiles = DiffSizeGuard.filter(localGitService.review(snapshot).files)
        val wipFiles: List<WipFile> = snapshot.files
        val checks: List<() -> FindingRules.Candidate?> = listOf(
            { FindingRules.secretLeak(safeFiles) },
            { FindingRules.envFileCommitted(wipFiles) },
            { FindingRules.suspiciousPackageScript(safeFiles) },
            { FindingRules.ipcHandlerMissingValidation(safeFiles) },
            { FindingRules.corsWildcard(safeFiles) },
            { FindingRules.electronInsecureFlags(safeFiles) },
            { FindingRules.evalOrExec(safeFiles) },
            { FindingRules.commitSplitSuggestion(wipFiles) },
            { FindingRules.largeCommit(snapshot.additions, snapshot.deletions) },
            { FindingRules.debugArtifact(safeFiles) },
            { FindingRules.noTestTouched(wipFiles) },
        )
        val results = mutableListOf<FindingRules.Candidate>()
        for (check in checks) {
            try {
                check()?.let { results += it }
            } catch (e: Exception) {
                // 규칙 하나가 죽어도 나머지 규칙과 폴링에 영향 없게 스킵한다.
            }
        }
        try {
            val todoCount = FindingRules.newTodoCount(safeFiles)
            if (todoCount > 0) {
                results += FindingRules.Candidate(
                    ruleId = "new-todo-count",
                    category = "기록",
                    tier = null,
                    message = "TODO ${todoCount}개 새로 추가됨",
                    evidence = null,
                )
            }
        } catch (e: Exception) {
            // 규칙 하나가 죽어도 나머지에 영향 없게
        }
        return results
    }

    fun liveFindings(user: User): List<FindingRules.Candidate> {
        val active = localGitService.list(user).active
        return if (active != null && active.ok) evaluateLive(active) else emptyList()
    }
}
