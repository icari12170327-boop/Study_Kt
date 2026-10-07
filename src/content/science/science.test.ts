import { describe, expect, it } from 'vitest';
import { SCIENCE_CARDS, SCIENCE_CARD_MAP } from './experiments';
import { SCIENCE_QUESTIONS } from './questions';
import { SCIENCE_UNITS } from './units';
import { gradeAnswer, newBadges, normalizeScience, normalizeScienceDay, OTHER_OBSERVATIONS, pickScienceSession, questionsFor, recordExperiment, recordScienceAnswer, scienceSummary, scienceTalkTopics } from './session';
import { scienceKeyAction } from './keyboard';
import { defaultState } from '../../store/defaults';
import { exportState, importState, normalizeState } from '../../store/storage';
import { applyProgress, dayRatio, emptyDay, isDayComplete } from '../../lib/progress';
import { addDays } from '../../lib/date';
import { outfitFor } from '../../lib/outfit';
import type { SrsCard } from '../../types';

const date = '2026-10-07', card = SCIENCE_CARD_MAP['science-apple'];
const observation = { date, predicted: card.result, observed: card.result };
const question = SCIENCE_QUESTIONS[0];
const emptyScience = { collected: {}, experiments: {}, badges: [], recentWrong: [] };

describe('보호자 확인 필요: 문제 100개', () => {
  it('공통 20·초3 40·초5 40문제이고 고유 id, 단원, 모든 실험 연결이 유효하다', () => {
    expect(SCIENCE_QUESTIONS).toHaveLength(100);
    expect(new Set(SCIENCE_QUESTIONS.map(q => q.id)).size).toBe(100);
    for (const [audience, count] of [['both', 20], ['g3', 40], ['g5', 40]] as const) expect(SCIENCE_QUESTIONS.filter(q => q.audience === audience)).toHaveLength(count);
    const linked = new Set(SCIENCE_QUESTIONS.map(q => q.experimentId).filter(Boolean));
    expect(linked.size).toBe(40);
    expect([...linked].sort()).toEqual(SCIENCE_CARDS.map(c => c.id).sort());
    for (const q of SCIENCE_QUESTIONS) {
      expect(SCIENCE_UNITS[q.unit]).toBeDefined();
      if (q.experimentId) expect([q.audience, 'both']).toContain(SCIENCE_CARD_MAP[q.experimentId].audience);
    }
  });
  for (const q of SCIENCE_QUESTIONS) it(`${q.id}: 보기·채점·짧은 질문·해설`, () => {
    expect(q.question && q.emoji && q.card).toBeTruthy();
    expect(q.choices.length).toBeGreaterThanOrEqual(q.kind === 'ox' ? 2 : 3);
    expect(q.choices.length).toBeLessThanOrEqual(4);
    expect(new Set(q.choices).size).toBe(q.choices.length);
    expect(Number.isInteger(q.answer)).toBe(true);
    expect(q.answer).toBeGreaterThanOrEqual(0);
    expect(q.answer).toBeLessThan(q.choices.length);
    if (q.kind === 'ox') expect(q.choices).toEqual(['O', 'X']);
    if (q.audience !== 'g5') expect(q.question.split(/[.!?]/u).filter(s => s.trim()).length).toBeLessThanOrEqual(2);
    expect(q.explain.split(/[.!?]/u).filter(s => s.trim()).length).toBeGreaterThanOrEqual(2);
    expect(q.explain.split(/[.!?]/u).filter(s => s.trim()).length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(q)).not.toMatch(/로블록스|동물의 숲|포켓몬|마인크래프트/);
    for (let i = 0; i < q.choices.length; i++) expect(gradeAnswer(q, i)).toBe(i === q.answer);
  });
  it('학년별 2학기가 절반 이상이고 객관식 정답 위치가 고르게 배치돼 있다', () => {
    for (const audience of ['g3', 'g5'] as const) {
      const own = SCIENCE_QUESTIONS.filter(q => q.audience === audience);
      expect(own.filter(q => SCIENCE_UNITS[q.unit].semester === 2).length).toBeGreaterThanOrEqual(20);
    }
    for (const audience of ['both', 'g3', 'g5'] as const) {
      const own = SCIENCE_QUESTIONS.filter(q => q.audience === audience && q.kind === 'choice');
      const counts = [0, 1, 2, 3].map(n => own.filter(q => q.answer === n).length);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      const ox = SCIENCE_QUESTIONS.filter(q => q.audience === audience && q.kind === 'ox');
      expect(Math.abs(ox.filter(q => q.answer === 0).length - ox.filter(q => q.answer === 1).length)).toBeLessThanOrEqual(1);
    }
  });
});

describe('학년·SRS·채점·배지', () => {
  it('학년별 공통 포함 60문제이고 다른 학년이 섞이지 않는다', () => {
    for (const level of ['g3', 'g5'] as const) {
      expect(questionsFor(level)).toHaveLength(60);
      expect(questionsFor(level).every(q => q.audience === 'both' || q.audience === level)).toBe(true);
      expect(pickScienceSession(level, {}, date, 5)).toHaveLength(5);
    }
  });
  it('복습이 새 문제보다 먼저 나오고 단어 SRS와 과학 SRS는 겹치지 않는다', () => {
    const fresh = questionsFor('g3'), due = fresh[20], future = fresh[0];
    const srs = { [`sci:${due.id}`]: { box: 1, due: addDays(date, -1), seen: 2, lapses: 1 },
      [`sci:${future.id}`]: { box: 2, due: addDays(date, 1), seen: 1, lapses: 0 },
      [fresh[1].id]: { box: 5, due: addDays(date, 30), seen: 10, lapses: 0 } };
    const session = pickScienceSession('g3', srs, date, 5);
    expect(session[0].id).toBe(due.id);
    expect(session.some(q => q.id === future.id)).toBe(false);
    expect(session.some(q => q.id === fresh[1].id)).toBe(true);
    expect(new Set(session.map(q => q.id)).size).toBe(5);
  });
  it('오답은 다음 날, 연속 정답은 3·7·14·30일 간격으로 복습한다', () => {
    const state = defaultState(), data = state.data.kid2, wrong = (question.answer + 1) % question.choices.length;
    recordScienceAnswer(state, 'kid2', question.id, wrong, date);
    expect(data.srs[`sci:${question.id}`]).toMatchObject({ box: 1, due: addDays(date, 1), lapses: 1 });
    expect(pickScienceSession('g3', data.srs, date, 60).some(q => q.id === question.id)).toBe(false);
    expect(pickScienceSession('g3', data.srs, addDays(date, 1), 5)[0]).toBe(question);
    let today = addDays(date, 1);
    for (const days of [3, 7, 14, 30]) {
      recordScienceAnswer(state, 'kid2', question.id, question.answer, today);
      expect(data.srs[`sci:${question.id}`].due).toBe(addDays(today, days));
      today = addDays(today, days);
    }
    expect(data.srs[`sci:${question.id}`].box).toBe(5);
  });
  it('모두 복습일 전이면 당일 오답을 연습으로 다시 내지 않는다', () => {
    const srs: Record<string, SrsCard> = Object.fromEntries(questionsFor('g3').map(q => [`sci:${q.id}`, { box: 1, seen: 1, lapses: 1, due: addDays(date, 1) }]));
    expect(pickScienceSession('g3', srs, date, 5)).toEqual([]);
  });
  it('부족분은 오늘 풀지 않은 낮은 상자의 연습으로 채우고, 예정 복습과 새 문제를 우선한다', () => {
    const qs = questionsFor('g3');
    const srs: Record<string, SrsCard> = Object.fromEntries(qs.map(q => [`sci:${q.id}`, { box: 5, seen: 8, lapses: 0, due: addDays(date, 10) }]));
    srs[`sci:${qs[0].id}`] = { box: 2, seen: 3, lapses: 0, due: date };
    delete srs[`sci:${qs[1].id}`];
    srs[`sci:${qs[2].id}`] = { box: 3, seen: 4, lapses: 0, due: addDays(date, 2) };
    srs[`sci:${qs[3].id}`] = { box: 2, seen: 3, lapses: 1, due: addDays(date, 2) };
    srs[`sci:${qs[4].id}`] = { box: 1, seen: 1, lapses: 0, due: addDays(date, 1) }; // 오늘 정답
    srs[`sci:${qs[5].id}`] = { box: 1, seen: 2, lapses: 1, due: addDays(date, 1) }; // 오늘 오답
    srs[`sci:${qs[6].id}`] = { box: 5, seen: 12, lapses: 0, due: addDays(date, 30) }; // 오늘 익힌 문제
    const before = structuredClone(srs), selected = pickScienceSession('g3', srs, date, 5);
    expect(selected.slice(0, 4).map(q => q.id)).toEqual([qs[0].id, qs[1].id, qs[3].id, qs[2].id]);
    expect(selected).toHaveLength(5);
    for (const q of qs.slice(4, 7)) expect(selected).not.toContain(q);
    expect(srs).toEqual(before);
  });
  it('오늘 푼 문제는 백업 복원·재입장에서도 빼고 같은 날 다시 기록해도 보상을 늘리지 않는다', () => {
    const state = defaultState();
    state.settings.kid2.missions = [{ type: 'science', enabled: true, target: 5 }];
    const qs = pickScienceSession('g3', state.data.kid2.srs, date, 5);
    for (let n = 0; n < qs.length; n++) recordScienceAnswer(state, 'kid2', qs[n].id, n === 0 ? (qs[n].answer + 1) % qs[n].choices.length : qs[n].answer, date);
    const restored = importState(exportState(state)), before = structuredClone(restored);
    const selected = pickScienceSession('g3', restored.data.kid2.srs, date, 5);
    expect(selected).toHaveLength(5);
    expect(selected.every(q => !qs.includes(q))).toBe(true);
    for (const q of qs) expect(recordScienceAnswer(restored, 'kid2', q.id, q.answer, date)).toBe(false);
    expect(restored).toEqual(before);
  });
  for (const [profileId, level] of [['kid1', 'g5'], ['kid2', 'g3']] as const) for (const accuracy of [100, 80]) {
    it(`${level} 정답률 ${accuracy}%로 180일간 매일 5문제·쿠폰·연속일을 유지한다`, () => {
      let state = defaultState();
      state.settings[profileId].missions = [{ type: 'science', enabled: true, target: 5 }];
      for (let n = 0; n < 180; n++) {
        const today = addDays(date, n), data = state.data[profileId];
        const selected = pickScienceSession(level, data.srs, today, 5);
        expect(selected, `${n + 1}일째`).toHaveLength(5);
        expect(new Set(selected.map(q => q.id)).size).toBe(5);
        for (let i = 0; i < selected.length; i++) {
          const q = selected[i], chosen = accuracy === 80 && i === 0 ? (q.answer + 1) % q.choices.length : q.answer;
          expect(recordScienceAnswer(state, profileId, q.id, chosen, today)).toBe(true);
        }
        expect(data.days[today].progress.science).toBe(5);
        expect(data.days[today].completed).toBe(true);
        expect(data.coupons).toHaveLength(n + 1);
        expect(data.streak).toBe(n + 1);
        expect(data.stars).toBe((n + 1) * (accuracy === 100 ? 5 : 4));
        const next = pickScienceSession(level, data.srs, today, 5);
        expect(next.every(q => !selected.includes(q))).toBe(true);
        if (n % 30 === 29) state = importState(exportState(state));
      }
    });
  }
  it('잘못된 답·학년·보호자 요청은 기록을 바꾸지 않는다', () => {
    const state = defaultState(), before = structuredClone(state);
    for (const chosen of [-1, 0.5, Infinity, NaN, question.choices.length]) {
      expect(gradeAnswer(question, chosen)).toBe(false);
      expect(recordScienceAnswer(state, 'kid2', question.id, chosen, date)).toBe(false);
    }
    expect(recordScienceAnswer(state, 'parent', question.id, 0, date)).toBe(false);
    expect(recordScienceAnswer(state, 'kid2', SCIENCE_QUESTIONS.find(q => q.audience === 'g5')!.id, 0, date)).toBe(false);
    expect(recordScienceAnswer(state, 'kid2', 'toString', 0, date)).toBe(false);
    expect(state).toEqual(before);
  });
  it('5문제 참여로 미션 완료, 정답만 별·도감에 반영하고 첫 날짜를 보존한다', () => {
    const state = defaultState();
    state.settings.kid2.missions = [{ type: 'science', enabled: true, target: 5 }];
    const qs = pickScienceSession('g3', {}, date, 5);
    for (let i = 0; i < 5; i++) {
      recordScienceAnswer(state, 'kid2', qs[i].id, i === 0 ? (qs[i].answer + 1) % qs[i].choices.length : qs[i].answer, date);
      expect(state.data.kid2.days[date].completed).toBe(i === 4);
    }
    const data = state.data.kid2;
    expect(data.days[date]).toMatchObject({ progress: { science: 5 }, science: { correct: 4, total: 5 }, correct: 4, total: 5, completed: true });
    expect(data.stars).toBe(4); expect(data.coupons).toHaveLength(1); expect(data.streak).toBe(1);
    expect(Object.keys(data.science.collected)).toHaveLength(4);
    expect(data.science.recentWrong[0]).toMatchObject({ id: qs[0].id, date });
    recordScienceAnswer(state, 'kid2', qs[1].id, qs[1].answer, addDays(date, 1));
    expect(data.science.collected[qs[1].id]).toBe(date);
  });
  it('오답 30개 제한, 같은 단원 5·10·전체 배지는 중복하지 않는다', () => {
    const state = defaultState(), data = state.data.kid2;
    for (let i = 0; i < 35; i++) recordScienceAnswer(state, 'kid2', question.id, (question.answer + 1) % question.choices.length, addDays(date, i));
    expect(data.science.recentWrong).toHaveLength(30);
    expect(data.science.recentWrong[0].date).toBe(addDays(date, 34));
    const qs = SCIENCE_QUESTIONS.filter(q => q.unit === 'life');
    const collected = Object.fromEntries(qs.slice(0, 5).map(q => [q.id, date]));
    expect(newBadges(collected, [])).toEqual(['life:5']);
    expect(newBadges(collected, ['life:5'])).toEqual([]);
    for (const q of qs.slice(5, 10)) collected[q.id] = date;
    expect(newBadges(collected, ['life:5'])).toEqual(['life:10']);
    for (const q of qs.slice(10)) collected[q.id] = date;
    expect(newBadges(collected, ['life:5', 'life:10'])).toEqual(['life:all']);
  });
  it('두 학년 모두 단원 전체 배지에 도달할 수 있고 미등록 id는 배지를 늘리지 않는다', () => {
    for (const level of ['g3', 'g5'] as const) {
      const qs = questionsFor(level), collected = Object.fromEntries(qs.map(q => [q.id, date]));
      const badges = newBadges({ ...collected, future: date }, []);
      const units = new Set(qs.map(q => q.unit));
      expect(badges.filter(id => id.endsWith(':all')).length).toBe(units.size);
      expect(newBadges({ future: date }, [])).toEqual([]);
    }
  });
});

describe('선택 실험·현황·키보드·AI 칩', () => {
  it('실험은 처음만 별 1개, 미션·도감·정답률·쿠폰·연속일은 그대로', () => {
    const state = defaultState(), data = state.data.kid2;
    data.stars = 40; data.streak = 8; data.lastCompleted = date;
    data.days[date] = { ...emptyDay(date), progress: { science: 5, math: 20 }, completed: false };
    const before = structuredClone(data);
    expect(recordExperiment(state, 'kid2', card.id, date, card.result, OTHER_OBSERVATIONS[1])).toBe(true);
    expect(data.stars).toBe(41);
    for (const field of ['days', 'coupons', 'streak', 'lastCompleted', 'srs'] as const) expect(data[field]).toEqual(before[field]);
    expect(data.science.collected).toEqual({});
    const saved = structuredClone(state);
    expect(recordExperiment(state, 'kid2', card.id, addDays(date, 1), card.result, card.result)).toBe(false);
    expect(state).toEqual(saved);
    expect(recordExperiment(state, 'parent', card.id, date, card.result, card.result)).toBe(false);
    expect(recordExperiment(state, 'kid2', 'toString', date, '', '')).toBe(false);
    expect(recordExperiment(state, 'kid2', card.id, date, '없는 보기', card.result)).toBe(false);
    const g5 = SCIENCE_CARDS.find(c => c.audience === 'g5')!;
    expect(recordExperiment(state, 'kid2', g5.id, date, g5.result, g5.result)).toBe(false);
  });
  it('학습하지 않은 날의 실험도 학습일을 만들지 않는다', () => {
    const state = defaultState();
    recordExperiment(state, 'kid2', card.id, date, card.result, card.result);
    expect(state.data.kid2.days).toEqual({});
  });
  it('최근 7일 정답률·최근 30개에서 가장 자주 틀린 5문제와 최근 답', () => {
    const state = defaultState(), data = state.data.kid2, qs = questionsFor('g3');
    for (let n = 0; n < 8; n++) data.days[addDays(date, -n)] = { ...emptyDay(addDays(date, -n)), science: { correct: 2, total: 4, units: [] } };
    data.science.recentWrong = qs.slice(0, 7).flatMap((q, n) => Array.from({ length: n + 1 }, () => ({ id: q.id, chosen: 0, date })));
    data.science.recentWrong.unshift({ id: qs[6].id, chosen: 1, date });
    const summary = scienceSummary(data, date);
    expect(summary).toMatchObject({ correct: 14, total: 28 });
    expect(summary.frequentWrong).toHaveLength(5);
    expect(summary.frequentWrong[0]).toMatchObject({ id: qs[6].id, chosen: 1, count: 8 });
  });
  it('오늘 풀어 본 단원만 중복 없이 칩에 보내고 문제나 오답은 보내지 않는다', () => {
    const state = defaultState();
    recordScienceAnswer(state, 'kid2', question.id, 0, date);
    recordScienceAnswer(state, 'kid2', question.id, 1, date);
    expect(scienceTalkTopics(state.data.kid2, date)).toEqual(['오늘 과학: 생활 속 과학']);
    expect(scienceTalkTopics(state.data.kid2, addDays(date, 1))).toEqual([]);
  });
  it('1~4·O/X로 선택하고 해설 뒤에만 Enter를 받는다', () => {
    const ox = SCIENCE_QUESTIONS.find(q => q.kind === 'ox')!;
    for (const key of ['o', 'O', '1']) expect(scienceKeyAction(key, ox, false)).toEqual({ type: 'choose', chosen: 0 });
    for (const key of ['x', 'X', '2']) expect(scienceKeyAction(key, ox, false)).toEqual({ type: 'choose', chosen: 1 });
    expect(scienceKeyAction('4', question, false)).toEqual({ type: 'choose', chosen: 3 });
    for (const key of ['3', '4', 'Enter', 'ArrowLeft']) expect(scienceKeyAction(key, ox, false)).toBeUndefined();
    expect(scienceKeyAction('Enter', ox, true)).toEqual({ type: 'next' });
    expect(scienceKeyAction('1', ox, true)).toBeUndefined();
    expect(scienceKeyAction('o', question, false)).toBeUndefined();
    expect(scienceKeyAction('Enter', undefined, true)).toBeUndefined();
  });
  it('소품은 날짜·프로필에 대해 결정적이며 연속 날짜에는 달라진다', () => {
    for (const id of ['kid1', 'kid2', 'parent'] as const) {
      expect(outfitFor(date, id)).toBe(outfitFor(date, id));
      expect(outfitFor(date, id)).not.toBe(outfitFor(addDays(date, 1), id));
    }
    expect(outfitFor(date, 'kid1')).not.toBe(outfitFor(date, 'kid2'));
  });
});

describe('PR #21 데이터 이전·백업 호환', () => {
  it('옛 실험 기록만 옮기고 생각·같이·주기·당일 선택·옛 배지는 버린다', () => {
    const raw = { done: { [card.id]: { ...observation, thinkAnswer: '생각', together: true }, future: observation }, badges: ['mixing:3'], cycleDone: [card.id], today: { date, cardId: card.id } };
    const before = structuredClone(raw);
    expect(normalizeScience(raw)).toEqual({ ...emptyScience, experiments: { [card.id]: observation, future: observation } });
    expect(raw).toEqual(before);
  });
  it('신·구 혼합은 새 유효 항목 우선, unknown id 보존, 손상된 항목 제외', () => {
    const collected = Object.fromEntries(SCIENCE_QUESTIONS.filter(q => q.unit === 'life').slice(0, 5).map(q => [q.id, date]));
    const raw = { collected: { ...collected, unknown: date, broken: 3, badDate: '2026-02-30' },
      done: { [card.id]: observation, future: observation, broken: { date: 'no' }, missingAnswers: { date } },
      experiments: { [card.id]: { date: addDays(date, 1) }, future: null, unknown: { date }, malformed: { date, observed: 3 } },
      badges: ['mixing:3', 'fake:5'],
      recentWrong: [{ id: 'future', chosen: 99, date }, { id: 'toString', chosen: 1, date }, { id: question.id, chosen: 99, date }, { id: 'bad', chosen: -1, date }, { id: 'bad', chosen: 0.5, date }, { id: 'bad', chosen: 1, date: '2026-02-30' }, null] };
    const normalized = normalizeScience(raw);
    expect(normalized.collected).toEqual({ ...collected, unknown: date });
    expect(normalized.experiments).toEqual({ [card.id]: { date: addDays(date, 1) }, future: observation, unknown: { date } });
    expect(normalized.badges).toEqual(['life:5']);
    expect(normalized.recentWrong).toEqual([{ id: 'future', chosen: 99, date }, { id: 'toString', chosen: 1, date }]);
    expect(normalizeScience(normalized)).toEqual(normalized);
    expect(normalizeScience(null)).toEqual(emptyScience);
  });
  it('최신 오답 30개만 유지하며 날짜 순서를 바로잡고 프로토타입 키를 받지 않는다', () => {
    const raw = JSON.parse('{"collected":{"__proto__":"2026-10-07","constructor":"2026-10-07"},"experiments":{"prototype":{"date":"2026-10-07"}}}');
    raw.recentWrong = Array.from({ length: 40 }, (_, n) => ({ id: `future-${n}`, chosen: 0, date: addDays(date, n) }));
    const normalized = normalizeScience(raw);
    expect(normalized.collected).toEqual({}); expect(normalized.experiments).toEqual({});
    expect(normalized.recentWrong).toHaveLength(30);
    expect(normalized.recentWrong[0].id).toBe('future-39');
    expect(normalized.recentWrong[29].id).toBe('future-10');
  });
  for (const profileId of ['kid1', 'kid2'] as const) for (const version of [1, 2]) for (const enabled of [true, false]) it(`${profileId}·v${version}·science enabled=${enabled}: target1→5는 한 번만, 모든 보상·학습 기록 보존`, () => {
    const base = defaultState();
    const data = base.data[profileId];
    data.stars = 41; data.streak = 9; data.lastCompleted = date;
    data.days[date] = { ...emptyDay(date), progress: { science: 1, math: 20 }, completed: true };
    data.coupons = [{ id: 'kept', label: '기존 쿠폰', earnedAt: date }];
    data.notes = [{ id: 'note', title: '책', author: '작가', date, summary: '내 생각', cards: [] }];
    data.srs = { 'kept-vocab': { box: 3, seen: 7, lapses: 2, due: date } };
    base.settings[profileId].missions = [{ type: 'science', enabled, target: 1 }, { type: 'math', enabled: true, target: 20 }];
    const raw = { ...base, version, settings: { ...base.settings, [profileId]: { ...base.settings[profileId], scienceV2: undefined } }, data: { ...base.data, [profileId]: { ...data, science: { done: { [card.id]: observation }, badges: ['states:3'], cycleDone: [card.id], today: { date, cardId: card.id } } } } };
    const before = structuredClone(raw), restored = normalizeState(raw);
    expect(restored.version).toBe(2);
    expect(restored.settings[profileId].scienceV2).toBe(true);
    expect(restored.settings[profileId].missions.find(m => m.type === 'science')).toEqual({ type: 'science', target: 5, enabled });
    expect(restored.data[profileId].science).toEqual({ ...emptyScience, experiments: { [card.id]: observation } });
    for (const field of ['stars', 'streak', 'lastCompleted', 'days', 'coupons', 'notes', 'srs', 'math', 'talks'] as const) expect(restored.data[profileId][field]).toEqual(data[field]);
    expect(raw).toEqual(before);
    expect(importState(JSON.stringify(raw))).toEqual(restored);
    const mission = restored.settings[profileId].missions.find(m => m.type === 'science')!;
    mission.target = 1;
    expect(normalizeState(restored).settings[profileId].missions.find(m => m.type === 'science')).toEqual({ type: 'science', target: 1, enabled });
  });
  it('이전 쿠폰·연속일은 재계산하지 않고 추가 문제에도 이중 발행하지 않는다', () => {
    const raw = defaultState();
    raw.settings.kid2.scienceV2 = undefined;
    raw.settings.kid2.missions = [{ type: 'science', enabled: true, target: 1 }];
    raw.data.kid2.days[date] = { ...emptyDay(date), progress: { science: 1 }, completed: true };
    raw.data.kid2.streak = 6; raw.data.kid2.lastCompleted = date;
    raw.data.kid2.coupons = [{ id: 'old', label: '기존 쿠폰', earnedAt: date }];
    const state = normalizeState(raw), data = state.data.kid2;
    expect(isDayComplete(data.days[date], state.settings.kid2, { aiReady: false })).toBe(false);
    expect(dayRatio(data.days[date], state.settings.kid2, { aiReady: false })).toBe(0.2);
    for (let n = 0; n < 4; n++) applyProgress(data, state.settings.kid2, date, { type: 'science', correct: 1, total: 1 }, { aiReady: false });
    expect(data.days[date].completed).toBe(true); expect(data.coupons).toHaveLength(1); expect(data.streak).toBe(6);
  });
  it('과학 미션이 없으면은 학년 기본5를 채우며 다른 목표·켜짐은 보존', () => {
    const state = defaultState();
    state.settings.kid2.scienceV2 = undefined;
    state.settings.kid2.missions = [{ type: 'math', target: 13, enabled: false }];
    expect(normalizeState(state).settings.kid2.missions).toContainEqual({ type: 'science', target: 5, enabled: true });
    expect(normalizeState(state).settings.kid2.missions).toContainEqual({ type: 'math', target: 13, enabled: false });
    state.settings.kid2.missions.push({ type: 'science', target: 8, enabled: false });
    const normalized = normalizeState(state);
    expect(normalized.settings.kid2.missions).toContainEqual({ type: 'science', target: 8, enabled: false });
    expect(normalized.settings.kid2.scienceV2).toBe(true);
  });
  it('새 도감·실험·오답·일별 과학 통계를 백업에서 유지하고 다른 통계와 혼합하지 않는다', () => {
    const state = defaultState();
    recordScienceAnswer(state, 'kid2', question.id, question.answer, date);
    recordExperiment(state, 'kid2', card.id, date, card.result, card.result);
    expect(importState(exportState(state))).toEqual(state);
    expect(normalizeScienceDay({ correct: 3, total: 1, units: [] })).toBeUndefined();
    expect(normalizeScienceDay({ correct: NaN, total: 3, units: [] })).toBeUndefined();
    expect(normalizeScienceDay({ correct: 1, total: 3, units: ['future', 'future', 3] })).toEqual({ correct: 1, total: 3, units: ['future'] });
    expect(Object.values(SCIENCE_UNITS).filter(u => u.semester === 2)).toHaveLength(8);
  });
});
