# Portfolio Overlay

op.gg 스타일 데스크톱 오버레이. 항상 작은 트레이 인디케이터로 떠 있다가,
클릭하면 팝오버로, `Alt+Ctrl+W`를 누르면 화면 중앙 HUD로 지금 이 로컬
브랜치의 작업 상태(커밋 안 한 변경/오늘 커밋/브랜치 초안 제안)를 보여준다.

접힌 알약은 발견 엔진(`/api/findings/next-action`)이 고른 한 줄 문구를 보여준다
(보안 > 구조 > push 대기 > 글감 > 커밋 안 한 파일).

## 실행

1. 레포 루트에서 `docker compose up -d` (Postgres)
2. `cd backend`에서 `.env.local`을 로드한 뒤 `./gradlew bootRun` (`:8080`)
3. (선택) `cd frontend && npm run dev` (`:5173`) — 대시보드/설정, OAuth 성공 리다이렉트
4. `cd desktop && npm install && npm run dev` (`:5174` + Electron)

웹 설정(`http://localhost:5173/settings`)의 "데스크톱 오버레이 켜기/끄기"로도 같은 `npm run dev`를 띄울 수 있다.

첫 실행 시 트레이의 "로그인"을 클릭해 GitHub 로그인을 한 번 하면, 이후 재시작에도
세션이 유지된다. 로그인 창은 `http://localhost:8080/oauth2/authorization/github`를
열고, 성공 후 `http://localhost:5173`으로 넘어오면 자동으로 닫힌다.

로컬 레포는 오버레이가 아니라 웹 설정에서 등록한다. 등록 전이면 알약이 "레포 없음"이다.

숨긴 뒤에는 트레이 아이콘, 트레이 우클릭, 또는 `Alt+Ctrl+W`로 다시 연다.

## 로그인 플로우 (확인된 경로)

1. 오버레이가 same-origin `/api`로 폴링한다(Vite가 `127.0.0.1:8080`으로 프록시).
2. `GET /api/me`가 401이면 "로그인" 알약. 연속 2번 실패해야 로그아웃으로 본다.
3. 로그인 창은 백엔드 OAuth로 바로 간다. `localhost:8080`으로 열면
   `redirect_uri=http://localhost:8080/login/oauth2/code/github`가 나온다.
4. 성공 핸들러는 `http://localhost:5173/dashboard`로 보낸다. 로그인 창이 그 URL을
   보면 400ms 뒤 닫고 localhost 쿠키를 `userData/session-cookies.json`에 저장한다.
5. `/api/*`는 익명 세션을 만들지 않는다. 폴링이 방금 받은 JSESSIONID를 덮어쓰지 않게 한다.

GitHub 앱 Callback URL은 `http://localhost:8080/login/oauth2/code/github`여야 한다.
`127.0.0.1`로 열면 redirect_uri가 달라지므로 로그인 창은 항상 `localhost`를 쓴다.

## 범위

설치 파일/자동 업데이트 없음. `npm run dev`로만 실행하는 개인용 도구.
AI 초안 생성은 백엔드 쪽에서 보류 상태라 "초안 만들기"를 눌러도 실패할 수 있다.
요청 자체는 `/api/drafts/from-local`로 나간다.

## 수동 테스트 체크리스트

백엔드 + Docker + `cd desktop && npm run dev`가 떠 있는 상태에서:

- [ ] 트레이 인디케이터가 다른 창 위에 실제로 떠 있다
- [ ] 인디케이터를 드래그하면 창이 따라 움직이고, 움직임 없이 클릭하면 팝오버가 열린다
- [ ] × 또는 트레이 메뉴로 숨긴 뒤, 트레이 클릭/`Alt+Ctrl+W`로 다시 보인다
- [ ] 추적 중인 로컬 레포에 커밋을 하나 만들면 8초 안에 팝오버가 자동으로 열리고 5초 후 다시 접힌다
- [ ] 다른 앱에 포커스가 있는 상태에서 `Alt+Ctrl+W`를 눌러도 HUD가 뜨고, `Esc`로 닫힌다
- [ ] 인디케이터 위치를 옮긴 뒤 앱을 완전히 재시작하면 그 위치를 기억한다
- [ ] 백엔드를 껐다 켜면 "연결 안 됨" ↔ 정상 표시가 자동으로 전환된다
- [ ] 로그아웃 상태에서 로그인 클릭 → GitHub 로그인 → 오버레이 복귀까지 끊기지 않는다
- [ ] 앱을 재시작해도 로그인 상태가 유지된다
- [ ] "레포 없음" 클릭은 팝오버가 아니라 브라우저 설정을 연다
- [ ] HUD에서 Enter를 누르면 브랜치 초안 요청이 나간다
- [ ] 저녁 6시(또는 금요일 랩) 토스트가 알약 자리에 잠깐 뜨고, 클릭하면 HUD가 열린다
- [ ] 팝오버/HUD 상단을 드래그하면 창이 움직이고, 접기·숨기기·종료가 동작한다
- [ ] "이 브랜치로 초안 만들기" 버튼을 눌러 요청이 나가는지(콘솔/백엔드 로그 — AI가 막혀 있어 실패는 해도 됨)
- [ ] 팝오버에서 발견(근거 텍스트, `commit-split-suggestion`/`large-commit`일 때 명령어 복사)이 보이고, "넘기기"/"글에 넣었음"을 누르면 알약 문구가 바뀐다
- [ ] SECURITY 발견(예: IPC 핸들러)일 때 파일 경로 옆 "탐색기에서 보기"를 누르면 그 파일이 선택된 상태로 탐색기가 열린다
