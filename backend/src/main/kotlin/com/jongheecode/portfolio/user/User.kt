package com.jongheecode.portfolio.user

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "users")
class User(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false, unique = true)
    val githubId: Long,

    @Column(nullable = false)
    var username: String,

    var avatarUrl: String? = null,

    // MVP: 1인 사용 서비스라 GitHub access token을 평문으로 저장.
    // 여러 사용자로 확장하거나 배포 범위를 넓힐 때는 암호화가 필요함.
    @Column(nullable = false, length = 512)
    var accessToken: String,

    var tistoryAccessToken: String? = null,
    var tistoryBlogName: String? = null,

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),
)
