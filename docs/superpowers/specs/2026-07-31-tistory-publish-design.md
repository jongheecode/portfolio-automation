# 티스토리 실제 발행 연동 설계

## 배경

지금 "블로그 포스팅"은 앱 안에서만 관리되고 실제로 외부에 올라가지 않는다. "발행" 버튼은 내부 `published` 플래그만 바꾼다. jongheecode는 원래 Velog 같은 실제 기술 블로그에 자동으로 올리고 싶어했다. 조사 결과 Velog는 공식 공개 API가 없어(내부 GraphQL을 역공학하는 비공식 방법뿐, 서버 변경에 언제든 깨질 수 있음) 배제하고, 공식 Open API가 있는 Tistory로 진행하기로 확정했다.

## 연동 흐름

1. 설정 페이지에 "티스토리 연동" 섹션 추가
   - 미연결: "연결하기" 버튼
   - 연결됨: 연결된 블로그 이름 표시 + "연결 해제" 버튼
2. "연결하기" 클릭 → Tistory OAuth authorize URL로 이동 (`client_id`, `redirect_uri`, `response_type=code`, `state`)
3. 사용자가 Tistory에서 로그인/승인
4. Tistory가 우리 콜백 URL로 `code`와 함께 리다이렉트
5. 백엔드 콜백 핸들러: `code`를 `access_token`으로 교환(`POST tistory.com/oauth/access_token`) → 사용자의 블로그 목록 조회(`GET /apis/blog/info`)해서 `blogName` 저장
6. `User`에 `tistoryAccessToken`(nullable), `tistoryBlogName`(nullable) 저장
7. 설정 페이지로 리다이렉트, 연결 성공 표시

**확인 안 된 리스크**: Tistory가 콜백 URL로 `localhost`를 허용하는지는 실제 앱 등록 전엔 알 수 없다. 안 되면 ngrok 같은 터널이 필요할 수 있음 — 이 부분은 실제 앱 등록 단계에서 사용자와 함께 확인한다.

## 실제 발행

- `BlogPostDetailPage`: 티스토리가 연결돼 있으면 "티스토리에 올리기" 버튼 노출
- 클릭 시: 백엔드가 마크다운 `content`를 commonmark로 HTML 변환 → Tistory Open API `POST /apis/post/write` 호출(`access_token`, `output=json`, `blogName`, `title`, `content`=HTML, `visibility=3`(공개) 고정)
- 성공 응답에서 글 URL을 받아 `BlogPost.tistoryUrl`(nullable)에 저장
- 프론트에는 "티스토리에서 보기" 링크로 표시. `tistoryUrl`이 이미 있으면 "티스토리에 올리기" 버튼은 비활성화하고 링크만 보여준다(재업로드/수정 반영은 v2 — 한 번 올리면 끝)

## 데이터 모델

### User (수정)
- `tistoryAccessToken: String?` (nullable)
- `tistoryBlogName: String?` (nullable)

### BlogPost (수정)
- `tistoryUrl: String?` (nullable)

## 백엔드 구현

새 패키지 `com.jongheecode.portfolio.tistory`:

- `TistoryApiClient`: `fetchAccessToken(code): String`, `fetchBlogName(accessToken): String`, `publishPost(accessToken, blogName, title, htmlContent): String`(URL 반환)
- `TistoryController`:
  - `GET /api/tistory/authorize-url` — 프론트가 리다이렉트할 authorize URL 문자열 응답
  - `GET /api/tistory/callback` — `code` 처리 후 프론트 설정 페이지로 리다이렉트
  - `DELETE /api/tistory/connection` — 연결 해제(토큰/블로그명 null 처리)
- `BlogPostController`에 `POST /api/blog-posts/{id}/publish-to-tistory` 추가
- `application.yml`: `tistory.client-id`, `tistory.client-secret` (env var `TISTORY_CLIENT_ID`/`TISTORY_CLIENT_SECRET`, `.env.local`에 사용자가 직접 추가 — 기존 GEMINI_API_KEY와 같은 패턴)
- redirect_uri는 `http://localhost:8080/api/tistory/callback`로 고정

## 프론트 구현

- `SettingsPage.tsx`: 티스토리 연동 상태 표시(연결됨/안됨), 연결하기·해제 액션
- `BlogPostDetailPage.tsx`: "티스토리에 올리기" 버튼 + 발행 후 "티스토리에서 보기" 링크
- `AppDataContext` 또는 별도 훅으로 `me` 응답에 티스토리 연결 상태 포함시켜 조회

## 에러 처리

- 연동 안 된 상태로 발행 시도 → 400 에러, 명확한 메시지("먼저 설정에서 티스토리를 연결해주세요")
- Tistory API 호출 실패 → 기존 Gemini/GitHub 패턴과 동일하게 에러 메시지 그대로 화면에 노출
- OAuth 콜백에서 `state` 불일치 → 400 에러

## 범위 밖 (v2)

- 카테고리/태그 지정
- 비공개/보호글 옵션
- 이미 올린 글 수정 반영(재업로드)
- Tistory 외 다른 플랫폼(Dev.to 등) 추가
