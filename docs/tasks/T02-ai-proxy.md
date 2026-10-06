# T02 — AI 프록시 (Cloudflare Worker + OpenAI API)

- 상태: 준비됨
- 단계: 2
- 선행 작업: T01
- 예상 분량: 하루

## 목표
앱이 API 키 없이 AI 기능을 쓸 수 있도록, 가족 전용 서버리스 프록시를 만든다. 이후 T03~T06이 모두 이 프록시를 쓴다.

## 배경
브라우저에 OpenAI API 키를 넣으면 누구나 키를 꺼내 쓸 수 있다. 키는 Worker 비밀값에만 두고, 앱은 가족 토큰으로 프록시를 호출한다. 비용 폭주를 막기 위해 사용량 제한을 서버에서 강제한다.

## 범위
**포함**
- `worker/` 폴더에 Cloudflare Worker 프로젝트 (TypeScript, `wrangler`, OpenAI 공식 SDK `openai`)
- AI 호출은 **제공사 어댑터**(`worker/src/providers/`) 뒤에 둔다. 1차 구현은 `openai.ts` 하나. 나중에 다른 제공사로 바꿀 때 어댑터만 추가하면 되게 한다.
- 엔드포인트
  - `POST /api/chat`: 대화형, **SSE 스트리밍** 응답 (T03, T04)
  - `POST /api/generate`: 구조화된 JSON 한 번에 받기 (T05, T06)
  - `GET /api/usage`: 오늘 프로필별 사용량 조회 (보호자 화면용)
- 인증: `Authorization: Bearer <FAMILY_TOKEN>`. 토큰은 Worker 비밀값 `FAMILY_TOKEN`과 비교(상수 시간 비교).
- CORS: 환경변수 `ALLOWED_ORIGINS`(쉼표 구분)에 있는 출처만 허용
- 사용량 제한: Cloudflare KV에 `usage:<YYYY-MM-DD>:<profileId>` 키로 요청 수와 토큰 수(응답의 usage 입력+출력 토큰) 누적. 프로필별 하루 상한을 넘으면 `429`와 한국어 메시지
- 앱 쪽: `src/lib/ai.ts`(프록시 클라이언트), 보호자 모드 "백업·보안" 탭 옆에 **"AI 연결" 설정**(프록시 주소, 가족 토큰 입력, 연결 테스트 버튼, 오늘 사용량 표시)
- 저장: 프록시 주소와 토큰은 `AppState.ai = { endpoint?: string; token?: string }`에 저장 (기기 로컬). **백업 JSON에는 토큰을 넣지 않는다.**

**제외**
- 실제 회화, 퀴즈 화면 (T03~T06)
- 사용자 계정, 로그인

## 설계

### 모델과 요청 기본값 (Worker 환경변수로 바꿀 수 있게)
저렴한 소형 모델을 기본으로 쓰고, 용도별로 모델을 따로 지정할 수 있게 한다.

| 변수 | 기본값 (예시) | 설명 |
|---|---|---|
| `AI_PROVIDER` | `openai` | 제공사 어댑터 선택 |
| `CHAT_MODEL` | `gpt-5-mini` | 회화(T03, T04). 대화 품질이 중요하므로 mini급 |
| `GENERATE_MODEL` | `gpt-5-nano` | 문장제, 퀴즈, 피드백 생성(T05, T06). 짧은 구조화 출력이라 가장 싼 nano급 |
| `MAX_OUTPUT_TOKENS_CHAT` | `300` | 회화 답장 길이 상한 (아이 답장은 2문장이면 충분) |
| `MAX_OUTPUT_TOKENS_GENERATE` | `1500` | 생성 요청 상한 |
| `DAILY_REQUEST_LIMIT_KID` | `60` | 아이 프로필 하루 요청 수 |
| `DAILY_REQUEST_LIMIT_PARENT` | `150` | 보호자 하루 요청 수 |
| `DAILY_REQUEST_LIMIT_TOTAL` | `300` | 가족 전체 하루 요청 수 (profileId를 바꿔 보내는 우회 방지) |

- **모델 이름은 구현 시점에 OpenAI 공식 가격 페이지(platform.openai.com/docs/pricing)와 모델 목록에서 확인해 기본값을 정한다.** 표의 값은 예시다. 기획 시점(2026년 10월) 기준 저가 후보는 nano, mini 계열이다.
- 호출 방식은 OpenAI 공식 SDK 문서를 확인하고 구현한다. 기억에 의존해 파라미터 이름을 짐작하지 않는다. 권장 구성:
  - 회화: Responses API 스트리밍. 시스템 지시(`instructions`)와 대화 기록(`input`)을 보낸다.
  - 생성: Responses API의 구조화된 출력(JSON Schema, `strict`)으로 스키마를 강제한다. 그래도 Worker에서 한 번 더 검증한다(아래 "검증").
  - 추론(reasoning) 모델이면 회화는 가장 낮은 추론 수준을 써서 지연과 비용을 줄인다(모델이 지원할 때만).
- 시스템 프롬프트는 앱이 보내지 않는다. **Worker 안에 프롬프트 템플릿(`worker/src/prompts.ts`)을 두고**, 앱은 `mode`와 파라미터만 보낸다. 앱이 임의 프롬프트를 보내 프록시를 범용 API처럼 쓰는 것을 막기 위해서다.
- 프롬프트 캐싱: OpenAI는 앞부분이 같은 긴 프롬프트를 자동으로 캐싱한다. 시스템 지시를 맨 앞에 고정하고, 날짜나 요청 id 같은 변하는 값은 넣지 않는다.
- **안전 확인**: 아이 대화(`mode: 'kid-talk'`)는 아이가 보낸 메시지를 OpenAI Moderation API로 먼저 검사하고, 걸리면 모델을 부르지 않고 `{ error: "unsafe" }`를 돌려준다. 아이 화면에는 "다른 이야기를 해 볼까요?"를 보여준다. 모델이 답을 거부한 경우도 같은 오류로 처리한다.
- SDK 오류는 SDK가 제공하는 오류 클래스와 HTTP 상태로 구분한다(429 → 앱에 `limit`, 그 외 → 502). 오류 메시지 문자열 비교는 하지 않는다.
- 어댑터 인터페이스 (제공사와 무관한 형태):
  ```ts
  interface AiProvider {
    streamChat(p: { model: string; system: string; messages: ChatTurn[]; maxOutputTokens: number }): AsyncIterable<string>; // 텍스트 조각
    generateJson<T>(p: { model: string; system: string; user: string; schemaName: string; schema: object; maxOutputTokens: number }): Promise<{ data: T; usage: Usage }>;
    moderate(text: string): Promise<{ flagged: boolean }>;
  }
  ```

### 요청과 응답 형태
```ts
// POST /api/chat  (응답: text/event-stream)
type ChatRequest = {
  profileId: 'kid1' | 'kid2' | 'parent';
  level: 'g3' | 'g5' | 'adult';
  mode: 'kid-talk' | 'biz-roleplay';
  scenarioId: string;              // Worker의 시나리오 목록에 있는 id만 허용
  messages: { role: 'user' | 'assistant'; content: string }[]; // 최대 30개, 각 500자
};
// SSE 이벤트: data: {"type":"text","text":"..."}  …  data: {"type":"done","usage":{...}}

// POST /api/generate  (응답: application/json)
type GenerateRequest = {
  profileId: 'kid1' | 'kid2' | 'parent';
  level: 'g3' | 'g5' | 'adult';
  kind: 'talk-feedback' | 'roleplay-feedback' | 'word-problem' | 'reading-quiz';
  input: unknown;                  // kind별 스키마는 T03~T06에서 정의, Worker가 검증
};
// 응답: { ok: true, data: <kind별 JSON> } | { ok: false, error: string }
```
- `/api/generate`는 구조화된 출력(JSON Schema)을 써서 JSON이 스키마를 따르게 하고, Worker가 받은 결과를 같은 스키마로 다시 검증한 뒤 돌려준다.
- 입력 검증은 Worker에서 한다(길이, 개수, 허용된 enum). 잘못된 요청은 400.

### 앱 쪽 `src/lib/ai.ts`
```ts
export interface AiConfig { endpoint: string; token: string }
export function streamChat(cfg: AiConfig, req: ChatRequest, onText: (t: string) => void, signal?: AbortSignal): Promise<{ usage: Usage }>;
export function generate<T>(cfg: AiConfig, req: GenerateRequest): Promise<T>;
export function fetchUsage(cfg: AiConfig): Promise<Record<string, { requests: number; tokens: number }>>;
export class AiError extends Error { kind: 'unauthorized' | 'limit' | 'unsafe' | 'network' | 'server' }
```

## 수용 기준
- [ ] `cd worker && npm test`로 Worker 단위 테스트(인증, CORS, 입력 검증, 사용량 제한)가 통과한다. OpenAI 호출은 어댑터를 모킹한다.
- [ ] 토큰이 없거나 틀리면 401, 허용되지 않은 출처는 CORS 거부, 상한 초과는 429.
- [ ] 앱이 임의 시스템 프롬프트를 보낼 방법이 없다.
- [ ] `worker/README.md`에 배포 절차가 있다: `wrangler kv namespace create`, `wrangler secret put OPENAI_API_KEY`, `wrangler secret put FAMILY_TOKEN`, `wrangler deploy`.
- [ ] 보호자 모드에서 프록시 주소와 토큰을 넣고 "연결 테스트"를 누르면 성공 또는 실패 이유가 한국어로 나온다.
- [ ] 백업 JSON에 토큰이 들어가지 않는다(테스트로 확인).
- [ ] API 키가 저장소 어디에도 없다. `.dev.vars`는 `.gitignore`에 있다.
- [ ] `npm run typecheck && npm test && npm run build` 통과 (앱)

## 테스트
- Worker: 인증, CORS 프리플라이트, 검증 실패, 사용량 누적과 429, SSE 형식(모킹된 스트림)
- 앱: `ai.ts`의 SSE 파서(청크가 잘려서 오는 경우 포함), 오류 종류 매핑, `exportState`에서 토큰 제외

## 리뷰 포인트
- 키 노출 경로가 없는지 (번들, 로그, 오류 메시지)
- 아이 대화가 모더레이션을 거친 뒤에만 모델로 가는지
- OpenAI 대시보드에서 프로젝트 월 예산 한도(usage limit)를 설정하라는 안내가 README에 있는지
- 사용량 제한이 우회되지 않는지 (profileId를 바꿔 보내도 `DAILY_REQUEST_LIMIT_TOTAL`이 걸리는지)
- 스트림이 중간에 끊겨도 앱이 멈추지 않는지
