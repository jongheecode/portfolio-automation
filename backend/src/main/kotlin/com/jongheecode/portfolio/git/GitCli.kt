package com.jongheecode.portfolio.git

import org.springframework.stereotype.Component
import java.nio.file.Path
import java.util.concurrent.TimeUnit

@Component
class GitCli {
    fun run(repo: Path, vararg args: String): String {
        val process = ProcessBuilder(listOf("git", "-C", repo.toString()) + args)
            .redirectErrorStream(true)
            .start()
        val finished = process.waitFor(12, TimeUnit.SECONDS)
        val output = process.inputStream.bufferedReader().readText()
        if (!finished) {
            process.destroyForcibly()
            error("git 명령이 시간 초과되었습니다")
        }
        if (process.exitValue() != 0 && output.isBlank()) {
            error(output.ifBlank { "git 명령이 실패했습니다" })
        }
        return output
    }

    fun runOrEmpty(repo: Path, vararg args: String): String {
        return try {
            val process = ProcessBuilder(listOf("git", "-C", repo.toString()) + args)
                .redirectErrorStream(true)
                .start()
            val finished = process.waitFor(12, TimeUnit.SECONDS)
            val output = process.inputStream.bufferedReader().readText()
            if (!finished) {
                process.destroyForcibly()
                return ""
            }
            if (process.exitValue() != 0) "" else output
        } catch (_: Exception) {
            ""
        }
    }
}
