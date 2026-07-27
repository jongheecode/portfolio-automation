package com.jongheecode.portfolio.commit

import com.jongheecode.portfolio.blog.BlogPost
import com.jongheecode.portfolio.repo.TrackedRepo
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
    name = "commit_records",
    uniqueConstraints = [UniqueConstraint(columnNames = ["tracked_repo_id", "sha"])],
)
class CommitRecord(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tracked_repo_id", nullable = false)
    val trackedRepo: TrackedRepo,

    @Column(nullable = false)
    val sha: String,

    @Column(nullable = false, length = 2000)
    val message: String,

    @Column(nullable = false)
    val authorName: String,

    @Column(nullable = false)
    val committedAt: Instant,

    @Column(nullable = false)
    val htmlUrl: String,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "blog_post_id")
    var blogPost: BlogPost? = null,

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),
)
