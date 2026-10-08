# T07 — 오늘의 문제 낚시 게임과 형제 대결

- 상태: 준비됨 · **다음** (2026-10-08 점검: 현재 코드 기준으로 보강)
- 단계: 3
- 선행 작업: T05, T15
- 예상 분량: 하루

## 목표
수학 미션을 끝내면 **오늘 푼 문제로 만든 낚시 게임**이 열린다. 형제가 같은 기기에서 번갈아 대결하고, 이긴 아이가 다음 게임 선택권(👑)을 갖는다.

## 배경
- 원글: 오늘 푼 문제가 물고기로 나오는 낚시 게임, 형제 대결에서 이긴 아이가 다음 게임 선택권 → 둘 다 수학을 열심히 했다.
- 둘째는 동물의 숲을 좋아해서 낚시가 잘 맞는다. 첫째도 같은 낚시 게임으로 시작하고, 첫째용 "오비 달리기"는 후속 후보로 둔다.
- 수학 빙고(T16)는 언제나 할 수 있는 자유 놀이이고, 이 게임은 **수학 미션을 끝낸 보상**이다. 성격이 다르므로 합치지 않는다.

## 현재 코드 상태 (구현 전에 확인)
- `DayLog.mathAttempts`의 `MathAttempt`에는 단원(`skill`), 정답 여부, 시간만 있고 **문제 본문이 없다.** 문제를 함께 저장하도록 확장한다(아래 설계).
- 오답은 `MathSession.tsx`에서 `wrongNotes`에 `{ problem, addedAt: today, given }`으로 들어가지만, 오답노트 문제를 다시 맞히면 지워진다. 그래서 금빛 물고기는 `wrongNotes`가 아니라 **오늘 시도 기록**에서 고른다.
- 문제 생성은 `src/content/math/session.ts`의 `buildLevelQueue(grade, level, wrongNotes, count, rng)`, 레벨은 `ProfileData.math.level`(T05).
- 숫자 입력은 `src/components/NumberPad.tsx`(T15에서 `window` 키 리스너). 게임 화면에서도 그대로 쓰고, 한 화면에 NumberPad 리스너가 하나만 살아 있게 한다.
- 미션 완료 판정은 `src/lib/progress.ts`. 수학 미션 완료 = 오늘 `progress.math >= target`.

## 범위
**포함**
- 홈 화면(아이 프로필)에 "🎮 오늘의 게임" 카드
  - 수학 미션 전: 🔒 "수학 미션을 끝내면 열려요"
  - 끝난 뒤: "🎣 낚시" / "⚔️ 형제 대결" 버튼, 오늘 남은 판 수 표시
- 수학 세션 완료 화면(`SessionDone.tsx`)에 "🎣 게임 열림!" 버튼
- 🎣 **낚시 게임** (DOM + CSS 또는 Canvas, 외부 게임 라이브러리 없이)
  - 물 위에 물고기가 헤엄친다(동시에 최대 8마리, `requestAnimationFrame`).
  - 물고기마다 **오늘 푼 문제**가 붙어 있다. **오늘 틀린 문제는 금빛 물고기**(점수 3배).
  - 물고기를 누르면(또는 키보드로 고르면) 문제가 뜨고, `NumberPad`로 맞히면 잡힌다. 틀리면 물고기가 도망가고 나중에 다시 나온다.
  - 한 판 90초. 점수 = 잡은 물고기 점수 합(보통 10점, 금빛 30점).
  - 오늘 푼 문제가 8개보다 적으면 그 아이 레벨 문제로 채운다(`buildLevelQueue`, 금빛 아님).
  - 끝나면 결과: 잡은 물고기 수, 금빛 물고기 수, 점수, 오늘 최고 점수.
- ⚔️ **형제 대결**
  - 첫째와 둘째가 **둘 다 오늘 수학 미션을 끝냈을 때** 열린다.
  - 같은 기기에서 번갈아 한 판씩. "첫째 차례 → 기기 넘기기 화면 → 둘째 차례".
  - 문제는 **각자 자기 레벨**에서 같은 시드로 10문제(`buildLevelQueue`, 오답노트 제외). 레벨이 달라도 공정하다.
  - 한 사람 최대 90초. 점수 = 정답 수 × 10 + 남은 초(정수). 10문제를 다 풀면 그 사람 차례가 끝난다.
  - 결과 화면: 두 사람 점수, 승자 👑. 비기면 둘 다 👑.
  - 승자 홈에 "👑 다음 게임 선택권" 배지가 **다음 날 끝까지** 보인다.
- 하루 플레이 횟수 상한: 보호자 설정 "하루 게임 판 수"(1~10, 기본 3). 낚시 한 판 = 1판, 대결 한 번 = 두 아이 각각 1판.
- 키보드(DeX): 낚시에서 `←`/`→`로 물고기 고르기(고른 물고기 테두리 강조), `Enter`로 문제 열기, 숫자·`Enter`로 답, `Esc`로 문제 닫기. 대결은 수학 도전과 같은 키 조작.
- `prefers-reduced-motion`이면 물고기를 천천히 움직이거나 제자리에서 살짝만 흔든다.

**제외** (하지 말 것)
- 다른 게임 종류. 게임 목록 구조(`GameId`)만 만들어 둔다.
  - 후속 후보: 첫째용 **오비 달리기**(로블록스 좋아함: 장애물 칸마다 오늘 문제, 맞히면 점프), 둘째용 곤충 채집 변형
- 기기 간 대결, 온라인 순위
- 효과음 파일, 이미지 파일 추가(이모지와 CSS로)

## 설계
### 데이터 모델 (`src/types.ts`, 선택 필드만 추가, version 2 유지)
```ts
export interface MathAttempt {
  skill: string;
  correct: boolean;
  activeMs: number;
  guessed: boolean;
  /** T07부터 저장. 예전 기록에는 없다. */
  problem?: MathProblem;
}
export type GameId = 'fishing' | 'duel';
export interface GameRecord { date: string; game: GameId; score: number; caught?: number; golden?: number; opponent?: ProfileId; won?: boolean }
// ProfileData에 추가
games?: GameRecord[];        // 최근 60개
crownUntil?: string;         // 'YYYY-MM-DD', 이 날짜까지 👑 표시
// ProfileSettings에 추가
gamesPerDay?: number;        // 1~10, 기본 3
```
- `MathSession.tsx`에서 시도를 기록할 때 `problem`도 함께 넣는다. 하루 시도 수가 많아져도 저장 크기가 커지지 않게, **문제 본문은 오늘 기록에만 유지**하고 날짜가 지난 기록의 `problem`은 `normalizeState()`에서 지운다(T05 레벨 평가는 `problem`을 쓰지 않음을 확인).
- `normalizeState()`: `games` 60개 제한·형식 검사, `crownUntil` 날짜 형식 검사, `gamesPerDay` 범위 검사. 백업 내보내기/가져오기에 포함.

### 순수 로직 `src/content/games/`
```ts
// fishing.ts
export interface Fish { id: string; problem: MathProblem; golden: boolean; points: number }
/** 오늘 시도에서 물고기 목록을 만든다. 같은 문제는 한 번만, 틀린 문제는 golden. 부족하면 filler로 채운다. */
export function buildFishPool(attempts: readonly MathAttempt[], filler: readonly MathProblem[], min: number): Fish[];
export function fishingScore(caught: readonly Fish[]): number;
// duel.ts
export function duelQueue(grade: Level, level: number, seed: number): MathProblem[];   // seededRng, 10문제
export function duelScore(correct: number, remainingMs: number): number;              // correct*10 + floor(remainingMs/1000)
export function duelWinner(a: number, b: number): 'a' | 'b' | 'tie';
// limits.ts
export function gamesPlayedToday(records: readonly GameRecord[], today: string): number;
export function canPlay(settings: ProfileSettings, data: ProfileData, today: string): { ok: true } | { ok: false; reason: 'math-not-done' | 'limit' };
export function crownVisible(crownUntil: string | undefined, today: string): boolean;
export function nextDay(date: string): string;
```
- 물고기의 움직임(좌표, 속도)은 화면 컴포넌트에서 처리하되, 시간 기반(`performance.now()` 차이)으로 움직여 느린 기기에서도 속도가 같게 한다.
- 채점은 기존 `src/content/math/grading.ts`를 그대로 쓴다.

### 보상 분리
- 게임 점수는 **별, 쿠폰, 미션 진행, 연속 학습일, 수학 레벨 평가에 영향이 없다.** 게임 안 정답·오답은 `mathAttempts`, `wrongNotes`, `mathBySkill`에 기록하지 않는다(게임으로 레벨이 흔들리거나 꼼수가 생기지 않게).

## 수용 기준
- [ ] 수학 미션 전에는 게임 카드가 잠겨 있고, 끝나면 열린다. 수학 완료 화면에 "🎣 게임 열림!"이 있다.
- [ ] 물고기에 오늘 푼 문제가 나오고, 오늘 틀린 문제는 금빛 물고기(3배)다. 오늘 푼 문제가 적으면 레벨 문제로 채운다.
- [ ] 예전 기록(`problem` 없음)만 있는 날에도 게임이 깨지지 않고 레벨 문제로 열린다.
- [ ] 하루 판 수 상한이 지켜지고, 보호자가 1~10으로 바꿀 수 있다.
- [ ] 대결은 두 아이 모두 수학을 끝냈을 때 열리고, 각자 자기 레벨 문제 10개를 같은 시드로 푼다. 승자(비기면 둘 다)에게 👑가 다음 날 끝까지 보인다.
- [ ] 게임이 별, 쿠폰, 미션 진행, 연속 학습일, 수학 레벨, 오답노트에 영향을 주지 않는다(테스트).
- [ ] 마우스, 터치, 키보드(DeX)만으로 각각 낚시 한 판과 대결을 끝낼 수 있다.
- [ ] DeX 큰 화면과 375px 폭에서 플레이 가능하고, 물고기는 최대 8마리, 시간 기반 애니메이션이다.
- [ ] `normalizeState`가 지난 날의 `problem`을 지우고, `games`·`crownUntil`·`gamesPerDay`를 정리한다(테스트).
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` 통과

## 테스트
- 단위: `buildFishPool`(중복 제거, 금빛, 채우기, 예전 기록), 점수 함수, `duelQueue` 같은 시드 → 같은 문제, `duelWinner` 비김, `canPlay`, `crownVisible`/`nextDay`(월말, 연말), 정규화.
- 직접: 첫째·둘째 수학을 끝낸 뒤 낚시 한 판씩, 대결 한 번. 다음 날 👑가 남아 있고 그다음 날 사라지는지(보호자 모드에서 날짜를 바꾸지 말고 단위 테스트로 확인).

## 리뷰 포인트
- 게임이 학습 기록과 보상에 섞이지 않는지.
- `MathAttempt.problem` 저장으로 localStorage가 불어나지 않는지(지난 날 정리).
- NumberPad 키 리스너가 게임 화면에서 중복으로 붙지 않는지.
