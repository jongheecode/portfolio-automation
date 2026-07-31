# dev.to 실제 발행 연동 설계 (Tistory 대체)

## 배경

티스토리로 실제 발행 연동을 구현했으나, 실사용 테스트 직전 Tistory Open API가 2024년 2월까지 순차 종료됐다는 사실을 확인했다([공식 종료 안내](https://tistory.github.io/document-tistory-apis/)). 글쓰기 API(`POST /apis/post/write`)를 포함한 "글 관련 기능"이 종료 대상에 명시돼 있어 이미 구현한 연동은 실제로 동작하지 않는다.

대체 플랫폼을 조사한 결과:
- **Velog**: 공식 공개 API 없음 (기존 조사에서 확인, 비공식 GraphQL 역공학뿐)
- **Hashnode**: 2026년 5월부터 GraphQL API가 Pro 유료 플랜 전용으로 전환됨 — 무료 발행 불가
- **네이버 블로그**: `writePost.json` API가 살아있으나 OAuth 로그인 플로우가 필요해 티스토리만큼 복잡하고, 기술 블로그 성격이 약함
- **dev.to (Forem)**: 정상 운영 중, 무료, **고정 API 키 방식**(OAuth 불필요) — `POST https://dev.to/api/articles`에 `body_markdown`으로 마크다운 원문을 그대로 전송 가능. 실제 개발자 커뮤니티라 "velog 같은 기술 블로그"라는 원래 요구에 가장 부합

**dev.to로 결정.**

## Tistory 연동과의 핵심 차이

- **인증**: OAuth authorize/callback 플로우 전체 제거. 사용자가 dev.to 계정 설정에서 API 키를 발급받아 설정 페이지에 직접 붙여넣는 방식 (기존 `GEMINI_API_KEY`를 사용자가 `.env.local`에 넣는 패턴과 유사하지만, 이건 사용자별 값이라 DB의 `User` 엔티티에 저장).
- **콘텐츠 변환 불필요**: dev.to는 마크다운을 그대로 받으므로(`body_markdown`), `MarkdownRenderer`로 HTML 변환할 필요가 없다. `BlogPostController`에서 해당 의존성 제거.
- **redirect_uri, backend.url 설정 불필요**: OAuth 콜백이 없으므로 `backend.url` 설정과 `TistoryController`의 `/authorize-url`, `/callback` 엔드포인트에 대응하는 것들이 모두 사라지고, 단순히 "키 저장/삭제" API만 남는다.

## 연동 흐름

1. 설정 페이지에 "dev.to 연동" 섹션 추가
   - 미연결: API 키 입력창 + "연결하기" 버튼
   - 연결됨: `@username`으로 연결됨 표시 + "연결 해제" 버튼
2. "연결하기" 클릭 → 백엔드가 입력받은 키로 `GET https://dev.to/api/users/me` 호출해 유효성 검증 및 username 조회
3. 유효하면 `User.devtoApiKey`, `User.devtoUsername`에 저장. 유효하지 않으면 에러 메시지 표시("dev.to API 키가 올바르지 않습니다")

## 실제 발행

- `BlogPostDetailPage`: dev.to가 연결돼 있으면 "dev.to에 올리기" 버튼 노출
- 클릭 시: 백엔드가 `POST https://dev.to/api/articles` 호출 (헤더 `api-key`, body `{ article: { title, body_markdown, published: true } }`)
- 성공 응답의 `url` 필드를 `BlogPost.devtoUrl`에 저장
- 프론트에는 "dev.to에서 보기" 링크로 표시. `devtoUrl`이 이미 있으면 버튼 대신 링크만 노출 (재업로드/수정 반영은 v2 — 티스토리 설계와 동일한 범위 제약 유지)

## 데이터 모델

### User (수정 — 기존 tistoryAccessToken/tistoryBlogName 대체)
- `devtoApiKey: String?` (nullable)
- `devtoUsername: String?` (nullable)

### BlogPost (수정 — 기존 tistoryUrl 대체)
- `devtoUrl: String?` (nullable)

## 백엔드 구현

기존 `com.jongheecode.portfolio.tistory` 패키지를 `com.jongheecode.portfolio.devto`로 대체:

- `DevToApiClient`: `fetchUsername(apiKey): String`, `publishArticle(apiKey, title, markdownContent): String`(URL 반환)
- `DevToController`:
  - `POST /api/devto/connection` — body `{ apiKey }`, 검증 후 저장
  - `DELETE /api/devto/connection` — 연결 해제
- `BlogPostController`에 `POST /api/blog-posts/{id}/publish-to-devto` 추가 (기존 publish-to-tistory 대체), `markdownRenderer`/`tistoryApiClient` 의존성 제거하고 `devToApiClient`로 교체
- `application.yml`: `tistory.*`, `backend.url` 블록 제거 (더 이상 불필요)

## 프론트 구현

- `SettingsPage.tsx`: dev.to 섹션을 OAuth 리다이렉트 대신 API 키 입력 폼으로 구현
- `BlogPostDetailPage.tsx`: "dev.to에 올리기" 버튼 + 발행 후 "dev.to에서 보기" 링크
- `types.ts`/`api/client.ts`: tistory 관련 타입/함수를 devto로 교체

## 에러 처리

- 연동 안 된 상태로 발행 시도 → 400 에러, "먼저 설정에서 dev.to를 연결해주세요"
- API 키 검증 실패 → "dev.to API 키가 올바르지 않습니다"
- dev.to API 호출 실패 → 기존 패턴과 동일하게 에러 메시지 그대로 화면에 노출

## 범위 밖 (v2)

- 태그 지정
- 비공개(unlisted) 옵션
- 이미 올린 글 수정 반영(재업로드) — dev.to는 `PUT /api/articles/{id}`로 가능하지만 v1 범위 밖
- dev.to 외 다른 플랫폼 추가

## 정리 작업

기존 Tistory 관련 코드/문서를 다음과 같이 정리한다:
- `backend/.../tistory/TistoryApiClient.kt`, `TistoryController.kt` 삭제
- `User.kt`/`BlogPost.kt`의 tistory* 필드를 devto* 필드로 교체 (하이버네이트 `ddl-auto: update`가 컬럼 추가는 처리하지만 컬럼 삭제는 안 하므로, 안 쓰는 `tistory_access_token`/`tistory_blog_name`/`tistory_url` 컬럼은 DB에 남을 수 있음 — 로컬 1인 서비스라 수동으로 `ALTER TABLE ... DROP COLUMN`을 실행해 정리)
- `docs/superpowers/specs/2026-07-31-tistory-publish-design.md`, `docs/superpowers/plans/2026-07-31-tistory-publish.md`는 삭제하지 않고 "폐기됨(Tistory API 종료로 대체)" 헤더만 추가해 기록으로 남긴다
