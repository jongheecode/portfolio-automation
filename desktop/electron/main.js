const { app, BrowserWindow, ipcMain, globalShortcut, screen, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const COLLAPSED = { width: 160, height: 44 }
const POPOVER = { width: 380, height: 560 }
const HUD = { width: 900, height: 600 }
const POSITION_FILE = path.join(app.getPath('userData'), 'window-position.json')

let mainWindow = null
let dragStart = null
let loginWindow = null

function loadCollapsedPosition() {
  try {
    const raw = fs.readFileSync(POSITION_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return parsed
  } catch {
    // 파일 없음/손상 — 기본 위치 사용
  }
  const { width } = screen.getPrimaryDisplay().workAreaSize
  return { x: width - COLLAPSED.width - 24, y: 24 }
}

function saveCollapsedPosition(position) {
  fs.writeFileSync(POSITION_FILE, JSON.stringify(position))
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
  if (mode === 'popover') {
    const [x, y] = mainWindow.getPosition()
    return { width: POPOVER.width, height: POPOVER.height, x, y }
  }
  const { x, y } = loadCollapsedPosition()
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
  mainWindow.setAlwaysOnTop(true, 'screen-saver')

  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  if (!devServerUrl) throw new Error('VITE_DEV_SERVER_URL이 없습니다. npm run dev(desktop/scripts/dev.mjs)로 실행하세요.')
  mainWindow.loadURL(devServerUrl)
}

ipcMain.on('overlay:set-mode', (_event, mode) => {
  if (!mainWindow) return
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
  mainWindow.setPosition(dragStart.window[0] + dx, dragStart.window[1] + dy)
})

ipcMain.on('overlay:drag-end', () => {
  if (mainWindow && dragStart) {
    const [x, y] = mainWindow.getPosition()
    saveCollapsedPosition({ x, y })
  }
  dragStart = null
})

ipcMain.on('overlay:open-dashboard', () => {
  shell.openExternal('http://localhost:5173/dashboard')
})

ipcMain.handle('overlay:open-login', async () => {
  if (loginWindow) {
    loginWindow.focus()
    return
  }
  loginWindow = new BrowserWindow({
    width: 480,
    height: 640,
    parent: mainWindow ?? undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
  loginWindow.loadURL('http://localhost:8080/oauth2/authorization/github')

  const onNavigate = (_event, url) => {
    if (url.startsWith('http://localhost:5173')) {
      loginWindow?.close()
    }
  }
  loginWindow.webContents.on('did-navigate', onNavigate)
  loginWindow.webContents.on('did-navigate-in-page', onNavigate)
  loginWindow.on('closed', () => {
    loginWindow = null
    mainWindow?.webContents.send('overlay:login-complete')
  })
})

app.whenReady().then(() => {
  createWindow()
  globalShortcut.register('Alt+Control+W', () => {
    mainWindow?.webContents.send('overlay:force-hud')
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
})
