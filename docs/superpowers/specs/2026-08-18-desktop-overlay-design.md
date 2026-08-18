# 데스크톱 오버레이 (op.gg 스타일)

## 배경

지금 `frontend/src/overlay/`에 있는 HUD(Alt+Ctrl+W 토글, 로컬 git 폴링 기반 토스트)는 브라우저 탭 안에서만 동작한다. 탭이 안 열려 있으면 아무것도 안 보인다. 개발 중엔 대부분 에디터/터미널에 포커스가 가 있으므로, op.gg가 게임 위에 항상 떠 있듯 **다른 창 위에 항상 떠 있는 진짜 데스크톱 위젯**이 필요하다.

이번 슬라이스에 넣지 않는 것: 설치 파일/자동 업데이트, 크로스 플랫폼(Windows 전용), 설정 화면, 멀티 모니터 배치 고도화, AI 초안 생성 연동(보류 상태).

## 사용자 흐름

1. `desktop/` 앱을 실행하면(`npm run dev`) 화면 우상단에 작은 알약 위젯이 always-on-top으로 뜬다.
2. 로그인 안 된 상태면 위젯에 "로그인" 텍스트만 보인다. 클릭하면 별도 로그인 창이 떠서 기존 GitHub OAuth 플로우를 그대로 탄다.
3. 평소엔 위젯이 오늘 커밋 수 정도만 작게 보여주고, **클릭 통과(click-through)** 상태라 밑에 있는 에디터 클릭을 막지 않는다.
4. 로컬 git HEAD가 바뀌면(8초 폴링) 위젯이 확장되며 토스트("오늘 N번째 커밋")를 보여주고 몇 초 뒤 다시 접힌다.
5. 전역 단축키 `Alt+Ctrl+W`를 누르면 다른 앱에 포커스가 있어도 강제로 확장된다.
6. 확장 상태에서는 클릭 가능해진다 — 위젯을 드래그해 위치를 옮길 수 있고, 재시작해도 마지막 위치를 기억한다.

## 아키텍처

새 최상위 패키지 `desktop/` (Electron + Vite + React, 기존 `backend/`/`frontend/`와 독립적인 패키지). 기존 프론트엔드 앱을 통째로 재사용하지 않고, 오버레이 전용 작은 렌더러를 새로 만든다. 백엔드는 전혀 건드리지 않는다 — 기존 REST API(`/api/week`, `/api/local-git`, `/api/me`, GitHub OAuth 라우트)를 그대로 호출한다.

### 메인 프로세스 (`desktop/electron/main.ts`)

- `BrowserWindow` 생성: `frame: false`, `transparent: true`, `alwaysOnTop: true`, `skipTaskbar: true`, `resizable: false`, `hasShadow: false`.
- **창 크기는 고정**(확장 상태 기준 최대 크기)이고, 접힘/펼침은 렌더러 쪽 CSS로 표현한다 — 창을 실시간으로 리사이즈하면 OS별로 깜빡이거나 위치가 튀는 경우가 있어서, 투명 배경 위에 알약만 그리는 쪽이 더 단순하고 안전하다.
- `setIgnoreMouseEvents(true, { forward: true })`로 기본 클릭 통과, 렌더러가 IPC로 "확장됨" 신호를 보내면 `setIgnoreMouseEvents(false)`로 전환.
- `globalShortcut.register('Alt+Control+W', ...)` 등록 — 렌더러에 "강제 확장" IPC 이벤트 전송.
- 창 위치 저장: 외부 패키지 없이 `app.getPath('userData')/window-position.json`에 직접 JSON read/write.
- 세션/쿠키: Electron 기본 `session`(디스크에 자동 영속)을 그대로 쓴다 — 별도 설정 불필요, 재시작해도 로그인 유지.
- `preload.ts`: `contextIsolation: true`, `nodeIntegration: false` 유지. `contextBridge`로 `window.overlay.setExpanded(bool)`, `window.overlay.onForceExpand(cb)` 정도만 노출.

### 렌더러 (`desktop/src/`)

- `OverlayWidget.tsx`: 접힘 알약 / 펼침 카드 두 상태를 CSS로 표현하는 단일 컴포넌트.
- 데이터 폴링 로직(오늘 커밋 수, 이번 주 계획, HEAD sha diff로 새 커밋 감지, 저녁 6시/금요일 넛지)은 `frontend/src/overlay/OverlayContext.tsx`와 동일한 로직이지만, 별도 Vite 앱이라 **그대로 복사해서 이 앱 안에 둔다** — 모노레포 공유 패키지를 새로 구성하는 건 지금 규모에 비해 과함. 나중에 로직이 갈라지기 시작하면 그때 공유 패키지로 뽑는다.
- API 베이스 URL은 `http://localhost:8080` 고정(로컬 전용 개인 앱이라 env 설정 불필요 — 기존 프론트 기본값과 동일).
- `fetch(..., { credentials: 'include' })`로 기존 백엔드 세션 쿠키를 그대로 사용.

## 로그인 처리

1. 렌더러 마운트 시 `GET /api/me` 호출. 401이면 "로그인" 상태로 표시.
2. 위젯 클릭 시 메인 프로세스에 IPC로 로그인 요청 → 메인이 **프레임 있는 일반 `BrowserWindow`**를 새로 띄워 `http://localhost:8080/oauth2/authorization/github`로 이동시킨다.
3. 백엔드의 기존 OAuth 성공 핸들러는 `${app.frontend-url}/dashboard`(즉 `http://localhost:5173/dashboard`)로 리다이렉트하도록 이미 구현돼 있다 — 여기는 손대지 않는다.
4. 로그인 창의 `did-navigate` 이벤트를 감시하다가 URL이 `frontend-url` 하위로 바뀌는 순간(=로그인 성공) 그 창을 닫고 오버레이로 돌아온다. 쿠키는 이미 Electron 세션에 저장된 상태이므로 이후 오버레이의 API 호출이 바로 인증된다.

## 에러 처리

- 백엔드 연결 실패(fetch reject) → 위젯 텍스트를 흐리게 "연결 안 됨"으로 표시, 8초 간격 재시도는 계속하다가 복구되면 자동으로 정상 표시로 전환.
- 401(세션 만료 포함) → "로그인" 상태로 전환.

## 범위 밖

- 설치 파일(`electron-builder` 등)/자동 업데이트 — 지금은 `npm run dev`로 로컬 실행.
- macOS/Linux 대응 — Windows 개발 머신 기준으로만 검증.
- 설정 화면(단축키 변경, 폴링 간격 변경, 온오프 등).
- 멀티 모니터 위치 저장 세부 처리(모니터 구성이 바뀌었을 때 위치 보정 등) — 저장된 좌표를 그대로 쓰고, 화면 밖으로 나가면 기본 위치로 리셋하는 정도만 한다.

## 테스트

Electron 글루 코드(창 생성, IPC, 전역 단축키)는 기존 프로젝트 관례대로 수동 검증한다:
- 다른 창(에디터/터미널) 위에 실제로 떠 있는지, 접힘 상태에서 밑 클릭이 통과되는지
- 로컬 git에 커밋을 만들었을 때 8초 안에 확장 + 토스트가 뜨는지
- `Alt+Ctrl+W`가 다른 앱에 포커스 있을 때도 동작하는지
- 창을 드래그해 옮긴 뒤 앱을 재시작해도 위치가 유지되는지
- 백엔드(Docker/Spring Boot)를 껐다 켰을 때 "연결 안 됨" ↔ 정상 표시가 자동 전환되는지
- 로그아웃 상태에서 로그인 클릭 → GitHub 로그인 → 오버레이 복귀까지 흐름이 끊기지 않는지
