# AGENTS.md — 구현 에이전트(Codex) 작업 규칙

이 저장소는 **기획(Claude Opus) → 구현(Codex) → 리뷰(Claude Sonnet)** 순서로 개발한다.
구현 에이전트는 `docs/tasks/`의 작업 명세서(Txx) 하나를 받아 그 범위만 구현한다.
전체 흐름은 `docs/WORKFLOW.md`, 제품 기획은 `docs/PLAN.md`를 본다.

## 프로젝트 한눈에 보기
- 가족(초5 첫째, 초3 둘째, 보호자)이 쓰는 학습 웹앱(PWA). UI 문구는 모두 한국어. 기기: 아이들은 아이뮤즈 뮤패드 K10 PLUS 태블릿(Android 13 Chrome, 10.4인치 2000×1200, RAM 4GB, 터치만), 보호자는 아이폰 13·14(Safari·홈 화면 앱, 390×844), 공용으로 2560×1440 PC 모니터(마우스·키보드)를 쓴다. 화면 검증은 이 세 가지 기준으로 한다(`docs/tasks/T24-device-fit.md`).
- Vite + React 19 + TypeScript(strict) + Vitest. 상태는 `localStorage`에 저장. AI(영어 음성 대화 등)는 OpenAI API를 `worker/` 프록시로 호출.
- 아이가 태블릿으로 쓰는 앱이다. **큰 터치 영역, 짧은 문장, 즉각적인 피드백**을 유지한다.

## 명령어
```bash
npm install          # 의존성 설치
npm run dev          # 개발 서버 (http://localhost:5173)
npm test             # Vitest 단위 테스트
npm run typecheck    # tsc -b
npm run build        # 타입 검사 + 프로덕션 빌드 (dist/)
```
PR을 올리기 전에 `npm run typecheck && npm test && npm run build`가 모두 통과해야 한다.

## 폴더 구조
```
src/
  types.ts                 공통 타입 (AppState, ProfileData, MathProblem …)
  route.ts                 화면 라우트 타입과 미션 메타데이터 (라우터 라이브러리 없음)
  store/                   상태: defaults(기본값), storage(저장/복원/정규화), StoreContext(update(draft))
  lib/                     순수 로직: date, random, srs(Leitner), progress(미션/보상), similarity(말하기 채점), speech(Web Speech API)
  content/math/            연산 단원별 문제 생성기(skills), 채점(grading), 세션 구성(session), 분수 유틸
  content/english/         단어장(vocab), 말하기 문장(sentences), 단어 세션 구성(session)
  components/              공통 UI (TopBar, ProgressBar, AnswerInput, PinGate)
  pages/                   화면 단위 컴포넌트
worker/                    Cloudflare Worker (T02부터): OpenAI 프록시, AI 친구 지시문, 사용량 제한
```

## 코드 규칙
1. **로직은 `lib/`와 `content/`의 순수 함수로, 화면은 `pages/`에.** 새 로직은 반드시 순수 함수로 빼고 Vitest 테스트를 붙인다.
2. **상태 변경은 `useStore().update((draft) => { ... })`로만.** draft는 깊은 복사본이므로 직접 수정한다. 학습 기록은 `applyProgress()`를 거쳐야 별, 연속 학습일, 쿠폰이 일관되게 처리된다.
3. **저장 스키마를 바꾸면** `types.ts`, `store/defaults.ts`, `store/storage.ts`의 `normalizeState()`를 함께 고치고, 이전 데이터가 깨지지 않는지 테스트한다. 호환이 안 되는 변경이면 `version`을 올리고 마이그레이션 함수를 쓴다.
4. **콘텐츠 id는 학습 기록(SRS) 키이므로 바꾸지 않는다.** 문장 id는 순서 기반이라 새 문장은 목록 끝에 추가한다.
5. **난수는 `Rng` 인자로 받는다.** 테스트는 `seededRng()`로 결과를 고정한다.
6. 새 npm 의존성은 명세서에 있거나 꼭 필요할 때만 추가하고, PR 설명에 이유를 적는다.
7. 주석, 커밋 메시지, UI 문구는 한국어. 식별자는 영어.
8. 스타일은 `src/styles.css`의 CSS 변수(`--primary` 등)와 기존 클래스를 재사용한다. 다크 모드를 깨지 않는다.

## 절대 하지 말 것
- **API 키나 비밀값을 클라이언트 코드, 저장소, 커밋에 넣지 않는다.** AI 호출은 반드시 프록시(`worker/`, T02)를 거친다.
- **AI 지시문(프롬프트)을 앱 코드에 두지 않는다.** 지시문은 `worker/`에만 두고, 앱은 모드와 데이터만 보낸다.
- 아이에게 보여 줄 콘텐츠(실험 카드, 이야기)는 보호자 승인 없이 추가하지 않는다. PR에 "보호자 확인 필요"로 표시한다.
- 아이 학습 데이터를 명세서에 없는 외부 서비스로 보내지 않는다.
- 테스트를 지우거나 `skip`해서 통과시키지 않는다.
- 명세서 범위 밖의 리팩터링이나 기능 추가를 하지 않는다. 필요해 보이면 PR 설명의 "후속 제안"에 적는다.

## 작업 방식
1. `docs/tasks/Txx-*.md`를 읽고 **수용 기준**을 체크리스트로 삼는다.
2. 브랜치 이름: `feat/Txx-짧은-설명` (예: `feat/T03-ai-friend-talk`).
3. 커밋은 의미 단위로 작게. 메시지 예: `T03: 대화 준비 화면과 주제 칩 추가`.
4. PR 제목: `[Txx] 작업 제목`. 본문에 다음을 쓴다:
   - 수용 기준 체크리스트(명세서에서 복사, 완료 표시)
   - 화면 변경이 있으면 스크린샷(태블릿 820px, 폰 375px). **스크린샷은 PR 본문이나 코멘트에 이미지로 직접 첨부하고, 저장소에 커밋하지 않는다**(`docs/screenshots/`에 새 파일 추가 금지)
   - 명세서와 다르게 구현한 부분과 이유
   - 후속 제안
5. 명세가 모호하면 임의로 결정하지 말고, 가장 보수적인 쪽으로 구현한 뒤 PR에 "확인 필요"로 표시한다.
