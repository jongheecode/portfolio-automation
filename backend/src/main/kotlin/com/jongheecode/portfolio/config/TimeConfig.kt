package com.jongheecode.portfolio.config

import com.jongheecode.portfolio.week.WeekDates
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Clock

@Configuration
class TimeConfig {
    @Bean
    fun clock(): Clock = Clock.system(WeekDates.ZONE)
}
