# 주간 캘린더 홈 + 미션 + 멀티채널 초안

## 배경

대시보드는 히트맵·레포 카드 요약이고, 블로그 초안은 미작성 커밋 전부를 한 글에 몰아넣으며, 발행은 dev.to뿐이다. 홈을 “이번 주” 한 화면으로 바꿔 커밋·습관·계획을 같이 보고, 그 주 커밋만으로 블로그/LinkedIn/X 초안을 만든 뒤 복사하게 한다.

이번 슬라이스에 넣지 않는 것: GitHub App, 토큰 암호화, LinkedIn/X 실제 API 발행, Hashnode, 월간 캘린더, 이메일 알림, PDF/히트맵 개편.

## 사용자 흐름

1. 로그인 후 `/dashboard`가 이번 주(월–일) 보드다. 기본 타임존 `Asia/Seoul`, 주는 월요일 시작.
2. 왼쪽 레일: 습관 3개(진행률 + 목표 숫자 수정)와 직접 추가한 계획 목록.
3. 가운데: 요일 7칸. 각 칸에 그날 커밋(첫 줄)과 그날 due인 계획.
4. 상단 주 이동(`이전 주` / `이번 주` / `다음 주`)과 **이번 주 초안 만들기**.
5. 초안이 있으면 보드 아래 카드 3장(블로그 / LinkedIn / X). 각 카드에 복사, 블로그는 기존 에디터로 이동.
6. 블로그 페이지(`/blog`)는 아카이브. “새 초안”은 홈의 주간 생성으로 대체한다(미작성 커밋 전체 생성 제거).
7. 사이드바 라벨 “대시보드” 유지, 목적지만 주간 보드.

## 습관 규칙

세 습관은 사용자마다 항상 존재한다. 첫 `GET /api/week` 때 없으면 기본값으로 시드한다.

| key | 기본 제목 | 기본 target | 완료 조건 |
|---|---|---|---|
| `COMMIT_DAYS` | 커밋한 날 | 5 | 그 주 커밋이 있는 고유 날짜 수 ≥ target |
| `WEEKLY_POST` | 글 초안 | 1 | 그 주 `weekStart`가 같은 BlogPost 수 ≥ target |
| `PUBLISH_OUTSIDE` | 밖에 글 올리기 | 1 | 그 주 사용자가 수동 체크한 횟수 ≥ target |

- `COMMIT_DAYS` / `WEEKLY_POST`는 데이터로 계산한다. 체크박스로 강제 완료하지 않는다.
- `PUBLISH_OUTSIDE`만 수동 토글이다. 외부 발행을 검증하지 않는다(LinkedIn API 없음).
- target은 1 이상 정수. 습관 행에서 숫자를 바꿔 저장한다.
- 습관 제목/삭제/추가 커스텀은 하지 않는다. 끄는 기능도 없다.

## 계획 (수동 미션)

사용자가 제목과 날짜를 넣어 추가하는 할 일이다. 주간 보드의 해당 날짜 칸과 왼쪽 레일에 같이 보인다. 체크하면 완료.

## 데이터 모델

### HabitSetting (신규)

사용자당 key 하나.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | Long | PK |
| user | User | 소유자 |
| key | String | `COMMIT_DAYS` / `WEEKLY_POST` / `PUBLISH_OUTSIDE` |
| target | Int | 기본 위 표 |
| unique | (user, key) | |

### HabitCheck (신규)

`PUBLISH_OUTSIDE` 전용. 그 주에 올렸다고 표시한 기록.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | Long | PK |
| user | User | |
| habitKey | String | 지금은 `PUBLISH_OUTSIDE`만 |
| weekStart | LocalDate | 그 주 월요일 |
| checkedAt | Instant | |

같은 (user, habitKey, weekStart)는 1행. 토글 끄면 삭제.

### Plan (신규)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | Long | PK |
| user | User | |
| title | String | 200자 |
| dueOn | LocalDate | 보드에 올라가는 날짜 |
| doneAt | Instant? | null이면 미완료 |
| createdAt | Instant | |

### BlogPost (수정)

| 필드 | 타입 | 설명 |
|---|---|---|
| linkedinContent | TEXT? | LinkedIn용 본문 |
| twitterContent | TEXT? | X 스레드. 트윗은 빈 줄 두 개로 구분 |
| weekStart | LocalDate? | 주간 생성 시 그 주 월요일. 구 글은 null |

주간 생성은 그 주 커밋만 글에 연결한다. 미작성 커밋 전체를 집어넣지 않는다. 같은 `weekStart`로 다시 생성하면 기존 그 주 글을 덮어쓴다(제목/본문/소셜 필드 교체, 커밋 연결 재설정). 사용자가 에디터에서 고친 블로그 본문도 덮인다. UI에 “다시 만들면 이 주 초안을 덮어씁니다”를 보여 준다.

## API

기준 시각은 서버에서 `Asia/Seoul`로 계산한다. `weekStart` 쿼리는 `YYYY-MM-DD`(월요일). 월요일이 아니면 400.

### `GET /api/week?weekStart=`

`weekStart` 생략 시 오늘이 속한 주.

응답:

```json
{
  "weekStart": "2026-08-10",
  "weekEnd": "2026-08-16",
  "habits": [
    {
      "key": "COMMIT_DAYS",
      "title": "커밋한 날",
      "target": 5,
      "current": 3,
      "done": false
    }
  ],
  "plans": [
    {
      "id": 1,
      "title": "이력서 문장 다듬기",
      "dueOn": "2026-08-14",
      "done": false
    }
  ],
  "days": [
    {
      "date": "2026-08-14",
      "commits": [
        {
          "id": 10,
          "repoName": "foo",
          "message": "fix login redirect",
          "htmlUrl": "https://github.com/..."
        }
      ]
    }
  ],
  "pack": {
    "id": 3,
    "title": "...",
    "content": "...",
    "linkedinContent": "...",
    "twitterContent": "...",
    "published": false,
    "devtoUrl": null
  }
}
```

`pack`은 그 `weekStart`인 BlogPost가 있으면 넣고, 없으면 `null`. `days`는 월–일 7칸 고정. 커밋은 `committedAt`을 서울 날짜로 자른다. 메시지 첫 줄만. 하루 8개까지, 나머지는 `commitExtra` 카운트 필드로 알려 준다.

하루 커밋이 8개를 넘으면:

```json
"commitExtra": 4
```

해당 day 객체에 추가.

### 습관

- `PUT /api/habits/{key}` `{ "target": 3 }` — target만. key가 세 개 중 아니면 404. target < 1이면 400.
- `PUT /api/habits/PUBLISH_OUTSIDE/check` `{ "weekStart": "2026-08-10", "checked": true }` — 체크 생성/삭제. 응답은 갱신된 habit 객체.

### 계획

- `POST /api/plans` `{ "title": "...", "dueOn": "2026-08-14" }`
- `PUT /api/plans/{id}` `{ "title"?, "dueOn"?, "done"? }`
- `DELETE /api/plans/{id}`

다른 사용자 것이면 404.

### 주간 초안

`POST /api/blog-posts/generate-week` `{ "weekStart": "2026-08-10" }`

1. 그 주 커밋이 0개면 400. 메시지: `이번 주에 기록된 커밋이 없습니다. 먼저 레포를 동기화해주세요.`
2. Gemini에 그 주 커밋 목록(`[repo] 첫줄`)을 넣고 JSON만 받는다:

```json
{
  "title": "블로그 제목",
  "content": "마크다운 본문",
  "linkedin": "150~250자 한국어 포스트. 해시태그 3개 이하",
  "twitter": "트윗1\n\n트윗2\n\n..."
}
```

트윗은 3~5개, 각 280자 이내를 프롬프트에 명시한다. 모델이 넘기면 저장은 하되 UI에서 글자 수를 보여 준다.

3. 같은 weekStart 글이 있으면 update, 없으면 insert. 그 주 커밋만 `blogPost` FK로 연결(이전 연결은 그 글 기준 끊고 다시 연결).
4. `BlogPostDetail`에 `linkedinContent`, `twitterContent`, `weekStart`를 넣어 반환.

기존 `POST /api/blog-posts/generate`는 삭제한다. 프론트도 호출하지 않는다.

`PUT /api/blog-posts/{id}`는 `title`, `content`에 더해 `linkedinContent`, `twitterContent`를 선택적으로 받는다.

## 프론트

### `/dashboard`

레이아웃: 왼쪽 280px 레일 + 나머지 7열 그리드. 기존 히트맵·레포 카드 레이아웃은 이 페이지에서 제거한다. 레포 추가는 Topbar/기존 `openAddRepo`로 유지.

레일:

- 습관: 제목, `current/target`, 진행 바. target은 숫자 클릭 후 입력. `PUBLISH_OUTSIDE`만 체크박스.
- 계획: 미완료 위에, 완료는 취소선. 인라인 추가로 제목 + 날짜(기본 오늘).

보드:

- 열 헤더: 요일 + 날짜. 오늘은 악센트 테두리.
- 커밋은 작은 행, 클릭 시 GitHub. 8개 넘으면 `+N`.
- 그날 계획을 커밋 아래에 체크 가능한 칩으로.

하단 초안 카드(pack 있을 때): 블로그(미리보기 4줄 + 편집으로), LinkedIn, X. 각 **복사**. X는 트윗별로 복사 + 전체 복사.

커밋이 있는 주만 초안 버튼 활성. 재생성 시 confirm.

### 기타

- `BlogPostDetail` 타입/에디터에 LinkedIn·X 탭 또는 하단 텍스트 영역. 저장 시 세 필드 모두.
- `/blog` 목록에서 주간 생성 버튼 제거. 홈으로 유도하는 문구.
- 기존 인라인 스타일 패턴 유지.

## 에러

- 주간 커밋 0개 생성 → 400, 위 메시지
- Gemini 실패 → 기존과 같이 메시지 노출, 기존 pack 유지
- 잘못된 weekStart(월요일 아님) → 400

## 테스트

- 서울 기준 일요일 23:00 / 월요일 00:30이 다른 주에 들어가는지
- 주간 생성은 그 주 커밋만 연결하는지
- 같은 주 재생성 시 소셜 필드가 덮이는지
- `PUBLISH_OUTSIDE` 토글 후 `current`/`done`이 바뀌는지
- target을 3으로 낮추면 `COMMIT_DAYS` done이 재계산되는지
