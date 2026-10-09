# T11 — 독서노트·독서록에서 AI 복습 질문 만들기

- 상태: 완료 (PR #43) · 2026-10-09 개정: 현재 코드 기준으로 다시 씀
- 단계: 5
- 선행 작업: T02
- 예상 분량: 반나절

## 목표
보호자 독서노트나 아이 독서록에 요약을 쓰고 "🤖 질문 만들기"를 누르면, AI가 **요약 내용만으로** 질문과 답 후보를 만든다. 사람이 후보를 고치고 골라서 추가하면, 기존 복습 카드(SRS)에 합쳐진다.

## 배경
- 1단계 독서노트는 질문과 답을 직접 써야 해서 손이 많이 간다. AI가 초안을 만들고 사람이 고르면 꾸준히 쓰기 쉽다.
- 보호자는 비즈니스·투자 책을 읽고 핵심을 복습하는 데 쓰고, 아이는 독서록에 쓴 줄거리로 간단한 확인 질문을 만든다.

## 현재 코드 상태 (구현 전에 확인)
- **Worker는 이미 있다** (T02). 새 생성 종류를 만들지 않는다.
  - `shared/ai.ts` `GenerateKind`에 `'reading-quiz'`가 있다.
  - 입력 `worker/src/validation.ts` `inputSchemas['reading-quiz']`: `{ title(≤200), author(0~100), summary(40~8000), level, count(1~10, 기본 5) }`
  - 출력 `outputSchemas['reading-quiz']`: `{ cards: { q(≤500), a(≤500), type: 'fact' | 'why' | 'apply' }[] }` 1~10개
  - 지시문 `worker/src/personas.ts` `'reading-quiz'`. 아이 프로필도 호출할 수 있다(보호자 전용 종류가 아님).
- 앱 화면은 아직 없다. `src/pages/Reading.tsx`의 `NoteEditor`가 제목·저자·요약·질문(`QaCard { id, q, a }`) 편집과 저장을 맡는다. 저장하면 `applyProgress(..., { type: 'reading' })`로 미션이 진행되고, 복습은 `NoteReview`가 SRS 키 `noteKey(noteId, cardId)`로 돈다.
- AI 호출은 `src/lib/ai.ts`의 `generate(cfg, request, signal)`를 쓰고, 오류는 `AiError`(`limit`, `unsafe`, `network` 등)와 기존 한국어 메시지를 재사용한다. 다른 화면 예시: `src/components/CoachMeaning.tsx`, `src/components/BusinessFeedback.tsx`.
- 홈 화면에서 아이는 "📚 독서록", 보호자는 "📚 독서노트"로 같은 `Reading` 화면에 들어간다.

## 범위
**포함**
- `NoteEditor`의 질문 목록 위에 "🤖 질문 만들기" 버튼
  - 활성 조건: AI 연결 설정됨(`aiReady`), 제목이 있음, 요약이 40자 이상(공백 제외 전 `trim()` 기준, Worker 최소값과 같음)
  - 비활성일 때 버튼 아래에 이유를 한 줄로: "보호자 모드에서 AI 연결을 설정해 주세요", "제목을 먼저 써 주세요", "요약을 12자 더 쓰면 만들 수 있어요"처럼 남은 글자 수
  - 아이 프로필은 보호자 설정 "독서록 AI 질문"이 켜져 있을 때만 버튼이 보인다(기본 켜짐). 보호자 프로필은 항상 보인다.
- 요청할 질문 수: 보호자 5개, 첫째(g5) 4개, 둘째(g3) 3개
- 후보 목록 (편집 화면 안에서만 관리, 저장 전까지 어디에도 남기지 않음)
  - 각 후보: 체크박스(기본 체크), 질문·답 입력칸(바로 고칠 수 있음), 종류 표시(사실 / 왜 / 적용)
  - "고른 질문 추가": 체크된 후보를 질문 목록에 붙인다. 질문 목록에 비어 있는 첫 줄(`q`, `a` 모두 빈칸)만 있으면 그 줄은 지우고 붙인다.
  - "다시 만들기": 후보를 새로 받아 바꾼다. "닫기": 후보를 버린다.
  - 이미 질문 목록에 있는 질문과 같은 후보는 빼고 보여 준다. 다 빠지면 "이미 있는 질문과 같아서 새 후보가 없어요".
- 실제 저장은 기존 "저장" 버튼 흐름 그대로다. 후보를 추가만 하고 저장하지 않으면 남지 않는다.
- 진행 중 표시("질문을 만들고 있어요…"), 요청 중에는 버튼 비활성(중복 요청 금지), 화면을 나가면 요청 취소(`AbortController`).
- 오류: 기존 `AiError` 메시지를 그대로 보여 주고 "다시 시도" 버튼. 오류가 나도 지금 쓰던 제목·요약·질문은 그대로.
- Worker 지시문 보강 (작게, `worker/src/personas.ts`만)
  - 요약 속 사람 이름 중 책 등장인물·저자가 아닌 것(친구, 가족, 학교)과 주소·연락처는 질문이나 답에 쓰지 않는다.
  - 아이: 그 학년이 읽을 수 있는 짧은 한국어, 무섭거나 폭력적인 질문 금지, 답은 한 문장.
  - 보호자: `apply` 질문은 "내 일이나 생활에 어떻게 써 볼까?" 형태로, 투자 책이어도 특정 종목 매수·매도 권유 금지.

**제외** (하지 말 것)
- 새 Worker 생성 종류, 입력·출력 스키마 변경
- 책 내용 검색, 웹 검색, 책 페이지 사진 인식
- 질문 자동 저장, 후보 기록 저장, 저장 스키마 변경(보호자 설정 필드 하나만 예외)
- 복습(`NoteReview`)·미션 진행·별 계산 변경

## 설계
### 순수 함수 `src/lib/readingQuiz.ts`
```ts
export type QuizType = 'fact' | 'why' | 'apply';
export interface QuizCandidate { id: string; q: string; a: string; type: QuizType; checked: boolean }
/** 레벨별 요청 개수: adult 5, g5 4, g3 3 */
export function quizCount(level: Level): number;
/** 버튼 상태. ok가 false면 화면에 보여 줄 한국어 이유를 준다. */
export function quizReadiness(args: { aiReady: boolean; title: string; summary: string }): { ok: true } | { ok: false; reason: string };
/** 응답 카드를 후보로 바꾼다. 앞뒤 공백 정리, 빈 질문·답 제거, 후보끼리 중복 제거, 기존 카드와 같은 질문 제거, 최대 count개. */
export function toCandidates(existing: readonly QaCard[], cards: readonly { q: string; a: string; type: QuizType }[], count: number, makeId: () => string): QuizCandidate[];
/** 체크된 후보를 질문 목록에 합친다. 빈 첫 줄 하나만 있으면 대체한다. 고친 내용이 비면 뺀다. */
export function mergeCandidates(cards: readonly QaCard[], candidates: readonly QuizCandidate[]): QaCard[];
```
- 같은 질문 판단(`sameQuestion`): 앞뒤 공백 제거, 연속 공백을 하나로, 영문 대소문자 무시, 끝의 `?`·`？`·`.` 무시.
- `makeId`는 기존 `uid`를 넘긴다(테스트에서는 고정 함수).

### 화면 (`src/pages/Reading.tsx` 또는 새 `src/components/ReadingQuizPanel.tsx`)
- `NoteEditor`가 길어지면 후보 패널은 새 컴포넌트로 뺀다. 패널은 `existing`, `level`, `profileId`, `title`, `author`, `summary`를 받고 `onAdd(candidates)`를 부른다.
- 요청: `generate(cfg, { profileId, level, kind: 'reading-quiz', input: { title, author, summary, level, count } }, signal)`
- 응답은 앱에서도 형태를 확인한다(배열인지, `q`·`a`가 문자열인지, `type`이 셋 중 하나인지). 이상하면 `server` 오류처럼 처리.

### 저장 (선택 필드, version 2 유지)
```ts
// ProfileSettings(아이)에 추가
readingQuiz?: { enabled: boolean }; // 없으면 켜짐
```
- `normalizeState()`: 형식 검사(불리언 아니면 기본값). 백업 내보내기/가져오기 포함.
- 보호자 모드 아이 설정에 "독서록 AI 질문 켜기/끄기".

## 수용 기준
- [ ] 보호자 독서노트에서 요약을 40자 이상 쓰고 "🤖 질문 만들기"를 누르면 후보 5개 안팎이 나온다. 아이 독서록은 첫째 4개, 둘째 3개다.
- [ ] 후보를 고치고 골라서 추가할 수 있고, 저장하면 질문 개수에 반영되고 복습에 나온다.
- [ ] 이미 있는 질문과 같은 후보는 나오지 않는다(테스트).
- [ ] AI 미설정, 제목 없음, 요약 부족이면 버튼이 비활성이고 이유가 보인다. 요청 오류·사용량 초과면 메시지와 "다시 시도"가 나오고 쓰던 내용은 그대로다.
- [ ] 요청 중 연타해도 요청은 하나만 나가고, 편집 화면을 나가면 요청이 취소된다.
- [ ] 저장 전에는 후보가 어디에도 남지 않고, 미션 진행·별·복습 기록은 기존 저장 흐름 그대로다(테스트).
- [ ] 보호자가 아이의 "독서록 AI 질문"을 끄면 그 아이 화면에 버튼이 없다. `normalizeState`·백업 테스트가 있다.
- [ ] Worker 지시문에 개인정보 제외, 아이 안전·학년 수준, 투자 권유 금지 문장이 있고 지시문 테스트가 있다. 입력·출력 스키마는 바뀌지 않았다.
- [ ] 375px와 DeX 큰 화면에서 후보 목록을 마우스·터치·키보드(Tab, Space로 체크, Enter로 추가)로 다룰 수 있다.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` 통과, `cd worker && npm run typecheck && npm test` 통과

## 테스트
- 단위: `quizCount`, `quizReadiness`(경계값 39/40자, 공백만 있는 요약), `toCandidates`(빈 값 제거, 후보끼리 중복, 기존 질문과 중복, 개수 제한), `mergeCandidates`(빈 첫 줄 대체, 체크 안 된 후보 제외, 고쳐서 빈칸이 된 후보 제외), `sameQuestion`
- 화면: 가짜 `generate`로 성공·오류·중복 클릭·취소 흐름
- 정규화: `readingQuiz` 없음/잘못된 값/정상값
- Worker: 지시문에 새 규칙이 들어 있는지

## 리뷰 포인트
- 요약에 없는 내용을 지어내지 않는지: PR에는 가짜 응답으로 만든 화면만 올리고, 실제 생성 예시는 **배포 후 보호자가** 보호자 노트 하나, 아이 독서록 하나로 확인한다.
- 아이 화면 문구가 초3이 읽을 수 있는지.
- 후보 상태가 저장 흐름을 건드리지 않는지(저장 전 새로고침하면 사라지는 것이 정상).
