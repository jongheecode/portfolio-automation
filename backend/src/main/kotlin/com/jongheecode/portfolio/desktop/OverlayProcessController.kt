package com.jongheecode.portfolio.desktop

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/overlay")
class OverlayProcessController(
    private val overlayProcessService: OverlayProcessService,
) {
    @GetMapping
    fun status(): OverlayProcessStatus = overlayProcessService.status()

    @PostMapping("/start")
    fun start(): OverlayProcessStatus = overlayProcessService.start()

    @PostMapping("/stop")
    fun stop(): OverlayProcessStatus = overlayProcessService.stop()
}
