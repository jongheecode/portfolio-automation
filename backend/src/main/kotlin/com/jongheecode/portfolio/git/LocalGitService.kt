package com.jongheecode.portfolio.git

import com.jongheecode.portfolio.commit.CommitRecordRepository
import com.jongheecode.portfolio.user.User
import com.jongheecode.portfolio.week.WeekDates
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.file.Files
import java.nio.file.Path
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Service
class LocalGitService(
    private val repoRepository: LocalWatchedRepoRepository,
    private val gitCli: GitCli,
    private val commitRecordRepository: CommitRecordRepository,
    private val clock: Clock,
) {
    @Transactional
    fun list(user: User): LocalGitResponse {
        val rows = repoRepository.findByUserOrderByIdAsc(user)
        val snapshots = rows.map { inspect(user, it) }
        val active = snapshots
            .filter { it.ok }
            .maxWithOrNull(compareBy<LocalGitSnapshot> { it.changedFileCount > 0 }.thenBy { it.lastCommitAt ?: "" })
            ?: snapshots.firstOrNull()
        return LocalGitResponse(repos = snapshots, active = active)
    }

    @Transactional
    fun add(user: User, rawPath: String): LocalGitResponse {
        val path = normalize(rawPath)
        check(!repoRepository.existsByUserAndPath(user, path.toString())) { "이미 감시 중인 폴더입니다" }
        checkGitRepo(path)
        repoRepository.save(LocalWatchedRepo(user = user, path = path.toString()))
        return list(user)
    }

    @Transactional(readOnly = true)
    fun review(user: User): LocalDiffReview = review(list(user).active)

    /** 이미 list()로 얻은 스냅샷으로 diff만 읽는다(같은 요청에서 list()를 두 번 돌리지 않게). */
    fun review(snapshot: LocalGitSnapshot?): LocalDiffReview {
        if (snapshot == null) return LocalDiffReview(emptyList(), listOf("감시 중인 로컬 레포가 없어요."))
        if (!snapshot.ok) return LocalDiffReview(emptyList(), listOf(snapshot.error ?: "git을 읽지 못했습니다"))
        val path = Path.of(snapshot.path)
        val staged = LocalGitParser.parseUnifiedDiff(gitCli.runOrEmpty(path, "diff", "--cached", "--unified=3"), staged = true)
        val unstaged = LocalGitParser.parseUnifiedDiff(gitCli.runOrEmpty(path, "diff", "--unified=3"), staged = false)
        val files = (staged + unstaged).distinctBy { it.path }.take(20)
        return LocalDiffReview(
            files = files,
            notes = LocalGitParser.reviewNotes(files, snapshot.changedFileCount, snapshot.additions, snapshot.deletions),
        )
    }

    @Transactional
    fun remove(user: User, id: Long) {
        val row = repoRepository.findByIdAndUser(id, user) ?: error("감시 폴더를 찾을 수 없습니다: $id")
        repoRepository.delete(row)
    }

    private fun inspect(user: User, row: LocalWatchedRepo): LocalGitSnapshot {
        val path = Path.of(row.path)
        if (!Files.isDirectory(path)) {
            return LocalGitSnapshot(id = row.id, path = row.path, name = path.fileName?.toString() ?: row.path, ok = false, error = "폴더가 없습니다")
        }
        return try {
            checkGitRepo(path)
            val name = gitCli.runOrEmpty(path, "rev-parse", "--show-toplevel")
                .trim()
                .ifBlank { path.toString() }
                .let { Path.of(it).fileName.toString() }
            val branch = gitCli.runOrEmpty(path, "branch", "--show-current").trim().ifBlank { "HEAD" }
            val status = gitCli.runOrEmpty(path, "status", "--porcelain", "-uall")
            val unstaged = gitCli.runOrEmpty(path, "diff", "--numstat")
            val staged = gitCli.runOrEmpty(path, "diff", "--cached", "--numstat")
            val files = LocalGitParser.wipFiles(status, unstaged, staged)
            val unpushed = unpushedCount(path)
            val lastIso = gitCli.runOrEmpty(path, "log", "-1", "--format=%cI").trim().ifBlank { null }
            val lastInstant = lastIso?.let { runCatching { Instant.parse(it) }.getOrNull() }
            val ageSeconds = lastInstant?.let { Duration.between(it, Instant.now(clock)).seconds }?.coerceAtLeast(0)
            val today = LocalDate.now(clock.withZone(WeekDates.ZONE))
            val since = today.atStartOfDay(WeekDates.ZONE).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
            val logText = gitCli.runOrEmpty(
                path,
                "log",
                "--since=$since",
                "--pretty=format:--%x09%H%x09%cI%x09%s",
                "--numstat",
            )
            val todayCommits = LocalGitParser.logEntries(logText).map { entry ->
                val written = commitRecordRepository.findByShaAndTrackedRepo_User(entry.sha, user)?.blogPost != null
                LocalTodayCommit(
                    sha = entry.sha,
                    message = entry.message,
                    committedAt = entry.committedAt,
                    files = entry.files,
                    additions = entry.additions,
                    deletions = entry.deletions,
                    written = written,
                )
            }
            val branchMessages = branchCommitMessages(path)
            LocalGitSnapshot(
                id = row.id,
                path = row.path,
                name = name,
                parentLabel = homeLabel(path.parent),
                branch = branch,
                ok = true,
                unpushedCount = unpushed,
                changedFileCount = files.size,
                additions = files.sumOf { it.additions },
                deletions = files.sumOf { it.deletions },
                files = files.take(40),
                extraFileCount = (files.size - 40).coerceAtLeast(0),
                lastCommitAt = lastIso,
                lastCommitAge = ageSeconds?.let { LocalGitParser.ageLabel(it) },
                headSha = gitCli.runOrEmpty(path, "rev-parse", "HEAD").trim().ifBlank { null },
                todayCommits = todayCommits.take(5),
                branchCommitCount = branchMessages.size,
                branchCommitMessages = branchMessages,
            )
        } catch (e: Exception) {
            LocalGitSnapshot(
                id = row.id,
                path = row.path,
                name = path.fileName?.toString() ?: row.path,
                ok = false,
                error = e.message ?: "git을 읽지 못했습니다",
            )
        }
    }

    private fun unpushedCount(path: Path): Int {
        val withUpstream = gitCli.runOrEmpty(path, "rev-list", "--count", "@{upstream}..HEAD").trim()
        withUpstream.toIntOrNull()?.let { return it }
        val origin = gitCli.runOrEmpty(path, "rev-list", "--count", "origin/HEAD..HEAD").trim()
        return origin.toIntOrNull() ?: 0
    }

    private fun branchCommitMessages(path: Path): List<String> {
        val bases = listOf("@{upstream}", "origin/HEAD", "main", "master")
        for (base in bases) {
            val text = gitCli.runOrEmpty(path, "log", "$base..HEAD", "--pretty=format:%s", "--max-count=40")
            if (text.isNotBlank()) {
                return text.lineSequence().map { it.trim() }.filter { it.isNotEmpty() }.toList()
            }
        }
        return emptyList()
    }

    private fun checkGitRepo(path: Path) {
        require(Files.isDirectory(path)) { "폴더를 찾을 수 없습니다" }
        val out = gitCli.runOrEmpty(path, "rev-parse", "--is-inside-work-tree").trim()
        require(out == "true") { "git 저장소가 아닙니다" }
    }

    private fun normalize(raw: String): Path {
        val trimmed = raw.trim().trim('"')
        require(trimmed.isNotEmpty()) { "폴더 경로를 입력해주세요" }
        return Path.of(trimmed).toAbsolutePath().normalize()
    }

    private fun homeLabel(parent: Path?): String {
        if (parent == null) return ""
        val home = System.getProperty("user.home") ?: return parent.toString()
        val text = parent.toString()
        return if (text.startsWith(home)) text.replaceFirst(home, "~") else text
    }
}

data class LocalGitResponse(
    val repos: List<LocalGitSnapshot>,
    val active: LocalGitSnapshot?,
)

data class LocalGitSnapshot(
    val id: Long,
    val path: String,
    val name: String,
    val parentLabel: String? = null,
    val branch: String? = null,
    val ok: Boolean = true,
    val error: String? = null,
    val unpushedCount: Int = 0,
    val changedFileCount: Int = 0,
    val additions: Int = 0,
    val deletions: Int = 0,
    val files: List<WipFile> = emptyList(),
    val extraFileCount: Int = 0,
    val lastCommitAt: String? = null,
    val lastCommitAge: String? = null,
    val headSha: String? = null,
    val todayCommits: List<LocalTodayCommit> = emptyList(),
    val branchCommitCount: Int = 0,
    val branchCommitMessages: List<String> = emptyList(),
)

data class LocalTodayCommit(
    val sha: String,
    val message: String,
    val committedAt: String,
    val files: Int,
    val additions: Int,
    val deletions: Int,
    val written: Boolean,
)
