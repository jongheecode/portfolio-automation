# 데스크톱 오버레이 (op.gg 스타일)

## 배경

지금 `frontend/src/overlay/`에 있는 HUD(Alt+Ctrl+W 토글, 로컬 git 폴링 기반 토스트)는 브라우저 탭 안에서만 동작한다. 탭이 안 열려 있으면 아무것도 안 보인다. 개발 중엔 대부분 에디터/터미널에 포커스가 가 있으므로, op.gg가 게임 위에 항상 떠 있듯 **다른 창 위에 항상 떠 있는 진짜 데스크톱 위젯**이 필요하다.

사용자가 Claude Design으로 미리 그려둔 목업이 레포 루트 `Overlay Week Pulse.dc.html`에 있다. 이 문서의 화면 구성은 그 목업(특히 "2a/2b — 작업 컨텍스트" 섹션, 최종안으로 확정)을 그대로 따른다.

이번 슬라이스에 넣지 않는 것: 설치 파일/자동 업데이트, 크로스 플랫폼(Windows 전용), 설정 화면, 멀티 모니터 배치 고도화, AI 초안 생성 연동(보류 상태 — "초안 만들기" 버튼은 만들되 눌렀을 때의 실제 생성 로직은 이미 있는 `/api/drafts/from-local`을 그대로 쓴다).

## 콘텐츠 — "작업 컨텍스트" (목업 2a/2b, 최종안)

목업엔 트레이 팝오버(2a)와 전역 단축키 HUD(2b) 두 형태가 있고, **같은 데이터를 보여주되 레이아웃만 다르다**. 둘 다 "이번 주 요약"이 아니라 **지금 이 로컬 레포/브랜치의 작업 상태**를 보여준다:

- 레포명 + 브랜치명 + push 대기 개수 + 변경 파일 수
- 작업 중 변경(아직 커밋 안 한 diff): 총 +/− 라인, 파일별 태그(M/A/D)+경로+add/del
- 오늘 커밋 리스트: 메시지, 시간, 파일 수, add/del, "글에 포함됨" 여부 배지
- "이 브랜치에서 N커밋 했고 아직 글로 안 썼어요" 콜아웃 + "이 브랜치로 초안 만들기" 버튼
- 이번 주 파형(작은 스파크라인, 요일별 값)

이 데이터는 전부 기존 백엔드 API로 이미 나온다 — **백엔드 변경 없음**:
- `GET /api/local-git` → `LocalGitSnapshot`: `branch`, `unpushedCount`, `changedFileCount`, `additions`/`deletions`, `files`(태그/경로/add/del), `todayCommits`(메시지/시간/파일수/add/del/`written`), `branchCommitCount`, `branchCommitMessages`, `lastCommitAge`
- `GET /api/week` → 요일별 커밋 수(파형용)

## 사용자 흐름

1. `desktop/` 앱을 실행하면(`npm run dev`) 화면 우상단에 작은 **트레이 인디케이터**(점 + 라벨)가 always-on-top으로 뜬다. 라벨은 작업 중 변경이 있으면 `+214`(오늘 변경 라인 수), 없으면 `오늘 N커밋`.
2. 로그인 안 된 상태면 인디케이터가 "로그인" 텍스트로 보인다. 클릭하면 별도 로그인 창이 떠서 기존 GitHub OAuth 플로우를 그대로 탄다.
3. 인디케이터를 클릭하면 목업 2a 레이아웃의 **팝오버**(380px 폭)가 인디케이터 아래에 뜬다. 바깥을 클릭하거나 `Esc`를 누르면 닫힌다.
4. 전역 단축키 `Alt+Ctrl+W`를 누르면 다른 앱에 포커스가 있어도 목업 2b 레이아웃의 **HUD**(880px 폭, 화면 중앙, 배경 딤 처리)가 뜬다. `Esc`로 닫힌다.
5. 로컬 git HEAD가 바뀌면(8초 폴링) 팝오버가 잠깐 자동으로 열렸다가 몇 초 뒤 닫힌다(새 커밋 알림 역할).
6. 트레이 인디케이터는 드래그로 위치를 옮길 수 있고, 재시작해도 마지막 위치를 기억한다. 팝오버/HUD는 드래그 대상이 아니다(닫히면 그만인 일시적 오버레이).

## 아키텍처

새 최상위 패키지 `desktop/` (Electron + Vite + React, 기존 `backend/`/`frontend/`와 독립적인 패키지). 백엔드는 전혀 건드리지 않는다.

### 메인 프로세스 (`desktop/electron/main.js`)

- `BrowserWindow` 생성: `frame: false`, `transparent: true`, `alwaysOnTop: true`, `skipTaskbar: true`, `hasShadow: false`.
- **창을 상태별로 리사이즈한다** — `resizable: false`는 유지하되(사용자가 직접 리사이즈는 못 함), 코드에서 `setBounds()`로 세 가지 크기 중 하나로 전환한다:
  - `collapsed`(트레이 인디케이터만): 약 160×44, 저장된 위치 또는 화면 우상단 기본값
  - `popover`(2a 콘텐츠): 약 380×560, 인디케이터 바로 아래에 붙여서 표시
  - `hud`(2b 콘텐츠): 약 900×600, 주 모니터 정중앙
  - 초기 설계(첫 스펙 버전)에서는 창 크기를 고정하고 클릭 통과(`setIgnoreMouseEvents`)로 상태를 표현하려 했으나, 트레이 인디케이터 자체가 **항상 클릭 가능해야** 한다는 요구(팝오버를 열어야 하니까)와 맞지 않아 리사이즈 방식으로 변경했다. 창이 항상 실제 콘텐츠 크기와 같으므로 클릭 통과 로직 자체가 필요 없어져 오히려 더 단순하다.
- `globalShortcut.register('Alt+Control+W', ...)` 등록 — 렌더러에 "HUD 강제 오픈" IPC 이벤트 전송.
- 창 위치 저장(트레이 인디케이터 위치만): 외부 패키지 없이 `app.getPath('userData')/window-position.json`에 직접 JSON read/write. `collapsed` 상태로 돌아올 때만 이 위치를 쓴다.
- 세션/쿠키: Electron 기본 `session`(디스크에 자동 영속)을 그대로 쓴다 — 별도 설정 불필요, 재시작해도 로그인 유지.
- `preload.js`: `contextIsolation: true`, `nodeIntegration: false` 유지. `contextBridge`로 `window.overlay.setMode(mode)`, `window.overlay.onForceHud(cb)`, `window.overlay.openLogin()`, `window.overlay.onLoginComplete(cb)` 노출.

### 렌더러 (`desktop/src/`)

- `OverlayWidget.tsx`: 최상위 상태 머신(`collapsed` / `popover` / `hud`). 모드가 바뀔 때마다 IPC로 메인 프로세스에 알려 창 크기를 맞춘다.
- `TrayIndicator.tsx`(collapsed), `WorkContextPanel.tsx`(popover/hud 공용 콘텐츠 — 두 레이아웃이 같은 데이터를 쓰므로 내부 컴포넌트를 공유하고 바깥 컨테이너 크기/배치만 다르게 감싼다).
- 데이터 폴링 로직은 `frontend/src/overlay/OverlayContext.tsx`(HEAD sha diff 감지, `createBranchDraft`)와 같은 로직이지만, 별도 Vite 앱이라 **그대로 복사해서 이 앱 안에 둔다** — 모노레포 공유 패키지를 새로 구성하는 건 지금 규모에 비해 과함.
- API 베이스 URL은 `http://localhost:8080` 고정. `fetch(..., { credentials: 'include' })`로 기존 백엔드 세션 쿠키를 그대로 사용.

## 로그인 처리

1. 렌더러 마운트 시 `GET /api/me` 호출. 401이면 트레이 인디케이터가 "로그인" 상태로 표시.
2. 인디케이터 클릭 시 메인 프로세스에 IPC로 로그인 요청 → 메인이 **프레임 있는 일반 `BrowserWindow`**를 새로 띄워 `http://localhost:8080/oauth2/authorization/github`로 이동시킨다.
3. 백엔드의 기존 OAuth 성공 핸들러는 `${app.frontend-url}/dashboard`(즉 `http://localhost:5173/dashboard`)로 리다이렉트하도록 이미 구현돼 있다 — 여기는 손대지 않는다.
4. 로그인 창의 `did-navigate` 이벤트를 감시하다가 URL이 `frontend-url` 하위로 바뀌는 순간(=로그인 성공) 그 창을 닫고 오버레이로 돌아온다.

## 에러 처리

- 백엔드 연결 실패(fetch reject) → 트레이 인디케이터를 흐리게 "연결 안 됨"으로 표시, 8초 간격 재시도는 계속하다가 복구되면 자동으로 정상 표시로 전환.
- 401(세션 만료 포함) → "로그인" 상태로 전환.
- 추적 중인 로컬 레포가 없으면(`/api/local-git`의 `active`가 `null`) 팝오버/HUD에 "감시 중인 로컬 레포가 없어요" 안내만 보여준다(기존 프론트 `RepoScopeModal`류의 등록 UI는 이번 범위 밖 — 브라우저 대시보드에서 등록하라고 안내).

## 범위 밖

- 설치 파일(`electron-builder` 등)/자동 업데이트 — 지금은 `npm run dev`로 로컬 실행.
- macOS/Linux 대응 — Windows 개발 머신 기준으로만 검증.
- 설정 화면(단축키 변경, 폴링 간격 변경, 온오프 등).
- 멀티 모니터 위치 저장 세부 처리 — 저장된 좌표를 그대로 쓰고, 화면 밖으로 나가면 기본 위치로 리셋하는 정도만 한다.
- 목업의 "push 대기" 색상 커스터마이즈(`accent` prop), 조용한 모드(`quietMode`) 같은 목업 자체의 설정 옵션들 — 데이터 표시 로직만 가져오고 설정 UI는 만들지 않는다.

## 테스트

Electron 글루 코드는 기존 프로젝트 관례대로 수동 검증한다:
- 트레이 인디케이터가 다른 창 위에 실제로 떠 있고, 클릭하면 팝오버가 인디케이터 아래에 뜨는지
- 로컬 git에 커밋을 만들었을 때 8초 안에 팝오버가 자동으로 열렸다가 몇 초 후 닫히는지
- `Alt+Ctrl+W`가 다른 앱에 포커스 있을 때도 HUD를 여는지, `Esc`로 닫히는지
- 트레이 인디케이터를 드래그해 옮긴 뒤 앱을 재시작해도 위치가 유지되는지
- 백엔드를 껐다 켰을 때 "연결 안 됨" ↔ 정상 표시가 자동 전환되는지
- 로그아웃 상태에서 로그인 클릭 → GitHub 로그인 → 오버레이 복귀까지 흐름이 끊기지 않는지
- "이 브랜치로 초안 만들기" 클릭 시 실제로 `/api/drafts/from-local` 호출이 나가는지(AI 자체가 지금 막혀 있어 결과는 실패해도 되지만, 요청까지는 정상 나가야 함)
