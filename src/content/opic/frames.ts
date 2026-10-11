import type { OpicType } from '../../../shared/opic';
export interface OpicFrame { steps: readonly string[]; skeleton: readonly string[]; connectors: readonly string[]; fillers: readonly string[] }
const connectors = ['First,', 'Also,', 'For example,', 'Because of that,', 'In the end,'];
const fillers = ['Let me think for a moment.', 'That is a good question.', 'I will start with one example.'];
const frame = (steps: string[], skeleton: string[]): OpicFrame => ({ steps, skeleton, connectors, fillers });
export const OPIC_FRAMES: Record<OpicType, OpicFrame> = {
  'self-intro': frame(['요즘 생활', '즐기는 활동', '관심을 갖게 된 이유', '오늘의 나'], ['My days are usually...', 'I enjoy...', 'I started because...', 'These days, I...']),
  description: frame(['주제 소개', '어디·무엇·어떤 세부 3개', '느낌과 이유', '마무리'], ['I would like to describe...', 'It has... It is... You can...', 'I like it because...', 'That is why it matters to me.']),
  routine: frame(['보통 언제', '처음 하는 일', '그다음과 이유', '마무리 습관'], ['I usually... on...', 'First, I...', 'Then, I... because...', 'Before I finish, I...']),
  past: frame(['언제·어디', '일어난 일', '내 행동과 느낌', '결과'], ['It happened when...', 'At first,...', 'So I... I felt...', 'In the end,...']),
  comparison: frame(['비교 대상', '예전 모습', '지금 모습과 이유', '앞으로'], ['I can see a change in...', 'In the past,...', 'Now,... because...', 'In the future, I expect...']),
  'roleplay-questions': frame(['인사와 용건', '첫 질문', '다른 질문 두 개', '감사와 확인'], ['Hello, I would like to...', 'Could you tell me...?', 'What about...? Is it possible to...?', 'Thank you. Let me check...']),
  'roleplay-solution': frame(['문제 설명', '첫 번째 대안', '두 번째 대안', '의견 묻기'], ['I am calling because...', 'Could we... instead?', 'Another option would be...', 'Which option works for you?']),
  'roleplay-experience': frame(['비슷한 경험', '문제 발생', '해결 행동', '결과와 배운 점'], ['I had a similar experience when...', 'The problem was...', 'I decided to...', 'It worked out, and I learned...']),
  issue: frame(['문제 소개', '내 생각', '아는 사례와 이유', '실천할 개선'], ['One challenge is...', 'I think... because...', 'For example,...', 'One practical change could be...']),
};
