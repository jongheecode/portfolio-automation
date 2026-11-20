# AGENTS.md

Portfolio Automation — GitHub 커밋 기반 개발 기록 + 기술 블로그(dev.to 발행) + 포트폴리오 PDF + 데스크톱 오버레이(op.gg 스타일)를 만드는 1인용 개인 서비스.

**이 파일은 Claude Code와 Cursor가 번갈아 작업 중이라 서로 상태를 알 수 있게 쓰는 핸드오프 문서다.** 작업을 넘기거나 세션을 새로 시작할 때 여기부터 읽을 것 — 그리고 뭔가 바꿨으면 여기도 같이 갱신할 것(특히 "지금 누가 뭘 하고 있는지"와 "커밋 안 된 변경사항").

## 스택

- 백엔드: `backend/` — Kotlin + Spring Boot 3.3, PostgreSQL(Docker), GitHub OAuth2 로그인
- 프론트(웹): `frontend/` — React + TypeScript + Vite, `localhost:5173`
- 데스크톱 오버레이: `desktop/` — Electron + Vite + React, `localhost:5174`
- AI 초안 생성: Google Gemini API — **현재 보류 상태** (Gemini 계정 접근이 막혀 있음, 관련 없는 다른 작업 계속 진행 중)
- 블로그 실제 발행: dev.to Open API (티스토리는 API 종료로 폐기, `docs/superpowers/specs/2026-07-31-tistory-publish-design.md` 참고)

## 로컬 실행

```bash
docker compose up -d                                    # Postgres
cd backend && set -a && . ./.env.local && set +a && ./gradlew bootRun   # :8080
cd frontend && npm run dev                               # :5173
cd desktop && npm run dev                                 # Electron 오버레이 (선택)
```

`backend/.env.local`(gitignore됨)에 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GEMINI_API_KEY` 필요. **절대 이 파일 내용을 그대로 출력하는 명령(cat, sed -n 'l' 등)을 실행하지 말 것** — 구조 확인만 필요하면 `grep -c`/`length()` 같은 걸로.

## 데스크톱 오버레이 (`desktop/`) — 완료, main에 병합됨

op.gg처럼 다른 창 위에 항상 떠 있는 위젯. 설계 문서: `docs/superpowers/specs/2026-08-18-desktop-overlay-design.md`. 구현 계획(Task 1~8): `docs/superpowers/plans/2026-08-18-desktop-overlay.md`. 디자인 원본: `docs/design/Overlay Week Pulse.dc.html`(2a/2b). 루트에 있던 디자인/핸드오프 스크래치 파일들은 `docs/design/`로 옮김.

**Task 1~8 코드/문서 완료.** 로그인·로컬 레포 등록까지 수동으로 확인됨. 체크리스트는 `desktop/README.md`.

### 로그인 플로우 — 수동 확인됨

로그인 창은 `http://localhost:8080/oauth2/authorization/github`를 연다. `localhost`로 열면
`redirect_uri=http://localhost:8080/login/oauth2/code/github`가 나오고 `/api/me`는 비로그인 시 401이다.
성공하면 `http://localhost:5173/dashboard`로 가고, 로그인 창이 그 URL을 보면 닫힌다.

같이 들어간 안정화:
- CORS에 `app.desktop-url`(5174)
- 세션 쿠키 30일, `requestCache` 끔
- `ApiSessionFilter`: `/api/*`는 익명 세션을 만들지 않음
- Electron은 Chrome UA + 쿠키를 `userData/session-cookies.json`에 저장
- 오버레이 fetch는 Vite `/api` 프록시(`127.0.0.1:8080`)
- 401은 연속 2번이어야 로그아웃으로 본다
- `[login]` 디버그 로그는 제거함

GitHub 앱 Callback URL은 **localhost**여야 한다. `127.0.0.1`로 열면 redirect_uri가 달라진다.
임베디드 창에서 GitHub/Google SSO가 500을 내면 GitHub 계정으로 직접 로그인하는 편이 낫다.

### 알약 — 발견 엔진 텍스트 알약 (finding-engine 브랜치)

적재선 알약(`LoadLinePill`)은 폐기. 접힌 상태는 `TrayIndicator`(점 + 한 줄)이고, 문구는
`GET /api/findings/next-action`이 고른다: SECURITY > STRUCTURE > push 대기 > 글감 > 커밋 안 한 파일 > CLEAR.
규칙은 `backend/.../finding/FindingRules.kt`(순수 함수), 우선순위는 `FindingPriority.kt`.
- 라이브(커밋 전 diff) 규칙은 폴링마다 계산, 저장 안 함. 커밋 메시지/크기 규칙만 GitHub 동기화 때 `findings` 테이블에 저장.
- 동기화된 `large-commit`은 tier null(추세용) — 알약에 안 뜸. 머지/봇 커밋은 건너뜀.
- 팝오버 `FindingDetail`: 근거, `commit-split-suggestion`일 때만 명령어 복사, `PATCH /api/findings/{id}`로 넘기기/글에 넣었음.
- `GET /api/findings/live` → 팝오버 '지금 만지는 중'. 웹 `/week-review`(사이드바 "주간 리뷰")에 커밋별 발견 + 반복 습관.
- 실행은 절대 안 함(클립보드 복사만). 신규 untracked 파일 내용은 라이브 규칙이 못 본다(`git diff` 기반).
- 설계/계획: `docs/superpowers/specs|plans/2026-08-28-finding-engine*.md`.

색: `--diff-add`/`--diff-del` 토큰이 diff +/-를 담당, 종료 버튼은 `--muted`.

### Instrument Panel 팔레트 — 토큰 반영됨

방향 목업: https://claude.ai/code/artifact/90943371-d511-44c7-bd80-937ac739ea32
작업 파일: `.claude-design-scratch/`(gitignore). 배경 `#0F1214`/`#171B1E`/`#1B2024`, 테두리 `#262B2F`,
텍스트 `#E7E9EA`/`#8E979C`, 강청 `#6E9CC4` · 황동 `#C8A05A` · 세이지 `#7FAE9B`, 카드 이중 링.
`frontend/src/theme.css`, `desktop/src/styles.css`, 팝오버/HUD 인라인 색에 반영함.

### 조작 / 폰트 / 변경 리뷰

팝오버·HUD가 열리면 상단에 드래그 바 + **접기 / 숨기기 / 종료**. 알약은 6px 이상 움직이면 드래그, 아니면 클릭.
글꼴: Pretendard Variable + IBM Plex Mono (`desktop/index.html`).
개발 중 확인: `GET /api/local-git/diff` → 팝오버/HUD의 변경 리뷰(휴리스틱 노트 + unified diff). Gemini 없음.
저녁 18:00 / 금요일 랩 토스트(하루 최대 2개), HUD에서 Enter → 브랜치 초안.

**남은 것**: 발견 엔진 PATCH(넘기기/글에 넣었음)가 실제 로그인 세션으로 한 번도 수동 확인이 안 됨(코드 추적으로만 검증) — 로그인 → 팝오버 → 넘기기/글에 넣었음 눌러보고 확인할 것. LLM provider 추상화(Gemini 대체)와 PDF 한글 폰트 번들링은 계정/바이너리 파일이 필요해서 보류 중.

## 코드 스타일 / 관례

- 커밋 메시지: 한국어, 짧은 설명 스타일. 이 프로젝트는 커밋/명령어 실행에 매번 허락받지 않고 진행하는 것으로 사전 합의됨.
- 이 프로젝트는 단위테스트가 거의 없음(예외: `backend/src/test/kotlin/.../week`, `git`, `github`, `commit` 일부). Electron 글루 코드는 수동 검증 관례.
- 스펙/계획 문서는 `docs/superpowers/specs/`, `docs/superpowers/plans/`에 `YYYY-MM-DD-<topic>` 형식으로 쌓임 — 새 기능 작업 전에 관련 문서가 있는지 먼저 확인할 것.
