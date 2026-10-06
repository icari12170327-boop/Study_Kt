# T09 — 국어 연재 이야기 읽기

- 상태: 준비됨
- 단계: 4
- 선행 작업: 없음
- 예상 분량: 하루 (화면) + 이야기 1편 작성

## 목표
책 읽기를 싫어하는 아이도 "다음 화가 궁금해서" 스스로 켜게 만든다. 하루 한 화를 읽고, 끝에 문제 3개를 풀면 다음 날 다음 화가 열린다.

## 배경
원글: 재밌게 쭉쭉 읽다가 마지막에 문제로 뒤통수 맞는 구조, 이야기가 궁금해서 다음 날 알아서 켠다. 그림은 집 PC의 그림 AI로 그렸다.

## 범위
**포함**
- 미션 타입 `story` (단위: 화, 기본 둘째 1화 켬, 첫째 끔)
- 이야기 데이터 `src/content/stories/*.ts`. **첫 이야기 1편(10화)**, 초3 수준. 화마다 600~1,000자, 끝은 궁금하게 끊김
- 읽기 화면: 큰 글씨(1.25rem 이상, 줄 간격 1.8), 문단 나눔, 선택 그림(`public/stories/<id>/<n>.webp`), 🔊 한국어 읽어 주기(`speak(text, { lang: 'ko-KR' })`, 문단 단위)
- 문제 3개: 사실 확인, 추론, 어휘(뜻 고르기). 4지선다. 틀리면 해당 문단을 강조해 보여 주고 다시 풀기
- 다음 화 잠금: 오늘 화의 문제를 다 맞히면 "내일 열려요 🔒 (다음 화 제목)" 예고. 날짜가 바뀌면 열림
- 이야기 목록, 다 읽은 이야기 다시 보기
- 보호자: 아이 진도, 문제별 정답률, "다음 화 미리 열기" 버튼

**제외**
- AI 이야기 자동 생성 기능 (이야기는 저장소 데이터로 관리)
- 그림 생성 (이미지 파일만 있으면 표시)

## 설계
```ts
interface Story {
  id: string; title: string; level: 'g3' | 'g5';
  episodes: {
    n: number; title: string;
    paragraphs: string[];
    image?: string;
    questions: { type: 'fact' | 'infer' | 'vocab'; q: string; choices: string[]; answer: number; paragraph: number; explain: string }[];
    teaser: string; // 다음 화 예고 한 줄
  }[];
}
// ProfileData.stories: Record<storyId, { unlocked: number; finished: number; lastReadDate?: string; answers: Record<string, boolean[]> }>
```
- 이야기 작성 방법: AI(어떤 도구든)로 초안을 만들고 보호자가 읽고 고친 뒤 PR로 넣는다. **보호자 승인 없는 이야기는 넣지 않는다.**
- 첫 이야기 제안: 둘째 관심사를 반영한 모험물(예: 과학을 좋아하면 "꼬마 발명가와 고장 난 로봇", 동물을 좋아하면 "밤마다 말하는 고양이"). 보호자에게 먼저 고르게 한다.

## 수용 기준
- [ ] 이야기 1편 10화가 형식대로 있고, 화마다 문제 3개(유형별 1개), `answer`와 `paragraph`가 유효하다(테스트).
- [ ] 오늘 화를 다 풀면 미션 완료, 다음 화는 다음 날 열린다(날짜 경계 테스트).
- [ ] 틀리면 근거 문단이 강조되고 다시 풀 수 있다.
- [ ] 한국어 읽어 주기가 문단 단위로 동작한다.
- [ ] 보호자 "다음 화 미리 열기"가 동작한다.
- [ ] `npm run typecheck && npm test && npm run build` 통과

## 리뷰 포인트
- 초3 어휘 수준, 맞춤법, 끝맺음이 다음 화를 궁금하게 하는지 (보호자 승인 여부 PR에 명시)
