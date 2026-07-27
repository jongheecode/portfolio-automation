# 포트폴리오 AI 큐레이션 설계

## 배경

3단계(포트폴리오 PDF)는 추적 중인 레포를 전부 자동으로 나열하는 수준이었다. 실제 포트폴리오로 쓰려면 어떤 프로젝트를 넣을지 고르고, GitHub 설명 그대로가 아니라 자기소개·강점/약점·프로젝트별 어려웠던 점 같은 실제 포트폴리오 항목을 AI가 초안으로 써주고, 사용자가 다듬어서 PDF로 뽑는 흐름이 필요하다.

## 문서 구조

포트폴리오는 사용자당 하나의 마크다운 문서(PortfolioDraft)로 관리한다. 블로그 초안과 동일하게 "AI 생성 → 마크다운 편집 → 확정" 흐름을 따른다.

포함 가능한 섹션(체크박스로 켜고 끔):

- **자기소개**: 선택된 레포 전체의 언어/구성을 보고 AI가 초안 작성
- **기술 스택 종합 요약**: 선택된 프로젝트들의 언어 비중을 모아 정리
- **프로젝트별 카드** (레포 체크박스로 선택): 한 줄 소개 + 주요 기능·역할. "어려웠던 점과 해결 과정" 섹션이 켜져 있으면 각 카드에 그 프로젝트의 어려웠던 점도 포함
- **강점/약점**: 커밋 패턴(언어 다양성, 빈도 등)에서 추측한 초안. 가장 주관적이므로 사용자 직접 수정이 많이 필요하다는 점을 UI에 안내

## 데이터 흐름

1. `/pdf` 페이지에서 레포 체크박스(포함 여부) + 섹션 체크박스(자기소개/어려운점/강점약점/기술스택) 선택. 선택 상태는 즉시 저장.
2. "AI로 초안 생성" 클릭 → 백엔드가 선택된 각 레포에 대해 README(GitHub API)와 언어 비중(GitHub API `/languages`)을 가져오고, 이미 저장된 커밋 목록과 함께 프롬프트를 구성해 Claude 호출 → 전체 포트폴리오 마크다운 문서 하나를 응답으로 받음
3. 결과를 PortfolioDraft에 저장(사용자당 1행, 재생성 시 덮어씀)
4. 마크다운 편집 화면(블로그 에디터와 동일한 컴포넌트 재사용)에서 사용자가 직접 수정
5. "PDF 생성"은 저장된(수정된) 마크다운을 commonmark로 HTML 변환 후 기존 openhtmltopdf 파이프라인으로 PDF 렌더링

기존의 "레포 목록 그대로 자동 나열" PDF 생성 방식은 이 흐름으로 대체된다(제거).

## 데이터 모델

### PortfolioDraft (신규)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | Long | PK |
| user | User (FK) | 소유자 |
| content | TEXT | 마크다운 본문 |
| includedRepoIds | String | 마지막 생성에 포함된 레포 id CSV |
| includedSections | String | 켜져 있던 섹션 키 CSV (예: `intro,challenges,strengths,techstack`) |
| updatedAt | Instant | |

사용자당 1행. 최초 생성 시 insert, 이후 재생성/수정은 update.

### TrackedRepo (수정)

- `includeInPortfolio: Boolean = false` 추가 — 체크박스 상태 저장용. `TrackedRepoResponse`에도 노출해서 프론트가 초기 체크 상태를 받을 수 있게 함.

## 백엔드 변경

### GithubApiClient 추가 메서드

- `fetchReadme(accessToken, owner, repo): String?` — `GET /repos/{owner}/{repo}/readme`, `Accept: application/vnd.github.raw` 헤더로 원문 텍스트 바로 받음. 404(README 없음)는 null 처리.
- `fetchLanguages(accessToken, owner, repo): Map<String, Long>` — `GET /repos/{owner}/{repo}/languages`.

### 새 엔드포인트

- `PUT /api/tracked-repos/{id}/portfolio-selection` `{ include: Boolean }` — 포함 여부 토글
- `GET /api/portfolio-draft` — 현재 저장된 초안 조회(없으면 404 대신 빈 상태 응답)
- `POST /api/portfolio-draft/generate` `{ sections: string[] }` — 선택된 레포(`includeInPortfolio=true`) 기준으로 README/언어/커밋 모아 Claude 호출, PortfolioDraft upsert 후 반환
- `PUT /api/portfolio-draft` `{ content: string }` — 마크다운 직접 수정 저장
- `GET /api/portfolio-pdf` — PortfolioDraft.content를 commonmark→HTML→PDF 변환해 다운로드 (기존 스냅샷 나열 방식 제거)

### AnthropicClient 추가 메서드

`generatePortfolioDraft(sections, repoInputs): String` — repoInputs는 레포별 {fullName, description, language, languageBreakdown, readme(길면 4000자 컷), 최근 커밋 메시지 목록}. 블로그와 달리 JSON 래핑 없이 마크다운 원문을 그대로 응답받도록 프롬프트 구성(문서 안에 제목 포함).

## 프론트엔드 변경

`/pdf` 페이지를 재구성:

- 상단: 섹션 체크박스 4개(자기소개/어려운점/강점약점/기술스택 요약)
- 레포 목록: 각 항목에 포함 체크박스 (기존 미리보기 목록 재사용, 체크박스만 추가)
- "AI로 초안 생성" 버튼
- 초안이 있으면 마크다운 에디터(편집/미리보기 토글 — BlogPostDetailPage와 동일 패턴) + "PDF 생성" 버튼
- 강점/약점 섹션을 켰을 때 "AI 추측이라 직접 검토가 특히 필요합니다" 안내 문구

## 에러 처리

- README 없는 레포는 조용히 스킵(AI 프롬프트에 "README 없음"으로 명시)
- Claude 호출 실패 시 기존 블로그와 동일하게 에러 메시지를 화면에 그대로 노출
- 포함된 레포가 0개인 상태로 생성 시도 → 400 에러 ("최소 1개 레포를 선택해주세요")

## 범위 밖 (v2)

- 섹션 순서 변경/커스텀 섹션 추가
- 여러 개의 포트폴리오 버전 관리(현재는 사용자당 1개만)
- PDF 디자인 커스터마이징(현재 스타일 그대로 재사용)
