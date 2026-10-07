import { describe, expect, it } from 'vitest';
import { SCIENCE_CARDS, SCIENCE_CARD_MAP } from './cards';
import { badgeThresholds, cardsFor, chooseCard, normalizeScience, OTHER_OBSERVATIONS, pendingCards, recordScience, scienceBadges, scienceTalkTopics, togetherCard } from './session';
import { defaultState } from '../../store/defaults';
import { exportState, importState, normalizeState } from '../../store/storage';
import { emptyDay } from '../../lib/progress';
import { addDays } from '../../lib/date';
import { seededRng } from '../../lib/random';
import { outfitFor } from '../../lib/outfit';

const date = '2026-10-07';
const card = SCIENCE_CARD_MAP['science-apple'];
const observation = { date, predicted: card.result, observed: card.result };
const entry = (profileId: 'kid1' | 'kid2', predicted = card.result, observed = card.result) => ({ profileId, predicted, observed, thinkAnswer: '물보다 전체 밀도가 작아서요.' });

describe('보호자 확인 필요: 콘텐츠 검증', () => {
  it('함께 20·초3 10·초5 10장이고 고유 id를 쓴다', () => {
    expect(SCIENCE_CARDS).toHaveLength(40);
    expect(new Set(SCIENCE_CARDS.map(c => c.id)).size).toBe(40);
    expect(SCIENCE_CARDS.filter(c => c.audience === 'both')).toHaveLength(20);
    expect(SCIENCE_CARDS.filter(c => c.audience === 'g3')).toHaveLength(10);
    expect(SCIENCE_CARDS.filter(c => c.audience === 'g5')).toHaveLength(10);
  });
  for (const c of SCIENCE_CARDS) it(`${c.id}: 형식·보기·안전 문구·학년별 깊이`, () => {
    expect(c.predictions.length).toBeGreaterThanOrEqual(2);
    expect(c.predictions.length).toBeLessThanOrEqual(4);
    expect(new Set(c.predictions).size).toBe(c.predictions.length);
    expect(c.predictions).toContain(c.result);
    expect(c.steps.length).toBeGreaterThanOrEqual(3);
    expect(c.steps.length).toBeLessThanOrEqual(6);
    expect(c.materials.length).toBeGreaterThan(0);
    expect(c.title && c.question && c.explain && c.safety).toBeTruthy();
    expect(c.adultNeeded).toBe(true);
    if (c.audience !== 'g3') expect(c.deeper?.think && c.deeper.vary && c.deeper.explain).toBeTruthy();
    // 단독 '불'은 '불다'와 구분하고, 위험한 재료·행위는 주의 문구에도 넣지 않는다.
    const text = JSON.stringify(c);
    expect(text).not.toMatch(/끓는|가열|칼|콘센트|표백제|세제|불꽃|촛불|성냥|라이터|(?:^|[\s"·])불(?:[\s".,]|을|로|에)/u);
    if (/따뜻한|미지근한/.test(text)) expect(c.safety).toMatch(/보호자.*(?:온도|물)/);
    if (/동전|자석|클립/.test(c.materials.join(' '))) expect(c.safety).toMatch(/입에 넣지/);
  });
});

describe('날짜·학년·함께 카드 선택', () => {
  it('초3·초5는 30장, 보호자는 0장이고 다른 학년 카드는 제외한다', () => {
    expect(cardsFor('g3')).toHaveLength(30);
    expect(cardsFor('g5')).toHaveLength(30);
    expect(cardsFor('adult')).toEqual([]);
    expect(cardsFor('g3').some(c => c.audience === 'g5')).toBe(false);
    expect(cardsFor('g5').some(c => c.audience === 'g3')).toBe(false);
  });
  it('시드·날짜가 같으면 같고 연속 날짜에는 다르다', () => {
    const data = defaultState().data.kid2.science;
    for (let i = 0; i < 30; i++) {
      const day = addDays(date, i);
      expect(chooseCard('g3', data, day, seededRng(808))).toEqual(chooseCard('g3', data, day, seededRng(808)));
      expect(chooseCard('g3', data, day)?.id).not.toBe(chooseCard('g3', data, addDays(day, 1))?.id);
    }
  });
  it('30장 완료 전 중복이 없고 다음 순환에서도 도감·배지는 유지한다', () => {
    const state = defaultState(), seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const day = addDays(date, i), next = chooseCard('g3', state.data.kid2.science, day)!;
      expect(seen.has(next.id)).toBe(false);
      seen.add(next.id);
      expect(recordScience(state, next.id, day, [{ profileId: 'kid2', predicted: next.result, observed: next.result }])).toBe(true);
    }
    expect(seen.size).toBe(30);
    const badges = [...state.data.kid2.science.badges], repeatDate = addDays(date, 30);
    const repeat = chooseCard('g3', state.data.kid2.science, repeatDate)!;
    expect(seen.has(repeat.id)).toBe(true);
    recordScience(state, repeat.id, repeatDate, [{ profileId: 'kid2', predicted: repeat.result, observed: repeat.result }]);
    expect(state.data.kid2.science.cycleDone).toEqual([repeat.id]);
    expect(Object.keys(state.data.kid2.science.done)).toHaveLength(30);
    expect(state.data.kid2.science.badges).toEqual(badges);
  });
  it('당일 보호자 선택은 새로고침 후 유지하고 완료 카드는 다음 날짜의 풀에서 빠진다', () => {
    const state = defaultState();
    state.data.kid2.science.today = { date, cardId: card.id };
    expect(chooseCard('g3', normalizeState(state).data.kid2.science, date)?.id).toBe(card.id);
    state.data.kid2.science.cycleDone = [card.id];
    expect(chooseCard('g3', state.data.kid2.science, addDays(date, 1))?.id).not.toBe(card.id);
    expect(pendingCards('g3', state.data.kid2.science).some(c => c.id === card.id)).toBe(false);
  });
  it('두 아이 모두 미완료인 함께용만 고르고 공통 카드가 없으면 반복하지 않는다', () => {
    const state = defaultState(), next = togetherCard(state, date)!;
    expect(next.audience).toBe('both');
    state.data.kid1.science.cycleDone.push(next.id);
    expect(togetherCard(state, date)?.id).not.toBe(next.id);
    state.data.kid1.science.cycleDone = SCIENCE_CARDS.filter(c => c.audience === 'both').map(c => c.id);
    expect(togetherCard(state, date)).toBeUndefined();
    state.profiles.find(p => p.id === 'kid2')!.level = 'adult';
    expect(togetherCard(state, date)).toBeUndefined();
  });
});

describe('실험 기록·별·배지', () => {
  it('두 도감에 각자 예상·관찰·생각을 저장하고 별·쿠폰은 한 번만 준다', () => {
    const state = defaultState();
    for (const id of ['kid1', 'kid2'] as const) state.settings[id].missions = [{ type: 'science', target: 1, enabled: true }];
    const wrong = card.predictions.find(p => p !== card.result)!;
    expect(recordScience(state, card.id, date, [entry('kid1'), entry('kid2', wrong)], true)).toBe(true);
    expect(state.data.kid1.science.done[card.id]).toMatchObject({ ...observation, together: true, thinkAnswer: entry('kid1').thinkAnswer });
    expect(state.data.kid2.science.done[card.id].predicted).toBe(wrong);
    expect(state.data.kid1.stars).toBe(2);
    expect(state.data.kid2.stars).toBe(1);
    for (const id of ['kid1', 'kid2'] as const) {
      expect(state.data[id].days[date]).toMatchObject({ progress: { science: 1 }, correct: 0, total: 0, completed: true });
      expect(state.data[id].coupons).toHaveLength(1);
      expect(state.data[id].streak).toBe(1);
    }
    const before = structuredClone(state);
    expect(recordScience(state, card.id, date, [entry('kid1'), entry('kid2')], true)).toBe(false);
    expect(state).toEqual(before);
  });
  it('교과 예상 결과와 달라도 실제 관찰이 예상과 같으면 보너스를 준다', () => {
    const state = defaultState(), other = card.predictions.find(p => p !== card.result)!;
    recordScience(state, card.id, date, [entry('kid2', other, other)]);
    expect(state.data.kid2.stars).toBe(2);
    expect(state.data.kid2.science.done[card.id].observed).toBe(other);
  });
  it('관찰이 어려워도 참여를 기록하고 이미 기록한 형제의 답·별은 바꾸지 않는다', () => {
    const state = defaultState();
    recordScience(state, card.id, date, [entry('kid1')]);
    const first = structuredClone(state.data.kid1);
    expect(recordScience(state, card.id, date, [entry('kid1'), entry('kid2', card.result, OTHER_OBSERVATIONS[1])], true)).toBe(true);
    expect(state.data.kid1).toEqual(first);
    expect(state.data.kid2.stars).toBe(1);
  });
  it('생각 답·참여자·보기·학년을 검증하고 잘못된 요청은 아무것도 변경하지 않는다', () => {
    const state = defaultState(), before = structuredClone(state);
    expect(recordScience(state, card.id, date, [{ ...entry('kid1'), thinkAnswer: ' ' }, entry('kid2')], true)).toBe(false);
    expect(recordScience(state, card.id, date, [entry('kid2'), entry('kid2')], true)).toBe(false);
    expect(recordScience(state, card.id, date, [entry('kid2')], true)).toBe(false);
    expect(recordScience(state, card.id, date, [entry('kid1'), entry('kid2')])).toBe(false);
    expect(recordScience(state, card.id, date, [entry('kid2', '없는 보기')])).toBe(false);
    expect(recordScience(state, '없는 카드', date, [entry('kid2')])).toBe(false);
    const g5 = SCIENCE_CARDS.find(c => c.audience === 'g5')!;
    expect(recordScience(state, g5.id, date, [{ profileId: 'kid2', predicted: g5.result, observed: g5.result }])).toBe(false);
    expect(state).toEqual(before);
  });
  it('3·6·10장 주제별 배지를 계산하고 반복은 고유 카드 수를 늘리지 않는다', () => {
    expect(badgeThresholds(2)).toEqual([]);
    expect(badgeThresholds(3)).toEqual([3]);
    expect(badgeThresholds(6)).toEqual([3, 6]);
    expect(badgeThresholds(10)).toEqual([3, 6, 10]);
    const cards = SCIENCE_CARDS.filter(c => c.topic === 'mixing');
    const done = Object.fromEntries(cards.slice(0, 6).map(c => [c.id, observation]));
    expect(scienceBadges(done)).toEqual(['mixing:3', 'mixing:6']);
    done[cards[0].id] = { ...observation, date: addDays(date, 1) };
    expect(scienceBadges(done)).toEqual(['mixing:3', 'mixing:6']);
  });
  it('현재 학년별 30장을 모두 모아도 6장·10장 배지는 아직 얻지 못한다', () => {
    for (const level of ['g3', 'g5'] as const) {
      const eligible = cardsFor(level);
      const done = Object.fromEntries(eligible.map(c => [c.id, observation]));
      const badges = scienceBadges(done);
      expect(badges.length).toBeGreaterThan(0);
      expect(badges.every(id => id.endsWith(':3'))).toBe(true);
      expect(eligible.filter(c => c.topic === 'mixing')).toHaveLength(level === 'g3' ? 5 : 4);
    }
  });
});

describe('저장 호환·백업·AI 주제·소품', () => {
  for (const version of [1, 2]) it(`v${version} 기존 기록·미션 목표를 보존하고 과학 기본값을 채운다`, () => {
    const state = defaultState();
    for (const id of ['kid1', 'kid2', 'parent'] as const) {
      state.settings[id].missions = state.settings[id].missions.filter(m => m.type !== 'science');
      state.settings[id].missions.find(m => m.type === 'math')!.target = 13;
      state.data[id].stars = 41;
      state.data[id].days[date] = { ...emptyDay(date), progress: { math: 13 }, completed: true };
      state.data[id].coupons = [{ id: 'kept', label: '기존 쿠폰', earnedAt: date }];
      state.data[id].notes = [{ id: 'note', title: '책', author: '작가', date, summary: '내 생각', cards: [] }];
      state.data[id].srs = { 'kept-vocab': { box: 3, seen: 7, lapses: 2, due: date } };
    }
    const raw = { ...state, version, data: Object.fromEntries(Object.entries(state.data).map(([id, data]) => [id, { ...data, science: undefined }])) };
    const before = structuredClone(raw), restored = normalizeState(raw);
    for (const id of ['kid1', 'kid2', 'parent'] as const) {
      for (const field of ['stars', 'days', 'coupons', 'notes', 'srs', 'math', 'talks'] as const) expect(restored.data[id][field]).toEqual(state.data[id][field]);
      expect(restored.data[id].science).toEqual({ done: {}, badges: [], cycleDone: [] });
      expect(restored.settings[id].missions.find(m => m.type === 'math')?.target).toBe(13);
      expect(restored.settings[id].missions.find(m => m.type === 'science')).toEqual({ type: 'science', enabled: id !== 'parent', target: 1 });
    }
    expect(raw).toEqual(before);
  });
  it('새 실험 기록·생각 답·당일 선택·수동 꺼짐은 백업 복원 후에도 같다', () => {
    const state = defaultState();
    recordScience(state, card.id, date, [entry('kid1'), entry('kid2')], true);
    state.settings.kid2.missions.find(m => m.type === 'science')!.enabled = false;
    expect(importState(exportState(state))).toEqual(state);
    expect(normalizeState(state).settings.kid2.missions.find(m => m.type === 'science')?.enabled).toBe(false);
  });
  it('손상된 필드를 보완하고 알 수 없는 유효 도감 id는 보존한다', () => {
    expect(normalizeScience(null)).toEqual({ done: {}, badges: [], cycleDone: [] });
    const data = normalizeScience({ done: { future: observation, broken: null, 'science-coin': { date, predicted: 3 } }, badges: ['fake:10'], cycleDone: ['future', 'future', 3], today: { date, cardId: '없는 카드' } });
    expect(data.done).toEqual({ future: observation });
    expect(data.cycleDone).toEqual(['future']);
    expect(data.badges).toEqual([]);
    expect(data.today).toBeUndefined();
    expect(normalizeScience({ done: { [card.id]: observation } }).cycleDone).toEqual([card.id]);
  });
  it('오늘 기록한 제목만 데이터 칩으로 보내고 생각 답·과거 기록은 제외한다', () => {
    const state = defaultState();
    recordScience(state, card.id, date, [entry('kid1')]);
    expect(scienceTalkTopics(state.data.kid1.science, date)).toEqual([`오늘 실험: ${card.title}`]);
    expect(scienceTalkTopics(state.data.kid1.science, addDays(date, 1))).toEqual([]);
  });
  it('소품은 날짜·프로필에 대해 결정적이며 연속 날짜에는 달라진다', () => {
    for (const id of ['kid1', 'kid2', 'parent'] as const) {
      expect(outfitFor(date, id)).toBe(outfitFor(date, id));
      expect(outfitFor(date, id)).not.toBe(outfitFor(addDays(date, 1), id));
    }
    expect(outfitFor(date, 'kid1')).not.toBe(outfitFor(date, 'kid2'));
  });
});
