import type { OpicType } from '../../../shared/opic';
export interface OpicQuestion { id: string; topic: string; type: OpicType; en: string; ko: string; minLevel: 1 | 2 | 3 | 4 | 5 | 6 }
export const SURVEY_TOPICS = [
  ['work', '회사 생활', 'your workplace', '직장'], ['home', '우리 집', 'your home', '집'],
  ['park', '공원 가기', 'a park you visit', '자주 가는 공원'], ['beach', '해변 가기', 'a beach you like', '좋아하는 해변'],
  ['walking', '걷기', 'your walking route', '산책길'], ['jogging', '조깅', 'a place where you jog', '조깅하는 곳'],
  ['movies', '영화 보기', 'a movie you enjoy', '좋아하는 영화'], ['tv', 'TV 보기', 'a TV program you enjoy', '좋아하는 TV 프로그램'],
  ['music', '음악 감상', 'music you enjoy', '즐겨 듣는 음악'], ['cafe', '카페 가기', 'a cafe you visit', '자주 가는 카페'],
  ['staycation', '집에서 보내는 휴가', 'a relaxing day at home', '집에서 쉬는 날'], ['domestic-travel', '국내 여행', 'a place you visit in your country', '국내 여행지'],
] as const;
export const UNEXPECTED_TOPICS = [
  ['furniture', '가구·가전', 'a useful item in your home', '집에서 쓰는 물건'], ['weather', '날씨·계절', 'your favorite season', '좋아하는 계절'],
  ['bank', '은행', 'a bank service you use', '이용하는 은행 서비스'], ['hospital', '병원', 'a clinic you have visited', '가 본 병원'],
  ['recycling', '재활용', 'recycling in your neighborhood', '동네 재활용'], ['transport', '교통', 'transportation you use', '이용하는 교통수단'],
  ['technology', '인터넷·기술', 'a device you often use', '자주 쓰는 기기'], ['holidays', '명절', 'a holiday you celebrate', '보내는 명절'],
  ['shopping', '쇼핑', 'a shop you visit', '자주 가는 가게'], ['cooking', '음식·요리', 'a meal you enjoy', '좋아하는 식사'],
  ['health', '건강', 'a habit that helps you feel well', '건강에 도움이 되는 습관'], ['appointments', '약속', 'a place where you meet people', '약속 장소'],
] as const;
export const TOPIC_NAMES: Record<string, string> = Object.fromEntries([...SURVEY_TOPICS, ...UNEXPECTED_TOPICS].map(([id, name]) => [id, name]));
export const TYPE_NAMES: Record<OpicType, string> = { 'self-intro': '자기소개', description: '묘사', routine: '일상·습관', past: '과거 경험', comparison: '비교·변화', 'roleplay-questions': '롤플레이 질문하기', 'roleplay-solution': '롤플레이 문제 해결', 'roleplay-experience': '롤플레이 관련 경험', issue: '이슈' };
const activities: Record<string, string> = {
  work: 'working', home: 'spending time at home', park: 'visiting a park', beach: 'going to the beach', walking: 'taking a walk', jogging: 'going jogging', movies: 'watching a movie', tv: 'watching TV', music: 'listening to music', cafe: 'visiting a cafe', staycation: 'taking a vacation at home', 'domestic-travel': 'traveling within your country',
  furniture: 'using household items', weather: "getting ready for the day's weather", bank: 'using a bank service', hospital: 'going to a clinic', recycling: 'recycling household waste', transport: 'getting from one place to another', technology: 'using a device', holidays: 'celebrating a holiday', shopping: 'going shopping', cooking: 'preparing a meal', health: 'taking care of your health', appointments: 'meeting someone you know',
};
// 기출·교재를 옮기지 않고 일상 경험을 묻는 새 질문을 작성했다. id는 주제·유형·고정 번호다.
const ordinary = [...SURVEY_TOPICS, ...UNEXPECTED_TOPICS].flatMap(([topic, , subject, meaning]): OpicQuestion[] => [
  { id: `${topic}-describe-01`, topic, type: 'description', minLevel: 1, en: `Tell me about ${subject}. Describe three details that help me picture it, and explain why those details matter to you.`, ko: `${meaning}에 대해 말해 주세요. 모습을 떠올릴 수 있는 세부 사항 세 가지와 그것이 중요한 이유를 설명해 주세요.` },
  { id: `${topic}-describe-02`, topic, type: 'description', minLevel: 2, en: `Imagine I know nothing about ${subject}. What would you point out first? Explain its main features and your personal impression.`, ko: `${meaning}을 처음 알게 된 사람에게 무엇부터 설명하겠어요? 주요 특징과 직접 느낀 점을 말해 주세요.` },
  { id: `${topic}-routine-01`, topic, type: 'routine', minLevel: 1, en: `Tell me about your usual routine for ${activities[topic]}. When do you do it, and what do you do first, next, and last?`, ko: `평소 한 주에서 ${meaning}과 관련해 무엇을 하나요? 보통 하는 일을 처음부터 끝까지 말해 주세요.` },
  { id: `${topic}-routine-02`, topic, type: 'routine', minLevel: 2, en: `Walk me through an ordinary day that includes ${activities[topic]}. How do you prepare, what do you do during it, and how do you finish? Explain your choices.`, ko: `${meaning}과 관련한 일을 할 때 어떻게 준비하고 마무리하나요? 평소의 선택과 이유를 설명해 주세요.` },
  { id: `${topic}-past-01`, topic, type: 'past', minLevel: 3, en: `Recall a recent experience involving ${subject}. What happened first, what happened next, and how did you feel at the end?`, ko: `${meaning}과 관련한 최근 경험을 떠올려 주세요. 처음과 다음에 무슨 일이 있었고 마지막에는 어떻게 느꼈나요?` },
  { id: `${topic}-past-02`, topic, type: 'past', minLevel: 3, en: `Tell me about a memorable moment connected with ${subject}. Describe the situation, your actions, and what made that moment stand out.`, ko: `${meaning}과 관련해 기억에 남는 순간을 말해 주세요. 상황과 직접 한 일, 특별히 기억나는 이유를 설명해 주세요.` },
]);
const roleplayScenes = [
  ['cafe', 'reserve a table for a small group', '작은 모임의 자리를 예약'], ['domestic-travel', 'book a room for a weekend trip', '주말 여행의 방을 예약'],
  ['movies', 'arrange movie tickets for your family', '가족 영화표를 준비'], ['transport', 'find a way to get to a meeting', '약속 장소로 갈 방법을 찾기'],
  ['shopping', 'choose a household item in a shop', '가게에서 생활용품을 고르기'], ['appointments', 'plan a meeting with a friend', '친구와 약속을 정하기'],
  ['park', 'arrange a picnic with friends', '친구들과 소풍을 정하기'], ['work', 'organize a short team meeting', '짧은 팀 회의를 준비'],
] as const;
const roles = roleplayScenes.flatMap(([topic, scene, ko]): OpicQuestion[] => [
  { id: `${topic}-role-questions-01`, topic, type: 'roleplay-questions', minLevel: 3, en: `You want to ${scene}. Speak to the person who can help. Ask three questions you need answered before making a decision.`, ko: `${ko}를 하려고 합니다. 도움을 줄 사람에게 결정하기 전에 알아야 할 질문 세 가지를 해 주세요.` },
  { id: `${topic}-role-solution-01`, topic, type: 'roleplay-solution', minLevel: 3, en: `You planned to ${scene}, but the time you chose is no longer available. Explain the problem to the person helping you and suggest two workable alternatives.`, ko: `${ko}를 계획했지만 고른 시간에는 할 수 없게 됐어요. 상황을 설명하고 가능한 대안 두 가지를 제안해 주세요.` },
  { id: `${topic}-role-experience-01`, topic, type: 'roleplay-experience', minLevel: 3, en: `Have you ever had to change a plan like this: ${scene}? Tell me what went wrong, how you handled it, and how things ended. If not, explain a similar experience.`, ko: `${ko} 같은 계획을 바꾼 적이 있나요? 문제와 대처, 결과를 말해 주세요. 없으면 비슷한 경험을 설명해 주세요.` },
]);
const advanced = SURVEY_TOPICS.map(([topic, , subject, meaning], i): OpicQuestion => i % 2 ?
  { id: `${topic}-issue-01`, topic, type: 'issue', minLevel: 5, en: `What challenge do people face today in connection with ${subject}? Explain your view, give an example you know, and suggest a practical improvement.`, ko: `요즘 ${meaning}과 관련해 사람들이 겪는 어려움은 무엇인가요? 생각과 아는 사례, 실천할 수 있는 개선 방법을 말해 주세요.` } :
  { id: `${topic}-compare-01`, topic, type: 'comparison', minLevel: 5, en: `How has your experience of ${subject} changed over time? Compare the past and the present, and explain what you expect in the future.`, ko: `시간이 지나며 ${meaning}과 관련한 경험은 어떻게 바뀌었나요? 과거와 현재를 비교하고 앞으로의 기대를 말해 주세요.` });
export const OPIC_QUESTIONS: readonly OpicQuestion[] = [
  { id: 'intro-life-01', topic: 'home', type: 'self-intro', minLevel: 1, en: 'Introduce yourself through your daily life. Tell me how you spend a typical day and one activity that is important to you. You do not need to share your name or workplace.', ko: '일상을 중심으로 자신을 소개해 주세요. 보통 하루를 어떻게 보내는지, 중요한 활동 하나를 말해 주세요. 이름이나 회사명은 말하지 않아도 돼요.' },
  { id: 'intro-interest-01', topic: 'work', type: 'self-intro', minLevel: 1, en: 'Help me get to know you. Describe something you enjoy, how you became interested in it, and how it fits into your life now.', ko: '자신을 알아갈 수 있도록 즐기는 것과 관심을 갖게 된 계기, 요즘 생활과 어떻게 연결되는지 말해 주세요.' },
  ...ordinary, ...roles, ...advanced,
];
export const QUESTION_MAP = new Map(OPIC_QUESTIONS.map(question => [question.id, question]));
