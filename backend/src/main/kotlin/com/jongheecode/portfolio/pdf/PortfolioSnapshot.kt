package com.jongheecode.portfolio.pdf

import java.time.Instant

data class PortfolioRepoSummary(
    val fullName: String,
    val description: String?,
    val language: String?,
    val commitCount: Long,
    val htmlUrl: String,
)

data class PortfolioSnapshot(
    val username: String,
    val avatarUrl: String?,
    val generatedAt: Instant,
    val totalRepos: Int,
    val totalCommits: Long,
    val repos: List<PortfolioRepoSummary>,
)
