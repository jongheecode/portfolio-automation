package com.jongheecode.portfolio.desktop

import org.springframework.stereotype.Service
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.nio.file.Path
import java.util.concurrent.TimeUnit

@Service
class OverlayProcessService {
    @Volatile
    private var started: Process? = null

    fun status(): OverlayProcessStatus = OverlayProcessStatus(running = isRunning())

    @Synchronized
    fun start(): OverlayProcessStatus {
        if (isRunning()) return OverlayProcessStatus(true)
        val desktop = desktopDir()
        val npm = if (windows()) "npm.cmd" else "npm"
        val process = ProcessBuilder(npm, "run", "dev")
            .directory(desktop.toFile())
            .redirectErrorStream(true)
            .start()
        started = process
        waitUntil(timeoutMs = 8_000) { isRunning() }
        return OverlayProcessStatus(running = isRunning())
    }

    @Synchronized
    fun stop(): OverlayProcessStatus {
        started?.destroyForcibly()
        started = null
        killDesktopProcesses()
        waitUntil(timeoutMs = 3_000) { !isRunning() }
        return OverlayProcessStatus(running = isRunning())
    }

    private fun isRunning(): Boolean = started?.isAlive == true || portOpen(5174)

    private fun desktopDir(): Path {
        val cwd = Path.of(System.getProperty("user.dir")).toAbsolutePath()
        val root = if (cwd.fileName.toString() == "backend") cwd.parent else cwd
        return root.resolve("desktop")
    }

    private fun portOpen(port: Int): Boolean =
        listOf("127.0.0.1", "localhost").any { host ->
            try {
                Socket().use { socket ->
                    socket.connect(InetSocketAddress(InetAddress.getByName(host), port), 400)
                }
                true
            } catch (_: Exception) {
                false
            }
        }

    private fun killDesktopProcesses() {
        val desktop = desktopDir().toString().replace("\\", "\\\\")
        if (windows()) {
            val script = """
                Get-NetTCPConnection -LocalPort 5174 -State Listen -ErrorAction SilentlyContinue |
                  ForEach-Object { Stop-Process -Id ${'$'}_.OwningProcess -Force -ErrorAction SilentlyContinue }
                Get-CimInstance Win32_Process |
                  Where-Object { ${'$'}_.CommandLine -and ${'$'}_.CommandLine -match '$desktop' } |
                  ForEach-Object { Stop-Process -Id ${'$'}_.ProcessId -Force -ErrorAction SilentlyContinue }
            """.trimIndent()
            ProcessBuilder("powershell", "-NoProfile", "-Command", script).start().waitFor(8, TimeUnit.SECONDS)
        } else {
            ProcessBuilder("pkill", "-f", desktop).start().waitFor(5, TimeUnit.SECONDS)
        }
    }

    private fun waitUntil(timeoutMs: Long, condition: () -> Boolean) {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (condition()) return
            Thread.sleep(200)
        }
    }

    private fun windows(): Boolean = System.getProperty("os.name").lowercase().contains("win")
}

data class OverlayProcessStatus(val running: Boolean)
