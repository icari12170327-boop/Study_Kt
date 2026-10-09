# T13 — 주간 학습 리포트 (보호자용)

- 상태: 완료 (PR #41)
- 단계: 5
- 선행 작업: T02, T03, T05, T08, T10 (기록이 쌓이는 기능들)
- 예상 분량: 하루

## 목표
보호자가 일주일에 한 번, **아이별로 이번 주에 무엇을 얼마나 했는지 한 화면에서** 본다. 숫자 요약은 앱이 바로 계산해 보여 주고(AI 없이도 동작), 원하면 AI가 "잘한 점 / 살펴볼 점 / 다음 주 제안"을 짧은 한국어로 정리해 준다.

## 배경
- 기능이 많아져서(수학 도전, 문장제, 과학 문제, AI 친구 대화, 빙고, 퍼즐, 낚시·대결, 이야기) 보호자가 탭을 여러 개 돌아다녀야 상황을 안다.
- 아이를 다그치는 성적표가 아니라, 보호자가 **칭찬할 거리와 도와줄 곳**을 빨리 찾는 용도다.

## 범위
**포함**
- 보호자 모드에 "📊 주간 리포트" 탭. 아이 선택(첫째/둘째), 주 선택(이번 주 / 지난주 / 그 전 주, 월~일 기준).
- **숫자 요약 (AI 없이, 순수 계산)**
  - 출석: 7일 중 하루 미션 완료한 날 수, 연속 학습일, 받은 별·쿠폰
  - 수학 도전: 푼 문제 수, 정답률, 현재 레벨과 이번 주 레벨 변화(T05 `math.history`), 단원별 정답률 하위 3개, 찍기 감지 횟수, 문장제 정답률(T10)
  - 과학 문제: 푼 수, 정답률, 이번 주 새 도감 카드, 새 배지(T08)
  - 영어 대화: 대화 분, 대화 횟수, 대화 기록 요약의 "오늘의 한 줄" 최대 3개(T03 `talks[].summary.highlightKo`)
  - 자유 놀이: 빙고 판 수·최고 기록, 퍼즐 푼 수·종류별 난이도 변화, 낚시·대결 판 수와 👑, 이야기 읽은 화(T16, T06, T07, T09)
  - 지난주와 비교 화살표(▲▼, 같으면 –). 기록이 없는 항목은 "기록 없음"으로 조용히 표시하고 숨기지 않는다.
- **AI 한마디 (선택)**: "✨ AI 요약 만들기" 버튼. 위 숫자 요약만 Worker로 보내 `{ goodKo, watchKo, nextKo }` 각 2~3문장을 받는다. 결과는 그 주·아이별로 저장해서 다시 열면 그대로 보인다("다시 만들기" 가능).
- **공유용 보기**: "복사하기" 버튼으로 숫자 요약 + AI 한마디를 짧은 텍스트로 클립보드에 복사(가족 단톡방에 붙여 넣기용). 아이 이름 대신 프로필 이름을 쓴다.
- 홈 화면 보호자 카드에 일요일·월요일에만 "📊 이번 주 리포트가 준비됐어요" 안내.

**제외** (하지 말 것)
- 자동 알림, 이메일 발송, 외부 공유 링크
- 그래프 라이브러리 추가(막대는 CSS 너비로 충분)
- 아이 화면에 리포트 노출(보호자 전용)

## 설계
### 순수 계산 `src/lib/weeklyReport.ts`
```ts
export interface WeekRange { start: string; end: string } // 'YYYY-MM-DD', 월~일
export function weekRange(date: string, offset = 0): WeekRange;          // offset -1 = 지난주
export interface WeeklyStats {
  profileId: ProfileId; range: WeekRange;
  attendance: { completedDays: number; streak: number; stars: number; coupons: number };
  math: { solved: number; accuracy: number | null; levelStart: number; levelEnd: number; weakSkills: { skill: string; label: string; accuracy: number }[]; guesses: number; storyAccuracy: number | null };
  science: { solved: number; accuracy: number | null; newCards: number; newBadges: string[] };
  talk: { minutes: number; sessions: number; highlights: string[] };
  play: { bingoGames: number; bingoBest?: number; puzzlesSolved: number; puzzleLevelUps: number; fishing: number; duels: number; crowns: number; storyEpisodes: number };
}
export function buildWeeklyStats(state: AppState, profileId: ProfileId, range: WeekRange): WeeklyStats;
export function compareStats(cur: WeeklyStats, prev: WeeklyStats): Record<string, 'up' | 'down' | 'same' | 'none'>;
export function reportText(stats: WeeklyStats, ai?: WeeklyAi): string;   // 복사용 텍스트
```
- 날짜 계산은 `src/lib/date.ts`를 쓰고, 시간대 때문에 하루 밀리지 않게 문자열 날짜로만 계산한다.
- 기존 기록 구조를 그대로 읽기만 한다. **학습 기록을 바꾸지 않는다.**
- 단원 이름은 기존 단원 라벨(수학 skills, 과학 단원)을 재사용한다.

### Worker (새 생성 종류 1개)
- `shared/ai.ts` `GenerateKind`에 `'weekly-report'` 추가.
- 입력: `{ stats: WeeklyStats(숫자와 라벨만), level: 'g3' | 'g5' }`. **대화 원문, 오답 문제 본문, 이야기 답 같은 상세 기록은 보내지 않는다.** 대화 하이라이트(이미 AI가 만든 한국어 한 줄, 개인정보 제거됨)만 최대 3개.
- 출력 스키마: `{ goodKo: string(≤300), watchKo: string(≤300), nextKo: string(≤300) }`.
- 지시문(`worker/src/personas.ts`): 보호자에게 쓰는 따뜻한 한국어, 비교·꾸중·등수 표현 금지, 숫자는 입력에 있는 것만 인용, 진단·의학적 판단 금지, 다음 주 제안은 앱 안에서 할 수 있는 구체적 행동 1~2개(예: "과학 '물질의 상태' 문제를 함께 풀어 보기").
- 보호자만 호출 가능(`profileId === 'parent'` 검증, `stats.profileId`는 아이). 하루 생성 한도 공유.
- Worker 테스트: 스키마 검증, 아이 프로필 호출 거부, 지시문 금지 규칙 포함.

### 저장 (선택 필드, version 2 유지)
```ts
// ProfileData(아이)에 추가
weeklyAi?: Record<string /* week start */, { goodKo: string; watchKo: string; nextKo: string; createdAt: string }>; // 최근 12주
```
- `normalizeState()`: 형식 검사, 12주 초과분 정리, 백업 포함.

## 수용 기준
- [ ] 보호자 모드에 "📊 주간 리포트"가 있고, 아이와 주(이번 주/지난주/그 전 주)를 고를 수 있다. 아이 화면에는 없다.
- [ ] 숫자 요약이 AI 연결 없이도 바로 보이고, 각 항목이 기존 기록과 일치한다(고정 데이터 단위 테스트).
- [ ] 지난주 대비 ▲▼–가 맞게 표시되고, 기록이 없는 항목은 "기록 없음"으로 보인다.
- [ ] "AI 요약 만들기"가 숫자 요약만 보내고, 결과가 그 주에 저장돼 다시 열어도 보인다. 실패하면 숫자 요약은 그대로이고 "다시 시도"가 나온다.
- [ ] "복사하기"가 짧은 텍스트를 클립보드에 넣는다(복사 실패 시 텍스트를 선택 가능한 상자로 보여 줌).
- [ ] 리포트 화면이 학습 기록, 별, 쿠폰, 미션을 바꾸지 않는다(테스트).
- [ ] 주 경계(일요일 23:59 → 월요일), 월말·연말이 맞게 계산된다(테스트).
- [ ] Worker `weekly-report` 검증·권한·지시문 테스트가 있다.
- [ ] 375px와 DeX 큰 화면에서 보기 좋다(막대는 CSS, 다크 모드 확인).
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` 통과, `cd worker && npm run typecheck && npm test` 통과

## 리뷰 포인트
- 숫자가 실제 기록과 맞는지(특히 정답률 분모, 레벨 변화, 주 경계)
- Worker로 나가는 데이터가 숫자 요약뿐인지(개인정보·원문 유출 없음)
- AI 문구가 아이를 비교하거나 꾸짖지 않는지(실제 생성 예시는 배포 후 보호자 확인)
