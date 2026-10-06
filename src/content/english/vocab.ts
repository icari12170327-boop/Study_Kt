import type { Level } from '../../types';

export interface VocabCard {
  id: string;
  en: string;
  ko: string;
  emoji?: string;
  /** 예문 (선택) */
  example?: string;
}

export interface VocabDeck {
  id: string;
  title: string;
  level: Level;
  cards: VocabCard[];
}

type Row = [en: string, ko: string, emoji?: string, example?: string];

const toCards = (rows: Row[]): VocabCard[] =>
  rows.map(([en, ko, emoji, example]) => ({ id: en, en, ko, emoji, example }));

/** 초등 3학년: 영어를 처음 배우는 단계의 기초 단어 */
const G3: Row[] = [
  ['apple', '사과', '🍎'], ['banana', '바나나', '🍌'], ['milk', '우유', '🥛'], ['bread', '빵', '🍞'],
  ['egg', '달걀', '🥚'], ['water', '물', '💧'], ['pizza', '피자', '🍕'], ['candy', '사탕', '🍬'],
  ['cat', '고양이', '🐱'], ['dog', '개', '🐶'], ['bird', '새', '🐦'], ['fish', '물고기', '🐟'],
  ['lion', '사자', '🦁'], ['tiger', '호랑이', '🐯'], ['rabbit', '토끼', '🐰'], ['bear', '곰', '🐻'],
  ['monkey', '원숭이', '🐵'], ['elephant', '코끼리', '🐘'], ['duck', '오리', '🦆'], ['pig', '돼지', '🐷'],
  ['red', '빨간색', '🟥'], ['blue', '파란색', '🟦'], ['yellow', '노란색', '🟨'], ['green', '초록색', '🟩'],
  ['black', '검은색', '⬛'], ['white', '흰색', '⬜'], ['pink', '분홍색', '🩷'], ['orange', '주황색', '🟧'],
  ['one', '하나, 1', '1️⃣'], ['two', '둘, 2', '2️⃣'], ['three', '셋, 3', '3️⃣'], ['four', '넷, 4', '4️⃣'],
  ['five', '다섯, 5', '5️⃣'], ['six', '여섯, 6', '6️⃣'], ['seven', '일곱, 7', '7️⃣'], ['eight', '여덟, 8', '8️⃣'],
  ['nine', '아홉, 9', '9️⃣'], ['ten', '열, 10', '🔟'],
  ['mom', '엄마', '👩'], ['dad', '아빠', '👨'], ['sister', '언니, 누나, 여동생', '👧'], ['brother', '형, 오빠, 남동생', '👦'],
  ['baby', '아기', '👶'], ['friend', '친구', '🧑‍🤝‍🧑'], ['teacher', '선생님', '🧑‍🏫'],
  ['head', '머리', '🙆'], ['eye', '눈', '👁️'], ['ear', '귀', '👂'], ['nose', '코', '👃'],
  ['mouth', '입', '👄'], ['hand', '손', '✋'], ['foot', '발', '🦶'],
  ['book', '책', '📕'], ['pencil', '연필', '✏️'], ['bag', '가방', '🎒'], ['desk', '책상', '🪑'],
  ['school', '학교', '🏫'], ['eraser', '지우개', '🧽'], ['ruler', '자', '📏'],
  ['ball', '공', '⚽'], ['robot', '로봇', '🤖'], ['doll', '인형', '🪆'], ['bike', '자전거', '🚲'],
  ['car', '자동차', '🚗'], ['bus', '버스', '🚌'], ['house', '집', '🏠'], ['tree', '나무', '🌳'],
  ['flower', '꽃', '🌸'], ['sun', '해', '☀️'], ['moon', '달', '🌙'], ['star', '별', '⭐'],
  ['rain', '비', '🌧️'], ['snow', '눈(날씨)', '❄️'],
  ['happy', '행복한', '😊'], ['sad', '슬픈', '😢'], ['hungry', '배고픈', '😋'], ['tired', '피곤한', '😪'],
  ['big', '큰', '🐘'], ['small', '작은', '🐜'], ['hot', '뜨거운, 더운', '🔥'], ['cold', '차가운, 추운', '🧊'],
  ['run', '달리다', '🏃'], ['jump', '뛰다', '🦘'], ['swim', '수영하다', '🏊'], ['sing', '노래하다', '🎤'],
  ['dance', '춤추다', '💃'], ['eat', '먹다', '🍽️'], ['sleep', '자다', '😴'], ['read', '읽다', '📖'],
];

/** 초등 5학년: 일상 표현과 교과 주제 단어 */
const G5: Row[] = [
  ['breakfast', '아침 식사', '🍳', 'I eat breakfast at 7.'], ['lunch', '점심 식사', '🍱'], ['dinner', '저녁 식사', '🍲'],
  ['delicious', '맛있는', '😋', 'This soup is delicious.'], ['vegetable', '채소', '🥦'], ['fruit', '과일', '🍇'],
  ['kitchen', '부엌', '🍳'], ['bathroom', '욕실', '🛁'], ['bedroom', '침실', '🛏️'], ['living room', '거실', '🛋️'],
  ['library', '도서관', '📚', "Let's go to the library."], ['hospital', '병원', '🏥'], ['museum', '박물관', '🏛️'],
  ['bakery', '빵집', '🥐'], ['park', '공원', '🌳'], ['station', '역', '🚉'], ['post office', '우체국', '📮'],
  ['straight', '똑바로', '⬆️', 'Go straight one block.'], ['turn left', '왼쪽으로 돌다', '⬅️'], ['turn right', '오른쪽으로 돌다', '➡️'],
  ['next to', '~ 옆에', '↔️'], ['between', '~ 사이에', '↕️'], ['across from', '~ 맞은편에', '🔁'],
  ['Monday', '월요일', '📅'], ['Tuesday', '화요일', '📅'], ['Wednesday', '수요일', '📅'], ['Thursday', '목요일', '📅'],
  ['Friday', '금요일', '📅'], ['Saturday', '토요일', '📅'], ['Sunday', '일요일', '📅'],
  ['spring', '봄', '🌱'], ['summer', '여름', '🏖️'], ['fall', '가을', '🍂'], ['winter', '겨울', '⛄'],
  ['weather', '날씨', '🌤️', "How's the weather today?"], ['cloudy', '흐린', '☁️'], ['windy', '바람 부는', '🌬️'], ['sunny', '맑은', '☀️'],
  ['math', '수학', '➗'], ['science', '과학', '🔬'], ['music', '음악', '🎵'], ['art', '미술', '🎨'],
  ['history', '역사', '📜'], ['English', '영어', '🔤'], ['P.E.', '체육', '🤸'], ['subject', '과목', '📚', "What's your favorite subject?"],
  ['soccer', '축구', '⚽'], ['baseball', '야구', '⚾'], ['badminton', '배드민턴', '🏸'], ['basketball', '농구', '🏀'],
  ['practice', '연습하다', '🏋️', 'I practice the piano every day.'], ['hobby', '취미', '🎯'], ['contest', '대회', '🏆'],
  ['doctor', '의사', '🧑‍⚕️'], ['scientist', '과학자', '🧑‍🔬'], ['cook', '요리사; 요리하다', '🧑‍🍳'], ['pilot', '조종사', '🧑‍✈️'],
  ['firefighter', '소방관', '🧑‍🚒'], ['police officer', '경찰관', '👮'], ['designer', '디자이너', '🎨'], ['programmer', '프로그래머', '👨‍💻'],
  ['future', '미래', '🔮', 'I want to be a scientist in the future.'], ['dream', '꿈', '💭'],
  ['headache', '두통', '🤕', 'I have a headache.'], ['fever', '열', '🤒'], ['cold', '감기', '🤧'], ['toothache', '치통', '🦷'],
  ['medicine', '약', '💊'], ['rest', '쉬다; 휴식', '🛌'],
  ['vacation', '방학, 휴가', '🏝️', 'What did you do during the vacation?'], ['travel', '여행하다', '✈️'], ['visit', '방문하다', '🚪'],
  ['yesterday', '어제', '⏪'], ['tomorrow', '내일', '⏩'], ['weekend', '주말', '🎉'], ['always', '항상', '♾️'],
  ['usually', '보통', '🔁'], ['sometimes', '가끔', '🎲'], ['never', '결코 ~않다', '🚫'],
  ['earth', '지구', '🌍'], ['plant', '식물; 심다', '🪴'], ['recycle', '재활용하다', '♻️', 'We should recycle plastic.'],
  ['save', '아끼다, 구하다', '💡'], ['trash', '쓰레기', '🗑️'], ['energy', '에너지', '⚡'],
  ['brave', '용감한', '🦸'], ['kind', '친절한', '🤝'], ['funny', '웃긴', '😆'], ['smart', '똑똑한', '🧠'],
  ['honest', '정직한', '😇'], ['curious', '호기심 많은', '🧐'], ['careful', '조심스러운', '⚠️'], ['different', '다른', '🔀'],
  ['borrow', '빌리다', '📥', 'Can I borrow your pen?'], ['lend', '빌려주다', '📤'], ['invite', '초대하다', '💌'],
  ['remember', '기억하다', '🧠'], ['forget', '잊다', '🫥'], ['decide', '결정하다', '✅'], ['explain', '설명하다', '🗣️'],
];

/** 보호자: 비즈니스 영어 + AI 핵심 표현 */
const BIZ_AI: Row[] = [
  ['agenda', '안건, 의제', '📋', "Let's go over today's agenda."],
  ['follow up', '후속 조치하다', '📨', "I'll follow up with an email."],
  ['deadline', '마감 기한', '⏰', 'Can we push the deadline to Friday?'],
  ['deliverable', '산출물', '📦', 'The key deliverable is a working prototype.'],
  ['stakeholder', '이해관계자', '👥', 'We need buy-in from all stakeholders.'],
  ['buy-in', '동의와 지지', '🤝', "We'll need buy-in from the sales team."],
  ['bottleneck', '병목', '🍾', 'Approval is the main bottleneck.'],
  ['trade-off', '득실 관계, 절충', '⚖️', "There's a trade-off between speed and quality."],
  ['leverage', '활용하다', '🛠️', 'We can leverage our existing data.'],
  ['align', '방향을 맞추다', '🎯', "Let's align on the priorities first."],
  ['prioritize', '우선순위를 정하다', '🥇', 'We should prioritize customer issues.'],
  ['scalable', '확장 가능한', '📈', 'Is this solution scalable?'],
  ['ROI', '투자 대비 수익', '💰', 'What is the expected ROI?'],
  ['KPI', '핵심 성과 지표', '📊', 'Our main KPI is monthly active users.'],
  ['ballpark figure', '대략적인 수치', '🔢', 'Can you give me a ballpark figure?'],
  ['on the same page', '같은 이해를 공유하는', '📄', 'Just to make sure we are on the same page.'],
  ['touch base', '잠깐 연락하다', '📞', "Let's touch base next week."],
  ['circle back', '나중에 다시 논의하다', '🔄', "Let's circle back to this after lunch."],
  ['take ownership', '책임을 맡다', '🙋', "I'll take ownership of this task."],
  ['heads-up', '미리 알림', '📣', 'Thanks for the heads-up.'],
  ['wrap up', '마무리하다', '🎁', "Let's wrap up the meeting."],
  ['action item', '실행 과제', '✅', "Let's review the action items."],
  ['negotiate', '협상하다', '🤝', 'We need to negotiate the terms.'],
  ['compromise', '타협하다; 타협', '🫱', "I think we can reach a compromise."],
  ['proposal', '제안(서)', '📝', "I'll send you the proposal by tomorrow."],
  ['budget', '예산', '💵', "It's over our budget."],
  ['quarter', '분기', '🗓️', 'Sales grew 10% this quarter.'],
  ['revenue', '매출', '💹', 'Revenue increased by 15 percent.'],
  ['artificial intelligence', '인공지능', '🤖', 'Artificial intelligence is changing every industry.'],
  ['machine learning', '머신러닝', '🧮', 'Machine learning finds patterns in data.'],
  ['large language model', '대규모 언어 모델(LLM)', '💬', 'A large language model can draft emails.'],
  ['prompt', '프롬프트(지시문)', '⌨️', 'A clear prompt gives better results.'],
  ['training data', '학습 데이터', '🗄️', 'The quality of training data matters.'],
  ['inference', '추론(모델 실행)', '⚙️', 'Inference costs are dropping quickly.'],
  ['fine-tune', '미세 조정하다', '🎛️', 'We fine-tuned the model on our documents.'],
  ['hallucination', '환각(그럴듯한 오답)', '🌀', 'Always check the output for hallucinations.'],
  ['agent', '에이전트(자율 실행 AI)', '🕵️', 'An AI agent can complete multi-step tasks.'],
  ['automate', '자동화하다', '🔁', 'We automated the weekly report.'],
  ['workflow', '업무 흐름', '🔀', 'AI fits naturally into this workflow.'],
  ['use case', '활용 사례', '💡', "What's the best use case for AI here?"],
  ['pilot project', '시범 프로젝트', '🧪', "Let's start with a small pilot project."],
  ['data privacy', '데이터 프라이버시', '🔒', 'Data privacy is our top concern.'],
  ['benchmark', '벤치마크; 기준점', '📏', 'The model scored high on the benchmark.'],
  ['productivity', '생산성', '🚀', 'AI tools boosted our productivity.'],
  ['adopt', '도입하다', '📥', 'Many companies are adopting AI tools.'],
  ['insight', '통찰', '🔍', 'The data gave us valuable insights.'],
];

export const VOCAB_DECKS: VocabDeck[] = [
  { id: 'g3-words', title: '초3 기초 단어', level: 'g3', cards: toCards(G3) },
  { id: 'g5-words', title: '초5 단어', level: 'g5', cards: toCards(G5) },
  { id: 'biz-ai', title: '비즈니스·AI 표현', level: 'adult', cards: toCards(BIZ_AI) },
];

export const VOCAB_DECK_MAP: Record<string, VocabDeck> = Object.fromEntries(VOCAB_DECKS.map((d) => [d.id, d]));

export const vocabKey = (deckId: string, cardId: string) => `vocab:${deckId}:${cardId}`;
