# T19 — 오비 달리기 (수학 미션 보상 게임, 첫째 아이디어)

- 상태: 준비됨 · **다음**
- 단계: 3
- 선행 작업: T07 (낚시·대결 틀), T15 (키보드)
- 예상 분량: 하루

## 목표
첫째가 좋아하는 로블록스 "오비(장애물 코스)" 느낌의 달리기 게임. 장애물마다 **오늘 푼 수학 문제**가 붙어 있고, 맞히면 점프해서 넘고, 틀리면 떨어졌다가 다시 올라온다. 낚시처럼 **수학 미션을 끝내면 열리는 보상 게임**이다.

## 배경
- T07 명세에서 "첫째용 오비 달리기"를 후속 후보로 남겨 두었다. 지금 보상 게임은 낚시(둘째 취향)와 형제 대결뿐이다.
- 로블록스 오비의 재미 요소: **스테이지 번호**, **체크포인트 깃발**, **떨어지기**, **캐릭터 꾸미기**. 이걸 이모지와 CSS로만 흉내 낸다.
- 둘째도 할 수 있게 두 아이 모두에게 보인다(문제는 각자 레벨).

## 현재 코드 상태 (구현 전에 확인)
- 게임 틀은 `src/content/games/`에 있다.
  - `limits.ts`: `GAME_DURATION_MS`(90초), `canPlay`, `reserveGame`(시작할 때 한 판 확보), `finishGame`, `normalizeGames`
  - `fishing.ts`: `normalizeProblem`, `buildFishPool(attempts, filler, min)`(오늘 틀린 문제 = golden, 30점), `refillFishPool`
- 화면: `src/pages/RewardGames.tsx`(`REWARD_GAMES` 목록, 라우트 `{ name: 'games', profileId, game }`), `src/pages/FishingGame.tsx`, `src/components/RewardGameCard.tsx`(홈 카드)
- 숫자 입력: `src/components/NumberPad.tsx`(`window` 키 리스너, 한 화면에 하나만)
- 주간 리포트: `src/lib/weeklyReport.ts`의 `play`에 낚시·대결 판 수가 있다.

## 범위
**포함**
- 홈 "🎮 오늘의 게임" 카드에 "🏃 오비 달리기" 버튼(낚시와 대결 사이). 잠금, 하루 판 수 상한은 낚시와 같다(`canPlay`, `reserveGame`).
- 게임 화면 (DOM + CSS, 외부 게임 라이브러리·이미지 파일 없이)
  - 위: 남은 시간, **Stage 번호**, 점수
  - 가운데 코스 띠(높이 약 160px): 캐릭터가 왼쪽에서 제자리 달리기(배경 줄무늬가 흘러감), 오른쪽 앞에 다음 장애물. 장애물 위에 문제가 말풍선으로 붙는다.
  - 아래: `NumberPad`와 정답 확인
  - **맞히면**: 캐릭터가 점프(약 0.6초)해서 장애물을 넘고 Stage +1, 다음 장애물이 들어온다.
  - **틀리면**: "으악, 떨어졌다!" 캐릭터가 아래로 떨어졌다가 올라온다. **3초 동안 입력 잠금**(남은 시간은 계속 흐름). 틀린 문제는 3개 뒤에 다시 나오고, 지금 장애물에는 다른 문제가 붙는다. 정답은 보여 주지 않는다(그 문제가 다시 나오므로).
  - **체크포인트**: 5 Stage마다 🚩 깃발과 "체크포인트!" 안내, 보너스 20점, 코스 색이 바뀐다(5개 색을 돌려 씀).
  - 90초가 끝나면 결과: 도달 Stage, 넘은 장애물 수, 🔥 장애물 수, 점수, 내 최고 Stage.
- 장애물 문제
  - 낚시와 같은 풀: 오늘 시도한 문제(`buildFishPool`), 부족하면 그 아이 레벨 문제로 채움(`refillFishPool`). 계속 맞히면 문제가 떨어지지 않게 레벨 문제로 계속 보충한다.
  - **오늘 틀린 문제는 🔥 용암 장애물**(30점). 보통 장애물은 10점이고, 모양만 번갈아 바뀐다(🧱 벽, 🌀 회전 막대, 🕳️ 구멍, 🪜 사다리).
- **캐릭터 꾸미기** (점수·별과 무관한 꾸미기만)
  - 시작 화면에서 몸 색 5가지 중 고르기(CSS 색 블록 캐릭터, 이모지 얼굴 🙂).
  - 내 최고 Stage로 모자가 열린다: Stage 10 🧢, 20 🎩, 30 🪖. 열린 모자 중에서 고르기. 잠긴 것은 "Stage 20에서 열려요"로 보여 준다.
- 키보드(DeX): 숫자·`Backspace`·`Enter`(NumberPad 그대로). 시작 화면에서 `←`/`→`로 색 고르기, `Enter`로 시작.
- `prefers-reduced-motion`이면 점프·떨어지기·배경 흐름 대신 짧은 깜빡임으로 표시한다.
- 주간 리포트(`weeklyReport.ts`, `WeeklyReport.tsx`)의 자유 놀이에 "오비 달리기 판 수, 이번 주 최고 Stage" 추가.

**제외** (하지 말 것)
- 하루 미션, 별·쿠폰, 학습 기록 반영(낚시와 같은 보상 분리)
- 형제 대결 모드, 온라인 순위, 시간 대결
- 효과음 파일, 이미지 파일, Canvas 물리 엔진(점프는 CSS 애니메이션으로)
- 꾸미기 아이템 구매, 게임 화폐(로블록스 로벅스 같은 것 흉내 금지)

## 설계
### 데이터 모델 (`src/types.ts`, 선택 필드만, version 2 유지)
```ts
export type GameId = 'fishing' | 'duel' | 'obby';
export interface GameRecord { /* 기존 필드 */ stage?: number } // obby: 도달 Stage
// ProfileData에 추가
obby?: { best: number; color: ObbyColor; hat?: ObbyHat };
export type ObbyColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple';
export type ObbyHat = 'cap' | 'tophat' | 'helmet';
```
- `normalizeGames`: `'obby'` 허용, `stage`는 0 이상 정수일 때만.
- `normalizeState()`: `obby` 형식 검사(색이 이상하면 'blue', 모자가 `best`로 아직 안 열렸으면 지움, `best`는 0 이상 정수). 백업 포함.

### 순수 로직 `src/content/games/obby.ts`
```ts
export const OBBY_PENALTY_MS = 3000;
export const OBBY_RETRY_GAP = 3;          // 틀린 문제는 3개 뒤에 다시
export const CHECKPOINT_EVERY = 5;
export const CHECKPOINT_BONUS = 20;
export type ObstacleKind = 'lava' | 'wall' | 'spinner' | 'hole' | 'ladder';
export interface ObbyRun {
  queue: Fish[];          // 앞으로 나올 문제 (fishing.ts의 Fish 재사용)
  stage: number;          // 지금 서 있는 Stage = 넘은 장애물 수 + 1 (1부터)
  cleared: Fish[];        // 넘은 장애물
  lockedUntil: number;    // 떨어진 뒤 입력 잠금 시각(ms)
  falls: number;
}
export function startRun(pool: readonly Fish[]): ObbyRun;
export function obstacleKind(fish: Fish, stage: number): ObstacleKind;        // golden → 'lava', 아니면 stage로 4가지 순환
/** 정답: 맨 앞 문제를 cleared로, stage+1. 오답: 맨 앞 문제를 OBBY_RETRY_GAP 뒤로 옮기고 lockedUntil = now + 패널티. 잠금 중 입력은 무시. */
export function answerObstacle(run: ObbyRun, correct: boolean, now: number): ObbyRun;
export function needsRefill(run: ObbyRun, min?: number): boolean;            // queue가 min(기본 4)보다 적으면 true
export function checkpointsPassed(clearedCount: number): number;             // floor(clearedCount / 5): 5, 10, 15번째 장애물을 넘을 때마다 1
export function obbyScore(run: ObbyRun): number;                              // cleared 점수 합 + checkpointsPassed × 20
export function unlockedHats(best: number): ObbyHat[];                        // 10 cap, 20 tophat, 30 helmet
```
- 상태는 불변으로 다룬다(새 객체 반환). 화면은 `useRef`/`useState`로 `ObbyRun`을 들고 있다.
- 채점은 기존 `src/content/math/grading.ts` 그대로.
- 시간은 `roundRemaining(startedAt, now)`(limits.ts) 그대로. 애니메이션도 `performance.now()` 기준.
- 문제 보충은 `refillFishPool`을 써서 이미 넘은 문제와 겹치지 않게. 그래도 후보가 바닥나면 같은 문제를 다시 써도 되지만 무한 반복 생성은 하지 않는다(시도 상한).

### 화면 `src/pages/ObbyGame.tsx` (+ 필요하면 `src/components/ObbyCourse.tsx`)
- 시작 화면(색·모자 고르기) → 시작 누르면 `reserveGame(..., 'obby')`로 한 판 확보 → 90초 → 결과에서 `finishGame`으로 기록, `obby.best` 갱신.
- 중간에 나가도 한 판으로 센다(낚시와 같음).
- `REWARD_GAMES`에 `{ id: 'obby', title: '🏃 오비 달리기' }` 추가, 라우트는 기존 `{ name: 'games', game }` 재사용.

### 보상 분리
- 게임 안 정답·오답은 `mathAttempts`, `wrongNotes`, `mathBySkill`, 수학 레벨, 별, 쿠폰, 미션, 연속 학습일에 영향이 없다. 저장되는 것은 `games` 기록과 `obby`(최고 Stage, 꾸미기)뿐이다.

## 수용 기준
- [ ] 수학 미션 전에는 오비 달리기가 잠겨 있고, 끝나면 열린다. 하루 판 수 상한을 낚시·대결과 함께 쓴다.
- [ ] 장애물에 오늘 푼 문제가 나오고, 오늘 틀린 문제는 🔥 용암(30점)이다. 문제가 모자라면 레벨 문제로 채워지고, 90초 내내 문제가 떨어지지 않는다.
- [ ] 맞히면 점프하고 Stage가 오른다. 틀리면 떨어지고 3초 동안 입력이 잠기며, 그 문제는 3개 뒤에 다시 나온다(테스트).
- [ ] 5 Stage마다 체크포인트 안내와 보너스 20점이 있고, 점수 계산이 맞다(테스트).
- [ ] 결과에 도달 Stage와 최고 Stage가 나오고, 최고 Stage 10/20/30에서 모자가 열린다. 색·모자 선택이 저장된다.
- [ ] 예전 기록(`problem` 없음)만 있는 날에도 레벨 문제로 게임이 열린다.
- [ ] 게임이 별, 쿠폰, 미션, 연속 학습일, 수학 레벨, 오답노트에 영향을 주지 않는다(테스트).
- [ ] `normalizeGames`(obby, stage)와 `obby` 정규화·백업 테스트가 있다. version 2 유지.
- [ ] 주간 리포트 자유 놀이에 오비 달리기 판 수와 최고 Stage가 보인다(테스트).
- [ ] 마우스, 터치, 키보드(DeX)만으로 각각 한 판을 끝낼 수 있다. NumberPad 리스너는 한 화면에 하나다.
- [ ] 375px와 DeX 큰 화면에서 코스와 문제가 잘 보이고, `prefers-reduced-motion`을 지킨다.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` 통과

## 테스트
- 단위: `startRun`, `answerObstacle`(정답, 오답 재배치 위치, 큐가 3개보다 짧을 때 오답 위치, 잠금 중 입력 무시), `obstacleKind`(golden→lava, 순환), `obbyScore`, `checkpointsPassed`(4/5/10), `unlockedHats` 경계(9/10, 19/20, 29/30), `needsRefill`
- 정규화: `normalizeGames`의 obby 행, `obby` 잘못된 값(없는 색, 안 열린 모자, 음수 best)
- 화면: 가짜 시계로 시작→정답→오답 잠금→종료 흐름, 중간 이탈 시 한 판 기록

## 리뷰 포인트
- 게임이 학습 기록·보상에 섞이지 않는지(낚시와 같은 규칙)
- 오답 잠금 3초 동안 키 입력이 실제로 막히는지, 잠금이 끝나면 바로 풀리는지
- 문제 보충이 무한 반복되지 않는지
- 애니메이션이 시간 기반이고, 언마운트 때 타이머·`requestAnimationFrame`·키 리스너가 정리되는지
- 꾸미기가 게임 화폐나 구매처럼 보이지 않는지
