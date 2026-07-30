# Portfolio Automation

GitHub 커밋을 기반으로 개발 기록을 쌓고, 기술 블로그 자동 포스팅과 포트폴리오 PDF 생성까지 이어가는 개인 서비스.

## 스택

- 백엔드: Kotlin + Spring Boot 3.3 (Spring Security OAuth2 Client, Spring Data JPA, PostgreSQL)
- 프론트엔드: React + TypeScript + Vite
- DB: PostgreSQL (Docker)
- AI: Google Gemini API (블로그 초안 / 포트폴리오 초안 생성)

## 기능

1. GitHub 연동 + 기록 관리 — OAuth 로그인, 레포 추적, 커밋 동기화, 대시보드/타임라인
2. 커밋 기반 기술 블로그 자동 포스팅 — 아직 글에 안 쓰인 커밋을 모아 Gemini가 초안 작성, 마크다운 편집 후 발행
3. 포트폴리오 PDF 생성 — 레포/섹션(자기소개·어려운점·강점약점·기술스택) 선택 → Gemini가 초안 작성 → 편집 → PDF 다운로드

## 로컬 실행

### 1. GitHub OAuth App 등록

https://github.com/settings/developers 에서 OAuth App 생성.
- Homepage URL: `http://localhost:5173`
- Authorization callback URL: `http://localhost:8080/login/oauth2/code/github`

### 2. Gemini API 키 발급

https://ai.google.dev (Google AI Studio) 에서 무료로 API 키 발급.

### 3. DB 실행

```
docker compose up -d
```

### 4. 백엔드 실행

`backend/.env.local`(gitignored)에 아래 값 넣고:

```
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GEMINI_API_KEY=...
```

```
cd backend
set -a && . ./.env.local && set +a && ./gradlew bootRun
```

기본 포트는 8080.

### 5. 프론트엔드 실행

```
cd frontend
npm install
npm run dev
```

기본 포트는 5173. `.env.example`을 참고해서 `.env`에 API 주소를 지정할 수 있음(기본값 `http://localhost:8080`으로도 동작).

### 6. 사용

`http://localhost:5173`에서 GitHub로 로그인 → 대시보드에서 추적할 레포 등록 → 커밋 동기화 버튼으로 기록 수집 → 블로그/포트폴리오 PDF 페이지에서 AI 초안 생성.
