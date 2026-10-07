# 가족 AI 프록시 (`study-kt-proxy`)

앱은 가족 토큰만 보내고 OpenAI 프로젝트 키·지시문은 Worker에 둡니다. 한국 시간 기준 프로필별 하루 대화 시간, 가족 월 대화 시간, 가족 하루 텍스트 생성 횟수를 제한합니다. 실제 배포는 `main` 머지 후 GitHub Actions가 합니다.

## 보호자 준비: 로컬 PC에 Wrangler를 설치하지 않아도 됩니다

1. Cloudflare 대시보드에서 계정을 만들고 **Workers & Pages**에서 workers.dev 서브도메인을 정합니다. 배포 뒤 주소는 `https://study-kt-proxy.<서브도메인>.workers.dev`입니다.
2. **Storage & databases → KV**에서 `study-kt-usage`를 만듭니다. 이 가족의 네임스페이스 ID `6cd93b6e51904a5ea0601dfdd089bfca`는 `wrangler.toml`의 `USAGE`에 이미 들어 있습니다. 다른 계정에서 쓰면 이 비밀이 아닌 ID를 바꿉니다.
3. 프로필 → **API Tokens → Create Token → Edit Cloudflare Workers** 템플릿으로 계정 범위 토큰을 만듭니다. Workers Scripts와 Workers KV Storage 편집 권한을 확인합니다. workers.dev만 쓰므로 Zone의 Workers Routes 권한 줄은 제거하거나 Zone Resources를 All zones로 설정합니다.
4. GitHub 저장소 **Settings → Secrets and variables → Actions**에 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`를 Secrets로 등록합니다. 계정 ID는 Cloudflare 계정 화면에서 확인합니다. 비밀값을 채팅·커밋·PR에 붙이지 않습니다.
5. 이 PR을 `main`에 머지하면 **Actions → Worker 테스트 · 배포**가 검사 후 배포합니다. 둘 중 한 Secret이라도 없으면 검사만 하고 배포를 건너뜁니다. PR에서는 배포하지 않습니다.
6. 첫 배포 후 Cloudflare **Workers & Pages → study-kt-proxy → Settings → Variables and Secrets**에서 `OPENAI_API_KEY`, `FAMILY_TOKEN`을 **Secret**으로 등록하고 적용합니다. 가족 토큰은 비밀번호 관리자의 무작위 생성기로 만든 32자 이상의 공백 없는 값입니다. 이후 배포에도 Secret은 유지됩니다.
7. 앱의 **보호자 모드 → AI 연결**에서 Worker 주소와 가족 토큰을 입력하고 저장합니다. **연결 확인 · 사용량 새로고침**으로 인증과 연결을 확인합니다. OpenAI 키는 앱에 입력하지 않습니다.

SQLite Durable Object `FamilyUsage`는 첫 배포의 migration으로 만들어지며 별도 수동 생성은 필요 없습니다. 무료 플랜에서도 SQLite Durable Objects를 사용할 수 있습니다. 이전 코드로 되돌릴 때 이미 배포한 migration을 지우거나 재사용하지 마세요.

## 주소·모델·상한 설정

`wrangler.toml`의 `[vars]`를 수정하고 PR로 머지합니다. 대시보드에서 바꾼 일반 변수는 다음 배포가 덮어씁니다.

- `ALLOWED_ORIGINS`: **origin만** 쉼표로 구분합니다. 기본 `https://icari12170327-boop.github.io`이며 `/Study_Kt/` 경로와 끝 `/`는 넣지 않습니다. 로컬 개발은 `http://localhost:5173`을 추가합니다. 미등록·무출처 요청은 403이며 응답에 CORS 허용 헤더를 넣지 않습니다.
- `REALTIME_MODEL`: 명세 기본값 `gpt-realtime-2.1-mini`. 실제 프로젝트에서 이 모델을 사용할 수 있는지는 보호자 확인이 필요합니다. 사용할 수 없다면 보호자가 공식 모델 목록을 확인하고 이 값을 수정합니다.
- `TEXT_MODEL`: 공식 가격표에서 nano/mini 중 표준 텍스트 입출력 가격이 가장 낮은 `gpt-5-nano`를 선택했습니다(2026-10-07 확인: 100만 토큰당 입력 $0.05, 출력 $0.40). `reasoning.effort=minimal`, 최대 출력 4000토큰, Responses `store:false`를 사용합니다.
- `TALK_MINUTES_kid1=20`, `_kid2=15`, `_parent=30`, `TALK_MINUTES_MONTH_TOTAL=1500`, `GENERATE_LIMIT_DAY_TOTAL=200`.
- `KRW_PER_TALK_MINUTE=15`: 음성 비용 추정 단가입니다. 텍스트 생성·입력 전사 비용은 포함하지 않으므로 실제 청구와 다릅니다.

### OpenAI 프로젝트 월 예산

OpenAI Platform에서 가족 전용 프로젝트를 만들고 **Settings → Project → Limits**에서 월 예산과 알림 기준을 설정합니다(예: 월 2만 원 상당의 USD 예산). 사용할 모델만 허용하고 사용량 페이지를 확인합니다. **OpenAI 프로젝트 예산은 알림 기준이며 결제를 강제로 차단하는 한도가 아닙니다.** 강제 차단은 이 Worker의 시간·횟수 상한이 담당합니다. 프로젝트 키를 공유하거나 브라우저에 넣지 않습니다. 비용은 예산 알림과 Worker 상한을 함께 확인합니다.

## API와 생성 데이터 계약

모든 호출은 `Authorization: Bearer <FAMILY_TOKEN>`과 허용된 `Origin`이 필요합니다. POST는 JSON이며 전체 본문은 최대 128KB입니다. 잘못된 입력은 400, 인증 401, 한도 429, 같은 프로필의 진행 중 대화 409입니다. 외부 오류·키·자막은 응답이나 로그로 내보내지 않습니다.

- `POST /api/realtime/session`: T02의 `SessionRequest`. 친구 이름은 `Max`, `Lily`, `Alex`, 성격은 `cheerful`, `calm`, `funny`, 목소리는 공식 Realtime 기본 목소리 허용 목록입니다. T03의 `persona.friendHobbies`(400자 이하), 관심사(각 80자·최대 8개)는 이스케이프된 참고 데이터로만 사용합니다. `pushToTalk:true`는 VAD를 끄며 앱이 누름·해제 시 오디오를 커밋합니다. 아이는 `kid-friend`와 g3/g5만, 보호자는 `biz-talk`·adult·T04의 scenarioId만 허용합니다. 사용자 지시문이나 임의 세션 설정 필드는 거부합니다.
- `POST /api/realtime/end`: `{ sessionId, seconds }`. 중복 종료는 같은 결과를 반환합니다. 서버가 통화를 끊은 다음 **서버 경과 시간과 허용된 남은 시간의 작은 값**을 기록합니다. 명세의 `min(클라이언트 seconds, 서버 경과)`를 그대로 쓰면 `seconds:0`으로 무제한 반복할 수 있어, 더 적게 보고한 값은 차감에 사용하지 않습니다. 확인 필요인 보수적 변경입니다. 종료 요청이 없어도 종료 알람이 기록합니다.
- `GET /api/usage`: 오늘 3개 프로필 시간·생성 횟수와 이번 달 시간·추정 원화 비용. 진행 중인 경과 시간도 표시합니다. `remainingSeconds`는 프로필별 실제 Worker 하루/월 예약/한국 자정 상한을 반영하며 T03 준비 화면에 사용합니다. 보호자의 미션 목표보다 Worker 상한이 우선합니다.
- `GET /api/realtime/active`: 인증된 보호자가 진행 중인 세션의 프로필·세션 ID·시작 시각·경과/남은 초를 조회합니다. OpenAI 통화 ID는 공개하지 않습니다.
- `POST /api/realtime/end-active`: `{profileId:'kid1'|'kid2'|'parent'|'all'}`. 보호자 **AI 연결 → 진행 중인 대화**에서 확인 후 강제 종료합니다. 서버 경과 시간을 한 번만 기록하고 예약을 해제합니다. hangup 실패는 `needsHangup`과 알람으로 재시도하며 새 대화의 `busy`를 막지 않습니다. 실제 외부 통화가 끊기는 데 지연이 생길 수 있으므로 사용량도 확인합니다.

강제 종료 후 hangup 재시도가 계속 실패하면 저장된 실패 횟수에 따라 **5초 → 1분 → 10분**으로 대기를 늘립니다. 이후에는 10분 간격으로 재시도하며, 객체 재시작이나 사용량 조회가 대기를 초기화하지 않습니다. 성공하면 재시도 정보를 지웁니다. 외부 통화 정리 기록은 성공할 때까지 보존합니다.
- `POST /api/generate`: `{ profileId, level, kind, input }`. 결과 `{ ok:true,data }` 또는 `{ ok:false,error }`.

다음은 T03/T04가 필드 이름을 확정하지 않은 부분을 구체화한 입력 계약입니다. 후속 작업은 이 형식에 맞춥니다. 입력·출력 모두 Zod로 검증하고 출력 Zod에서 만든 같은 JSON Schema를 OpenAI strict 구조화 출력에도 사용합니다.

| kind         | input                                                                                                   | data                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| talk-summary | `{ lines: [{ role:'kid' 또는 'friend', text, at:number, peeked? }] }`                                   | T03 요약 필드 + `flagged:boolean`                                                                              |
| biz-feedback | `{ lines:[{role:'user' 또는 'assistant',text,at}] }` 또는 `{ mode:'short', text }`                      | `{ overallKo, corrections:[{said,better,why}], nextExpressions:[{en,ko}] }` 또는 `{ alternatives:[문장 2개] }` |
| memory-merge | `{ memory:기존 문자열, summary:T03 요약 }`                                                              | 1500자 이하 문자열                                                                                             |
| word-problem | `{ items:[{id,skill,expression,numbers:string[],answerKind,interest,level}] }` 최대 8개, 정답 필드 없음 | `{items:[{id,story,question}]}`                                                                                |
| reading-quiz | `{title,author,summary,level,count?}` (요약 40~8000자, count 기본 5, 1~10)                              | `{cards:[{q,a,type:'fact' 또는 'why' 또는 'apply'}]}`                                                          |

`lines`는 최대 300개, 한 줄 2000자입니다(전체 128KB 한도도 적용). `talk-summary`는 아이 발화만 Moderation에 보내고 `flagged`를 보호자 결과에 붙입니다. 아동 자막 원문을 KV나 Durable Object에 저장하지 않습니다. 생성 실패도 비용이 발생할 수 있어 일일 생성 횟수에 셉니다. 입력 참고 데이터는 XML 특수 문자를 이스케이프한 태그 안에 넣고 지시로 취급하지 않게 안내합니다. 프롬프트 인젝션을 완전히 차단한다는 의미는 아닙니다.

## 서버 종료와 사용량 일관성

공식 Realtime calls API는 multipart `sdp`와 `session`을 받아 answer SDP와 `Location`의 call ID를 반환합니다. 음성 자막 전사와 semantic VAD, 250토큰 응답 상한을 서버 설정으로 보냅니다. `POST /v1/realtime/calls/{call_id}/hangup`은 **WebRTC 통화에도 사용 가능**합니다.

KV는 일관성 지연과 비원자적 갱신이 있어 단독으로 중복 대화·월 한도·동시 생성 횟수를 막을 수 없습니다. 가족 하나의 Durable Object가 예약과 저장 갱신을 직렬화하고 SQLite 저장소를 기준으로 사용합니다. KV에 `usage:<한국날짜>:<profile>`, `month:<월>`, `active:<profile>`를 함께 기록합니다. active TTL은 남은 시간+120초입니다. 같은 KV 키의 쓰기는 초당 한 번으로 합치고 실패하면 다음 알람에서 재시도하므로 KV 반영에는 지연이 있을 수 있습니다. 앱 사용량 API는 Durable Object의 현재 기록을 직접 읽습니다. 진행 중 예약도 가족 월 상한에서 빼므로 여러 프로필이 동시에 예산을 초과해 열리지 않습니다. 하루 기록은 90일, 월 기록은 약 13개월, 종료 세션의 중복 처리 기록은 24시간까지 유지합니다. 외부 통화 종료를 재시도해야 하는 기록은 정리가 끝날 때까지 보존합니다.

OpenAI 연결·종료·텍스트 생성은 `blockConcurrencyWhile` 밖에서 기다립니다. 연결 전에 저장한 예약으로 같은 프로필의 중복 연결을 막고, 외부 응답이 도착하면 저장 잠금을 다시 잡아 통화 ID를 등록합니다. 연결 대기 중 예약이 만료되면 늦게 도착한 통화도 종료하고 시간을 한 번만 기록합니다. 동시에 들어온 종료 요청은 하나의 외부 종료 작업을 공유합니다. 종료 재시도 상태는 저장하므로 Durable Object가 다시 시작돼도 알람으로 정리합니다.

Durable Object alarm이 만료된 통화를 hangup하며 실패하면 5초 뒤 재시도하고 예약을 유지합니다. 앱에도 남은 시간 종료 타이머가 있습니다. 한국 자정까지로 연결 시간을 제한해 다음 날짜·월로 넘어가는 비용을 막습니다. Cloudflare 알람·네트워크는 정확한 초 단위 실행을 보장하지 않으므로 종료에 지연이 생길 수 있습니다. 갑작스러운 런타임 중단이나 OpenAI가 call ID 없이 성공 응답을 반환하는 경우 같은 통화를 복구·종료하지 못할 가능성이 있어 프로젝트 사용량도 확인합니다. 종료 요청 실패가 제한을 해제하지 않도록 구현합니다. 텍스트 생성 대기 중에도 종료 알람이 실행될 수 있습니다.

공식 자료:

- [WebRTC 가이드](https://developers.openai.com/api/docs/guides/realtime-webrtc) (가이드의 Markdown 링크가 GPT-Live로 연결되는 경우 Realtime API reference의 calls 형식 사용)
- [Realtime calls 생성](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/create)
- [Realtime 통화 종료](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/hangup)
- [서버 이벤트](https://developers.openai.com/api/reference/resources/realtime/server-events)
- [텍스트 가격표](https://developers.openai.com/api/docs/pricing)
- [Cloudflare Durable Object alarms](https://developers.cloudflare.com/durable-objects/api/alarms/)

## 로컬 개발과 테스트 (선택)

```sh
cd worker
npm ci
npm test
npm run typecheck
npm run build  # 인증 없이 dry-run, 배포하지 않음
```

`worker/.dev.vars`를 직접 만들고 다음 이름을 채웁니다. 이 파일과 변형 파일은 gitignore에 있으며 **값은 커밋하지 않습니다**.

```dotenv
OPENAI_API_KEY=<보호자가 로컬에서 입력>
FAMILY_TOKEN=<32자 이상의 무작위 가족 토큰>
ALLOWED_ORIGINS=http://localhost:5173
```

`npm run dev`로 로컬 Worker를 시작합니다. 실제 키가 없으면 서버 설정을 확인하는 `/api/usage` 테스트와 모킹 단위 테스트만 사용합니다. 앱 로컬 설정 주소는 `http://localhost:8787`입니다. 앱 주소를 127.0.0.1로 열면 ALLOWED_ORIGINS에도 그 origin을 추가해야 합니다.

## 보호자 확인 필요: 배포 후 검증

실제 OpenAI/Cloudflare 키를 이 작업에서는 사용하지 않았으므로 아래 항목은 아직 미검증입니다.

1. GitHub Secrets 등록 후 main 머지의 배포가 성공하는지 확인합니다. Worker Secret을 등록하고 모델 사용 권한을 확인합니다.
2. 앱 **AI 연결 → 연결 확인** 후 **10초 음성 연결 테스트**를 누르고 마이크를 허용합니다. 영어로 인사하고 AI 음성·자막이 나오는지 확인합니다. 10초 자동 종료 뒤 사용량이 갱신돼야 합니다. 연결이 열리기까지는 별도 시간이 걸립니다.
3. 테스트용으로 `TALK_MINUTES_parent=1`로 설정해 배포하고, 10초 테스트를 반복해 1분을 쓴 뒤 다음 연결이 429로 거부되는지 확인합니다. 점검 뒤 상한을 복구합니다. 더 강한 검증은 앱 타이머·종료 보고를 차단한 클라이언트에서도 서버 alarm이 통화를 끊는지 확인하는 것입니다. 모킹에서는 1분 종료·429·hangup 호출을 확인했습니다.
4. 마이크 거부, Wi-Fi 끊김, 페이지 닫기/탭 이동 때 마이크가 꺼지는지 Fold4·DeX에서 확인합니다.

가족 토큰은 기기 localStorage에 저장됩니다. 백업 JSON에는 제외하며 복원 파일에 들어 있는 토큰도 가져오지 않습니다. 같은 기기에서 복원하면 현재 기기의 Worker 주소와 가족 토큰을 함께 유지합니다. 백업에 다른 주소가 있어도 현재 토큰을 그 주소로 보내지 않습니다. 토큰이 없는 다른 기기는 백업의 주소만 가져오며 토큰을 직접 입력해야 합니다.

## T03 아이 대화 확인

아이 홈 **AI 친구와 대화**에서 관심사나 다음 주제를 고르고 시작합니다. 보호자 **대화 기록** 탭에서 친구 이름·성격·목소리·관심사·취미·자막 가림·눌러서 말하기·미션 목표를 편집합니다. 이름은 기존 Worker 허용 목록 안에서 선택합니다. 실제 시간 상한은 `wrangler.toml`의 프로필별 변수로 바꿉니다.

아이 이름을 세션 요청에 넣지 않습니다. 친구 이름·학년·관심사·기억·주제만 전달합니다. 전체 자막과 최근 60개 대화 기록은 기기에 저장하고, 요약 호출은 본문 상한에 맞춰 최근 최대 300줄·약 90KB의 자막으로 제한합니다. Moderation의 경고도 이 요약 입력을 기준으로 하며 전체 로컬 자막의 검사 결과를 뜻하지는 않습니다. 기억 병합 지시문은 실명·학교·주소·연락처·계정 정보를 제외하도록 안내합니다. 외부 오류 원문과 자막은 앱 콘솔에 출력하지 않으며 Worker 연결 오류 로그는 HTTP 상태와 알려진 오류 코드만 기록합니다.

v1은 v2로 마이그레이션하며 기존 기록을 보존합니다. 기존 localStorage 키를 유지해 이전 기록을 계속 읽습니다. 하루 대화의 남은 초도 누적해 여러 짧은 대화가 합쳐 1분이 되면 진행과 별을 반영합니다. 별은 하루 미션 목표까지만 지급합니다. AI 주소·토큰이 없거나 형식이 잘못되면 대화 미션은 완료 조건에서 제외됩니다.

대화 중에는 연결 후 경과 시간을 반영하고, 정상 종료의 서버 기록 시간이 더 크면 기록·미션에 그 차이를 더합니다. 서버가 이미 계산한 연결 준비·종료 시간을 포함해 Worker 상한과 같은 기준으로 하루 목표를 채웁니다. 종료 응답이 없는 오프라인 이탈은 로컬 경과 시간을 보존합니다.

직접 검증은 보호자가 첫째(Max, 초5)와 둘째(Lily, 초3) 설정으로 각각 **5분씩**, 헤드셋과 스피커에서 확인합니다. 스트리밍 음성·자막, 10% 자막 가림과 꾹 누르기, 10초 침묵/막혔어요 신호 뒤 한국어 안내와 한국어 답변, 마지막 1분 작별·자동 종료, 마이크 멈춤/눌러서 말하기·탭 이탈 해제를 확인합니다. 종료 후 아이의 주제/예고, 보호자의 전체 자막·영어 비율·경고·새 표현, 다음 대화의 기억 반영을 확인합니다. 실서비스 음성·모델 반응·기억에서 개인정보 제외·Fold4/DeX 마이크 권한은 **보호자 확인 필요**입니다.
