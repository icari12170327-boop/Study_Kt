import type { Level } from '../../types';

export interface Sentence {
  id: string;
  en: string;
  ko: string;
  /** 상황 분류 */
  tag: string;
}

export interface SentenceDeck {
  id: string;
  title: string;
  level: Level;
  sentences: Sentence[];
}

// 문장 id는 순서로 매겨지므로, 학습 기록이 어긋나지 않게 새 문장은 각 목록 끝에 추가한다.
type Row = [tag: string, en: string, ko: string];

const toSentences = (prefix: string, rows: Row[]): Sentence[] =>
  rows.map(([tag, en, ko], i) => ({ id: `${prefix}${i + 1}`, en, ko, tag }));

const G3: Row[] = [
  ['인사', 'Hello, my name is Minji.', '안녕, 내 이름은 민지야.'],
  ['인사', 'Nice to meet you.', '만나서 반가워.'],
  ['인사', 'How are you?', '어떻게 지내?'],
  ['인사', "I'm fine, thank you.", '잘 지내, 고마워.'],
  ['인사', 'Goodbye. See you tomorrow.', '안녕. 내일 봐.'],
  ['소개', 'I am nine years old.', '나는 아홉 살이야.'],
  ['소개', 'This is my brother.', '이쪽은 우리 오빠야.'],
  ['소개', 'I like apples.', '나는 사과를 좋아해.'],
  ['소개', "I don't like snakes.", '나는 뱀을 좋아하지 않아.'],
  ['소개', 'I can swim.', '나는 수영할 수 있어.'],
  ['소개', "I can't ride a bike.", '나는 자전거를 못 타.'],
  ['물건', 'What is this?', '이것은 뭐야?'],
  ['물건', "It's a pencil.", '그것은 연필이야.'],
  ['물건', 'Is it a ball?', '그것은 공이니?'],
  ['물건', 'How many apples?', '사과가 몇 개야?'],
  ['물건', 'What color is it?', '그것은 무슨 색이야?'],
  ['교실', 'Sit down, please.', '앉아 주세요.'],
  ['교실', 'Stand up, please.', '일어나 주세요.'],
  ['교실', 'Open the door, please.', '문을 열어 주세요.'],
  ['교실', "Don't run.", '뛰지 마.'],
  ['날씨', "How's the weather?", '날씨 어때?'],
  ['날씨', "It's sunny today.", '오늘은 맑아.'],
  ['기분', "I'm happy.", '나는 행복해.'],
  ['기분', "I'm hungry.", '나는 배고파.'],
  ['놀이', "Let's play soccer.", '축구하자.'],
  ['놀이', 'Sounds good!', '좋아!'],
];

const G5: Row[] = [
  ['자기소개', "I'm from Korea. Where are you from?", '나는 한국에서 왔어. 너는 어디서 왔니?'],
  ['자기소개', 'My favorite subject is science.', '내가 가장 좋아하는 과목은 과학이야.'],
  ['자기소개', 'I want to be a programmer in the future.', '나는 미래에 프로그래머가 되고 싶어.'],
  ['자기소개', "I'm good at playing soccer.", '나는 축구를 잘해.'],
  ['일상', 'I usually get up at seven.', '나는 보통 7시에 일어나.'],
  ['일상', 'I go to school by bus.', '나는 버스를 타고 학교에 가.'],
  ['일상', 'What time do you go to bed?', '너는 몇 시에 자니?'],
  ['일상', 'I have English class on Tuesday.', '나는 화요일에 영어 수업이 있어.'],
  ['과거', 'What did you do last weekend?', '지난 주말에 뭐 했어?'],
  ['과거', 'I visited my grandparents.', '나는 조부모님 댁에 갔어.'],
  ['과거', 'I watched a movie with my family.', '나는 가족과 영화를 봤어.'],
  ['과거', 'It was really fun.', '정말 재미있었어.'],
  ['길찾기', 'Where is the library?', '도서관이 어디에 있니?'],
  ['길찾기', 'Go straight and turn left.', '똑바로 가서 왼쪽으로 돌아.'],
  ['길찾기', "It's next to the bakery.", '그것은 빵집 옆에 있어.'],
  ['건강', "What's wrong?", '무슨 일이야? (어디 아파?)'],
  ['건강', 'I have a headache.', '나는 머리가 아파.'],
  ['건강', 'You should take some medicine.', '너는 약을 좀 먹어야겠다.'],
  ['건강', 'Get some rest.', '좀 쉬어.'],
  ['부탁', 'Can I borrow your eraser?', '네 지우개 좀 빌려도 될까?'],
  ['부탁', 'Sure, here you are.', '물론이지, 여기 있어.'],
  ['부탁', 'Can you help me, please?', '나 좀 도와줄 수 있어?'],
  ['제안', 'Why don\'t we go to the park?', '우리 공원에 가는 게 어때?'],
  ['제안', "I'm sorry, but I can't.", '미안하지만 안 돼.'],
  ['제안', 'How about this Saturday?', '이번 토요일은 어때?'],
  ['의견', 'I think we should save water.', '나는 우리가 물을 아껴야 한다고 생각해.'],
  ['의견', 'I agree with you.', '네 말에 동의해.'],
  ['의견', 'What do you think?', '너는 어떻게 생각해?'],
  ['쇼핑', 'How much is this cap?', '이 모자는 얼마예요?'],
  ['쇼핑', "It's ten dollars.", '10달러예요.'],
];

const BIZ: Row[] = [
  ['회의', "Let's get started. First, let's go over today's agenda.", '시작하죠. 먼저 오늘 안건을 살펴보겠습니다.'],
  ['회의', 'Could you walk us through the numbers?', '수치를 차근차근 설명해 주시겠어요?'],
  ['회의', 'I see your point, but I have a slightly different view.', '말씀하신 요점은 이해하지만, 저는 조금 다르게 봅니다.'],
  ['회의', 'Can I jump in here for a second?', '잠깐 끼어들어도 될까요?'],
  ['회의', "Let's take this offline and discuss the details later.", '이건 따로 자리를 잡고 세부 사항은 나중에 논의하죠.'],
  ['회의', 'Just to make sure we are on the same page.', '우리가 같은 이해를 하고 있는지 확인하려고요.'],
  ['회의', "Let's wrap up and review the action items.", '마무리하면서 실행 과제를 정리하죠.'],
  ['회의', "Who's going to take the lead on this?", '이 건은 누가 주도하실 건가요?'],
  ['회의', "We're running out of time, so let's move on.", '시간이 부족하니 다음으로 넘어가죠.'],
  ['회의', "I'll circle back to you on that by Friday.", '그 건은 금요일까지 다시 말씀드리겠습니다.'],
  ['이메일·전화', 'I am writing to follow up on our meeting yesterday.', '어제 회의 후속으로 연락드립니다.'],
  ['이메일·전화', 'Please find the attached file for your review.', '검토하실 수 있도록 첨부 파일을 보내드립니다.'],
  ['이메일·전화', 'Could you let me know by the end of the day?', '오늘 중으로 알려주실 수 있을까요?'],
  ['이메일·전화', 'Sorry for the late reply.', '답장이 늦어 죄송합니다.'],
  ['이메일·전화', 'Thank you for your patience.', '기다려 주셔서 감사합니다.'],
  ['이메일·전화', 'Could you speak a little more slowly, please?', '조금만 더 천천히 말씀해 주시겠어요?'],
  ['이메일·전화', 'Let me check and get back to you.', '확인해 보고 다시 연락드리겠습니다.'],
  ['발표', "Today, I'd like to talk about our new strategy.", '오늘은 새 전략에 대해 말씀드리고자 합니다.'],
  ['발표', 'As you can see on this slide, sales have doubled.', '이 슬라이드에서 보시듯 매출이 두 배가 되었습니다.'],
  ['발표', 'Let me give you a quick overview.', '간단히 개요를 말씀드리겠습니다.'],
  ['발표', 'To sum up, we need to act quickly.', '요약하자면, 우리는 빨리 움직여야 합니다.'],
  ['발표', "That's a great question. Let me answer that.", '좋은 질문입니다. 답변드리겠습니다.'],
  ['협상', 'What would it take to close the deal today?', '오늘 계약을 마무리하려면 무엇이 필요할까요?'],
  ['협상', 'We are flexible on the price if you increase the volume.', '물량을 늘려 주시면 가격은 조정할 수 있습니다.'],
  ['협상', "I'm afraid that's beyond our budget.", '죄송하지만 그건 저희 예산을 넘어섭니다.'],
  ['협상', 'Is there any room for negotiation?', '협상의 여지가 있을까요?'],
  ['협상', 'Let me run this by my team first.', '먼저 팀과 상의해 보겠습니다.'],
  ['협상', 'I think we can meet each other halfway.', '서로 한 발씩 양보할 수 있을 것 같습니다.'],
  ['스몰토크', 'How was your weekend?', '주말 어떻게 보내셨어요?'],
  ['스몰토크', 'Have you been to Seoul before?', '서울에 와 보신 적 있으세요?'],
  ['스몰토크', "It's been a while. How have you been?", '오랜만이에요. 어떻게 지내셨어요?'],
  ['스몰토크', 'I hope you had a pleasant flight.', '편안한 비행이 되셨길 바랍니다.'],
  ['스몰토크', 'Let me introduce you to my colleague.', '제 동료를 소개해 드릴게요.'],
  ['의견·보고', 'From my perspective, the risk is manageable.', '제 관점에서는 리스크가 관리 가능한 수준입니다.'],
  ['의견·보고', 'The project is on track and within budget.', '프로젝트는 일정대로, 예산 범위 내에서 진행 중입니다.'],
  ['의견·보고', 'We are slightly behind schedule due to supplier issues.', '공급업체 문제로 일정이 약간 늦어지고 있습니다.'],
  ['의견·보고', 'I would recommend we start with a small pilot.', '작은 시범 프로젝트부터 시작하는 것을 권합니다.'],
  ['의견·보고', 'Could you clarify what you mean by that?', '그게 어떤 의미인지 좀 더 설명해 주시겠어요?'],
  ['AI', 'We are exploring how AI can improve our workflow.', '우리는 AI가 업무 흐름을 어떻게 개선할 수 있을지 검토 중입니다.'],
  ['AI', 'This AI tool cut our reporting time in half.', '이 AI 도구로 보고서 작성 시간이 절반으로 줄었습니다.'],
  ['AI', 'The model sometimes hallucinates, so we always double-check.', '모델이 가끔 그럴듯한 오답을 내서 항상 다시 확인합니다.'],
  ['AI', 'We should protect customer data when we use AI.', 'AI를 쓸 때는 고객 데이터를 보호해야 합니다.'],
  ['AI', 'An AI agent can handle routine tasks, but people still make the final call.', 'AI 에이전트가 반복 업무를 처리할 수 있지만, 최종 결정은 여전히 사람이 합니다.'],
  ['AI', 'What is the most valuable use case for our team?', '우리 팀에 가장 가치 있는 활용 사례는 무엇일까요?'],
  ['AI', 'Let me show you a quick demo of the prototype.', '시제품 데모를 간단히 보여드리겠습니다.'],
];

export const SENTENCE_DECKS: SentenceDeck[] = [
  { id: 'g3-talk', title: '초3 생활 영어', level: 'g3', sentences: toSentences('g3s', G3) },
  { id: 'g5-talk', title: '초5 생활 영어', level: 'g5', sentences: toSentences('g5s', G5) },
  { id: 'biz-talk', title: '비즈니스 영어회화', level: 'adult', sentences: toSentences('biz', BIZ) },
];

export const SENTENCE_DECK_MAP: Record<string, SentenceDeck> = Object.fromEntries(SENTENCE_DECKS.map((d) => [d.id, d]));

export const speakKey = (deckId: string, id: string) => `speak:${deckId}:${id}`;
