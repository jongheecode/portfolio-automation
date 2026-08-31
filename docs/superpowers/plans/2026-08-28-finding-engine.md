# Finding Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop overlay's load-line pill with a heuristic "Finding Engine" that surfaces one prioritized next-action sentence, and add a web "주간 리뷰" page showing per-commit findings and recurring-habit counters.

**Architecture:** A new `finding` backend package holds a `Finding` JPA entity, a pure-function `FindingRules` object (mirrors the existing `LocalGitParser` style — no Spring dependency, easy to unit test), a `FindingPriority` pure selection function, and a `FindingService`/`FindingController` that wire those into two new endpoints plus a hook into the existing commit-sync path. The desktop overlay's `LoadLinePill.tsx` is deleted; the collapsed pill reuses the existing text-pill mode of `TrayIndicator`.

**Tech Stack:** Kotlin + Spring Boot (backend, existing), React + TypeScript (desktop overlay + web frontend, existing). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-28-finding-engine-design.md`

## Global Constraints

- v1 rules are pure heuristic/pattern-matching — no LLM call anywhere in this plan (Gemini is blocked; see spec).
- The backend never executes `git commit`/split or runs tests on the user's behalf. Any command shown in the UI is copy-to-clipboard only, never executed server-side.
- Every rule call is wrapped so one failing/throwing rule cannot break the rest of a request.
- The live diff-evaluation path skips lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`) and `build/`/`dist/`/`node_modules/`/`.gradle/` paths, and skips any single file whose patch text exceeds 20,000 characters, before running any regex rule.
- `finding` table has a unique constraint on `(commit_id, rule_id)` so re-running sync never double-inserts.
- **Scope correction found during planning** (not in the original spec — the spec assumed richer data than the codebase actually has): `GithubCommitDto`/`GithubCommitDetail` (in `backend/src/main/kotlin/com/jongheecode/portfolio/github/GithubApiClient.kt`) only carry aggregate `additions`/`deletions` counts for a synced commit — no per-file paths or diff patches. Adding those would mean new DTO fields and an extra GitHub API call per commit (rate-limit cost), which is out of v1 scope. So:
  - **Persisted findings** (attached to a synced `CommitRecord`, used for `/week-review`'s historical list and the two counters below) are limited to `weak-commit-message` and `large-commit` — both derivable from data already on `CommitRecord` (`message`, `additions`, `deletions`).
  - **Everything else** (`ipc-handler-missing-validation`, `cors-wildcard`, `electron-insecure-flags`, `eval-or-exec`, `commit-split-suggestion`, `no-test-touched`, `new-todo-count`) runs **live only**, against the current local working tree via the existing `LocalGitService`/`GitCli` path (which already exposes full diff patches and file paths). These never get a persisted `Finding` row and are not counted historically — only the "지금 만지는 중" live panel on `/week-review` and the overlay pill see them.

---

## Task 1: `Finding` entity + repository

**Files:**
- Create: `backend/src/main/kotlin/com/jongheecode/portfolio/finding/Finding.kt`
- Create: `backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingRepository.kt`

**Interfaces:**
- Produces: `Finding` entity (`id`, `commit: CommitRecord`, `ruleId: String`, `category: String`, `tier: String?`, `message: String`, `evidence: String?`, `status: String` default `"OPEN"`, `createdAt: Instant`), `FindingRepository` with `existsByCommitAndRuleId(commit: CommitRecord, ruleId: String): Boolean`, `findByCommit_TrackedRepo_UserAndStatusOrderByCreatedAtAsc(user: User, status: String): List<Finding>`, `findByCommitIn(commits: List<CommitRecord>): List<Finding>`, `countByCommit_TrackedRepo_UserAndRuleIdAndCreatedAtAfter(user: User, ruleId: String, after: Instant): Long`.

This project uses `spring.jpa.hibernate.ddl-auto: update` (see `backend/src/main/resources/application.yml`) — there is no migration file to write; Hibernate creates the table from the entity on next boot. There is also no existing test convention for entities/repositories in this codebase (`CommitRecord`/`CommitRecordRepository` have none) — this task is verified by booting the app and confirming no schema errors, not by a JUnit test.

- [ ] **Step 1: Write the entity**

```kotlin
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
```

- [ ] **Step 2: Write the repository**

```kotlin
package com.jongheecode.portfolio.finding

import com.jongheecode.portfolio.commit.CommitRecord
import com.jongheecode.portfolio.user.User
import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant

interface FindingRepository : JpaRepository<Finding, Long> {
    fun existsByCommitAndRuleId(commit: CommitRecord, ruleId: String): Boolean
    fun findByCommit_TrackedRepo_UserAndStatusOrderByCreatedAtAsc(user: User, status: String): List<Finding>
    fun findByCommitIn(commits: List<CommitRecord>): List<Finding>
    fun countByCommit_TrackedRepo_UserAndRuleIdAndCreatedAtAfter(user: User, ruleId: String, after: Instant): Long
}
```

- [ ] **Step 3: Boot the app and confirm the table is created**

Run: `cd backend && set -a && . ./.env.local && set +a && ./gradlew bootRun`
Expected: no Hibernate schema-validation errors in the startup log; `docker exec -it portfolio-postgres psql -U portfolio -d portfolio -c "\d findings"` shows the new table with a `findings_commit_id_rule_id_key` unique constraint.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/finding/Finding.kt backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingRepository.kt
git commit -m "발견(Finding) 엔티티와 리포지토리를 추가했다"
```

---

## Task 2: Diff-size guard + tier-1 security rules

**Files:**
- Create: `backend/src/main/kotlin/com/jongheecode/portfolio/finding/DiffSizeGuard.kt`
- Create: `backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingRules.kt`
- Test: `backend/src/test/kotlin/com/jongheecode/portfolio/finding/FindingRulesTest.kt`

**Interfaces:**
- Consumes: `DiffHunk(path: String, staged: Boolean, additions: Int, deletions: Int, patch: String)` and `WipFile(tag: String, path: String, additions: Int, deletions: Int)` from `com.jongheecode.portfolio.git` (already defined in `LocalGitParser.kt`).
- Produces: `DiffSizeGuard.filter(files: List<DiffHunk>): List<DiffHunk>`. `FindingRules.FindingTier` enum (`SECURITY`, `STRUCTURE`, `BACKLOG`). `FindingRules.Candidate(ruleId: String, category: String, tier: FindingTier?, message: String, evidence: String?, filePath: String? = null)`. `FindingRules.ipcHandlerMissingValidation(files: List<DiffHunk>): Candidate?`, `FindingRules.corsWildcard(files: List<DiffHunk>): Candidate?`, `FindingRules.electronInsecureFlags(files: List<DiffHunk>): Candidate?`, `FindingRules.evalOrExec(files: List<DiffHunk>): Candidate?`.

- [ ] **Step 1: Write the failing test for `DiffSizeGuard`**

```kotlin
package com.jongheecode.portfolio.finding

import com.jongheecode.portfolio.git.DiffHunk
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class FindingRulesTest {
    @Test
    fun `락파일과 빌드 산출물은 규칙 평가 대상에서 뺀다`() {
        val files = listOf(
            DiffHunk(path = "frontend/package-lock.json", staged = false, additions = 5000, deletions = 0, patch = "+eval(x)"),
            DiffHunk(path = "desktop/dist/bundle.js", staged = false, additions = 200, deletions = 0, patch = "+eval(x)"),
            DiffHunk(path = "desktop/electron/main.js", staged = false, additions = 2, deletions = 0, patch = "+ipcMain.on('x', () => {})"),
        )
        val safe = DiffSizeGuard.filter(files)
        assertEquals(1, safe.size)
        assertEquals("desktop/electron/main.js", safe[0].path)
    }

    @Test
    fun `너무 큰 patch 하나는 걸러낸다`() {
        val huge = DiffHunk(path = "backend/Big.kt", staged = false, additions = 1, deletions = 0, patch = "+".repeat(20_001))
        assertEquals(0, DiffSizeGuard.filter(listOf(huge)).size)
    }

    @Test
    fun `ipcMain 핸들러가 새로 생겼는데 근처에 검증이 없으면 걸린다`() {
        val files = listOf(
            DiffHunk(
                path = "desktop/electron/main.js",
                staged = false,
                additions = 3,
                deletions = 0,
                patch = "+ipcMain.on('overlay:resize', (event, size) => {\n+  mainWindow.setBounds(size)\n+})",
            ),
        )
        val hit = FindingRules.ipcHandlerMissingValidation(files)
        assertEquals("ipc-handler-missing-validation", hit?.ruleId)
        assertEquals(FindingRules.FindingTier.SECURITY, hit?.tier)
    }

    @Test
    fun `ipcMain 핸들러 근처에 길이 체크가 있으면 안 걸린다`() {
        val files = listOf(
            DiffHunk(
                path = "desktop/electron/main.js",
                staged = false,
                additions = 3,
                deletions = 0,
                patch = "+ipcMain.on('overlay:resize', (event, size) => {\n+  if (typeof size.width !== 'number') return\n+  mainWindow.setBounds(size)\n+})",
            ),
        )
        assertEquals(null, FindingRules.ipcHandlerMissingValidation(files))
    }

    @Test
    fun `CORS 와일드카드를 잡는다`() {
        val files = listOf(
            DiffHunk(path = "backend/SecurityConfig.kt", staged = false, additions = 1, deletions = 0, patch = "+allowedOrigins = listOf(\"*\")"),
        )
        assertEquals("cors-wildcard", FindingRules.corsWildcard(files)?.ruleId)
    }

    @Test
    fun `정상 오리진 목록은 안 걸린다`() {
        val files = listOf(
            DiffHunk(path = "backend/SecurityConfig.kt", staged = false, additions = 1, deletions = 0, patch = "+allowedOrigins = listOf(frontendUrl, desktopUrl)"),
        )
        assertEquals(null, FindingRules.corsWildcard(files))
    }

    @Test
    fun `nodeIntegration true를 잡는다`() {
        val files = listOf(
            DiffHunk(path = "desktop/electron/main.js", staged = false, additions = 1, deletions = 0, patch = "+nodeIntegration: true,"),
        )
        assertEquals("electron-insecure-flags", FindingRules.electronInsecureFlags(files)?.ruleId)
    }

    @Test
    fun `contextIsolation true는 안 걸린다`() {
        val files = listOf(
            DiffHunk(path = "desktop/electron/main.js", staged = false, additions = 1, deletions = 0, patch = "+contextIsolation: true,"),
        )
        assertEquals(null, FindingRules.electronInsecureFlags(files))
    }

    @Test
    fun `문자열 결합 exec를 잡는다`() {
        val files = listOf(
            DiffHunk(path = "backend/Tool.kt", staged = false, additions = 1, deletions = 0, patch = "+exec(\"rm -rf \${userInput}\")"),
        )
        assertEquals("eval-or-exec", FindingRules.evalOrExec(files)?.ruleId)
    }

    @Test
    fun `상수 문자열 exec는 안 걸린다`() {
        val files = listOf(
            DiffHunk(path = "backend/Tool.kt", staged = false, additions = 1, deletions = 0, patch = "+exec(\"git status\")"),
        )
        assertEquals(null, FindingRules.evalOrExec(files))
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./gradlew test --tests "com.jongheecode.portfolio.finding.FindingRulesTest"`
Expected: FAIL — `DiffSizeGuard`/`FindingRules` unresolved reference (they don't exist yet).

- [ ] **Step 3: Write `DiffSizeGuard`**

```kotlin
package com.jongheecode.portfolio.finding

import com.jongheecode.portfolio.git.DiffHunk

object DiffSizeGuard {
    private val EXCLUDED_PATTERNS = listOf(
        Regex("""(^|/)package-lock\.json$"""),
        Regex("""(^|/)yarn\.lock$"""),
        Regex("""(^|/)pnpm-lock\.yaml$"""),
        Regex("""(^|/)(build|dist|node_modules|\.gradle)/"""),
    )
    private const val MAX_PATCH_CHARS = 20_000

    fun filter(files: List<DiffHunk>): List<DiffHunk> =
        files.filter { file ->
            EXCLUDED_PATTERNS.none { it.containsMatchIn(file.path) } && file.patch.length <= MAX_PATCH_CHARS
        }
}
```

- [ ] **Step 4: Write `FindingRules` (tier-1 rules only for now)**

```kotlin
package com.jongheecode.portfolio.finding

import com.jongheecode.portfolio.git.DiffHunk

object FindingRules {
    enum class FindingTier { SECURITY, STRUCTURE, BACKLOG }

    data class Candidate(
        val ruleId: String,
        val category: String,
        val tier: FindingTier?,
        val message: String,
        val evidence: String?,
        val filePath: String? = null,
    )

    private fun addedLines(file: DiffHunk): Sequence<String> =
        file.patch.lineSequence().filter { it.startsWith("+") && !it.startsWith("+++") }

    fun ipcHandlerMissingValidation(files: List<DiffHunk>): Candidate? {
        val handlerPattern = Regex("""ipcMain\.(on|handle)\s*\(""")
        val hit = files.firstOrNull { file ->
            val added = addedLines(file).toList()
            val hasNewHandler = added.any { handlerPattern.containsMatchIn(it) }
            val hasCheck = added.any { it.contains("typeof") || it.contains("length") || it.contains("JSON.parse") }
            hasNewHandler && !hasCheck
        } ?: return null
        return Candidate(
            ruleId = "ipc-handler-missing-validation",
            category = "보안",
            tier = FindingTier.SECURITY,
            message = "IPC 크기/타입 검증 확인해볼 것",
            evidence = "${hit.path} — 새 ipcMain 핸들러가 추가됐는데 근처에 길이/타입 체크가 안 보여요.",
            filePath = hit.path,
        )
    }

    fun corsWildcard(files: List<DiffHunk>): Candidate? {
        val pattern = Regex("""allowedOrigins?\s*=.*\*|@CrossOrigin\(\s*"\*"\s*\)""")
        val hit = files.firstOrNull { file -> addedLines(file).any { pattern.containsMatchIn(it) } } ?: return null
        return Candidate(
            ruleId = "cors-wildcard",
            category = "보안",
            tier = FindingTier.SECURITY,
            message = "CORS 와일드카드 확인해볼 것",
            evidence = "${hit.path} — 오리진에 와일드카드(*)가 추가된 것 같아요.",
            filePath = hit.path,
        )
    }

    fun electronInsecureFlags(files: List<DiffHunk>): Candidate? {
        val patterns = listOf(
            Regex("""nodeIntegration\s*:\s*true"""),
            Regex("""contextIsolation\s*:\s*false"""),
            Regex("""webSecurity\s*:\s*false"""),
        )
        val hit = files.firstOrNull { file -> addedLines(file).any { line -> patterns.any { it.containsMatchIn(line) } } } ?: return null
        return Candidate(
            ruleId = "electron-insecure-flags",
            category = "보안",
            tier = FindingTier.SECURITY,
            message = "Electron 보안 플래그 확인해볼 것",
            evidence = "${hit.path} — nodeIntegration/contextIsolation/webSecurity 플래그가 위험한 값으로 바뀐 것 같아요.",
            filePath = hit.path,
        )
    }

    fun evalOrExec(files: List<DiffHunk>): Candidate? {
        val evalPattern = Regex("""\beval\s*\(""")
        val execPattern = Regex("""exec\s*\(\s*["'`][^"'`]*\$\{|exec\s*\(\s*["'`][^"'`]*"\s*\+""")
        val hit = files.firstOrNull { file ->
            addedLines(file).any { line -> evalPattern.containsMatchIn(line) || execPattern.containsMatchIn(line) }
        } ?: return null
        return Candidate(
            ruleId = "eval-or-exec",
            category = "보안",
            tier = FindingTier.SECURITY,
            message = "eval/exec 사용 확인해볼 것",
            evidence = "${hit.path} — eval( 또는 문자열을 이어붙인 exec(가 추가된 것 같아요.",
            filePath = hit.path,
        )
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && ./gradlew test --tests "com.jongheecode.portfolio.finding.FindingRulesTest"`
Expected: PASS (all 9 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/finding/DiffSizeGuard.kt backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingRules.kt backend/src/test/kotlin/com/jongheecode/portfolio/finding/FindingRulesTest.kt
git commit -m "1등급 보안 발견 규칙과 diff 크기 가드를 추가했다"
```

---

## Task 3: Tier-2 structural rules

**Files:**
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingRules.kt`
- Modify: `backend/src/test/kotlin/com/jongheecode/portfolio/finding/FindingRulesTest.kt`

**Interfaces:**
- Consumes: `WipFile(tag: String, path: String, additions: Int, deletions: Int)` from `com.jongheecode.portfolio.git`.
- Produces: `FindingRules.commitSplitSuggestion(wipFiles: List<WipFile>): Candidate?`, `FindingRules.largeCommit(additions: Int, deletions: Int): Candidate?`.

- [ ] **Step 1: Write the failing tests**

Append to `FindingRulesTest.kt`:

```kotlin
    @Test
    fun `루트 직속 파일만 걸치면 커밋 분리를 제안 안 한다`() {
        val files = listOf(
            com.jongheecode.portfolio.git.WipFile("M", "docker-compose.yml", 2, 1),
            com.jongheecode.portfolio.git.WipFile("M", "README.md", 3, 0),
            com.jongheecode.portfolio.git.WipFile("M", "backend/build.gradle.kts", 1, 1),
        )
        assertEquals(null, FindingRules.commitSplitSuggestion(files))
    }

    @Test
    fun `두 폴더가 걸치지만 변경량이 작으면 제안 안 한다`() {
        val files = listOf(
            com.jongheecode.portfolio.git.WipFile("M", "backend/config/SecurityConfig.kt", 1, 1),
            com.jongheecode.portfolio.git.WipFile("M", "desktop/electron/main.js", 1, 1),
        )
        assertEquals(null, FindingRules.commitSplitSuggestion(files))
    }

    @Test
    fun `두 폴더가 걸치고 변경량도 크면 제안한다`() {
        val files = listOf(
            com.jongheecode.portfolio.git.WipFile("M", "backend/config/SecurityConfig.kt", 40, 5),
            com.jongheecode.portfolio.git.WipFile("M", "desktop/electron/main.js", 20, 3),
        )
        val hit = FindingRules.commitSplitSuggestion(files)
        assertEquals("commit-split-suggestion", hit?.ruleId)
        assertEquals(FindingRules.FindingTier.STRUCTURE, hit?.tier)
    }

    @Test
    fun `desktop 폴더 안에서만 여러 파일 걸치는 건 제안 안 한다`() {
        val files = listOf(
            com.jongheecode.portfolio.git.WipFile("M", "desktop/electron/main.js", 60, 5),
            com.jongheecode.portfolio.git.WipFile("M", "desktop/electron/preload.js", 20, 2),
            com.jongheecode.portfolio.git.WipFile("M", "desktop/src/OverlayWidget.tsx", 30, 4),
        )
        assertEquals(null, FindingRules.commitSplitSuggestion(files))
    }

    @Test
    fun `200줄 넘는 커밋을 잡는다`() {
        val hit = FindingRules.largeCommit(additions = 160, deletions = 45)
        assertEquals("large-commit", hit?.ruleId)
        assertEquals(FindingRules.FindingTier.STRUCTURE, hit?.tier)
    }

    @Test
    fun `200줄 이하는 안 걸린다`() {
        assertEquals(null, FindingRules.largeCommit(additions = 100, deletions = 50))
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./gradlew test --tests "com.jongheecode.portfolio.finding.FindingRulesTest"`
Expected: FAIL — `commitSplitSuggestion`/`largeCommit` unresolved reference.

- [ ] **Step 3: Implement the rules**

Add to `FindingRules` object (inside the `object FindingRules { ... }` block, alongside the tier-1 functions):

```kotlin
    private val ROOT_LEVEL_FILES = setOf(
        "docker-compose.yml", "README.md", ".gitignore", "AGENTS.md",
    )

    private fun topLevelFolders(paths: List<String>): Set<String> =
        paths.mapNotNull { raw ->
            val path = raw.trim()
            if (path in ROOT_LEVEL_FILES) return@mapNotNull null
            val slash = path.indexOf('/')
            if (slash < 0) return@mapNotNull null
            path.substring(0, slash)
        }.toSet()

    fun commitSplitSuggestion(wipFiles: List<com.jongheecode.portfolio.git.WipFile>): Candidate? {
        val folders = topLevelFolders(wipFiles.map { it.path })
        if (folders.size < 2) return null
        val totalLines = wipFiles.sumOf { it.additions + it.deletions }
        if (totalLines < 50 && wipFiles.size < 4) return null
        val sortedFolders = folders.sorted()
        val evidence = sortedFolders.joinToString("; ") { folder ->
            val filesInFolder = wipFiles.filter { it.path.startsWith("$folder/") }.joinToString(", ") { it.path }
            "$folder: $filesInFolder"
        }
        return Candidate(
            ruleId = "commit-split-suggestion",
            category = "구조",
            tier = FindingTier.STRUCTURE,
            message = "${sortedFolders.joinToString("·")}이 같이 바뀜 (의도한 거면 넘어가도 됨)",
            evidence = evidence,
        )
    }

    fun largeCommit(additions: Int, deletions: Int): Candidate? {
        val total = additions + deletions
        if (total < 200) return null
        return Candidate(
            ruleId = "large-commit",
            category = "구조",
            tier = FindingTier.STRUCTURE,
            message = "한 커밋에 ${total}줄 — 200줄 넘음",
            evidence = "+$additions -$deletions",
        )
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && ./gradlew test --tests "com.jongheecode.portfolio.finding.FindingRulesTest"`
Expected: PASS (all 15 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingRules.kt backend/src/test/kotlin/com/jongheecode/portfolio/finding/FindingRulesTest.kt
git commit -m "2등급 구조 발견 규칙(커밋 분리 제안, 200줄 초과)을 추가했다"
```

---

## Task 4: Trend-only rules

**Files:**
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingRules.kt`
- Modify: `backend/src/test/kotlin/com/jongheecode/portfolio/finding/FindingRulesTest.kt`

**Interfaces:**
- Produces: `FindingRules.weakCommitMessage(message: String): Candidate?` (tier `null`, category `"기록"`), `FindingRules.noTestTouched(wipFiles: List<WipFile>): Candidate?` (tier `null`, category `"테스트"`), `FindingRules.newTodoCount(files: List<DiffHunk>): Int`.

- [ ] **Step 1: Write the failing tests**

Append to `FindingRulesTest.kt`:

```kotlin
    @Test
    fun `짧은 커밋 메시지를 잡는다`() {
        val hit = FindingRules.weakCommitMessage("fix")
        assertEquals("weak-commit-message", hit?.ruleId)
        assertEquals(null, hit?.tier)
    }

    @Test
    fun `설명이 담긴 메시지는 안 걸린다`() {
        assertEquals(null, FindingRules.weakCommitMessage("오버레이 창 상태를 3개로 정리 + 클램프 도입"))
    }

    @Test
    fun `소스만 바뀌고 테스트가 없으면 잡는다`() {
        val files = listOf(com.jongheecode.portfolio.git.WipFile("M", "backend/src/main/kotlin/Foo.kt", 30, 2))
        assertEquals("no-test-touched", FindingRules.noTestTouched(files)?.ruleId)
    }

    @Test
    fun `테스트 파일도 같이 바뀌면 안 걸린다`() {
        val files = listOf(
            com.jongheecode.portfolio.git.WipFile("M", "backend/src/main/kotlin/Foo.kt", 30, 2),
            com.jongheecode.portfolio.git.WipFile("M", "backend/src/test/kotlin/FooTest.kt", 10, 0),
        )
        assertEquals(null, FindingRules.noTestTouched(files))
    }

    @Test
    fun `소스 변경이 없으면 안 걸린다`() {
        val files = listOf(com.jongheecode.portfolio.git.WipFile("M", "docs/notes.md", 5, 0))
        assertEquals(null, FindingRules.noTestTouched(files))
    }

    @Test
    fun `추가된 TODO 줄 수를 센다`() {
        val files = listOf(
            DiffHunk(path = "a.kt", staged = false, additions = 2, deletions = 0, patch = "+// TODO: 나중에\n+val x = 1\n+// TODO: 이것도"),
            DiffHunk(path = "b.kt", staged = false, additions = 1, deletions = 0, patch = "-// TODO: 지워짐"),
        )
        assertEquals(2, FindingRules.newTodoCount(files))
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./gradlew test --tests "com.jongheecode.portfolio.finding.FindingRulesTest"`
Expected: FAIL — unresolved references.

- [ ] **Step 3: Implement the rules**

Add to `FindingRules` object:

```kotlin
    private val WEAK_MESSAGES = setOf("fix", "wip", "update", "temp", "fix bug", "임시", "수정")

    fun weakCommitMessage(message: String): Candidate? {
        val firstLine = message.lineSequence().first().trim()
        val weak = firstLine.length < 8 || firstLine.lowercase() in WEAK_MESSAGES
        if (!weak) return null
        return Candidate(
            ruleId = "weak-commit-message",
            category = "기록",
            tier = null,
            message = "커밋 메시지가 짧음: \"$firstLine\"",
            evidence = null,
        )
    }

    private fun isSourceFile(path: String) =
        path.endsWith(".kt") || path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".js")

    private fun isTestFile(path: String) =
        path.contains("test", ignoreCase = true) || path.contains(".spec.")

    fun noTestTouched(wipFiles: List<com.jongheecode.portfolio.git.WipFile>): Candidate? {
        val sourceTouched = wipFiles.any { isSourceFile(it.path) }
        val testTouched = wipFiles.any { isTestFile(it.path) }
        if (!sourceTouched || testTouched) return null
        return Candidate(
            ruleId = "no-test-touched",
            category = "테스트",
            tier = null,
            message = "소스만 바뀌고 테스트 파일 변경 없음",
            evidence = null,
        )
    }

    fun newTodoCount(files: List<DiffHunk>): Int =
        files.sumOf { file -> addedLines(file).count { it.contains("TODO") } }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && ./gradlew test --tests "com.jongheecode.portfolio.finding.FindingRulesTest"`
Expected: PASS (all 21 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingRules.kt backend/src/test/kotlin/com/jongheecode/portfolio/finding/FindingRulesTest.kt
git commit -m "추세 전용 발견 규칙(짧은 메시지, 테스트 미터치, TODO 카운트)을 추가했다"
```

---

## Task 5: Priority selection

**Files:**
- Create: `backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingPriority.kt`
- Create: `backend/src/test/kotlin/com/jongheecode/portfolio/finding/FindingPriorityTest.kt`

**Interfaces:**
- Consumes: `FindingRules.Candidate`, `FindingRules.FindingTier`.
- Produces: `FindingPriority.PersistedCandidate(id: Long, tier: FindingRules.FindingTier, message: String, evidence: String?, createdAt: Instant)`, `FindingPriority.NextAction(message: String, tier: String, evidence: String?, findingId: Long?)`, `FindingPriority.pick(liveCandidates: List<Candidate>, persistedOpen: List<PersistedCandidate>, unpushedCount: Int, branchCommitCount: Int, uncommittedFileCount: Int): NextAction`.

- [ ] **Step 1: Write the failing tests**

```kotlin
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./gradlew test --tests "com.jongheecode.portfolio.finding.FindingPriorityTest"`
Expected: FAIL — `FindingPriority` doesn't exist yet.

- [ ] **Step 3: Implement `FindingPriority`**

```kotlin
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && ./gradlew test --tests "com.jongheecode.portfolio.finding.FindingPriorityTest"`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingPriority.kt backend/src/test/kotlin/com/jongheecode/portfolio/finding/FindingPriorityTest.kt
git commit -m "발견 우선순위 선택 로직을 추가했다"
```

---

## Task 6: `next-action` endpoint

**Files:**
- Create: `backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingService.kt`
- Create: `backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingController.kt`
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/finding/Finding.kt` (add `toDto()` + `FindingDto`)

**Interfaces:**
- Consumes: `LocalGitService.list(user): LocalGitResponse` and `LocalGitService.review(user): LocalDiffReview` (both already exist in `com.jongheecode.portfolio.git`), `FindingRepository`, `FindingRules`, `FindingPriority`.
- Produces: `FindingService.nextAction(user: User): FindingPriority.NextAction`, `FindingController` with `GET /api/findings/next-action`.

No new automated test here — this task wires already-tested pure functions (`FindingRules`, `FindingPriority`, both covered in Tasks 2-5) to Spring services that already have no test coverage in this codebase (`LocalGitController`, `WeekController`). Verify manually per project convention.

- [ ] **Step 1: Write `FindingService`**

```kotlin
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
```

- [ ] **Step 2: Add `FindingDto` + `toDto()` to `Finding.kt`**

Append to `backend/src/main/kotlin/com/jongheecode/portfolio/finding/Finding.kt`:

```kotlin
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
```

- [ ] **Step 3: Write `FindingController`**

```kotlin
package com.jongheecode.portfolio.finding

import com.jongheecode.portfolio.user.UserRepository
import com.jongheecode.portfolio.user.currentUser
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/findings")
class FindingController(
    private val findingService: FindingService,
    private val userRepository: UserRepository,
) {
    @GetMapping("/next-action")
    fun nextAction(@AuthenticationPrincipal principal: OAuth2User): NextActionDto =
        findingService.nextAction(userRepository.currentUser(principal)).toDto()
}
```

- [ ] **Step 4: Boot the backend and verify manually**

Run: `cd backend && set -a && . ./.env.local && set +a && ./gradlew bootRun`, then (while logged in via the browser session) `curl -s -b <session-cookie> http://localhost:8080/api/findings/next-action`
Expected: `200 OK` with a JSON body shaped like `{"message":"다 내보냈어요","tier":"CLEAR","evidence":null,"findingId":null}` (or a real finding if the local repo has matching changes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/finding/
git commit -m "GET /api/findings/next-action 엔드포인트를 추가했다"
```

---

## Task 7: Dismiss/mark-used endpoint

**Files:**
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingService.kt`
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingController.kt`

**Interfaces:**
- Produces: `FindingService.updateStatus(user: User, id: Long, status: String): FindingDto`, `PATCH /api/findings/{id}` with body `{"status": "DISMISSED" | "USED_IN_POST"}`.

- [ ] **Step 1: Add `updateStatus` to `FindingService`**

```kotlin
    fun updateStatus(user: User, id: Long, status: String): FindingDto {
        require(status == "DISMISSED" || status == "USED_IN_POST") { "알 수 없는 상태입니다: $status" }
        val finding = findingRepository.findById(id).orElseThrow { NoSuchElementException("발견을 찾을 수 없습니다: $id") }
        require(finding.commit.trackedRepo.user.id == user.id) { "권한이 없습니다" }
        finding.status = status
        return findingRepository.save(finding).toDto()
    }
```

Add the needed import to `FindingService.kt`:

```kotlin
import com.jongheecode.portfolio.user.User
```

(already present from the `nextAction` signature — no change needed if Task 6 already imports it.)

- [ ] **Step 2: Add the endpoint to `FindingController`**

```kotlin
    @org.springframework.web.bind.annotation.PatchMapping("/{id}")
    fun updateStatus(
        @AuthenticationPrincipal principal: OAuth2User,
        @org.springframework.web.bind.annotation.PathVariable id: Long,
        @org.springframework.web.bind.annotation.RequestBody request: UpdateFindingStatusRequest,
    ): FindingDto = findingService.updateStatus(userRepository.currentUser(principal), id, request.status)
```

Add below the controller class:

```kotlin
data class UpdateFindingStatusRequest(val status: String)
```

- [ ] **Step 3: Boot the backend and verify manually**

Run: `curl -s -X PATCH -b <session-cookie> -H "Content-Type: application/json" -d '{"status":"DISMISSED"}' http://localhost:8080/api/findings/1`
Expected: `200 OK` with the updated `FindingDto` showing `"status":"DISMISSED"`. A second call with an id belonging to another user's commit should fail the `require` check (500 with the Korean message, matching this codebase's existing error-handling style in `WeekService`/`LocalGitService`).

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingService.kt backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingController.kt
git commit -m "PATCH /api/findings/{id}로 발견 상태를 바꿀 수 있게 했다"
```

---

## Task 8: Persist findings at commit-sync time

**Files:**
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/commit/CommitSyncService.kt`

**Interfaces:**
- Consumes: `FindingRules.weakCommitMessage(message: String): Candidate?`, `FindingRules.largeCommit(additions: Int, deletions: Int): Candidate?`, `FindingRepository`, `Finding` entity.

No new test — this modifies an existing untested service (`CommitSyncService` has no test file today) by adding calls to already-tested pure functions. Verified manually via the sync flow.

- [ ] **Step 1: Inject `FindingRepository` into `CommitSyncService`**

In `backend/src/main/kotlin/com/jongheecode/portfolio/commit/CommitSyncService.kt`, add the import and constructor parameter:

```kotlin
import com.jongheecode.portfolio.finding.Finding
import com.jongheecode.portfolio.finding.FindingRepository
import com.jongheecode.portfolio.finding.FindingRules
```

```kotlin
@Service
class CommitSyncService(
    private val githubApiClient: GithubApiClient,
    private val commitRecordRepository: CommitRecordRepository,
    private val trackedRepoRepository: TrackedRepoRepository,
    private val findingRepository: FindingRepository,
) {
```

- [ ] **Step 2: Evaluate findings right after a new `CommitRecord` is saved**

In the `sync(...)` method, replace:

```kotlin
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
```

with:

```kotlin
            val saved = commitRecordRepository.save(
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
            evaluatePersistedFindings(saved)
            savedCount++
```

Add the private method to the same class:

```kotlin
    private fun evaluatePersistedFindings(commit: CommitRecord) {
        val candidates = listOfNotNull(
            FindingRules.weakCommitMessage(commit.message),
            FindingRules.largeCommit(commit.additions, commit.deletions),
        )
        for (candidate in candidates) {
            if (findingRepository.existsByCommitAndRuleId(commit, candidate.ruleId)) continue
            findingRepository.save(
                Finding(
                    commit = commit,
                    ruleId = candidate.ruleId,
                    category = candidate.category,
                    tier = candidate.tier?.name,
                    message = candidate.message,
                    evidence = candidate.evidence,
                ),
            )
        }
    }
```

- [ ] **Step 3: Boot the backend and verify manually**

Run the backend, trigger a sync (however the app currently triggers `CommitSyncService.syncAll` — e.g. via the existing `/api/sync` endpoint in `SyncController.kt` or logging in fresh), then check the `findings` table:

Run: `docker exec -it portfolio-postgres psql -U portfolio -d portfolio -c "select rule_id, message, tier from findings limit 10;"`
Expected: rows for any recently-synced commit with a short message or 200+ changed lines.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/commit/CommitSyncService.kt
git commit -m "커밋 동기화 시점에 짧은 메시지/큰 커밋 발견을 저장하게 했다"
```

---

## Task 9: Extend `/api/week` with findings + recurring friction

**Files:**
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/week/WeekDtos.kt`
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/week/WeekService.kt`

**Interfaces:**
- Consumes: `FindingRepository.findByCommitIn(commits: List<CommitRecord>): List<Finding>`, `FindingRepository.countByCommit_TrackedRepo_UserAndRuleIdAndCreatedAtAfter`, `Finding.toDto()`.
- Produces: `WeekCommitDto.findings: List<FindingDto>`, `WeekResponse.recurringFriction: List<RecurringFrictionDto>`.

- [ ] **Step 1: Add `findings` to `WeekCommitDto` and a new `RecurringFrictionDto`**

In `WeekDtos.kt`, modify `WeekCommitDto`:

```kotlin
data class WeekCommitDto(
    val id: Long,
    val sha: String = "",
    val repoName: String,
    val message: String,
    val htmlUrl: String,
    val committedAt: Instant? = null,
    val authorName: String? = null,
    val additions: Int = 0,
    val deletions: Int = 0,
    val isMerge: Boolean = false,
    val isBot: Boolean = false,
    val findings: List<com.jongheecode.portfolio.finding.FindingDto> = emptyList(),
)
```

Add to `WeekResponse`:

```kotlin
data class WeekResponse(
    val weekStart: LocalDate,
    val weekEnd: LocalDate,
    val habits: List<HabitDto>,
    val plans: List<PlanDto>,
    val days: List<WeekDayDto>,
    val pack: WeekPackDto?,
    val weekly: List<WeeklyPointDto> = emptyList(),
    val unwrittenCommitCount: Int = 0,
    val recurringFriction: List<RecurringFrictionDto> = emptyList(),
)

data class RecurringFrictionDto(val ruleId: String, val label: String, val count: Int)
```

Update `CommitRecord.toWeekCommitDto()` to accept findings:

```kotlin
fun CommitRecord.toWeekCommitDto(findings: List<com.jongheecode.portfolio.finding.FindingDto> = emptyList()) = WeekCommitDto(
    id = id,
    sha = sha,
    repoName = trackedRepo.fullName,
    message = firstLine(),
    htmlUrl = htmlUrl,
    committedAt = committedAt,
    authorName = authorName,
    additions = additions,
    deletions = deletions,
    isMerge = isMerge,
    isBot = isBot,
    findings = findings,
)
```

- [ ] **Step 2: Wire findings + recurring friction into `WeekService.buildWeek`**

Add `FindingRepository` to the constructor:

```kotlin
@Service
class WeekService(
    private val clock: Clock,
    private val habitSettingRepository: HabitSettingRepository,
    private val habitCheckRepository: HabitCheckRepository,
    private val planRepository: PlanRepository,
    private val commitRecordRepository: CommitRecordRepository,
    private val blogPostRepository: BlogPostRepository,
    private val findingRepository: com.jongheecode.portfolio.finding.FindingRepository,
) {
```

In `buildWeek`, after `val commits = weekCommits(user, weekStart)`, batch-fetch findings and group by commit id:

```kotlin
        val findingsByCommit = findingRepository.findByCommitIn(commits)
            .groupBy { it.commit.id }
            .mapValues { (_, rows) -> rows.map { it.toDto() } }
```

Change the `days` construction's commit-mapping line from `all.map { it.toWeekCommitDto() }` to:

```kotlin
                commits = all.map { it.toWeekCommitDto(findingsByCommit[it.id] ?: emptyList()) },
```

Add the recurring-friction computation right before the final `WeekResponse(...)` return, and add `recurringFriction = recurringFriction` to that return:

```kotlin
        val since = Instant.now(clock).minus(90, java.time.temporal.ChronoUnit.DAYS)
        val recurringFriction = listOf(
            "weak-commit-message" to "메시지만 보면 뭔지 모름",
            "large-commit" to "한 커밋에 200줄 넘김",
        ).map { (ruleId, label) ->
            RecurringFrictionDto(ruleId, label, findingRepository.countByCommit_TrackedRepo_UserAndRuleIdAndCreatedAtAfter(user, ruleId, since).toInt())
        }
```

```kotlin
        return WeekResponse(
            weekStart = weekStart,
            weekEnd = weekEnd,
            habits = habits,
            plans = plans,
            days = days,
            pack = packEntity?.toPackDto(packCount),
            weekly = weekly,
            unwrittenCommitCount = unwritten,
            recurringFriction = recurringFriction,
        )
```

Add the needed import at the top of `WeekService.kt`:

```kotlin
import com.jongheecode.portfolio.finding.RecurringFrictionDto
```

- [ ] **Step 3: Boot the backend and verify manually**

Run: `curl -s -b <session-cookie> http://localhost:8080/api/week`
Expected: response includes `"recurringFriction":[{"ruleId":"weak-commit-message","label":"메시지만 보면 뭔지 모름","count":N}, ...]` and any commit with a persisted finding shows a non-empty `findings` array.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/week/WeekDtos.kt backend/src/main/kotlin/com/jongheecode/portfolio/week/WeekService.kt
git commit -m "/api/week에 커밋별 발견과 반복 습관 카운터를 추가했다"
```

---

## Task 10: Desktop overlay — replace the load-line pill with the text pill

**Files:**
- Delete: `desktop/src/LoadLinePill.tsx`
- Modify: `desktop/src/overlayData.ts`
- Modify: `desktop/src/useOverlayData.ts`
- Modify: `desktop/src/OverlayWidget.tsx`
- Modify: `desktop/src/OverlayChrome.tsx` (its mini chrome-bar indicator currently imports `LoadLinePill` — this must come out or the build breaks once the file is deleted)
- Modify: `desktop/src/WorkContextPanel.tsx` (drops the `loadLineCounts` computation and the `counts` prop it passes to `OverlayChrome`)

**Interfaces:**
- Consumes: existing `TrayIndicator` (`label`, `dotColor`, `onOpenPopover`, `children` props — already supports a text-pill mode, see `desktop/src/TrayIndicator.tsx`).
- Produces: `NextAction` type and `fetchNextAction()` in `overlayData.ts`; `useOverlayData()` exposes `nextAction: NextAction | null`.

No automated test — this project's Electron/React glue code is manually verified (see `AGENTS.md`'s testing convention). Verify by running `npm run dev` and watching the pill.

- [ ] **Step 1: Add the `NextAction` fetch to `overlayData.ts`**

Add to `backend/../desktop/src/overlayData.ts` (append near the other `fetch*` functions):

```typescript
export interface NextAction {
  message: string
  tier: 'SECURITY' | 'STRUCTURE' | 'BACKLOG' | 'CLEAR'
  evidence: string | null
  findingId: number | null
}

export function fetchNextAction(): Promise<NextAction> {
  return apiFetch<NextAction>('/api/findings/next-action')
}

export function updateFindingStatus(id: number, status: 'DISMISSED' | 'USED_IN_POST'): Promise<unknown> {
  return apiFetch(`/api/findings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
```

- [ ] **Step 2: Poll `next-action` in `useOverlayData.ts`**

In the `State` interface, add:

```typescript
  nextAction: NextAction | null
```

Import it:

```typescript
import { createDraftFromLocal, fetchLocalDiff, fetchLocalGit, fetchMe, fetchNextAction, fetchWeek, formatHm, UnauthorizedError, weekdayLabel, type LocalDiffReview, type Me, type NextAction } from './overlayData'
```

In the initial `useState<State>({...})` object, add `nextAction: null,`.

In the `poll` callback, add the fetch alongside `week`/`local` (change the `Promise.all` line and the two `setState` calls that currently spread `...prev` — both need `nextAction` added):

```typescript
      const [week, local, nextAction] = await Promise.all([fetchWeek(), fetchLocalGit(), fetchNextAction()])
```

Then in both `setState` calls inside `poll` (the `!active` branch and the main branch), add `nextAction,` to the object literal (both currently do `setState((prev) => ({ ...prev, me, loggedOut: false, ... }))` — add `nextAction,` right after `me,` in each).

In the `catch` block's `UnauthorizedError` and generic branches, `nextAction` stays whatever it was in `prev` since those branches use `{ ...prev, ... }` without touching it — no change needed there.

Finally, return `nextAction` from the hook (in the `return { ...state, refresh: poll, createBranchDraft, dismissToast, loadReview }` line — `...state` already includes it since it's part of `State`, no change needed there).

- [ ] **Step 3: Replace `LoadLinePill` usage in `OverlayWidget.tsx`**

Remove the import:

```typescript
import LoadLinePill from './LoadLinePill'
```

Replace the destructured hook result to include `nextAction`:

```typescript
  const { me, loggedOut, connectionOk, hasLocalRepo, data, newCommitTick, toast, review, nextAction, refresh, createBranchDraft, dismissToast, loadReview } =
    useOverlayData()
```

Add a tier-to-color helper near the top of the file (after the existing constants):

```typescript
const TIER_COLOR: Record<string, string> = {
  SECURITY: '#C4693A',
  STRUCTURE: '#6E9CC4',
  BACKLOG: '#8E979C',
  CLEAR: '#7FAE9B',
}
```

Replace the block that currently renders `<LoadLinePill>` inside the `collapsed`/`toast` branch:

```tsx
      return (
        <TrayIndicator
          label={nextAction?.message ?? ''}
          dotColor={TIER_COLOR[nextAction?.tier ?? 'BACKLOG']}
          onOpenPopover={() => setMode('popover')}
        />
      )
```

(This replaces the whole `<TrayIndicator onOpenPopover={...}><LoadLinePill counts={...} /></TrayIndicator>` block — `TrayIndicator` falls back to its `label`/`dotColor` text mode automatically when no `children` are passed, per its existing implementation.)

- [ ] **Step 4: Strip the `LoadLinePill` mini-indicator out of `OverlayChrome.tsx`**

`OverlayChrome.tsx` currently imports `LoadLinePill` to draw a small chrome-bar indicator from a `counts` prop. Remove both:

Remove this import line:

```typescript
import LoadLinePill, { type LoadLineCounts } from './LoadLinePill'
```

Remove `counts` from the props type and function signature:

```typescript
export default function OverlayChrome({
  title,
  onCollapse,
  onHide,
}: {
  title?: string
  onCollapse?: () => void
  onHide?: () => void
}) {
```

Remove the line that renders it:

```tsx
      {counts && <LoadLinePill counts={counts} width={96} height={14.4} showCounts={false} />}
```

- [ ] **Step 5: Drop `loadLineCounts` and the `counts` prop in `WorkContextPanel.tsx`**

Remove the `loadLineCounts` computation:

```typescript
  const loadLineCounts = {
    uncommittedFiles: data.changedFileCount,
    unpushedCommits: data.unpushedCount,
    unwrittenCommits: data.branchCommitCount,
  }
```

And remove `counts={loadLineCounts}` from both `<OverlayChrome ... />` call sites (the `hud` variant and the `popover` variant), so each becomes:

```tsx
        <OverlayChrome title={data.repoName} onCollapse={onCollapse} onHide={onHide} />
```

- [ ] **Step 6: Delete `LoadLinePill.tsx`**

```bash
rm "desktop/src/LoadLinePill.tsx"
```

- [ ] **Step 7: Typecheck and manually verify**

Run: `cd desktop && npx tsc --noEmit -p tsconfig.json`
Expected: no errors (confirms no other file still imports `LoadLinePill`).

Run: `cd desktop && npm run dev`, confirm the collapsed pill now shows a text message from `/api/findings/next-action` instead of the SVG gates, and that the dot color changes when you deliberately create a matching condition (e.g. a large uncommitted diff for the STRUCTURE tier, or nothing changed for CLEAR/sage). Confirm the popover's chrome bar no longer shows the mini load-line strip.

- [ ] **Step 8: Commit**

```bash
git add desktop/src/overlayData.ts desktop/src/useOverlayData.ts desktop/src/OverlayWidget.tsx desktop/src/OverlayChrome.tsx desktop/src/WorkContextPanel.tsx
git rm desktop/src/LoadLinePill.tsx
git commit -m "적재선 알약을 발견 엔진 기반 텍스트 알약으로 교체했다"
```

---

## Task 11: Desktop overlay — finding detail in the popover

**Files:**
- Create: `desktop/src/FindingDetail.tsx`
- Modify: `desktop/src/WorkContextPanel.tsx`

**Interfaces:**
- Consumes: `NextAction` from `overlayData.ts`, `updateFindingStatus(id, status)` from `overlayData.ts`.
- Produces: `FindingDetail` component rendering tier-specific popover content, inserted into `WorkContextPanel`.

- [ ] **Step 1: Write `FindingDetail.tsx`**

```tsx
import { useState } from 'react'
import { updateFindingStatus, type NextAction } from './overlayData'

const SUGGESTED_COMMAND: Record<string, (evidence: string) => string> = {
  STRUCTURE: () => 'git add <파일들> && git commit -m "..."',
}

export default function FindingDetail({ nextAction, onHandled }: { nextAction: NextAction; onHandled: () => void }) {
  const [copied, setCopied] = useState(false)

  if (nextAction.tier === 'CLEAR' || nextAction.tier === 'BACKLOG') return null

  const command = nextAction.tier === 'STRUCTURE' ? SUGGESTED_COMMAND.STRUCTURE(nextAction.evidence ?? '') : null

  async function copyCommand() {
    if (!command) return
    await navigator.clipboard.writeText(command)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  async function markStatus(status: 'DISMISSED' | 'USED_IN_POST') {
    if (nextAction.findingId == null) return
    await updateFindingStatus(nextAction.findingId, status)
    onHandled()
  }

  return (
    <div className="finding-detail">
      {nextAction.evidence && <div className="finding-detail__evidence mono">{nextAction.evidence}</div>}
      {command && (
        <div className="finding-detail__command">
          <code className="mono">{command}</code>
          <button type="button" onClick={() => void copyCommand()}>
            {copied ? '복사됨' : '명령어 복사'}
          </button>
        </div>
      )}
      {nextAction.findingId != null && (
        <div className="finding-detail__actions">
          <button type="button" onClick={() => void markStatus('DISMISSED')}>넘기기</button>
          <button type="button" onClick={() => void markStatus('USED_IN_POST')}>글에 넣었음</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add matching CSS to `desktop/src/styles.css`**

Append:

```css
.finding-detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel2);
}

.finding-detail__evidence {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}

.finding-detail__command {
  display: flex;
  align-items: center;
  gap: 8px;
}

.finding-detail__command code {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text);
}

.finding-detail__command button,
.finding-detail__actions button {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel);
  color: var(--text);
  font-size: 11.5px;
  cursor: pointer;
}

.finding-detail__actions {
  display: flex;
  gap: 8px;
}
```

- [ ] **Step 3: Insert `FindingDetail` into `WorkContextPanel`**

In `desktop/src/WorkContextPanel.tsx`, add `nextAction: NextAction | null` and `onFindingHandled: () => void` to the props type, import `FindingDetail` and `NextAction`:

```typescript
import FindingDetail from './FindingDetail'
import type { NextAction } from './overlayData'
```

This plan does not remove the HUD variant — only the load-line pill is in scope (per the approved spec). Leave `WorkContextPanel`'s existing `variant: 'popover' | 'hud'` branching untouched otherwise. Add to the props destructuring and type:

```typescript
export default function WorkContextPanel({
  data,
  variant,
  review,
  nextAction,
  onFindingHandled,
  onCreateBranchDraft,
  onOpenDashboard,
  onCollapse,
  onHide,
}: {
  data: WorkContextData
  variant: 'popover' | 'hud'
  review: LocalDiffReview | null
  nextAction: NextAction | null
  onFindingHandled: () => void
  onCreateBranchDraft: () => void
  onOpenDashboard: () => void
  onCollapse: () => void
  onHide: () => void
}) {
```

Insert `{nextAction && <FindingDetail nextAction={nextAction} onHandled={onFindingHandled} />}` directly below the `<OverlayChrome title={data.repoName} onCollapse={onCollapse} onHide={onHide} />` line in the `popover` variant's return block (the non-`hud` branch — this is the signature Task 10 left `OverlayChrome` with after removing its `counts` prop).

- [ ] **Step 4: Wire the new props from `OverlayWidget.tsx`**

In `OverlayWidget.tsx`, update the `<WorkContextPanel ... />` call to pass the two new props:

```tsx
    <WorkContextPanel
      data={data}
      variant={mode === 'hud' ? 'hud' : 'popover'}
      review={review}
      nextAction={nextAction}
      onFindingHandled={() => void refresh()}
      onCreateBranchDraft={() => void createBranchDraft()}
      onOpenDashboard={() => window.overlay.openDashboard()}
      onCollapse={() => setMode('collapsed')}
      onHide={() => window.overlay.hide()}
    />
```

- [ ] **Step 5: Typecheck and manually verify**

Run: `cd desktop && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

Run: `npm run dev`, open the popover while a STRUCTURE-tier finding is active (e.g. touch files in two top-level folders with 50+ combined lines), confirm the evidence text and "명령어 복사" button appear and the clipboard actually receives the placeholder command; confirm "넘기기"/"글에 넣었음" only appear when `findingId` is non-null (i.e., for a persisted SECURITY finding, not for a live-only or BACKLOG/CLEAR state).

- [ ] **Step 6: Commit**

```bash
git add desktop/src/FindingDetail.tsx desktop/src/WorkContextPanel.tsx desktop/src/OverlayWidget.tsx desktop/src/styles.css
git commit -m "팝오버에 발견 근거와 명령어 복사·넘기기·글에 넣었음 액션을 추가했다"
```

---

## Task 12: Web dashboard — `/week-review` page

**Files:**
- Create: `frontend/src/pages/WeekReviewPage.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `GET /api/week` (now includes `days[].commits[].findings` and `recurringFriction`, per Task 9).
- Produces: a new route `/week-review`.

No automated test — this project's web frontend pages have no test coverage today (see `frontend/src/pages/*` — none have a matching test file). Verify manually by loading the page in the browser.

- [ ] **Step 1: Write `WeekReviewPage.tsx`**

```tsx
import { useEffect, useState } from 'react'

interface FindingDto {
  id: number
  ruleId: string
  category: string
  tier: string | null
  message: string
  evidence: string | null
  status: string
}

interface WeekCommit {
  id: number
  message: string
  repoName: string
  additions: number
  deletions: number
  findings: FindingDto[]
}

interface WeekDay {
  date: string
  commits: WeekCommit[]
}

interface RecurringFriction {
  ruleId: string
  label: string
  count: number
}

interface WeekResponse {
  days: WeekDay[]
  recurringFriction: RecurringFriction[]
}

export default function WeekReviewPage() {
  const [week, setWeek] = useState<WeekResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/week', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`요청 실패 (${res.status})`)
        return res.json() as Promise<WeekResponse>
      })
      .then(setWeek)
      .catch((err: Error) => setError(err.message))
  }, [])

  if (error) return <div className="week-review__error">{error}</div>
  if (!week) return <div className="week-review__loading">불러오는 중…</div>

  const commitsWithFindings = week.days.flatMap((day) => day.commits.filter((c) => c.findings.length > 0))

  return (
    <div className="week-review">
      <h1>주간 리뷰</h1>

      <section className="week-review__section">
        <h2>계속 걸리는 것</h2>
        <ul className="week-review__friction-list">
          {week.recurringFriction.map((item) => (
            <li key={item.ruleId}>
              <span>{item.label}</span>
              <span className="mono">{item.count}번</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="week-review__section">
        <h2>걸린 커밋</h2>
        {commitsWithFindings.length === 0 && <div className="week-review__empty">이번 주엔 걸린 게 없어요.</div>}
        {commitsWithFindings.map((commit) => (
          <div key={commit.id} className="week-review__commit">
            <div className="week-review__commit-header">
              <span>{commit.message}</span>
              <span className="mono">{commit.repoName}</span>
            </div>
            {commit.findings.map((finding) => (
              <div key={finding.id} className="week-review__finding">
                <span className="week-review__finding-category">{finding.category}</span>
                <span>{finding.message}</span>
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Add the route**

In `frontend/src/App.tsx`, import the page and add the route inside the existing `<Routes>` block, alongside the other authenticated routes:

```tsx
import WeekReviewPage from './pages/WeekReviewPage'
```

```tsx
            <Route path="/week-review" element={<WeekReviewPage />} />
```

- [ ] **Step 3: Add minimal styles**

Append to `frontend/src/theme.css` (or the stylesheet the other pages import — match whichever file `DashboardPage.tsx` currently imports for its own classes):

```css
.week-review { padding: 24px; display: flex; flex-direction: column; gap: 24px; }
.week-review__section { display: flex; flex-direction: column; gap: 12px; }
.week-review__friction-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.week-review__friction-list li { display: flex; justify-content: space-between; }
.week-review__commit { border: 1px solid var(--border, #262B2F); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.week-review__commit-header { display: flex; justify-content: space-between; }
.week-review__finding { display: flex; gap: 8px; font-size: 13px; }
.week-review__finding-category { font-weight: 600; }
```

- [ ] **Step 4: Manually verify**

Run: `cd frontend && npm run dev`, log in, navigate to `http://localhost:5173/week-review`.
Expected: the page loads without console errors, shows the recurring-friction counters (zeros are fine if no findings exist yet), and lists any commit that has a persisted finding.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/WeekReviewPage.tsx frontend/src/App.tsx frontend/src/theme.css
git commit -m "/week-review 페이지를 추가했다"
```

---

## Task 13: Web dashboard — "지금 만지는 중" live WIP panel

The spec's 3a section calls for a live panel that reuses the structural rule against the *current* uncommitted diff (not history) — e.g. today's "backend·desktop이 같이 바뀜" suggestion. Task 9's `/api/week` only carries **persisted** findings (tied to synced commits), and Task 6's `FindingService.evaluateLive` is private and only wired into `next-action`'s single pick. This task exposes the full live candidate list (including the trend-only `no-test-touched`/`new-todo-count` rules from Task 4, which were tested but never actually wired into evaluation) so the web page can show all of them, not just the one picked for the pill.

**Files:**
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingService.kt`
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingController.kt`
- Modify: `backend/src/main/kotlin/com/jongheecode/portfolio/finding/Finding.kt` (add `LiveFindingDto`)
- Modify: `frontend/src/pages/WeekReviewPage.tsx`

**Interfaces:**
- Produces: `FindingService.liveFindings(user: User): List<FindingRules.Candidate>`, `LiveFindingDto(ruleId: String, category: String, tier: String?, message: String, evidence: String?)`, `GET /api/findings/live`.

- [ ] **Step 1: Wire the trend-only rules into `evaluateLive` and add a public `liveFindings` method**

In `FindingService.kt`, add `noTestTouched` and `newTodoCount` to the `checks` list inside `evaluateLive` (the list currently has 6 entries from Task 6 — add 2 more):

```kotlin
            { FindingRules.noTestTouched(wipFiles) },
```

`newTodoCount` returns an `Int`, not a `Candidate?`, so it needs its own branch rather than joining the `checks` list — add this right after the `for (check in checks) { ... }` loop in `evaluateLive`, before `return results`:

```kotlin
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
```

Add the public method (the class already has `evaluateLive` and `localGitService` from Task 6 — this just exposes the same computation for callers other than `nextAction`):

```kotlin
    fun liveFindings(user: User): List<FindingRules.Candidate> {
        val active = localGitService.list(user).active
        return if (active != null && active.ok) evaluateLive(user, active) else emptyList()
    }
```

- [ ] **Step 2: Add `LiveFindingDto` to `Finding.kt`**

Append:

```kotlin
data class LiveFindingDto(
    val ruleId: String,
    val category: String,
    val tier: String?,
    val message: String,
    val evidence: String?,
)

fun FindingRules.Candidate.toLiveDto() = LiveFindingDto(ruleId, category, tier?.name, message, evidence)
```

- [ ] **Step 3: Add the endpoint**

In `FindingController.kt`:

```kotlin
    @GetMapping("/live")
    fun live(@AuthenticationPrincipal principal: OAuth2User): List<LiveFindingDto> =
        findingService.liveFindings(userRepository.currentUser(principal)).map { it.toLiveDto() }
```

- [ ] **Step 4: Boot the backend and verify manually**

Run: `curl -s -b <session-cookie> http://localhost:8080/api/findings/live`
Expected: a JSON array; empty `[]` when the working tree is clean, populated when a matching condition is created (e.g. touch files in two top-level folders with 50+ combined lines to trigger `commit-split-suggestion`).

- [ ] **Step 5: Add the WIP panel to `WeekReviewPage.tsx`**

Add a new interface and state:

```typescript
interface LiveFinding {
  ruleId: string
  category: string
  tier: string | null
  message: string
  evidence: string | null
}
```

```typescript
  const [live, setLive] = useState<LiveFinding[]>([])
```

Add a second fetch inside the existing `useEffect` (change it to fetch both in parallel):

```typescript
  useEffect(() => {
    Promise.all([
      fetch('/api/week', { credentials: 'include' }).then((res) => {
        if (!res.ok) throw new Error(`요청 실패 (${res.status})`)
        return res.json() as Promise<WeekResponse>
      }),
      fetch('/api/findings/live', { credentials: 'include' }).then((res) => {
        if (!res.ok) throw new Error(`요청 실패 (${res.status})`)
        return res.json() as Promise<LiveFinding[]>
      }),
    ])
      .then(([weekRes, liveRes]) => {
        setWeek(weekRes)
        setLive(liveRes)
      })
      .catch((err: Error) => setError(err.message))
  }, [])
```

Insert a new section right after the opening `<h1>주간 리뷰</h1>` (before the "계속 걸리는 것" section):

```tsx
      <section className="week-review__section">
        <h2>지금 만지는 중</h2>
        {live.length === 0 && <div className="week-review__empty">지금 걸리는 게 없어요.</div>}
        {live.map((finding) => (
          <div key={finding.ruleId} className="week-review__finding">
            <span className="week-review__finding-category">{finding.category}</span>
            <span>{finding.message}</span>
          </div>
        ))}
      </section>
```

- [ ] **Step 6: Manually verify**

Run: `cd frontend && npm run dev`, navigate to `/week-review` with a local repo that has uncommitted changes spanning two top-level folders (50+ lines).
Expected: "지금 만지는 중" shows the commit-split suggestion; with a clean working tree it shows "지금 걸리는 게 없어요."

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingService.kt backend/src/main/kotlin/com/jongheecode/portfolio/finding/FindingController.kt backend/src/main/kotlin/com/jongheecode/portfolio/finding/Finding.kt frontend/src/pages/WeekReviewPage.tsx
git commit -m "GET /api/findings/live와 '지금 만지는 중' 패널을 추가했다"
```
