# Portfolio Automation

GitHub 커밋을 기반으로 개발 기록을 쌓고, 이후 기술 블로그 자동 포스팅과 포트폴리오 PDF 생성까지 이어가는 개인 서비스.

## 스택

- 백엔드: Kotlin + Spring Boot 3.3 (Spring Security OAuth2 Client, Spring Data JPA, PostgreSQL)
- 프론트엔드: React + TypeScript + Vite
- DB: PostgreSQL (Docker)

## 진행 단계

1. GitHub 연동 + 기록 관리 (현재 단계)
2. 커밋 기반 기술 블로그 자동 포스팅
3. GitHub 링크 기반 포트폴리오 PDF 생성

## 로컬 실행

### 1. GitHub OAuth App 등록

https://github.com/settings/developers 에서 OAuth App 생성.
- Homepage URL: `http://localhost:5173`
- Authorization callback URL: `http://localhost:8080/login/oauth2/code/github`

발급받은 Client ID / Secret은 아래 환경변수로 사용.

### 2. DB 실행

```
docker compose up -d
```

### 3. 백엔드 실행

```
cd backend
GITHUB_CLIENT_ID=xxx GITHUB_CLIENT_SECRET=xxx ./gradlew bootRun
```

기본 포트는 8080.

### 4. 프론트엔드 실행

```
cd frontend
npm install
npm run dev
```

기본 포트는 5173. `.env.example`을 참고해서 `.env`에 API 주소를 지정할 수 있음(기본값 `http://localhost:8080`으로도 동작).

### 5. 사용

`http://localhost:5173`에서 GitHub로 로그인 → 대시보드에서 추적할 레포 등록 → 커밋 동기화 버튼으로 기록 수집.
