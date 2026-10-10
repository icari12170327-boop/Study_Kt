import { describe, expect, it, vi } from 'vitest';
import { CHUNK_MAP, TALK_CHUNKS } from '../content/talk/chunks';
import { defaultState } from '../store/defaults';
import { exportState, importState, normalizeState } from '../store/storage';
import { addDays } from './date';
import { seededRng } from './random';
import { normalizePreviewHistory, pickPreviewChunks, previewRetrieval } from './talkPreview';
import { detectRecast } from './recast';
import { buildTalkGrowth, englishWordCount, parentGrowthWeeks, parentWeeklyGrowth, normalizeGrowth } from './talkGrowth';
import { normalizeRetrieval, reusedExpression, addCorrectionTarget } from './retrieval';
import { normalizeRetrievalWords } from './retrievalWords';
import { expressionKey } from './talkPreview';
import { normalizeWords } from './similarity';
import { normalizePracticeFields, recordRetell } from './parentPractice';
import type { RetrievalItem, TalkLog } from '../types';
const today = '2026-10-10';
const chunk = TALK_CHUNKS[0];
const target = (text: string, patch: Partial<RetrievalItem> = {}): RetrievalItem => ({ id: text, text, source: 'correction', mode: 'coach', stage: 0, misses: 0, createdAt: today, dueDate: today, ...patch });
const item = { said: 'I go yesterday.', better: 'I went yesterday.', focus: 'went', hintKo: '언제 한 일인가요?', whyKo: '지난 일이에요.', pattern: 'tense' as const, selfFixed: true };
function log(): TalkLog { return { id: 't1', date: today, mode: 'coach', seconds: 60, englishRatio: 0.75, lines: [{ role: 'kid', text: 'I go yesterday. I like tea!', at: 1 }, { role: 'kid', text: '좋아요.', at: 2 }, { role: 'kid', text: 'Yes.', at: 3 }, { role: 'friend', text: 'Lots of AI words here.', at: 4 }], previewChunks: [chunk.id], corrections: { items: [item], praiseKo: '잘했어요.', createdAt: today }, retells: [{ text: `We went to a cafe. ${chunk.en}`, seconds: 60, limit: 120 }], retrievalApplied: [] }; }
describe('미리 보기 목록·선택·재사용', () => {
  it('코치 주제 3개·모든 비즈니스 상황 8개에 각각 20개, 영어·뜻·고정 id를 갖춘다', () => {
    expect(TALK_CHUNKS).toHaveLength(220); expect(CHUNK_MAP.size).toBe(220);
    for (const group of ['daily', 'work', 'money', 'biz-standup', 'biz-negotiation', 'biz-presentation-qa', 'biz-ai-adoption', 'biz-smalltalk', 'biz-escalation', 'biz-free', 'biz-custom']) {
      const rows = TALK_CHUNKS.filter(chunk => chunk.group === group); expect(rows).toHaveLength(20);
      expect(new Set(rows.map(row => row.en.toLowerCase())).size).toBe(20);
      for (const row of rows) { expect(row.en.length).toBeLessThanOrEqual(160); expect(row.en).toMatch(/[A-Za-z]/); expect(row.ko).toMatch(/[가-힣]/); }
    }
  });
  it('같은 시드·주제·날짜면 같고 입력은 바꾸지 않으며 목록에 없는 표현이 우선이다', () => {
    const prior = TALK_CHUNKS.filter(chunk => chunk.group === 'daily').slice(0, 17).map(chunk => target(chunk.en));
    const before = structuredClone(prior);
    const picked = pickPreviewChunks('daily', prior, {}, today, seededRng(1));
    expect(picked).toEqual(pickPreviewChunks('daily', prior, {}, today, seededRng(1)));
    expect(picked.map(chunk => chunk.id).sort()).toEqual(['daily-18', 'daily-19', 'daily-20']); expect(prior).toEqual(before);
    picked[0].en = 'changed'; expect(CHUNK_MAP.get(picked[0].id)!.en).not.toBe('changed');
  });
  it('최근 5일은 제외하고 정확히 5일 전부터 허용하며 오래된 날짜도 보존한다', () => {
    const candidates = TALK_CHUNKS.filter(chunk => chunk.group === 'work');
    const history = Object.fromEntries(candidates.map(chunk => [chunk.id, addDays(today, -4)]));
    history[candidates[0].id] = addDays(today, -5); history[candidates[1].id] = addDays(today, -60); delete history[candidates[2].id];
    expect(pickPreviewChunks('work', [], history, today, seededRng(1)).map(chunk => chunk.id)).toEqual([candidates[2].id, candidates[1].id, candidates[0].id]);
    const normalized = normalizePreviewHistory({ ...history, missing: today, 'daily-01': '2026-02-30', 'daily-02': '2026-10-11', 'daily-03': 10 }, today);
    expect(normalized).toEqual(history); expect(normalized[candidates[1].id]).toBe(addDays(today, -60));
  });
  it.each([...new Set(TALK_CHUNKS.map(chunk => chunk.group))])('%s 주제 30일 연속 매일 3개, 5일 안에 반복 없음, 당일 재사용', group => {
    const history: Record<string, string> = {}, last: Record<string, string> = {};
    for (let day = 0; day < 30; day++) {
      const date = addDays(today, day), picked = pickPreviewChunks(group, [], history, date, seededRng(day));
      expect(picked).toHaveLength(3); expect(new Set(picked.map(chunk => chunk.id)).size).toBe(3);
      for (const chunk of picked) {
        if (last[chunk.en]) expect(date >= addDays(last[chunk.en], 5)).toBe(true);
        last[chunk.en] = date; history[chunk.id] = date;
      }
      expect(pickPreviewChunks(group, [], history, date, seededRng(day + 300)).map(chunk => chunk.id).sort()).toEqual(picked.map(chunk => chunk.id).sort());
    }
  });
  it('부족하면 가장 오래된 최근 표현으로 채우고 입력 기록은 바꾸지 않는다', () => {
    const candidates = TALK_CHUNKS.filter(chunk => chunk.group === 'daily');
    const history = Object.fromEntries(candidates.map(chunk => [chunk.id, addDays(today, -1)]));
    history[candidates[0].id] = addDays(today, -5); history[candidates[1].id] = addDays(today, -4); history[candidates[2].id] = addDays(today, -3);
    const before = { ...history };
    expect(pickPreviewChunks('daily', [], history, today, seededRng(2)).map(chunk => chunk.id)).toEqual(candidates.slice(0, 3).map(chunk => chunk.id)); expect(history).toEqual(before);
  });
  it('복습에 없는 표현을 우선하고 그 안에서 본 적 없는 것·오래된 순으로 고른다', () => {
    const rows = TALK_CHUNKS.filter(chunk => chunk.group === 'money');
    const history = Object.fromEntries(rows.map(chunk => [chunk.id, addDays(today, -6)]));
    delete history[rows[0].id]; delete history[rows[1].id]; history[rows[2].id] = addDays(today, -10);
    const prior = rows.filter((_, i) => i !== 1 && i !== 2 && i !== 3).map(chunk => target(chunk.en));
    expect(pickPreviewChunks('money', prior, history, today, seededRng(1)).map(chunk => chunk.id)).toEqual([rows[1].id, rows[2].id, rows[3].id]);
  });
  it('두 주제에 같은 표현이 등록된 경우에도 마지막 노출 날짜로 5일 제외한다', () => {
    const shared = TALK_CHUNKS[0], alias = TALK_CHUNKS.find(row => row.group !== shared.group)!;
    const get = CHUNK_MAP.get.bind(CHUNK_MAP);
    const spy = vi.spyOn(CHUNK_MAP, 'get').mockImplementation(id => id === alias.id ? { ...alias, en: shared.en } : get(id));
    try {
      const rows = TALK_CHUNKS.filter(row => row.group === shared.group);
      const history = Object.fromEntries(rows.map(row => [row.id, addDays(today, -5)]));
      history[shared.id] = addDays(today, -60); history[alias.id] = addDays(today, -1);
      expect(pickPreviewChunks(shared.group, [], history, today, seededRng(1)).some(row => row.id === shared.id)).toBe(false);
    } finally { spy.mockRestore(); }
  });
  it('사용자는 stage 1, 미사용은 stage 0으로 넣고 AI 발화는 사용으로 세지 않는다', () => {
    const chosen = TALK_CHUNKS.slice(0, 3), prior = [target('I went yesterday.')];
    const before = structuredClone(prior);
    const next = previewRetrieval(prior, chosen, [`Yes, ${chosen[0].en.toUpperCase()}`], 'coach', today);
    expect(next.items.slice(1).map(item => item.stage)).toEqual([1, 0, 0]);
    expect(next.items.slice(1).every(item => item.dueDate === '2026-10-11' && item.source === 'preview')).toBe(true);
    expect(next.applied).toEqual([chosen[0].en]); expect(prior).toEqual(before);
  });
  it('기존 복습 단계를 되돌리지 않고 같은 대화에서 성공한 목표는 다시 올리지 않는다', () => {
    const prior = [target(chunk.en, { stage: 2, misses: 2 })];
    expect(previewRetrieval(prior, [chunk], [], 'biz', today).items).toEqual(prior);
    expect(previewRetrieval(prior, [chunk], [chunk.en], 'biz', today, [chunk.en]).items).toEqual(prior);
    expect(previewRetrieval(prior, [chunk], [chunk.en], 'biz', today).items[0]).toMatchObject({ stage: 3, misses: 0 });
  });
});
describe('리캐스트 보수적 판정', () => {
  it.each([
    ['I go yesterday.', 'Oh, you went yesterday! What did you do?', 'went'],
    ['I have two sister.', 'You have two sisters.', 'sisters'],
    ['I are happy.', 'You are happy.', 'are'],
    ['She like coffee.', 'She likes coffee.', 'likes'],
    ['We discuss the schedule yesterday.', 'Oh, you discussed the schedule yesterday!', 'discussed'],
    ['I like hiking last year.', 'You liked hiking last year.', 'liked'],
    ['I bought book yesterday.', 'You bought a book yesterday.', 'a'],
    ['We meet Monday.', 'We meet on Monday.', 'on'],
    ['I work here since last year.', "I've worked here since last year.", "I've worked"],
  ])('%s → %s 는 바뀐 부분만 강조한다', (user, ai, expected) => {
    const result = detectRecast(user, ai); expect(result).not.toBeNull(); expect(ai.slice(result!.start, result!.end)).toBe(expected);
  });
  it.each([
    ['I am happy.', 'You are happy!'], ['I am a manager.', 'Oh, you are a manager!'],
    ["I'm working on a project.", "Oh, you're working on a project!"], ['I was tired.', 'You were tired?'],
    ['I was born in Busan.', 'You were born in Busan!'], ['I am from Korea.', 'Oh, you are from Korea!'],
    ['You are happy.', 'I am happy.'], ['You were tired.', 'I was tired.'],
    ['I like tea.', 'Great! What else do you like?'], ['I like tea.', 'You like tea.'], ['I like tea.', 'I love coffee.'],
    ['I like tea.', 'You hate tea.'], ['I work here.', 'Yes, I work here too.'], ['I go yesterday.', '어제요? You went yesterday.'], ['어제 I go.', 'You went yesterday.'], ['Yes.', 'That is great.'],
  ])('맞장구·다른 뜻·혼합·애매한 문장은 강조하지 않는다: %s / %s', (user, ai) => expect(detectRecast(user, ai)).toBeNull());
});
describe('다시 말하기·성장 지표·저장 분리', () => {
  it('영어만 세고 축약형은 한 단어, AI 발화는 빼고 고정 데이터로 검증한다', () => {
    expect(englishWordCount("I'm happy. 안녕 2026! I like tea.")).toBe(5);
    const stats = buildTalkGrowth(log());
    expect(stats.averageEnglishWords).toBe(3.5); expect(stats.correctionRate).toBeCloseTo(1 / 3); expect(stats.selfFixedRate).toBe(1); expect(stats.englishRatio).toBe(.75); expect(stats.reuseRate).toBe(1);
    expect(stats.retellWordsPerMinute).toBe(9);
    expect(buildTalkGrowth({ ...log(), lines: [], corrections: undefined, previewChunks: [], retells: [] })).toEqual({ averageEnglishWords: null, retellWordsPerMinute: null, correctionRate: null, selfFixedRate: null, englishRatio: null, reuseRate: null });
  });
  it('대화→다시 말하기 1차→2차에서 같은 표현은 한 번만 성공 반영', () => {
    const data = defaultState().data.parent, current = log(); current.retells = []; current.growth = buildTalkGrowth(current); current.retrievalApplied = [chunk.en];
    data.talks = [current]; data.retrieval = [target(chunk.en, { stage: 1 }), target(item.better, { focus: item.focus })];
    const protectedBefore = structuredClone(data);
    recordRetell(data, current.id, { text: `${chunk.en} We went to a cafe.`, seconds: 20, limit: 120 }, today);
    expect(data.retrieval.map(item => item.stage)).toEqual([1, 1]); expect(current.retells).toHaveLength(1);
    recordRetell(data, current.id, { text: 'We went home.', seconds: 10, limit: 90 }, today);
    expect(data.retrieval.map(item => item.stage)).toEqual([1, 1]); expect(current.retells).toHaveLength(2);
    recordRetell(data, current.id, { text: 'We went home.', seconds: 10, limit: 90 }, today); expect(current.retells).toHaveLength(2);
    for (const key of Object.keys(data).filter(key => !['talks', 'retrieval'].includes(key)) as (keyof typeof data)[]) expect(data[key]).toEqual(protectedBefore[key]);
  });
  it('저장하지 않은 교정은 자동 등록하지 않고 시간·순서·길이가 잘못된 시도는 무시한다', () => {
    const data = defaultState().data.parent, current = log(); current.retells = []; current.growth = buildTalkGrowth(current); data.talks = [current];
    for (const attempt of [{ text: 'I went.', seconds: 0, limit: 120 }, { text: 'I went.', seconds: 121, limit: 120 }, { text: 'I went.', seconds: 20, limit: 90 }, { text: 'a'.repeat(6001), seconds: 20, limit: 120 }] as const) recordRetell(data, current.id, attempt, today);
    expect(current.retells).toEqual([]); recordRetell(data, current.id, { text: '', seconds: 20, limit: 120 }, today); recordRetell(data, current.id, { text: item.better, seconds: 20, limit: 90 }, today); expect(current.retells).toHaveLength(2); expect(data.retrieval).toEqual([]);
  });
  it('4주 경계·빈 주·연말을 다루고 기록은 읽기만 한다', () => {
    const old = { ...log(), date: '2025-12-31', growth: buildTalkGrowth(log()) }, latest = { ...old, id: 't2', date: '2026-01-05' };
    const logs = [old, latest]; const before = structuredClone(logs);
    const weeks = parentGrowthWeeks(logs, '2026-01-05'); expect(weeks.map(week => week.range.start)).toEqual(['2025-12-15', '2025-12-22', '2025-12-29', '2026-01-05']);
    expect(weeks[0].stats.averageEnglishWords).toBeNull(); expect(weeks[2].stats).toEqual(old.growth); expect(weeks[3].stats).toEqual(latest.growth);
    expect(parentWeeklyGrowth([{ ...old, growth: undefined }], weeks[2].range).averageEnglishWords).toBeNull(); expect(logs).toEqual(before);
  });
  it('version 2·기존 기록·아이 상태를 유지하고 새 선택 필드를 백업 왕복으로 보존한다', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
    try {
      const state = defaultState(), current = log(); current.growth = buildTalkGrowth(current); state.data.parent.talks = [current]; state.data.parent.previewHistory = { [chunk.id]: today, 'work-01': addDays(today, -60) };
      state.data.kid1.talks = [{ ...current, id: 'child' }]; state.data.kid1.previewHistory = { [chunk.id]: today };
      const restored = importState(exportState(state)); expect(restored.version).toBe(2); expect(restored.data.parent.talks).toEqual([current]); expect(restored.data.parent.previewHistory).toEqual({ [chunk.id]: today, 'work-01': addDays(today, -60) });
      for (const key of ['growth', 'retells', 'previewChunks', 'retrievalApplied']) expect(restored.data.kid1.talks[0]).not.toHaveProperty(key);
      expect(restored.data.kid1.previewHistory).toBeUndefined();
      const before = defaultState(), after = normalizeState(before, today); expect(after.data.kid1).toEqual(before.data.kid1); expect(after.data.parent.talks).toEqual([]);
    } finally { vi.useRealTimers(); }
  });
  it('배열이 아닌 다시 말하기 기록도 정규화 전체를 깨뜨리지 않는다', () => {
    for (const raw of [null, 'invalid', { length: 1, 0: { text: 'Hello.', seconds: 10, limit: 120 } }]) {
      const current = { ...log(), retells: raw } as unknown as TalkLog;
      expect(normalizePracticeFields(current).retells).toBeUndefined();
      const state = defaultState(); state.data.parent.talks = [current]; expect(normalizeState(state, today).data.parent.talks).toHaveLength(1);
    }
  });
  it('형식·길이·개수·수치 상한을 확인하고 손상된 선택 필드만 뺀다', () => {
    expect(normalizePracticeFields({ ...log(), previewChunks: ['bad', chunk.id, chunk.id], retrievalApplied: ['', 'a'.repeat(161), item.better] }).previewChunks).toEqual([chunk.id]);
    expect(normalizePracticeFields({ ...log(), retrievalApplied: ['', 'a'.repeat(161), item.better] }).retrievalApplied).toEqual([item.better]);
    for (const value of [NaN, Infinity, -1, 2]) expect(normalizeGrowth({ ...buildTalkGrowth(log()), englishRatio: value })).toBeUndefined();
    const current = log(); current.retells = [{ text: 'Hello.', seconds: 121, limit: 120 }]; expect(normalizePracticeFields(current).retells).toEqual([]);
  });
});

describe('표현 복습 전용 줄임말·교정 보관', () => {
  it.each([
    ["I'm ready.", 'I am ready.'], ["I don't know.", 'I do not know.'], ["I can't join.", 'I cannot join.'],
    ["We'll try again.", 'We will try again.'], ["I'll check it.", 'I will check it.'],
    ["It's nice to meet you.", 'It is nice to meet you.'], ["That's a good idea.", 'That is a good idea.'],
    ["Let's check it.", 'Let us check it.'], ["What's next?", 'What is next?'], ["Who's next?", 'Who is next?'],
    ["Here's my idea.", 'Here is my idea.'], ["There's a problem.", 'There is a problem.'],
  ])('%s ↔ %s 를 같은 복습 표현으로 판정·중복 제거하며 단계는 보존한다', (short, full) => {
    expect(reusedExpression(short, [full])).toBe(true); expect(reusedExpression(full, [short])).toBe(true);
    expect(expressionKey(short)).toBe(expressionKey(full));
    expect(normalizeRetrieval([target(short, { stage: 2 }), target(full)], today)).toHaveLength(1);
    expect(addCorrectionTarget([target(full, { stage: 2 })], short, 'coach', today, 'new')[0].stage).toBe(2);
  });
  it('이름의 소유격·다른 문장·공용 발음 점수 정규화는 바꾸지 않는다', () => {
    expect(normalizeRetrievalWords("John's idea")).toEqual(normalizeWords("John's idea"));
    expect(reusedExpression("John's idea", ['John is idea'])).toBe(false);
    expect(reusedExpression("It's nice to meet you.", ['It is hard to meet you.'])).toBe(false);
    expect(normalizeWords("It's nice")).toEqual(['it', 's', 'nice']);
  });
  it('60개를 넘으면 익히지 않은 교정을 미리 보기보다 우선 보관한다', () => {
    const corrections = Array.from({ length: 58 }, (_, i) => target(`Correction number ${i}.`));
    const previews = Array.from({ length: 20 }, (_, i) => target(`Preview number ${i}.`, { source: 'preview' }));
    const before = structuredClone([...corrections, ...previews]);
    const normalized = normalizeRetrieval(before, today);
    expect(normalized).toHaveLength(60); expect(normalized.filter(item => item.source === 'correction')).toEqual(corrections);
    expect(normalized.filter(item => item.source === 'preview')).toEqual(previews.slice(-2)); expect(before).toEqual([...corrections, ...previews]);
    const state = defaultState(); state.data.parent.retrieval = before;
    expect(normalizeState(state, today).data.parent.retrieval).toEqual(normalized);
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
    try { expect(importState(exportState(state)).data.parent.retrieval).toEqual(normalized); } finally { vi.useRealTimers(); }
  });
  it('익힌 항목을 먼저 정리하고 미리 보기로 있던 표현의 교정을 저장해도 단계는 유지한다', () => {
    const rows = Array.from({ length: 60 }, (_, i) => target(`Phrase number ${i}.`)); rows[10] = { ...rows[10], stage: 3, learnedAt: today };
    const normalized = normalizeRetrieval([...rows, target('A new expression.', { source: 'preview' })], today);
    expect(normalized).toHaveLength(60); expect(normalized.some(item => item.id === rows[10].id)).toBe(false);
    expect(addCorrectionTarget([target("Let's try.", { source: 'preview', stage: 2 })], 'Let us try.', 'biz', today, 'new')[0]).toMatchObject({ source: 'correction', stage: 2 });
  });
  it('60일 시뮬레이션에서 미리 보기 추가가 남아 있는 교정을 밀어내지 않는다', () => {
    let items: RetrievalItem[] = [];
    for (let day = 0; day < 60; day++) {
      const date = addDays(today, day);
      items = addCorrectionTarget(items, `Correct sentence ${day} a.`, 'coach', date, `c${day}a`);
      items = addCorrectionTarget(items, `Correct sentence ${day} b.`, 'coach', date, `c${day}b`);
      const corrections = items.filter(item => item.source === 'correction');
      items = previewRetrieval(items, pickPreviewChunks('daily', items, {}, date, seededRng(day)), [], 'coach', date).items;
      expect(items.filter(item => item.source === 'correction')).toEqual(corrections); expect(items.length).toBeLessThanOrEqual(60);
    }
  });
  it('말하지 않은 대화는 기록 없음, 한국어로 실제 말한 대화는 영어 0%다', () => {
    for (const text of ['', '   ', '…!?', '123']) expect(buildTalkGrowth({ ...log(), englishRatio: 0, lines: [{ role: 'kid', text, at: 1 }] }).englishRatio).toBeNull();
    expect(buildTalkGrowth({ ...log(), englishRatio: 0, lines: [{ role: 'kid', text: '오늘은 좋아요.', at: 1 }] }).englishRatio).toBe(0);
    const empty: TalkLog = { ...log(), englishRatio: 0, lines: [], growth: undefined };
    empty.growth = buildTalkGrowth(empty);
    expect(parentWeeklyGrowth([empty, { ...log(), growth: buildTalkGrowth(log()) }], { ...parentGrowthWeeks([], today).at(-1)!.range, start: today, end: today }).englishRatio).toBe(.75);
  });
});
