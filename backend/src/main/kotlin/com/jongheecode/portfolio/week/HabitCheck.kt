package com.jongheecode.portfolio.week

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
import jakarta.persistence.UniqueConstraint
import java.time.Instant
import java.time.LocalDate

@Entity
@Table(
    name = "habit_checks",
    uniqueConstraints = [UniqueConstraint(columnNames = ["user_id", "habit_key", "week_start"])],
)
class HabitCheck(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,

    @Column(name = "habit_key", nullable = false, length = 40)
    val habitKey: String,

    @Column(nullable = false)
    val weekStart: LocalDate,

    @Column(nullable = false)
    val checkedAt: Instant = Instant.now(),
)
