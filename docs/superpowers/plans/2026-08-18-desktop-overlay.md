# 데스크톱 오버레이 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** op.gg 스타일로 다른 창 위에 항상 떠 있는 Electron 데스크톱 오버레이를 만든다. 트레이 인디케이터(항상 표시) → 클릭 시 팝오버, `Alt+Ctrl+W`로 HUD. 둘 다 "지금 이 로컬 브랜치의 작업 상태"(WIP 변경/오늘 커밋/브랜치 초안 제안)를 보여준다.

**Architecture:** 새 독립 패키지 `desktop/`(Electron + Vite + React). 메인 프로세스가 투명/frameless/always-on-top 창을 만들고, `collapsed`/`popover`/`hud` 세 가지 상태에 맞춰 `setBounds()`로 리사이즈한다(클릭 통과 대신 — 트레이 인디케이터는 항상 클릭 가능해야 하므로). 렌더러는 기존 백엔드(`localhost:8080`) REST API를 그대로 폴링한다. 백엔드/프론트엔드 코드는 전혀 건드리지 않는다.

> **개정 (2026-08-18):** Task 1 완료 직후, 사용자가 미리 그려둔 실제 디자인 목업(`Overlay Week Pulse.dc.html`, 2a/2b 섹션)을 확인하고 스펙과 이 계획의 Task 2 이후를 다시 썼다. 최초 설계(고정 창 크기 + 클릭 통과 + 단순 알약/카드)는 트레이 인디케이터가 항상 클릭 가능해야 한다는 실제 요구와 맞지 않아 폐기했다.

**Tech Stack:** Electron, Vite, React 19, TypeScript(렌더러만 — 메인/프리로드는 plain CommonJS JS로 빌드 단계 없이 실행).

**Spec:** `docs/superpowers/specs/2026-08-18-desktop-overlay-design.md`

## Global Constraints

- 창은 상태(`collapsed` 160×44 / `popover` 380×560 / `hud` 900×600)에 따라 `setBounds()`로 리사이즈한다. 사용자가 직접 드래그로 리사이즈하지는 못한다(`resizable: false`).
- 로그인 세션은 Electron 기본 `session`(디스크 영속)을 그대로 쓴다. 별도 세션 파티션이나 토큰 저장소를 만들지 않는다.
- 백엔드 API는 무엇도 변경하지 않는다. 기존 `/api/me`, `/api/week`, `/api/local-git`, `/oauth2/authorization/github`만 호출한다.
- 설치 파일/자동 업데이트/크로스 플랫폼 대응은 이번 범위 밖. `npm run dev`로만 실행한다.
- Electron 글루 코드는 이 프로젝트 관례대로 단위테스트 없이 수동 검증한다.
- 커밋 메시지는 한국어, 짧은 설명 스타일.

---

### Task 1: 패키지 스캐폴드 + 빈 창 실행 확인

**Files:**
- Create: `desktop/package.json`
- Create: `desktop/tsconfig.json`
- Create: `desktop/vite.config.ts`
- Create: `desktop/index.html`
- Create: `desktop/src/main.tsx`
- Create: `desktop/electron/main.js`
- Create: `desktop/electron/preload.js`
- Create: `desktop/scripts/dev.mjs`

**Interfaces:**
- Produces: `npm run dev`(desktop 디렉터리 안에서) 실행 시 Vite dev server(5174) + Electron 창이 함께 뜬다.

- [ ] **Step 1: package.json 작성**

`desktop/package.json`:

```json
{
  "name": "portfolio-overlay",
  "private": true,
  "version": "0.1.0",
  "main": "electron/main.js",
  "scripts": {
    "dev": "node scripts/dev.mjs"
  },
  "dependencies": {
    "react": "^19.2.7",
    "react-dom": "^19.2.7"
  },
  "devDependencies": {
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.3",
    "electron": "^43.4.0",
    "typescript": "~6.0.2",
    "vite": "^8.1.1"
  }
}
```

- [ ] **Step 2: tsconfig.json 작성**

`desktop/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: vite.config.ts 작성**

`desktop/vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
  },
})
```

- [ ] **Step 4: index.html 작성**

`desktop/index.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Overlay</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: 렌더러 진입점(임시 Hello) 작성**

`desktop/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>Hello Overlay</div>
  </StrictMode>,
)
```

- [ ] **Step 6: Electron 메인 프로세스(최소 버전) 작성**

`desktop/electron/main.js`:

```js
const { app, BrowserWindow } = require('electron')

function createWindow() {
  const win = new BrowserWindow({
    width: 300,
    height: 170,
    webPreferences: {
      preload: require('node:path').join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  if (!devServerUrl) throw new Error('VITE_DEV_SERVER_URL이 없습니다. npm run dev(desktop/scripts/dev.mjs)로 실행하세요.')
  win.loadURL(devServerUrl)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  app.quit()
})
```

- [ ] **Step 7: preload 스켈레톤 작성**

`desktop/electron/preload.js`:

```js
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('overlay', {})
```

- [ ] **Step 8: dev 실행 스크립트 작성**

Vite dev server를 먼저 띄우고 포트가 열리길 기다린 뒤 Electron을 실행한다. 별도 패키지(`concurrently`, `wait-on`) 없이 Node 표준 라이브러리만 쓴다.

`desktop/scripts/dev.mjs`:

```js
import { spawn } from 'node:child_process'
import net from 'node:net'

const PORT = 5174

function waitForPort(port, timeoutMs = 15000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.connect(port, 'localhost')
      socket.once('connect', () => {
        socket.end()
        resolve()
      })
      socket.once('error', () => {
        socket.destroy()
        if (Date.now() - start > timeoutMs) reject(new Error('vite dev server did not start in time'))
        else setTimeout(tryConnect, 300)
      })
    }
    tryConnect()
  })
}

const vite = spawn('npx', ['vite', '--port', String(PORT)], { stdio: 'inherit', shell: true })

try {
  await waitForPort(PORT)
} catch (err) {
  vite.kill()
  throw err
}

const electron = spawn('npx', ['electron', '.'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_DEV_SERVER_URL: `http://localhost:${PORT}` },
})

electron.on('exit', (code) => {
  vite.kill()
  process.exit(code ?? 0)
})
```

- [ ] **Step 9: 의존성 설치 + 실행 확인**

Run: `cd desktop && npm install && npm run dev`
Expected: 일반 창(아직 투명/always-on-top 아님)이 떠서 "Hello Overlay" 텍스트가 보인다. 창을 닫으면 프로세스가 종료된다.

- [ ] **Step 10: 커밋**

```bash
git add desktop/
git commit -m "데스크톱 오버레이 패키지 스캐폴드"
```

---
### Task 2: 창 상태 전환(collapsed/popover/hud) + 위치 저장/복원 + 드래그

**Files:**
- Modify: `desktop/electron/main.js`
- Modify: `desktop/electron/preload.js`

**Interfaces:**
- Produces: `window.overlay.setMode(mode: 'collapsed' | 'popover' | 'hud')`, `window.overlay.onForceHud(cb): () => void`, `window.overlay.dragStart()`, `window.overlay.dragMove()`, `window.overlay.dragEnd()`, `window.overlay.openDashboard()`

- [ ] **Step 1: main.js를 상태별 리사이즈 + 드래그 IPC 포함해서 전체 교체**

`desktop/electron/main.js`:

```js
const { app, BrowserWindow, ipcMain, globalShortcut, screen, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const COLLAPSED = { width: 160, height: 44 }
const POPOVER = { width: 380, height: 560 }
const HUD = { width: 900, height: 600 }
const POSITION_FILE = path.join(app.getPath('userData'), 'window-position.json')

let mainWindow = null
let dragStart = null

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
```

- [ ] **Step 2: preload에 setMode/onForceHud/드래그 함수 노출**

`desktop/electron/preload.js`:

```js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('overlay', {
  setMode: (mode) => ipcRenderer.send('overlay:set-mode', mode),
  onForceHud: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('overlay:force-hud', listener)
    return () => ipcRenderer.removeListener('overlay:force-hud', listener)
  },
  dragStart: () => ipcRenderer.send('overlay:drag-start'),
  dragMove: () => ipcRenderer.send('overlay:drag-move'),
  dragEnd: () => ipcRenderer.send('overlay:drag-end'),
  openDashboard: () => ipcRenderer.send('overlay:open-dashboard'),
})
```

- [ ] **Step 3: 수동 확인**

Run: `npm run dev`
Expected: 창이 160×44 크기로 화면 우상단에 뜬다(안은 아직 비어 있어도 됨 — Task 3에서 채운다). 지금은 IPC를 아무도 호출하지 않으니 리사이즈는 다음 태스크에서 확인한다.

- [ ] **Step 4: 커밋**

```bash
git add desktop/electron/
git commit -m "오버레이 창 상태별 리사이즈 + 드래그 IPC 추가"
```

---

### Task 3: 트레이 인디케이터(collapsed) 렌더러

**Files:**
- Create: `desktop/src/TrayIndicator.tsx`
- Create: `desktop/src/OverlayWidget.tsx`
- Create: `desktop/src/styles.css`
- Modify: `desktop/src/main.tsx`

**Interfaces:**
- Consumes: `window.overlay.setMode`, `window.overlay.dragStart/dragMove/dragEnd`
- Produces: `<OverlayWidget />` — 지금은 `collapsed` 모드만 동작(정적 더미 라벨). `popover`/`hud`는 Task 4~5에서 채운다.

- [ ] **Step 1: 스타일 작성 (목업 색상 그대로)**

`desktop/src/styles.css`:

```css
html,
body,
#root {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: hidden;
  font-family: 'Pretendard Variable', Pretendard, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

button {
  font: inherit;
  color: inherit;
}

.mono {
  font-family: 'JetBrains Mono', monospace;
}

.tray {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  background: rgba(33, 40, 48, 0.94);
  border: 1px solid #3a444c;
  border-radius: 999px;
  color: #f0f4f5;
  cursor: pointer;
  font-size: 13px;
  user-select: none;
}

.tray__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}

.tray__label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  color: #e2e9eb;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 2: TrayIndicator 작성 — 드래그와 클릭을 이동량으로 구분**

Electron의 `-webkit-app-region: drag`는 그 위 요소의 클릭 이벤트를 안정적으로 못 받는 경우가 있어서(공식 문서도 "드래그 리전은 포인터 이벤트를 못 받는다"고 명시), CSS 드래그 리전 대신 `pointerdown`~`pointerup` 사이 이동량으로 드래그/클릭을 직접 구분한다.

`desktop/src/TrayIndicator.tsx`:

```tsx
import { useRef } from 'react'

interface Props {
  label: string
  dotColor: string
  onOpenPopover: () => void
}

export default function TrayIndicator({ label, dotColor, onOpenPopover }: Props) {
  const dragging = useRef(false)
  const moved = useRef(false)

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    dragging.current = true
    moved.current = false
    window.overlay.dragStart()
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove() {
    if (!dragging.current) return
    moved.current = true
    window.overlay.dragMove()
  }

  function handlePointerUp() {
    if (!dragging.current) return
    dragging.current = false
    window.overlay.dragEnd()
    if (!moved.current) onOpenPopover()
  }

  return (
    <button
      type="button"
      className="tray"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <span className="tray__dot" style={{ background: dotColor, boxShadow: `0 0 8px ${dotColor}` }} />
      <span className="tray__label">{label}</span>
    </button>
  )
}
```

- [ ] **Step 3: OverlayWidget(모드 전환 뼈대) 작성**

`desktop/src/OverlayWidget.tsx`:

```tsx
import { useEffect, useState } from 'react'
import TrayIndicator from './TrayIndicator'

declare global {
  interface Window {
    overlay: {
      setMode: (mode: 'collapsed' | 'popover' | 'hud') => void
      onForceHud: (callback: () => void) => () => void
      dragStart: () => void
      dragMove: () => void
      dragEnd: () => void
    }
  }
}

type Mode = 'collapsed' | 'popover' | 'hud'

export default function OverlayWidget() {
  const [mode, setModeState] = useState<Mode>('collapsed')

  function setMode(next: Mode) {
    setModeState(next)
    window.overlay.setMode(next)
  }

  useEffect(() => {
    return window.overlay.onForceHud(() => setMode('hud'))
  }, [])

  if (mode === 'collapsed') {
    return (
      <TrayIndicator label="오늘 0커밋" dotColor="#6fb6f0" onOpenPopover={() => setMode('popover')} />
    )
  }

  // popover/hud 콘텐츠는 Task 4~5에서 채운다.
  return (
    <div style={{ width: '100%', height: '100%', background: 'rgba(30,36,42,.95)', color: '#fff', padding: 16 }}>
      {mode} (임시)
    </div>
  )
}
```

- [ ] **Step 4: main.tsx에서 OverlayWidget 사용**

`desktop/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import OverlayWidget from './OverlayWidget'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OverlayWidget />
  </StrictMode>,
)
```

- [ ] **Step 5: 수동 확인**

Run: `npm run dev`
Expected: 화면 우상단에 어두운 알약("오늘 0커밋")이 뜬다. 알약을 클릭(움직임 없이 누르고 떼기)하면 창이 380×560으로 커지며 "popover (임시)" 텍스트가 보인다. 알약을 누른 채로 드래그하면 창이 마우스를 따라 움직인다(이때는 클릭으로 처리되지 않아야 함).

- [ ] **Step 6: 커밋**

```bash
git add desktop/src/
git commit -m "트레이 인디케이터 + 모드 전환 뼈대 추가"
```

---

### Task 4: 팝오버(작업 컨텍스트, 목업 2a) 렌더러

**Files:**
- Create: `desktop/src/WorkContextPanel.tsx`
- Create: `desktop/src/WeekStrip.tsx`
- Modify: `desktop/src/OverlayWidget.tsx`
- Modify: `desktop/src/styles.css`

**Interfaces:**
- Produces: `<WorkContextPanel data={WorkContextData} variant="popover" | "hud" onClose={() => void} onCreateBranchDraft={() => void} onOpenDashboard={() => void} />`, `<WeekStrip points={{ wd: string; value: number }[]} />`
- Consumes: 아직 정적 더미 데이터(`Task 5`에서 실제 API로 교체)

- [ ] **Step 1: 더미 타입 + WeekStrip(파형 SVG) 작성**

`desktop/src/WeekStrip.tsx`:

```tsx
interface Point {
  wd: string
  value: number
}

function smooth(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? pts[i + 1]
    d += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)}, ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)}, ${p2.x} ${p2.y}`
  }
  return d
}

export default function WeekStrip({ points, width, height }: { points: Point[]; width: number; height: number }) {
  const base = height - 6
  const top = 6
  const max = Math.max(1, ...points.map((p) => p.value))
  const col = width / Math.max(1, points.length)
  const coords = points.map((p, i) => ({
    x: Math.round(col * (i + 0.5)),
    y: Math.round(base - (p.value / max) * (base - top)),
  }))
  const line = smooth(coords)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <path d={line} fill="none" stroke="#6fb6f0" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
      <line x1={0} y1={base} x2={width} y2={base} stroke="#3a444c" strokeWidth={1} />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={points[i].value === 0 ? 2.5 : 3.5} fill={points[i].value === 0 ? '#4a555c' : '#6fb6f0'} stroke="#212830" strokeWidth={2} />
      ))}
    </svg>
  )
}
```

- [ ] **Step 2: WorkContextPanel(2a 콘텐츠) 작성**

`desktop/src/WorkContextPanel.tsx`:

```tsx
import WeekStrip from './WeekStrip'

export interface WipFile {
  tag: 'M' | 'A' | 'D'
  path: string
  additions: number
  deletions: number
}

export interface TodayCommitRow {
  sha: string
  message: string
  time: string
  additions: number
  deletions: number
  written: boolean
}

export interface WorkContextData {
  repoName: string
  branch: string | null
  unpushedCount: number
  changedFileCount: number
  additions: number
  deletions: number
  files: WipFile[]
  lastCommitAge: string | null
  todayCommits: TodayCommitRow[]
  branchCommitCount: number
  branchCommitMessages: string[]
  weekTotal: number
  weekPoints: { wd: string; value: number }[]
}

const TAG_COLOR: Record<WipFile['tag'], string> = { M: '#9ec4e4', A: '#5fd3b1', D: '#f0b45e' }
const TAG_BG: Record<WipFile['tag'], string> = {
  M: 'rgba(111,182,240,.14)',
  A: 'rgba(95,211,177,.14)',
  D: 'rgba(240,180,94,.14)',
}

export default function WorkContextPanel({
  data,
  onCreateBranchDraft,
  onOpenDashboard,
}: {
  data: WorkContextData
  onCreateBranchDraft: () => void
  onOpenDashboard: () => void
}) {
  const visibleFiles = data.files.slice(0, 3)
  const extraFiles = data.files.length - visibleFiles.length

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        background: 'rgba(33,40,48,.96)',
        border: '1px solid #3a444c',
        borderRadius: 14,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        color: '#f0f4f5',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <span style={{ width: 9, height: 9, borderRadius: 2, background: '#6fb6f0', flex: 'none' }} />
        <span className="mono" style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.repoName}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {data.branch && (
          <span className="mono" style={{ padding: '3px 8px', borderRadius: 6, background: '#2b343c', fontSize: 12, color: '#c3cdd1' }}>
            {data.branch}
          </span>
        )}
        {data.unpushedCount > 0 && (
          <span className="mono" style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #46525a', fontSize: 11.5, color: '#9ec4e4' }}>
            ↑{data.unpushedCount} push 대기
          </span>
        )}
        <span className="mono" style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #46525a', fontSize: 11.5, color: '#8b989e' }}>
          {data.changedFileCount} 파일 변경
        </span>
      </div>

      {data.changedFileCount > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: 12, background: '#262e35', border: '1px solid #333c43', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#b5c0c5' }}>작업 중 변경</span>
            <span style={{ flex: 1 }} />
            <span className="mono" style={{ fontSize: 12, color: '#9ec4e4' }}>+{data.additions}</span>
            <span className="mono" style={{ fontSize: 12, color: '#8b989e' }}>−{data.deletions}</span>
          </div>
          {visibleFiles.map((f) => (
            <div key={f.path} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <span
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    width: 15,
                    height: 15,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 3,
                    flex: 'none',
                    color: TAG_COLOR[f.tag],
                    background: TAG_BG[f.tag],
                  }}
                >
                  {f.tag}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 12.5, color: '#dde4e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left' }}
                >
                  {f.path}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
                <span className="mono" style={{ fontSize: 11.5, color: '#9ec4e4' }}>+{f.additions}</span>
                <span className="mono" style={{ fontSize: 11.5, color: '#7c888e' }}>−{f.deletions}</span>
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 2 }}>
            {extraFiles > 0 && <span style={{ fontSize: 12, color: '#7c888e' }}>파일 {extraFiles}개 더</span>}
            <span style={{ flex: 1 }} />
            {data.lastCommitAge && <span style={{ fontSize: 12, color: '#f0b45e' }}>{data.lastCommitAge}</span>}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#96a3a9' }}>오늘 커밋</span>
          <span className="mono" style={{ fontSize: 12.5 }}>{data.todayCommits.length}</span>
        </div>
        {data.todayCommits.map((c) => (
          <div key={c.sha} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 10px', borderRadius: 8, border: '1px solid #2c353b' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#e7edef', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.message}</span>
              <span style={{ flex: 1 }} />
              <span className="mono" style={{ fontSize: 11.5, color: '#7c888e', flex: 'none' }}>{c.time}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ fontSize: 11.5, color: '#9ec4e4' }}>+{c.additions}</span>
              <span className="mono" style={{ fontSize: 11.5, color: '#7c888e' }}>−{c.deletions}</span>
              <span style={{ flex: 1 }} />
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 7px',
                  borderRadius: 20,
                  whiteSpace: 'nowrap',
                  color: c.written ? '#5fd3b1' : '#8b989e',
                  border: `1px solid ${c.written ? '#3a5c52' : '#3a444c'}`,
                }}
              >
                {c.written ? '글에 포함됨' : '아직 안 씀'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {data.branchCommitCount > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, background: 'rgba(95,211,177,.07)', border: '1px solid #3a5c52', borderRadius: 10 }}>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: '#d8e0e3' }}>
            이 브랜치에서 <span className="mono" style={{ color: '#5fd3b1' }}>{data.branchCommitCount}커밋</span> 했고 아직 글로 안 썼어요.
          </div>
          <button
            type="button"
            onClick={onCreateBranchDraft}
            style={{ height: 36, background: '#5fd3b1', border: 0, borderRadius: 8, color: '#0e1a16', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
          >
            이 브랜치로 초안 만들기
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#7c888e' }}>이번 주</span>
          <span className="mono" style={{ fontSize: 12, color: '#b5c0c5' }}>{data.weekTotal} 커밋</span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onOpenDashboard} style={{ background: 'none', border: 'none', fontSize: 12, color: '#96a3a9', cursor: 'pointer' }}>
            대시보드 열기
          </button>
        </div>
        <WeekStrip points={data.weekPoints} width={348} height={34} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: OverlayWidget에서 popover 모드에 더미 데이터로 WorkContextPanel 연결**

`desktop/src/OverlayWidget.tsx`의 `// popover/hud 콘텐츠는 Task 4~5에서 채운다.` 이하 블록을 아래로 교체:

```tsx
  const dummyData: WorkContextData = {
    repoName: 'portfolio-automation',
    branch: 'feat/weekly-summary',
    unpushedCount: 2,
    changedFileCount: 7,
    additions: 214,
    deletions: 55,
    files: [
      { tag: 'M', path: 'backend/.../WeeklySummaryService.kt', additions: 128, deletions: 12 },
      { tag: 'M', path: 'frontend/src/pages/DashboardPage.tsx', additions: 64, deletions: 40 },
      { tag: 'A', path: 'frontend/src/components/WeekWave.tsx', additions: 22, deletions: 0 },
    ],
    lastCommitAge: '마지막 커밋 후 1시간 42분',
    todayCommits: [
      { sha: '1', message: 'feat: 주간 요약 API 추가', time: '09:12', additions: 128, deletions: 12, written: false },
      { sha: '2', message: 'fix: 주 시작 요일 계산 오류', time: '14:05', additions: 14, deletions: 9, written: true },
    ],
    branchCommitCount: 6,
    branchCommitMessages: ['feat: 주간 요약 API 추가', 'fix: 주 시작 요일 계산 오류'],
    weekTotal: 21,
    weekPoints: [
      { wd: '월', value: 4 },
      { wd: '화', value: 6 },
      { wd: '수', value: 2 },
      { wd: '목', value: 3 },
      { wd: '금', value: 6 },
      { wd: '토', value: 0 },
      { wd: '일', value: 0 },
    ],
  }

  if (mode === 'popover' || mode === 'hud') {
    return (
      <WorkContextPanel
        data={dummyData}
        onCreateBranchDraft={() => {}}
        onOpenDashboard={() => {}}
      />
    )
  }

  return null
```

그리고 파일 상단 import에 추가:

```tsx
import WorkContextPanel, { type WorkContextData } from './WorkContextPanel'
```

- [ ] **Step 4: 수동 확인**

Run: `npm run dev`. 알약을 클릭한다.
Expected: 380×560 팝오버가 뜨고, 목업 2a와 같은 레이아웃(레포/브랜치 배지, 작업 중 변경 파일 3개 + "파일 N개 더", 오늘 커밋 2개, "이 브랜치로 초안 만들기" 버튼, 이번 주 파형)이 더미 데이터로 채워져 보인다.

- [ ] **Step 5: 커밋**

```bash
git add desktop/src/
git commit -m "팝오버(작업 컨텍스트) 렌더러 추가 - 더미 데이터"
```

---

### Task 5: HUD(목업 2b) 렌더러

**Files:**
- Modify: `desktop/src/WorkContextPanel.tsx`
- Modify: `desktop/src/OverlayWidget.tsx`

**Interfaces:**
- 변경: `WorkContextPanel`에 `variant: 'popover' | 'hud'` prop 추가 — `hud`일 때 2컬럼 레이아웃 + 단축키 힌트 행을 보여준다.

- [ ] **Step 1: WorkContextPanel에 variant별 레이아웃 분기 추가**

`desktop/src/WorkContextPanel.tsx`의 함수 시그니처를 교체:

```tsx
export default function WorkContextPanel({
  data,
  variant,
  onCreateBranchDraft,
  onOpenDashboard,
}: {
  data: WorkContextData
  variant: 'popover' | 'hud'
  onCreateBranchDraft: () => void
  onOpenDashboard: () => void
}) {
```

`popover` 레이아웃(기존 Step 2 코드)은 그대로 두고, 최상위 `return` 문을 분기로 감싼다 — `variant === 'hud'`이면 아래 레이아웃을 렌더링:

```tsx
  if (variant === 'hud') {
    const visibleFiles = data.files.slice(0, 5)
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          background: 'rgba(30,36,42,.96)',
          border: '1px solid #46525a',
          borderRadius: 18,
          boxShadow: '0 40px 90px rgba(0,0,0,.6)',
          padding: '24px 26px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          color: '#f0f4f5',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: '#6fb6f0', flex: 'none' }} />
          <span className="mono" style={{ fontSize: 16 }}>{data.repoName}</span>
          {data.branch && (
            <span className="mono" style={{ padding: '4px 9px', borderRadius: 6, background: '#2b343c', fontSize: 12.5, color: '#c3cdd1' }}>
              {data.branch}
            </span>
          )}
          {data.unpushedCount > 0 && (
            <span className="mono" style={{ padding: '4px 9px', borderRadius: 6, border: '1px solid #46525a', fontSize: 12, color: '#9ec4e4' }}>
              ↑{data.unpushedCount} push 대기
            </span>
          )}
          <span style={{ flex: 1 }} />
          {data.lastCommitAge && <span style={{ fontSize: 12, color: '#f0b45e' }}>{data.lastCommitAge}</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 18, minHeight: 0, flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: 'rgba(38,46,53,.72)', border: '1px solid #3a444c', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#96a3a9' }}>작업 중 변경</span>
                <span style={{ fontSize: 12.5, color: '#7c888e' }}>파일 {data.changedFileCount}개 · 커밋 안 됨</span>
              </div>
              <span style={{ flex: 1 }} />
              <span className="mono" style={{ fontSize: 22, color: '#9ec4e4' }}>+{data.additions}</span>
              <span className="mono" style={{ fontSize: 22, color: '#8b989e' }}>−{data.deletions}</span>
            </div>
            <div style={{ height: 1, background: '#3a444c' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
              {visibleFiles.map((f) => (
                <div key={f.path} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 96px', gap: 10, alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        width: 16,
                        height: 16,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 3,
                        flex: 'none',
                        color: TAG_COLOR[f.tag],
                        background: TAG_BG[f.tag],
                      }}
                    >
                      {f.tag}
                    </span>
                    <span className="mono" style={{ fontSize: 13, color: '#dde4e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left' }}>
                      {f.path}
                    </span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                    <span className="mono" style={{ fontSize: 12, color: '#9ec4e4' }}>+{f.additions}</span>
                    <span className="mono" style={{ fontSize: 12, color: '#7c888e' }}>−{f.deletions}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#96a3a9' }}>오늘 커밋</span>
              <span className="mono" style={{ fontSize: 13 }}>{data.todayCommits.length}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: '#7c888e' }}>이번 주 {data.weekTotal}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
              {data.todayCommits.map((c) => (
                <div key={c.sha} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 10, border: '1px solid #3a444c', background: 'rgba(38,46,53,.5)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ fontSize: 13.5, color: '#eef3f4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.message}</span>
                    <span style={{ flex: 1 }} />
                    <span className="mono" style={{ fontSize: 12, color: '#7c888e', flex: 'none' }}>{c.time}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span className="mono" style={{ fontSize: 12, color: '#9ec4e4' }}>+{c.additions}</span>
                    <span className="mono" style={{ fontSize: 12, color: '#7c888e' }}>−{c.deletions}</span>
                    <span style={{ flex: 1 }} />
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 7px',
                        borderRadius: 20,
                        whiteSpace: 'nowrap',
                        color: c.written ? '#5fd3b1' : '#8b989e',
                        border: `1px solid ${c.written ? '#3a5c52' : '#3a444c'}`,
                      }}
                    >
                      {c.written ? '글에 포함됨' : '아직 안 씀'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {data.branchCommitCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(95,211,177,.08)', border: '1px solid #3a5c52', borderRadius: 10 }}>
                <span style={{ fontSize: 13, lineHeight: 1.45, color: '#d8e0e3', flex: 1 }}>
                  이 브랜치 <span className="mono" style={{ color: '#5fd3b1' }}>{data.branchCommitCount}커밋</span>이 글 하나가 됩니다.
                </span>
                <button
                  type="button"
                  onClick={onCreateBranchDraft}
                  style={{ height: 34, padding: '0 14px', background: '#5fd3b1', border: 0, borderRadius: 8, color: '#0e1a16', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  초안 만들기
                </button>
              </div>
            )}
          </div>
        </div>

        <WeekStrip points={data.weekPoints} width={560} height={40} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="mono" style={{ fontSize: 11.5, padding: '3px 7px', border: '1px solid #46525a', borderRadius: 5, color: '#b5c0c5' }}>esc</span>
            <span style={{ fontSize: 12.5, color: '#8b989e' }}>닫기</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="mono" style={{ fontSize: 11.5, padding: '3px 7px', border: '1px solid #46525a', borderRadius: 5, color: '#b5c0c5' }}>↵</span>
            <span style={{ fontSize: 12.5, color: '#8b989e' }}>초안 만들기</span>
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: '#7c888e' }}>이번 주 {data.weekTotal}커밋</span>
        </div>
      </div>
    )
  }

  return (
```

(마지막 `return (` 다음에 기존 popover JSX가 그대로 이어진다 — `variant === 'hud'`가 아니면 popover 레이아웃을 반환하는 구조가 된다.)

- [ ] **Step 2: OverlayWidget에서 팝오버/HUD에 variant와 키보드 핸들러 연결**

`desktop/src/OverlayWidget.tsx`의 `if (mode === 'popover' || mode === 'hud')` 블록을 아래로 교체:

```tsx
  useEffect(() => {
    if (mode === 'collapsed') return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMode('collapsed')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  if (mode === 'popover' || mode === 'hud') {
    return (
      <WorkContextPanel
        data={dummyData}
        variant={mode}
        onCreateBranchDraft={() => {}}
        onOpenDashboard={() => {}}
      />
    )
  }
```

`import { useEffect, useState } from 'react'`가 이미 있으므로 그대로 쓴다.

- [ ] **Step 3: 수동 확인**

Run: `npm run dev`. 다른 앱에 포커스를 두고 `Alt+Ctrl+W`를 누른다.
Expected: 900×600 HUD가 화면 정중앙에 뜨고 목업 2b와 같은 2컬럼 레이아웃(작업 중 변경 파일 리스트 / 오늘 커밋 + 브랜치 초안 콜아웃)과 하단 파형·단축키 힌트가 보인다. `Esc`를 누르면 다시 알약으로 접힌다. 알약 클릭 → 팝오버(380×560, 1컬럼)도 여전히 동작한다.

- [ ] **Step 4: 커밋**

```bash
git add desktop/src/
git commit -m "HUD(작업 컨텍스트, 2컬럼) 렌더러 추가 - 더미 데이터"
```

---

### Task 6: 백엔드 데이터 연동 (실제 WIP/오늘 커밋/새 커밋 감지)

**Files:**
- Create: `desktop/src/overlayData.ts`
- Create: `desktop/src/useOverlayData.ts`
- Modify: `desktop/src/OverlayWidget.tsx`

**Interfaces:**
- Produces: `useOverlayData()` → `{ me, loggedOut, connectionOk, data: WorkContextData | null, hasLocalRepo, weekStart, newCommitTick, refresh, createBranchDraft }`
- Consumes: 백엔드 `GET /api/me`, `GET /api/week`, `GET /api/local-git`(변경 없음)

- [ ] **Step 1: API 호출 + 날짜 유틸 작성**

`desktop/src/overlayData.ts`:

```ts
export interface Me {
  username: string
  avatarUrl: string | null
}

interface WeekDaySummary {
  date: string
  commitCount?: number
  commits: { id: number }[]
}

export interface WeekViewSummary {
  weekStart: string
  days: WeekDaySummary[]
}

interface LocalWipFileDto {
  tag: string
  path: string
  additions: number
  deletions: number
}

interface LocalTodayCommitDto {
  sha: string
  message: string
  committedAt: string
  additions: number
  deletions: number
  written: boolean
}

export interface LocalGitSnapshotDto {
  id: number
  path: string
  name: string
  branch?: string | null
  ok: boolean
  headSha?: string | null
  unpushedCount: number
  changedFileCount: number
  additions: number
  deletions: number
  files: LocalWipFileDto[]
  lastCommitAge?: string | null
  todayCommits: LocalTodayCommitDto[]
  branchCommitCount: number
  branchCommitMessages: string[]
}

interface LocalGitResponseDto {
  active: LocalGitSnapshotDto | null
}

const API_BASE = 'http://localhost:8080'

export class UnauthorizedError extends Error {}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (res.status === 401) throw new UnauthorizedError()
  if (!res.ok) throw new Error(`요청 실패 (${res.status})`)
  return res.json() as Promise<T>
}

export function fetchMe(): Promise<Me> {
  return apiFetch<Me>('/api/me')
}

export function fetchWeek(): Promise<WeekViewSummary> {
  return apiFetch<WeekViewSummary>('/api/week')
}

export function fetchLocalGit(): Promise<LocalGitResponseDto> {
  return apiFetch<LocalGitResponseDto>('/api/local-git')
}

export function createDraftFromLocal(weekStart: string, summaries: string[]): Promise<unknown> {
  return apiFetch('/api/drafts/from-local', {
    method: 'POST',
    body: JSON.stringify({ weekStart, summaries }),
  })
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

export function seoulToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

export function weekdayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return WEEKDAYS[utcDay === 0 ? 6 : utcDay - 1]
}

export function formatHm(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })
}
```

- [ ] **Step 2: 폴링 훅 작성 — DTO를 WorkContextData로 변환**

`desktop/src/useOverlayData.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createDraftFromLocal,
  fetchLocalGit,
  fetchMe,
  fetchWeek,
  formatHm,
  UnauthorizedError,
  weekdayLabel,
  type Me,
} from './overlayData'
import type { WorkContextData } from './WorkContextPanel'

const HEAD_KEY = 'overlay-head-sha'
const POLL_INTERVAL_MS = 8000

interface State {
  me: Me | null
  loggedOut: boolean
  connectionOk: boolean
  hasLocalRepo: boolean
  data: WorkContextData | null
  weekStart: string | null
  newCommitTick: number
}

export function useOverlayData() {
  const [state, setState] = useState<State>({
    me: null,
    loggedOut: false,
    connectionOk: true,
    hasLocalRepo: true,
    data: null,
    weekStart: null,
    newCommitTick: 0,
  })
  const tickRef = useRef(0)

  const poll = useCallback(async () => {
    try {
      const me = await fetchMe()
      const [week, local] = await Promise.all([fetchWeek(), fetchLocalGit()])
      const active = local.active

      const weekTotal = week.days.reduce((sum, d) => sum + (d.commitCount ?? d.commits.length), 0)
      const weekPoints = week.days.map((d) => ({ wd: weekdayLabel(d.date), value: d.commitCount ?? d.commits.length }))

      if (!active) {
        setState((prev) => ({ ...prev, me, loggedOut: false, connectionOk: true, hasLocalRepo: false, data: null }))
        return
      }

      const data: WorkContextData = {
        repoName: active.name,
        branch: active.branch ?? null,
        unpushedCount: active.unpushedCount,
        changedFileCount: active.changedFileCount,
        additions: active.additions,
        deletions: active.deletions,
        files: active.files.map((f) => ({ tag: f.tag as 'M' | 'A' | 'D', path: f.path, additions: f.additions, deletions: f.deletions })),
        lastCommitAge: active.lastCommitAge ?? null,
        todayCommits: active.todayCommits.map((c) => ({
          sha: c.sha,
          message: c.message,
          time: formatHm(c.committedAt),
          additions: c.additions,
          deletions: c.deletions,
          written: c.written,
        })),
        branchCommitCount: active.branchCommitCount,
        branchCommitMessages: active.branchCommitMessages,
        weekTotal,
        weekPoints,
      }

      const head = active.headSha
      const prevHead = localStorage.getItem(HEAD_KEY)
      const isNewCommit = Boolean(head && prevHead && head !== prevHead)
      if (head) localStorage.setItem(HEAD_KEY, head)

      setState((prev) => ({
        ...prev,
        me,
        loggedOut: false,
        connectionOk: true,
        hasLocalRepo: true,
        data,
        weekStart: week.weekStart,
        newCommitTick: isNewCommit ? ++tickRef.current : prev.newCommitTick,
      }))
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setState((prev) => ({ ...prev, me: null, loggedOut: true, connectionOk: true }))
      } else {
        setState((prev) => ({ ...prev, connectionOk: false }))
      }
    }
  }, [])

  const createBranchDraft = useCallback(async () => {
    if (!state.weekStart || !state.data || state.data.branchCommitMessages.length === 0) return
    try {
      await createDraftFromLocal(state.weekStart, state.data.branchCommitMessages)
    } catch (err) {
      console.error('브랜치 초안 생성 실패', err)
    }
    await poll()
  }, [state.weekStart, state.data, poll])

  useEffect(() => {
    void poll()
    const id = window.setInterval(() => void poll(), POLL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [poll])

  return { ...state, refresh: poll, createBranchDraft }
}
```

- [ ] **Step 2b: 백엔드/프론트 기동**

Run: `docker compose up -d`(레포 루트), `cd backend && ./gradlew bootRun`. 추적 중인 로컬 레포가 하나 이상 있어야 `active`가 채워진다(기존 브라우저 대시보드에서 이미 설정돼 있음).

- [ ] **Step 3: OverlayWidget을 실제 데이터로 교체 — 로그인/연결 안 됨/로컬 레포 없음 상태 포함**

`desktop/src/OverlayWidget.tsx` 전체를 아래로 교체:

```tsx
import { useEffect, useState } from 'react'
import TrayIndicator from './TrayIndicator'
import WorkContextPanel from './WorkContextPanel'
import { useOverlayData } from './useOverlayData'

declare global {
  interface Window {
    overlay: {
      setMode: (mode: 'collapsed' | 'popover' | 'hud') => void
      onForceHud: (callback: () => void) => () => void
      dragStart: () => void
      dragMove: () => void
      dragEnd: () => void
      openDashboard: () => void
      openLogin: () => Promise<void>
      onLoginComplete: (callback: () => void) => () => void
    }
  }
}

type Mode = 'collapsed' | 'popover' | 'hud'
const AUTO_POPOVER_MS = 5000

export default function OverlayWidget() {
  const { me, loggedOut, connectionOk, hasLocalRepo, data, newCommitTick, refresh, createBranchDraft } =
    useOverlayData()
  void me
  const [mode, setModeState] = useState<Mode>('collapsed')

  function setMode(next: Mode) {
    setModeState(next)
    window.overlay.setMode(next)
  }

  useEffect(() => {
    return window.overlay.onForceHud(() => setMode('hud'))
  }, [])

  useEffect(() => {
    return window.overlay.onLoginComplete(() => void refresh())
  }, [refresh])

  useEffect(() => {
    if (newCommitTick === 0) return
    setMode('popover')
    const id = window.setTimeout(() => setMode('collapsed'), AUTO_POPOVER_MS)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newCommitTick])

  useEffect(() => {
    if (mode === 'collapsed') return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMode('collapsed')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  if (loggedOut) {
    return <TrayIndicator label="로그인" dotColor="#f0b45e" onOpenPopover={() => void window.overlay.openLogin()} />
  }

  if (mode === 'collapsed') {
    const label = !connectionOk
      ? '연결 안 됨'
      : !hasLocalRepo
        ? '레포 없음'
        : data && data.changedFileCount > 0
          ? `+${data.additions}`
          : `오늘 ${data?.todayCommits.length ?? 0}커밋`
    const dotColor = !connectionOk ? '#8b989e' : data && data.changedFileCount > 0 ? '#f0b45e' : '#6fb6f0'
    return <TrayIndicator label={label} dotColor={dotColor} onOpenPopover={() => setMode('popover')} />
  }

  if (!data) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#96a3a9', fontSize: 13, background: 'rgba(30,36,42,.95)', borderRadius: 14 }}>
        감시 중인 로컬 레포가 없어요. 브라우저 대시보드에서 등록해주세요.
      </div>
    )
  }

  return (
    <WorkContextPanel
      data={data}
      variant={mode === 'hud' ? 'hud' : 'popover'}
      onCreateBranchDraft={() => void createBranchDraft()}
      onOpenDashboard={() => window.overlay.openDashboard()}
    />
  )
}
```

(로그인 안 된 상태에서 `TrayIndicator`를 재사용했으므로 `onOpenPopover` prop이 사실상 "클릭 콜백"이 된다 — prop 이름은 그대로 두되 로그인 흐름 연결은 Task 7에서 `openLogin` IPC로 채운다. `me`는 아직 화면에 표시하지 않아 `void me`로 미사용 경고만 피해 둔다 — 나중에 팝오버 헤더 등에 쓸 수 있다.)

- [ ] **Step 4: 수동 확인**

Run: `npm run dev` (백엔드가 떠 있는 상태에서)
Expected: 알약이 실제 WIP 상태("+N" 또는 "오늘 N커밋")를 보여준다. 추적 중인 로컬 레포에 파일을 수정하고 커밋하면 8초 안에 팝오버가 자동으로 열렸다가 5초 후 닫힌다. 백엔드를 잠깐 꺼보면 "연결 안 됨"으로 바뀌고, 다시 켜면 자동 복구된다.

- [ ] **Step 5: 커밋**

```bash
git add desktop/src/
git commit -m "오버레이에 백엔드 데이터 폴링 연동 (WIP/오늘 커밋/새 커밋 감지)"
```

---

### Task 7: 로그인 플로우 (별도 창)

**Files:**
- Modify: `desktop/electron/main.js`
- Modify: `desktop/electron/preload.js`

**Interfaces:**
- Produces: `window.overlay.openLogin(): Promise<void>`, `window.overlay.onLoginComplete(callback: () => void): () => void`

- [ ] **Step 1: main.js에 로그인 창 IPC 핸들러 추가**

`desktop/electron/main.js`의 `ipcMain.on('overlay:drag-end', ...)` 블록 다음에 추가:

```js
let loginWindow = null

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
```

- [ ] **Step 2: preload에 openLogin/onLoginComplete 노출**

`desktop/electron/preload.js`의 `contextBridge.exposeInMainWorld('overlay', { ... })` 객체에 추가:

```js
  openLogin: () => ipcRenderer.invoke('overlay:open-login'),
  onLoginComplete: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('overlay:login-complete', listener)
    return () => ipcRenderer.removeListener('overlay:login-complete', listener)
  },
```

- [ ] **Step 3: 수동 확인**

Run: `npm run dev` (백엔드 + `docker compose` 떠 있는 상태에서, 필요하면 Electron의 로그인 상태를 초기화하고 테스트: `%APPDATA%/portfolio-overlay` 폴더 삭제)
Expected: "로그인" 알약 클릭 → 별도 창에서 GitHub 로그인 → 완료되면 로그인 창이 자동으로 닫히고 오버레이가 실제 WIP/오늘 커밋 상태로 바뀐다. 앱을 완전히 재시작해도 로그인 상태가 유지된다.

- [ ] **Step 4: 커밋**

```bash
git add desktop/
git commit -m "오버레이에 GitHub 로그인 플로우 연결"
```

---

### Task 8: 통합 수동 테스트 + 실행 방법 문서화

**Files:**
- Create: `desktop/README.md`

**Interfaces:** 없음(문서/검증 전용)

- [ ] **Step 1: README 작성**

`desktop/README.md`:

```markdown
# Portfolio Overlay

op.gg 스타일 데스크톱 오버레이. 항상 작은 트레이 인디케이터로 떠 있다가,
클릭하면 팝오버로, `Alt+Ctrl+W`를 누르면 화면 중앙 HUD로 지금 이 로컬
브랜치의 작업 상태(커밋 안 한 변경/오늘 커밋/브랜치 초안 제안)를 보여준다.

## 실행

1. 레포 루트에서 `docker compose up -d` (Postgres)
2. `cd backend && ./gradlew bootRun`
3. `cd desktop && npm install && npm run dev`

첫 실행 시 트레이 인디케이터의 "로그인"을 클릭해 GitHub 로그인을 한 번
해두면, 이후 재시작해도 로그인 상태가 유지된다(Electron 세션이 디스크에
저장됨).

## 범위

설치 파일/자동 업데이트 없음. `npm run dev`로만 실행하는 개인용 도구.
AI 초안 생성은 백엔드 쪽에서 보류 상태라 "초안 만들기" 버튼을 눌러도
실패할 수 있다(요청 자체는 정상적으로 나간다).
```

- [ ] **Step 2: 전체 시나리오 수동 확인 체크리스트**

백엔드 + Docker + `npm run dev`가 모두 떠 있는 상태에서 하나씩 확인한다:

- [ ] 트레이 인디케이터가 다른 창(VS Code, 메모장 등) 위에 실제로 떠 있다
- [ ] 인디케이터를 드래그하면 창이 따라 움직이고, 움직임 없이 클릭하면 팝오버가 열린다
- [ ] 추적 중인 로컬 레포에 커밋을 하나 만들면 8초 안에 팝오버가 자동으로 열리고 5초 후 다시 접힌다
- [ ] 다른 앱에 포커스가 있는 상태에서 `Alt+Ctrl+W`를 눌러도 HUD가 뜨고, `Esc`로 닫힌다
- [ ] 인디케이터 위치를 옮긴 뒤 앱을 완전히 재시작하면 그 위치를 기억한다
- [ ] 백엔드를 껐다 켜면 "연결 안 됨" ↔ 정상 표시가 자동으로 전환된다
- [ ] 로그아웃 상태에서 로그인 클릭 → GitHub 로그인 → 오버레이 복귀까지 끊기지 않는다
- [ ] "이 브랜치로 초안 만들기" 버튼을 눌러 요청이 나가는지(콘솔/백엔드 로그로 확인 — AI가 막혀 있어 실패는 해도 됨)

- [ ] **Step 3: 커밋**

```bash
git add desktop/README.md
git commit -m "데스크톱 오버레이 실행 방법 문서화"
```
