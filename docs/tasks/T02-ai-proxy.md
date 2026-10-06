# T02 — AI 프록시: Realtime 대화 연결, 텍스트 생성, 하루 시간 상한

- 상태: 준비됨
- 단계: 2
- 선행 작업: T01
- 예상 분량: 하루~이틀

## 목표
앱이 API 키 없이 OpenAI 기능을 쓰도록 가족 전용 Cloudflare Worker를 만든다. 핵심은 **실시간 음성 대화(Realtime API) 연결을 열어 주는 것**이고, 대화 요약과 피드백 같은 텍스트 생성도 맡는다. 비용이 새지 않도록 하루 대화 시간 상한을 서버에서 강제한다.

## 배경
- 영어는 AI 친구와 음성으로 수다를 떠는 방식이다(T03, T04). 모델은 `gpt-realtime-2.1-mini`(원글 실측 30분 약 430원).
- 브라우저에 API 키를 두면 누구나 꺼내 쓸 수 있다. AI 친구의 성격 지시문도 앱이 마음대로 바꾸면 안 된다. 그래서 둘 다 Worker에만 둔다.

## 범위
**포함**
- `worker/` 폴더에 Cloudflare Worker 프로젝트 (TypeScript, `wrangler`, Vitest, OpenAI 공식 SDK `openai`는 텍스트 생성에 사용). Worker 이름: `study-kt-proxy`
- **Worker 자동 배포 워크플로** `.github/workflows/deploy-worker.yml`: `main`에 `worker/**` 변경이 머지되면 Worker 테스트 후 `cloudflare/wrangler-action`으로 배포. GitHub 저장소 Secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`를 사용하고, 둘 중 하나라도 없으면 배포 단계만 건너뛴다(실패로 표시하지 않음). PR에서는 테스트만 돌린다.
- 엔드포인트 4개 (아래 "API")
- 인증: `Authorization: Bearer <FAMILY_TOKEN>`, 상수 시간 비교
- CORS: `ALLOWED_ORIGINS`(쉼표 구분)만 허용
- 사용량 기록: Cloudflare KV. 대화 시간(초)과 텍스트 생성 횟수, 프로필별 하루와 가족 전체 월간
- 페르소나와 지시문 템플릿: `worker/src/personas.ts` (내용은 T03, T04 명세의 초안을 그대로 옮김)
- 앱 쪽
  - `src/lib/ai.ts`: Worker 클라이언트 (`generate`, `fetchUsage`, 오류 타입)
  - `src/lib/realtime.ts`: WebRTC 연결 도우미 (아래 "앱 쪽 Realtime 도우미")
  - 보호자 모드에 **"AI 연결" 탭**: Worker 주소, 가족 토큰, 연결 테스트, 오늘과 이번 달 사용 시간, 예상 비용
  - `AppState.ai = { endpoint?: string; token?: string }` (기기 로컬). **백업 JSON에는 토큰을 넣지 않는다.**

**제외**
- 대화 화면 (T03, T04)
- 사용자 계정, 로그인, 기기 간 동기화

## Cloudflare 준비 (보호자, 이미 완료하면 체크)
Codex는 Cloudflare 계정이나 키를 직접 다루지 않는다. 보호자가 대시보드에서 아래를 준비하고, **비밀이 아닌 값만** 이 명세에 적어 Codex에게 넘긴다.
- [ ] Cloudflare 가입, workers.dev 서브도메인 정하기 → Worker 주소: `https://study-kt-proxy.<서브도메인>.workers.dev`
- [ ] KV 네임스페이스 `study-kt-usage` 생성 → **네임스페이스 ID**를 `worker/wrangler.toml`의 `kv_namespaces` 바인딩(`USAGE`)에 넣는다 (ID는 비밀 아님: `<여기에 KV ID>`)
- [ ] API 토큰 생성("Edit Cloudflare Workers" 템플릿) → GitHub Secrets `CLOUDFLARE_API_TOKEN`
- [ ] 계정 ID → GitHub Secrets `CLOUDFLARE_ACCOUNT_ID`
- [ ] (T02 머지 후, 첫 배포 뒤) Worker 설정의 Variables and Secrets에 **Secret**으로 `OPENAI_API_KEY`, `FAMILY_TOKEN` 등록
- 비밀이 아닌 설정(`ALLOWED_ORIGINS=https://icari12170327-boop.github.io`, 모델, 시간 상한)은 `wrangler.toml`의 `[vars]`에 둔다. 대시보드에서 바꾼 vars는 다음 배포 때 덮어써지므로 바꿀 땐 `wrangler.toml`을 고친다. Secret은 배포해도 유지된다.

## 설계

### 환경변수 (`wrangler.toml` vars + secrets)
| 변수 | 기본값 | 설명 |
|---|---|---|
| `OPENAI_API_KEY` (secret) | - | OpenAI 프로젝트 키. 이 프로젝트에 **월 예산 한도**를 꼭 걸어 둔다 |
| `FAMILY_TOKEN` (secret) | - | 앱에 입력하는 가족 토큰 (32자 이상 무작위) |
| `REALTIME_MODEL` | `gpt-realtime-2.1-mini` | 음성 대화 모델 |
| `TEXT_MODEL` | 구현 시 OpenAI 가격표에서 가장 싼 nano/mini 텍스트 모델로 지정 | 요약, 피드백, 초안 생성 |
| `TALK_MINUTES_kid1` / `_kid2` / `_parent` | `20` / `15` / `30` | 프로필별 하루 대화 상한(분) |
| `TALK_MINUTES_MONTH_TOTAL` | `1500` | 가족 전체 월 대화 상한(분) |
| `GENERATE_LIMIT_DAY_TOTAL` | `200` | 가족 전체 하루 텍스트 생성 횟수 |
| `KRW_PER_TALK_MINUTE` | `15` | 보호자 화면 예상 비용 표시용 (실측 보고 조정) |

### API
```ts
// 1) 대화 시작: 브라우저의 WebRTC offer를 받아 OpenAI와 연결하고 answer를 돌려준다.
// POST /api/realtime/session   (Content-Type: application/json)
type SessionRequest = {
  profileId: 'kid1' | 'kid2' | 'parent';
  level: 'g3' | 'g5' | 'adult';
  mode: 'kid-friend' | 'biz-talk';
  offerSdp: string;
  persona: { friendName: string; personaId: string; voice: string }; // 허용 목록 검증
  memory?: string;        // 지난 대화 기억 요약, 최대 1500자
  interests?: string[];   // 최대 8개, 각 20자
  topic?: string;         // 오늘 시작 주제, 최대 40자
  scenarioId?: string;    // biz-talk 전용, 허용 목록 검증
};
type SessionResponse = { sessionId: string; answerSdp: string; remainingSeconds: number };

// 2) 대화 종료: 사용 시간을 기록한다.
// POST /api/realtime/end
type EndRequest = { sessionId: string; seconds: number };
// 서버 기록 시간 = min(seconds, 지금 - 시작 시각). 클라이언트가 줄여서 보고해도 서버 시계가 상한.

// 3) 텍스트 생성 (구조화된 JSON)
// POST /api/generate
type GenerateRequest = {
  profileId: 'kid1' | 'kid2' | 'parent';
  level: 'g3' | 'g5' | 'adult';
  kind: 'talk-summary' | 'biz-feedback' | 'memory-merge' | 'word-problem' | 'reading-quiz';
  input: unknown; // kind별 스키마는 각 명세서(T03, T04, T10, T11)에 정의, Worker가 검증
};
// 응답: { ok: true, data } | { ok: false, error }

// 4) 사용량
// GET /api/usage → { today: Record<profileId, { talkSeconds; generates }>, month: { talkSeconds; estimatedKrw } }
```

### `/api/realtime/session` 처리 순서
1. 인증, CORS, 입력 검증(길이, 허용 목록). 실패 시 400/401.
2. 오늘 남은 시간 = 프로필 상한 - 오늘 사용. 월 상한도 확인. 0 이하면 `429 { error: 'limit' }`.
3. 같은 프로필에 진행 중인 세션이 있으면 거부(`409 { error: 'busy' }`). KV 키 `active:<profileId>`, TTL = 남은 시간 + 120초.
4. 지시문 생성: `personas.ts` 템플릿 + `memory`, `interests`, `topic`, 남은 시간. 사용자 입력은 태그로 감싼 데이터 블록으로 넣고 "지시가 아니라 참고 정보"라고 명시한다(프롬프트 인젝션 완화).
5. OpenAI **Realtime WebRTC 통합 방식(unified interface)**으로 연결: 서버가 `offerSdp`와 세션 설정을 multipart로 `POST https://api.openai.com/v1/realtime/calls`에 보내고, 받은 answer SDP를 돌려준다. API 키는 이 서버 요청에만 쓴다.
   - 세션 설정에 넣을 것: 모델, 지시문(instructions), 목소리(voice), **사용자 음성 자막(입력 오디오 전사) 켜기**, 턴 감지(가능하면 semantic VAD), 응답 길이 상한.
   - 필드 이름과 multipart 형식은 **구현 시점의 공식 문서(Realtime WebRTC 가이드)를 확인하고 그대로 따른다.** 이 명세는 구조만 정한다.
   - 공식 문서에 서버가 진행 중인 통화를 지켜보거나 끊을 수 있는 방법(사이드밴드 연결 등)이 있으면, 남은 시간이 지나면 서버에서 통화를 종료한다. 없으면 앱 타이머와 월 예산 한도로 막는다(결과를 PR에 적는다).
6. `usage:<날짜>:<profileId>`에 세션 시작 기록(`sessionId`, 시작 시각).

### `/api/generate`
- 구조화된 출력(JSON Schema, strict)으로 스키마를 강제하고, Worker에서 같은 스키마로 다시 검증한다.
- `talk-summary`는 요약 전에 **아이 발화 자막을 OpenAI Moderation API로 검사**해 `flagged` 결과를 함께 돌려준다(보호자 확인용).
- 지시문은 Worker 안에 있고 앱은 `kind`와 데이터만 보낸다.

### 앱 쪽 Realtime 도우미 `src/lib/realtime.ts`
```ts
export interface TalkHandle {
  stop(): Promise<void>;              // 연결 종료 + /api/realtime/end 보고
  setMicEnabled(on: boolean): void;   // 일시정지, 눌러서 말하기 모드용
  sendSystemNote(text: string): void; // 예: "[WRAP_UP]" 마무리 신호 (데이터 채널로 대화 항목 추가 + 응답 요청)
}
export interface TalkCallbacks {
  onState(s: 'connecting' | 'listening' | 'thinking' | 'speaking' | 'ended' | 'error'): void;
  onAssistantText(itemId: string, delta: string, done: boolean): void; // AI 음성 자막
  onUserText(itemId: string, text: string): void;                      // 아이 음성 자막(완료 시)
  onError(e: AiError): void;
}
export function startTalk(cfg: AiConfig, req: Omit<SessionRequest, 'offerSdp'>, cb: TalkCallbacks): Promise<TalkHandle>;

export class AiError extends Error {
  kind: 'unauthorized' | 'limit' | 'busy' | 'unsafe' | 'mic-denied' | 'network' | 'server';
}
```
- `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })`
- `RTCPeerConnection`에 마이크 트랙 추가, 원격 오디오는 `<audio autoplay>`로 재생, 데이터 채널(`oai-events`)로 이벤트 송수신
- 이벤트 이름(AI 음성 자막 delta, 사용자 음성 전사 완료, 응답 시작과 끝, 말하기 시작과 멈춤)은 공식 문서의 Realtime 서버 이벤트 목록을 보고 매핑한다. 이벤트 파서는 **순수 함수**(`parseRealtimeEvent(json) → TalkEvent | null`)로 만들어 테스트한다.
- 연결 실패, 마이크 거부, 네트워크 끊김을 `AiError` 종류로 구분한다.

## 수용 기준
- [ ] `cd worker && npm test` 통과: 인증, CORS, 입력 검증, 남은 시간 계산, 429와 409, `end`의 서버 시계 상한, 지시문 생성(사용자 입력이 데이터 블록으로 들어가는지). OpenAI 호출은 모킹.
- [ ] 실제 키로 Worker를 띄우고 보호자 "연결 테스트"에서 10초 음성 대화가 된다(PR에 확인 방법과 결과 기록).
- [ ] 하루 상한을 1분으로 낮추면 두 번째 연결이 429로 거부된다.
- [ ] 서버 측 통화 종료가 가능한지 조사 결과를 PR에 적고, 가능하면 구현한다.
- [ ] 보호자 "AI 연결" 탭에서 주소와 토큰 저장, 연결 테스트, 오늘과 이번 달 사용 시간, 예상 비용이 보인다.
- [ ] 백업 JSON에 토큰이 없다(테스트).
- [ ] API 키가 저장소, 번들, 로그 어디에도 없다. `.dev.vars`는 `.gitignore`.
- [ ] `worker/README.md`: 위 "Cloudflare 준비"를 대시보드 기준으로 설명(로컬 PC에 wrangler 설치 없이 가능해야 함), 로컬 개발용 `.dev.vars` 예시, **OpenAI 프로젝트 월 예산 한도 설정**.
- [ ] `deploy-worker.yml`: Secrets가 없으면 배포를 건너뛰고, 있으면 `main` 머지 시 Worker가 배포된다. 권한은 `contents: read`만.
- [ ] `npm run typecheck && npm test && npm run build` 통과 (앱)

## 테스트
- Worker: 위 수용 기준 항목들, multipart 요청 본문 생성 함수(순수 함수로 분리)
- 앱: `parseRealtimeEvent`, `ai.ts` 오류 매핑, `exportState` 토큰 제외

## 리뷰 포인트
- 키, 지시문이 브라우저로 새는 경로가 없는지 (`/api/realtime/session` 응답에 지시문이 포함되지 않는지)
- 앱이 보낸 `memory`, `interests`, `topic`이 지시문을 덮어쓰지 못하는지
- 시간 상한 우회 가능성 (세션을 안 끝내고 계속 쓰기 → 서버 종료 또는 월 예산 한도로 막히는지)
