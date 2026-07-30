package com.jongheecode.portfolio.blog

import com.jongheecode.portfolio.user.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
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

    // PostgreSQL에서 @Lob 문자열은 Large Object(oid)로 매핑돼 트랜잭션 밖에서 못 읽는 문제가 있어
    // 일반 TEXT 컬럼으로 명시. Postgres TEXT는 길이 제한이 사실상 없어 문제 없음.
    @Column(nullable = false, columnDefinition = "TEXT")
    var content: String,

    @Column(nullable = false)
    var published: Boolean = false,

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),
)
