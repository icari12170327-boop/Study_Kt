# T08 — 과학 문제 (첫째, 둘째 모두), 도감, 배지, 캐릭터 옷차림

- 상태: 준비됨 (v2 개정: 실험 카드 중심 → **문제 중심**)
- 단계: 4
- 선행 작업: 없음 (AI 불필요)
- 예상 분량: 하루 반 (화면 1일, 문제 작성 반나절)
- 진행 기록: 실험 카드판(v1)이 PR #21로 먼저 머지·배포됐다. 이 개정은 **main 위에서 새 브랜치 `feat/T08b-science-questions`**로 한다.

## 개정 이유 (2026-10-07)
- 처음 명세는 "매일 실험 카드 한 장(보호자와 함께 실험)"이었다.
- 아이들에게 물어보니 **과학은 문제 푸는 쪽이 좋다**고 했다. 실험은 보호자 시간도 많이 든다.
- 그래서 하루 미션은 **과학 문제 풀기**로 바꾼다. 이미 만든 실험 카드 40장은 버리지 않고, 문제 해설 밑의 **"🧪 집에서 해 보기"(선택)**로 연결한다.
- 요일 설정 후속 작업(구 T17)은 필요 없어져 폐기했다.

## 목표
첫째와 둘째가 매일 학년에 맞는 과학 문제 5개를 풀고, 해설을 읽고, 틀린 문제는 며칠 뒤 다시 만난다. 맞힌 문제가 쌓이면 도감이 채워지고 배지가 생긴다.

## 범위
**포함**
- 미션 타입 `science` (단위: 문제, 첫째와 둘째 모두 **기본 5문제 켬, 매일**)
- 문제 은행 `src/content/science/questions.ts` — **첫 배포 100문제**: 공통 20, 초3 40, 초5 40 (목표 학년별 100)
- 문제 형식: 객관식(보기 3~4개)과 OX. 한 문제는 한 화면, 그림은 이모지.
- 문제 고르기: 기존 Leitner 복습(`src/lib/srs.ts`의 `pickSessionKeys`, `reviewCard`)을 그대로 쓴다. 복습할 문제를 먼저, 나머지는 새 문제. SRS 키는 `sci:<문제 id>`로 단어 카드와 겹치지 않게 한다.
- 풀이 흐름: 문제 → 보기 고르기 → 바로 ✅/❌ → **해설 항상 표시**(맞혀도) → "다음". 5문제 끝나면 결과 화면(맞힌 수, 새로 얻은 도감 카드, 배지).
- 초5 심화: 문제에 `why`(왜 그럴까? 한 줄 더 깊은 설명)가 있으면 해설 밑에 접힌 "더 알아보기"로 보여 준다. 쓰기 답은 받지 않는다.
- **🧪 집에서 해 보기 (선택)**: 문제에 `experimentId`가 있으면 해설 밑에 버튼. 누르면 기존 실험 카드 흐름(준비물 → 단계 → 결과)을 연다. 미션 완료와 무관하고, 끝내면 도감 카드에 🧪 표시와 보너스 별 1개.
- 도감: **단원별 칸**. 한 문제를 처음 맞히면 그 문제의 카드가 도감에 들어간다(이모지 + 핵심 한 줄). 아이별 테마는 그대로 — 둘째 "나의 과학 박물관", 첫째 "실험실 빌드"(단원 칸이 채워질수록 방이 지어짐).
- 배지: 단원별 카드 5장, 10장, 단원 전체.
- 캐릭터 옷차림: 기존 작업(`outfitFor(date, profileId)`) 유지.
- DeX 키보드: `1`~`4`로 보기 고르기, `O`/`X`로 OX, `Enter`로 다음. T15 방식(`window` 리스너, 입력 칸이나 PIN 모달에 포커스가 있으면 무시, 언마운트 시 제거).
- 보호자 현황: 아이별 최근 7일 과학 정답률, 자주 틀린 문제 5개(문제와 아이가 고른 답).
- AI 친구 연결(T03): 오늘 푼 단원 이름을 대화 주제 칩에 넣는다(예: "Today I learned about magnets!").

**제외** (하지 말 것)
- 매일 실험 미션, "같이 실험" 모드, 생각 질문 쓰기 답 (v1 범위에서 뺌)
- AI 문제 생성 (나중에 별도 작업)
- 문제 안의 영어

## 설계
### 문제 형식 `src/content/science/questions.ts`
```ts
export interface ScienceQuestion {
  id: string;                      // 바꾸지 않음 (SRS·도감 키). 예: 'g3-magnet-01'
  audience: 'both' | 'g3' | 'g5';
  unit: ScienceUnit;               // 아래 단원 id
  kind: 'choice' | 'ox';
  emoji: string;                   // 문제 그림 대용, 예: '🧲'
  question: string;                // 초3이 읽을 수 있는 문장 (both, g3)
  choices: string[];               // choice: 3~4개, ox: ['O', 'X']
  answer: number;                  // choices 인덱스
  explain: string;                 // 2~3문장, 정답이 왜 맞는지
  card: string;                    // 도감에 들어갈 핵심 한 줄, 예: '자석은 철로 된 물건을 끌어당겨요'
  why?: string;                    // 초5 "더 알아보기"
  experimentId?: string;           // 실험 카드 id (🧪 집에서 해 보기)
}
```
- 단원 (`ScienceUnit`, 작성 시 현재 교과서 단원명 확인)
  - 초3: 물질의 성질, 동물의 한살이, 자석의 이용, 지구의 모습, 동물의 생활, 지표의 변화, 물질의 상태, 소리의 성질
  - 초5: 온도와 열, 태양계와 별, 용해와 용액, 다양한 생물과 우리 생활, 날씨와 우리 생활, 물체의 운동, 산과 염기
  - 공통(both): 생활 속 과학(뜨고 가라앉기, 빛과 그림자, 공기, 정전기 등)
- 지금은 10월이라 학년별 40문제 중 절반 이상을 **2학기 단원**으로 채운다.
- 관심사 양념: 학년별 40문제 중 5문제 정도는 아이 관심사로 상황을 꾸민다. 둘째는 동물의 숲 느낌(곤충, 물고기, 화석, 섬), 첫째는 로블록스 느낌(만들기, 장애물). **게임 이름과 캐릭터 이름은 쓰지 않고**, 과학 내용은 실제 사실이어야 한다(게임 속 규칙 X).

### 기존 실험 카드 재활용
- 기존 `src/content/science/cards.ts`의 실험 카드 40장은 **삭제하지 않고** `src/content/science/experiments.ts`로 옮긴다(id는 그대로).
- 안전 검사 테스트는 그대로 유지(불, 끓는, 가열, 칼, 콘센트, 표백제, 세제 등 금지).
- 실험 흐름에서 예상 고르기와 결과 기록은 남겨도 된다. `deeper`, 같이 실험 모드, 생각 답 쓰기는 화면에서 뺀다(데이터 필드는 남겨도 됨).
- 각 실험 카드는 관련 문제 최소 1개의 `experimentId`로 연결한다. 연결 안 된 카드가 있으면 테스트가 실패한다.

### 저장 데이터
```ts
// ProfileData.science (PR #21의 ScienceData를 이 형태로 바꾼다. version 2 유지)
export interface ScienceData {
  collected: Record<string, string>;   // 문제 id → 처음 맞힌 날짜 (도감)
  experiments: Record<string, { date: string; predicted?: string; observed?: string }>;
  badges: string[];
  recentWrong: { id: string; chosen: number; date: string }[]; // 최신 30개
}
```
- **PR #21 형태에서 옮기기 (이미 배포됐으므로 필수)**: `normalizeScience()`가 옛 형태 `{ done, badges, cycleDone, today }`를 받으면
  - `done[cardId]`의 `date`, `predicted`, `observed`를 `experiments[cardId]`로 옮긴다. `thinkAnswer`, `together`는 버린다.
  - `cycleDone`, `today`는 버린다. `badges`는 새 기준(단원별)으로 다시 계산하므로 옛 배지 id는 버린다.
  - `collected`는 빈 객체로 시작한다(실험은 문제 정답이 아니므로 도감 카드로 옮기지 않는다).
  - 옛 형태와 새 형태가 섞여 와도 깨지지 않게 하고, 단위 테스트로 확인한다. 백업 파일 가져오기도 같은 경로를 탄다.
- **미션 단위 바꾸기**: PR #21에서 `science` 미션은 `target: 1`(장)이었다. 새 단위는 문제라서, 저장된 `science` 미션의 `target`이 1이면 **한 번만** 5로 바꾼다. 보호자가 꺼 둔 설정(`enabled: false`)은 그대로 둔다. 한 번만 바꾸는 표시는 `ProfileSettings.scienceV2?: true`로 둔다(보호자가 나중에 1로 정해도 다시 덮어쓰지 않게).
- 오늘 이미 옛 실험 미션으로 올라간 `DayLog.progress.science`(1)는 그대로 둔다. 새 목표가 5라서 오늘 미션이 미완료로 바뀔 수 있는데, 이미 받은 별과 쿠폰, 연속 학습일은 되돌리지 않는다(`applyProgress`는 과거 기록을 다시 계산하지 않음을 확인).
- `normalizeState()`: 형식이 틀린 항목은 버린다. 문제 은행에 없는 id는 버리지 않고 유지(문제가 바뀌어도 기록 보존). `recentWrong`은 30개 제한.
- 문제를 풀면 `applyProgress()`로 미션 진행을 올리고(문제 1개 = 1), SRS는 `reviewCard()`로 갱신한다.

### 순수 로직 `src/content/science/session.ts`
```ts
export function questionsFor(level: 'g3' | 'g5'): ScienceQuestion[];      // both + 해당 학년
export function pickScienceSession(level: 'g3' | 'g5', srs: Record<string, SrsCard>, today: string, count: number): ScienceQuestion[]; // pickSessionKeys, 'sci:' 접두사
export function gradeAnswer(q: ScienceQuestion, chosen: number): boolean;
export function newBadges(collected: Record<string, string>, owned: string[]): string[];
```

## 수용 기준
- [ ] 문제 100개(공통 20, 초3 40, 초5 40)가 형식대로 있고, `answer`가 `choices` 범위 안, 보기 중복 없음, OX는 보기가 정확히 `['O','X']`(테스트).
- [ ] 문제 id가 모두 고유하고, 모든 `experimentId`가 실제 실험 카드를 가리키며, 모든 실험 카드가 최소 1문제와 연결된다(테스트).
- [ ] 초3에게 `g5` 문제가 나오지 않고, 초5에게 `g3` 문제가 나오지 않는다.
- [ ] 첫째와 둘째 홈에 "🔬 과학 문제" 미션(기본 5문제)이 있고, 5문제를 풀면 미션이 완료된다.
- [ ] 틀린 문제는 다음 날 이후 다시 나오고(SRS), 맞힌 문제는 간격이 늘어난다.
- [ ] 맞혀도 틀려도 해설이 나오고, 초5 문제에 `why`가 있으면 "더 알아보기"로 볼 수 있다.
- [ ] 처음 맞힌 문제는 도감에 들어가고, 단원별 배지가 생긴다. 아이별 도감 테마가 보인다.
- [ ] "🧪 집에서 해 보기"로 실험을 끝내면 도감 카드에 🧪 표시와 별 1개가 추가되고, 미션 완료 여부는 바뀌지 않는다.
- [ ] 키보드만으로(1~4, O/X, Enter) 5문제를 끝까지 풀 수 있다.
- [ ] 보호자 현황에 아이별 정답률과 자주 틀린 문제가 보인다.
- [ ] 안전 금지어 테스트가 실험 카드에 계속 적용된다.
- [ ] PR #21 형태로 저장된 데이터(과학 기록이 있는 경우, 미션 target 1, 미션 꺼짐)를 열면 위 규칙대로 옮겨지고 별, 쿠폰, 연속 학습일이 바뀌지 않는다(테스트).
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` 통과
- [ ] PR 본문에 **"보호자 확인 필요: 과학 문제 100개"** 표시와 단원별 문제 수 표가 있다.

## 리뷰 포인트
- 문제와 해설의 과학적 정확성 (보호자 확인 + 리뷰어가 의심 문제 표시)
- 초3 문장 길이와 어휘 (한 문제 2문장 이내 권장)
- 정답 위치가 한쪽(예: 항상 1번)으로 쏠리지 않는지. 보기 순서는 화면에서 섞지 말고 데이터에서 고르게 배치한다(`chosen` 인덱스 기록과 어긋나지 않게).
- 관심사 문제가 게임 이름, 캐릭터, 게임 속 규칙을 쓰지 않는지
