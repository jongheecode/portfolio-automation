package com.jongheecode.portfolio.commit

import com.jongheecode.portfolio.github.GithubActivity
import com.jongheecode.portfolio.github.GithubApiClient
import com.jongheecode.portfolio.repo.TrackedRepo
import com.jongheecode.portfolio.repo.TrackedRepoRepository
import com.jongheecode.portfolio.user.User
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.temporal.ChronoUnit

@Service
class CommitSyncService(
    private val githubApiClient: GithubApiClient,
    private val commitRecordRepository: CommitRecordRepository,
    private val trackedRepoRepository: TrackedRepoRepository,
) {
    @Transactional
    fun syncAll(user: User): Pair<Int, Int> {
        val since = Instant.now().minus(90, ChronoUnit.DAYS)
        val events = githubApiClient.listUserEvents(user.accessToken, user.username)
        val fromEvents = GithubActivity.targetsFromEvents(events, since)
        var savedCount = 0
        val syncedDefault = mutableSetOf<String>()

        for ((fullName, branches) in fromEvents) {
            val repo = ensureTracked(user, fullName)
            savedCount += sync(repo, user.accessToken, user.username, since, sha = null)
            syncedDefault.add(fullName)
            for (branch in branches) {
                savedCount += sync(repo, user.accessToken, user.username, since, sha = branch)
            }
        }

        val repos = trackedRepoRepository.findByUser(user)
        for (repo in repos) {
            if (repo.fullName in syncedDefault) continue
            savedCount += sync(repo, user.accessToken, user.username, since, sha = null)
        }

        return repos.size to savedCount
    }

    @Transactional
    fun sync(
        trackedRepo: TrackedRepo,
        accessToken: String,
        author: String? = trackedRepo.user.username,
        since: Instant? = Instant.now().minus(90, ChronoUnit.DAYS),
        sha: String? = null,
    ): Int {
        val commits = githubApiClient.listCommits(
            accessToken = accessToken,
            owner = trackedRepo.owner,
            repo = trackedRepo.name,
            author = author,
            since = since,
            sha = sha,
        )
        var savedCount = 0
        for (dto in commits) {
            val existing = commitRecordRepository.findByTrackedRepoAndSha(trackedRepo, dto.sha)
            if (existing != null) {
                var dirty = false
                if (CommitMeta.isMerge(dto.parents.map { it.sha }) && !existing.isMerge) {
                    existing.isMerge = true
                    dirty = true
                }
                val login = dto.author?.login
                if (existing.authorLogin == null && login != null) {
                    existing.authorLogin = login
                    dirty = true
                }
                if (CommitMeta.isBot(login ?: existing.authorLogin) && !existing.isBot) {
                    existing.isBot = true
                    dirty = true
                }
                if (dirty) commitRecordRepository.save(existing)
                continue
            }
            val detail = if (dto.stats == null) {
                githubApiClient.fetchCommit(accessToken, trackedRepo.owner, trackedRepo.name, dto.sha)
            } else {
                dto
            }
            val login = detail?.author?.login ?: dto.author?.login
            commitRecordRepository.save(
                CommitRecord(
                    trackedRepo = trackedRepo,
                    sha = dto.sha,
                    message = dto.commit.message.take(2000),
                    authorName = dto.commit.author.name,
                    committedAt = dto.commit.author.date,
                    htmlUrl = dto.htmlUrl,
                    authorLogin = login,
                    additions = detail?.stats?.additions ?: 0,
                    deletions = detail?.stats?.deletions ?: 0,
                    isMerge = CommitMeta.isMerge((detail?.parents ?: dto.parents).map { it.sha }),
                    isBot = CommitMeta.isBot(login),
                ),
            )
            savedCount++
        }
        trackedRepo.lastSyncedAt = Instant.now()
        trackedRepoRepository.save(trackedRepo)
        return savedCount
    }

    private fun ensureTracked(user: User, fullName: String): TrackedRepo {
        trackedRepoRepository.findByUserAndFullName(user, fullName)?.let { return it }
        val (owner, name) = fullName.split('/', limit = 2)
        val remote = githubApiClient.fetchRepo(accessToken = user.accessToken, fullName = fullName)
        val isPrivate = remote?.isPrivate ?: false
        return trackedRepoRepository.save(
            TrackedRepo(
                user = user,
                owner = owner,
                name = name,
                fullName = fullName,
                htmlUrl = remote?.htmlUrl ?: "https://github.com/$fullName",
                language = remote?.language,
                description = remote?.description,
                isPrivate = isPrivate,
                aiScopeEnabled = !isPrivate,
            ),
        )
    }
}
