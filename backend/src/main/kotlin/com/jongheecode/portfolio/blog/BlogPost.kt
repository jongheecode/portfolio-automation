package com.jongheecode.portfolio.blog

import com.jongheecode.portfolio.user.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.Lob
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "blog_posts")
class BlogPost(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,

    @Column(nullable = false, length = 300)
    var title: String,

    @Lob
    @Column(nullable = false)
    var content: String,

    @Column(nullable = false)
    var published: Boolean = false,

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),
)
