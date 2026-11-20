const { app, BrowserWindow, ipcMain, globalShortcut, screen, shell, Menu, Tray, session } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

// 접힌 상태는 발견 엔진 텍스트 알약(TrayIndicator: 점 + 한 줄 메시지 + hide 버튼) 하나라 폭 284로 고정한다.
const COLLAPSED = { width: 284, height: 44 }
const TOAST = { width: 320, height: 96 }
const POPOVER = { width: 380, height: 560 }
const HUD = { width: 960, height: 640 }
const POSITION_FILE = path.join(app.getPath('userData'), 'window-position.json')
const COOKIE_FILE = path.join(app.getPath('userData'), 'session-cookies.json')

let mainWindow = null
let dragStart = null
let loginWindow = null
let tray = null
let currentMode = 'collapsed'

function loadCollapsedPosition() {
  try {
    const raw = fs.readFileSync(POSITION_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return parsed
  } catch {
    // 파일 없음/손상 — 기본 위치 사용
  }
  const work = screen.getPrimaryDisplay().workArea
  return { x: work.x + work.width - COLLAPSED.width - 24, y: work.y + 24 }
}

function clampToWorkArea(position, size = COLLAPSED) {
  const work = screen.getPrimaryDisplay().workArea
  const x = Math.min(Math.max(position.x, work.x), work.x + work.width - size.width)
  const y = Math.min(Math.max(position.y, work.y), work.y + work.height - size.height)
  return { x, y }
}

function saveCollapsedPosition(position) {
  fs.writeFileSync(POSITION_FILE, JSON.stringify(position))
}

async function persistLocalhostCookies() {
  const cookies = await session.defaultSession.cookies.get({ domain: 'localhost' })
  fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies))
}

async function restoreLocalhostCookies() {
  try {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'))
    if (!Array.isArray(cookies)) return
    for (const cookie of cookies) {
      await session.defaultSession.cookies.set({
        url: `http://localhost${cookie.path || '/'}`,
        name: cookie.name,
        value: cookie.value,
        path: cookie.path || '/',
        httpOnly: Boolean(cookie.httpOnly),
        secure: false,
        sameSite: 'lax',
        expirationDate: cookie.expirationDate || Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      })
    }
  } catch {
    // 저장된 쿠키 없음
  }
}

function boundsForMode(mode) {
  const work = screen.getPrimaryDisplay().workArea
  if (mode === 'hud') {
    return {
      width: HUD.width,
      height: HUD.height,
      x: Math.round(work.x + (work.width - HUD.width) / 2),
      y: Math.round(work.y + (work.height - HUD.height) / 2),
    }
  }
  if (mode === 'toast') {
    const [x, y] = mainWindow.getPosition()
    return { width: TOAST.width, height: TOAST.height, x, y }
  }
  if (mode === 'popover') {
    const [x, y] = mainWindow.getPosition()
    return { width: POPOVER.width, height: POPOVER.height, x, y }
  }
  const { x, y } = clampToWorkArea(loadCollapsedPosition())
  return { width: COLLAPSED.width, height: COLLAPSED.height, x, y }
}

function createWindow() {
  const bounds = boundsForMode('collapsed')
  mainWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  // 'screen-saver' 레벨은 Alt+Tab 전환 UI까지 가릴 정도로 공격적이라, 위젯에 적당한 'floating'으로 낮춘다.
  mainWindow.setAlwaysOnTop(true, 'floating')

  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  if (!devServerUrl) throw new Error('VITE_DEV_SERVER_URL이 없습니다. npm run dev(desktop/scripts/dev.mjs)로 실행하세요.')
  mainWindow.loadURL(devServerUrl)
  mainWindow.show()
}

function createTray() {
  tray = new Tray(path.join(__dirname, '..', 'assets', 'tray.png'))
  tray.setToolTip('Week Pulse 오버레이')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '오버레이 보이기', click: () => showOverlay() },
    { label: '숨기기', click: () => mainWindow?.hide() },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ]))
  tray.on('click', () => {
    if (!mainWindow) return
    if (mainWindow.isVisible()) mainWindow.hide()
    else showOverlay()
  })
}

ipcMain.on('overlay:set-mode', (_event, mode) => {
  if (!mainWindow) return
  currentMode = mode
  mainWindow.setBounds(boundsForMode(mode))
})

ipcMain.on('overlay:drag-start', () => {
  if (!mainWindow) return
  dragStart = { cursor: screen.getCursorScreenPoint(), window: mainWindow.getPosition() }
})

ipcMain.on('overlay:drag-move', () => {
  if (!mainWindow || !dragStart) return
  const cursor = screen.getCursorScreenPoint()
  const dx = cursor.x - dragStart.cursor.x
  const dy = cursor.y - dragStart.cursor.y
  const [width, height] = mainWindow.getSize()
  const { x, y } = clampToWorkArea({ x: dragStart.window[0] + dx, y: dragStart.window[1] + dy }, { width, height })
  mainWindow.setPosition(x, y)
})

ipcMain.on('overlay:drag-end', () => {
  // 팝오버/HUD의 드래그 바로 끌었을 때는 그 위치를 "접힌 알약 위치"로 저장하면 안 된다
  // (다음에 접혔을 때 엉뚱한 자리에 뜨게 됨) — collapsed 모드일 때만 저장한다.
  if (mainWindow && dragStart && currentMode === 'collapsed') {
    const [x, y] = mainWindow.getPosition()
    saveCollapsedPosition({ x, y })
  }
  dragStart = null
})

ipcMain.on('overlay:open-dashboard', () => {
  shell.openExternal('http://localhost:5173/dashboard')
})

ipcMain.on('overlay:open-settings', () => {
  shell.openExternal('http://localhost:5173/settings')
})

ipcMain.on('overlay:hide', () => {
  mainWindow?.hide()
})

ipcMain.on('overlay:quit', () => {
  app.quit()
})

ipcMain.on('overlay:menu', () => {
  if (!mainWindow) return
  Menu.buildFromTemplate([
    { label: '숨기기', click: () => mainWindow.hide() },
    { label: '다시 열기 (Alt+Ctrl+W)', click: () => showOverlay('hud') },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ]).popup({ window: mainWindow })
})

function showOverlay(mode) {
  if (!mainWindow) return
  mainWindow.show()
  mainWindow.setAlwaysOnTop(true, 'floating')
  mainWindow.focus()
  if (mode === 'hud') mainWindow.webContents.send('overlay:force-hud')
}

ipcMain.handle('overlay:open-login', async () => {
  if (loginWindow) {
    loginWindow.focus()
    return
  }
  // parent를 투명 always-on-top 창에 붙이면 리다이렉트가 끊기는 경우가 있어 독립 창으로 연다.
  // Electron 기본 UA는 GitHub/Google이 임베디드 웹뷰로 보고 500을 내는 경우가 있다.
  loginWindow = new BrowserWindow({
    width: 520,
    height: 720,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      session: session.defaultSession,
    },
  })
  loginWindow.webContents.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  )

  const closeAfterFrontendRedirect = (_event, url) => {
    if (url.startsWith('http://localhost:5173')) {
      setTimeout(() => loginWindow?.close(), 400)
    }
  }
  loginWindow.webContents.on('will-redirect', closeAfterFrontendRedirect)
  loginWindow.webContents.on('did-navigate', closeAfterFrontendRedirect)
  loginWindow.webContents.on('did-navigate-in-page', closeAfterFrontendRedirect)
  loginWindow.on('closed', () => {
    loginWindow = null
    void persistLocalhostCookies().finally(() => {
      mainWindow?.webContents.send('overlay:login-complete')
    })
  })

  loginWindow.loadURL('http://localhost:8080/oauth2/authorization/github')
})

app.whenReady().then(async () => {
  await restoreLocalhostCookies()
  createWindow()
  createTray()
  globalShortcut.register('Alt+Control+W', () => {
    showOverlay('hud')
  })
  // 모니터 연결이 바뀌면(특히 외장 모니터를 뺐을 때) 알약이 이제 없는 화면 영역에 남아
  // 안 보일 수 있다 — 작업 영역이 바뀔 때마다 접힌 위치를 다시 클램프한다.
  screen.on('display-metrics-changed', () => {
    if (!mainWindow) return
    const [width, height] = mainWindow.getSize()
    const { x, y } = clampToWorkArea(mainWindow.getPosition(), { width, height })
    mainWindow.setPosition(x, y)
    if (currentMode === 'collapsed') saveCollapsedPosition({ x, y })
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
})
