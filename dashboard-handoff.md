# /dashboard — Week Pulse 핸드오프 스펙

이 문서는 `frontend/src/pages/DashboardPage.tsx`, `frontend/src/components/ActivityChart.tsx`,
`frontend/src/theme.css` 의 구현 근거이자, 이 화면이 동작하려면 **백엔드에 무엇이 더 필요한지**의 목록이다.
디자인 원본(실행 가능한 프로토타입): `Dashboard Week Pulse.dc.html`

---

## 0. 화면의 단 하나의 목표

> 개발자 한 명이 "나 이번 주에 뭐 좀 했나?"를 **10초 안에** 판단하고, 바로 행동한다(동기화 / 요일 열기 / 초안 만들기).

이 목표를 깨는 변경은 하지 않는다. 특히:
- 요일 셀 안에는 커밋 메시지를 넣지 않는다(숫자 + 라벨만).
- 12주 곡선은 항상 화면 맨 아래. GitHub식 잔디 히트맵으로 바꾸지 않는다.
- 주 시작은 월요일, 모든 날짜 경계는 `Asia/Seoul`.
- 활동 없는 날/주에 "비어 있음" 같은 질책성 문구를 쓰지 않는다.

---

## 1. 디자인 시스템

**색 (theme.css 토큰)**

| 용도 | 토큰 | 다크 | 라이트 |
|---|---|---|---|
| 배경 | `--bg` | `#191e22` | `#f5f6f6` |
| 패널 | `--surface` / `--panel` | `#212830` | `#ffffff` |
| 요일 셀 | `--cell` / `--cell-active` | `#262e35` / `#2b343c` | `#ffffff` / `#f2f8fd` |
| 본문 / 보조 | `--text` / `--muted` | `#f0f4f5` / `#96a3a9` | `#14191c` / `#7d8a8d` |
| **커밋** | `--act-commit` | `#6fb6f0` | `#1f74b8` |
| **계획** | `--act-plan` | `#f0b45e` | `#a86c14` |
| **초안** | `--act-draft` | `#5fd3b1` | `#1c8a6c` |

규칙: **색은 활동 종류만 인코딩한다.** 장식 목적의 색·그라디언트를 추가하지 않는다.
색을 무시해도 읽혀야 하므로 모든 카운트는 `숫자 + 라벨`(`8 커밋`) 형태를 유지한다.

**타이포**: 한글 UI = Pretendard(`--font-ui`), **숫자·시각·레포명만** JetBrains Mono(`--font-mono`).
대문자 + 넓은 자간 라벨은 쓰지 않는다(딱딱해짐).

**형태**: radius 8 / 12 / 14px, 주 이동 화살표는 `--hit` = 38px(최소 36px 준수).

**모션**: 등장 시 파형 1회 트레이스(`wp-trace`)만. `prefers-reduced-motion`에서 전부 정지.

---

## 2. 레이아웃

```
헤더        ‹ › 주 범위 · 오늘 · GitHub에서 가져오기 · 초안 만들기(범위 배지)
상태줄      동기화 상태 · 액션 · 단축키 힌트
┌ 좌 레일 236px ┬ 본문 ─────────────────────────────┐
│ 습관(7칸 점)   │ [주간 신호 카드]                    │
│ 계획(커밋 연결)│   7일 파형 SVG                      │
│               │   요일 셀 7개 (요일·날짜·칩 2개)     │
│               │ 선택한 날 상세 (레포·메시지·diff·시각)│
│               │ 초안 카드 3개 (상태 배지)            │
│               │ 최근 12주 곡선 (평균선·툴팁)         │
│               │ 데이터 사용 고지                     │
└───────────────┴─────────────────────────────────┘
```

**시그니처**: 상단 7일 파형과 하단 12주 곡선이 같은 문법(부드러운 곡선 + 흰 점 + 수직 헤어라인)을 공유한다.
요일 셀 안에 미니 그래프를 넣지 않는다 — 파형은 셀 **위에 한 줄**로만 존재한다.

**반응형**: `window.innerWidth < 1000` 이면 `narrow` — 레일이 본문 위로 2열 스택, 요일 셀 7열 → 4열,
상세 행에서 diff 열 제거, 초안 1열, 단축키 힌트 숨김. (인라인 스타일이므로 미디어쿼리 대신 resize 리스너)

---

## 3. 상태 분기 (필수)

`DashboardPage`는 6가지 상태를 그린다. 프로토타입에서는 Tweaks의 `viewState`로 전환해 확인할 수 있다.

| 상태 | 조건 | 화면 |
|---|---|---|
| `no-repo` | `hasTrackedRepos === false` | 대시보드 대신 "추적할 레포를 먼저 등록해요" + `레포 등록하기` |
| `not-synced` | `syncState.kind === 'never'` | 파형/셀을 18% 로 죽이고 오버레이 + `GitHub에서 가져오기`. 상세·초안 숨김 |
| `syncing` | `syncState.kind === 'syncing'` | 버튼 스피너 + 상태줄 "가져오는 중" |
| `error` | `syncState.kind === 'error'` | 앰버 상태줄 + 원인 문구 + `GitHub 다시 연결` / `다시 시도` |
| `zero-week` | 동기화됨 & 주 커밋 0 | 조용한 안내 + "지난주에는 N개" + `지난주 보기`. 상세 숨김 |
| `ready` | 그 외 | 전체 |

에러 코드별 문구는 `ERRORS` 맵에 있다: `token_expired` / `rate_limited` / `no_access`.

---

## 4. 컴포넌트 Props (구현 완료, 이대로 채워주면 됨)

```ts
type SyncState =
  | { kind: 'never' }
  | { kind: 'syncing' }
  | { kind: 'ok'; lastSyncedAt: string; autoSync: boolean }
  | { kind: 'error'; lastAttemptAt: string; code: 'token_expired' | 'rate_limited' | 'no_access' };

type DayCell = { date: Date; commits: number; plans: number };            // 7개, 월요일 시작

type Commit = {
  sha: string; repo: string;        // 'owner/name'
  message: string;                  // 첫 줄만
  additions: number; deletions: number;
  isMerge: boolean; isBot: boolean; // 필터용 — 서버에서 판정해서 내려준다
  committedAt: string;              // ISO, KST로 렌더
  htmlUrl: string;                  // 행 클릭 → GitHub
};

type Plan  = { id: string; title: string; dayIndex: number; linkedCommitCount: number };
type Habit = { name: string; done: boolean[] };                            // 길이 7
type Draft = {
  id: string; channel: 'blog' | 'linkedin' | 'x'; title: string;
  status: 'draft' | 'published' | 'failed';
  sourceCommitCount: number; updatedAt: string; publishedUrl?: string;
};
type WeeklyPoint = { weekStart: string; count: number };                    // 12개, 오래된 주 → 최근 주
```

콜백: `onPrevWeek` `onNextWeek` `onToday` `onSelectDay` `onSelectWeek` `onSync`
`onReconnectGithub` `onAddRepo` `onCreateDraft` `onOpenDraft` `onRetryPublish` `onOpenRepoScope`

프론트 로컬 상태(서버 불필요): `excludeMerges`(기본 true), `repoFilter`, `narrow`, 차트 hover.

---

## 5. 백엔드에 필요한 것 (우선순위)

### P0 — 없으면 화면이 거짓말을 한다

1. **주간 집계 API**
   `GET /api/weeks?start=2026-08-10&tz=Asia/Seoul`
   → `{ days: [{date, commitCount, planCount}] x7, weekly: [{weekStart, count}] x12, unwrittenCommitCount }`
   주 경계는 **서버가 KST로** 계산한다(클라이언트 타임존 신뢰 금지).
2. **커밋 메타 확장** — 기존 커밋 응답에 `additions` `deletions` `isMerge` `isBot` `htmlUrl` 추가.
   `isMerge`: 부모 2개 이상. `isBot`: author login이 `[bot]` 로 끝나거나 알려진 봇 목록.
3. **동기화 상태 리소스**
   `GET /api/sync/status` → `SyncState` 그대로.
   `POST /api/sync` → 202 + 진행 상태. 실패 시 `code`를 반드시 위 3종으로 정규화.
   GitHub 토큰 만료(401)와 rate limit(403 + `X-RateLimit-Remaining: 0`)을 구분해서 저장.
4. **초안 범위 확정** — `unwrittenCommitCount` = 어떤 초안에도 포함되지 않은 커밋 수.
   `POST /api/drafts` 는 이 집합을 쓴다. 버튼 배지 숫자와 실제 생성 범위가 반드시 일치해야 한다.

### P1 — 화면의 절반이 죽어 있다

5. **계획 ↔ 커밋 연결** — `Plan.linkedCommitCount`.
   1차: 같은 날(KST) + 계획 키워드가 커밋 메시지에 포함되면 연결. 2차: 사용자가 수동 연결.
   이 연결이 없으면 좌측 계획 레일은 메모장에 불과하다.
6. **초안 상태 · 발행 이력** — `status`, `publishedUrl`, `POST /api/drafts/{id}/publish/retry`,
   `GET /api/drafts?status=published` (발행 이력 화면).
7. **자동 동기화** — 스케줄러(1일 3~4회 + 로그인 직후). 수동 버튼은 fallback으로 남긴다.
   `autoSync` on/off는 사용자 설정.

### P2 — 신뢰도와 안전

8. **AI 전송 레포 스코프** — `repo.aiScopeEnabled` (private 레포는 기본 false).
   `onOpenRepoScope` 가 여는 설정 화면 필요. 커밋 메시지를 Gemini로 보내기 전 서버에서 이 플래그로 필터링.
9. **레포별 필터 성능** — 선택한 날 커밋은 이미 서버에서 날짜로 좁혀 오므로 클라이언트 필터로 충분.
   단, 주간 집계는 `(user_id, committed_at)` 인덱스 필요.
10. **접근성/키보드** — 프론트 구현 완료(파형 `role="img"` + aria 요약, `:focus-visible` 링,
    `← →` 주 이동 / `1–7` 요일 / `T` 오늘). 새 인터랙션 추가 시 같은 규칙 유지.

---

## 6. 하지 말 것

- 커밋 수를 "생산성 점수"로 환산하거나 순위·배지·연속 기록 압박 UI 추가.
- 요일 셀에 커밋 메시지·아바타·레포 아이콘 추가(스캔 속도가 목표).
- 히트맵/도넛/스택바 도입, 차트 라이브러리 추가(plain SVG 유지).
- 배경 그라디언트 화려하게, 보라 액센트, Inter 계열 폰트로 회귀.
- 라이트 테마를 다크 값 그대로 밝히기(토큰이 이미 분리되어 있다).
