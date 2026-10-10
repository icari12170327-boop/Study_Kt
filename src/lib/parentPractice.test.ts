import { describe, expect, it, vi } from 'vitest';
import { CHUNK_MAP, TALK_CHUNKS } from '../content/talk/chunks';
import { defaultState } from '../store/defaults';
import { exportState, importState, normalizeState } from '../store/storage';
import { addDays } from './date';
import { seededRng } from './random';
import { normalizePreviewHistory, pickPreviewChunks, previewRetrieval } from './talkPreview';
import { detectRecast } from './recast';
import { buildTalkGrowth, englishWordCount, parentGrowthWeeks, parentWeeklyGrowth, normalizeGrowth } from './talkGrowth';
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
  it('13일 전·오늘 노출은 제외하고 정확히 14일 전부터 다시 허용한다', () => {
    const candidates = TALK_CHUNKS.filter(chunk => chunk.group === 'work');
    const history = Object.fromEntries(candidates.map(chunk => [chunk.id, addDays(today, -13)]));
    expect(pickPreviewChunks('work', [], history, today, seededRng(1))).toEqual([]);
    history[candidates[0].id] = addDays(today, -14); history[candidates[1].id] = today;
    expect(pickPreviewChunks('work', [], history, today, seededRng(1)).map(chunk => chunk.id)).toEqual([candidates[0].id]);
    expect(normalizePreviewHistory({ ...history, missing: today, 'daily-01': '2026-02-30', 'daily-02': '2026-10-11', 'daily-03': 10 }, today)).not.toHaveProperty(candidates[0].id);
  });
  it('연속 30일 선택에서도 14일 안에 같은 표현이 다시 나오지 않는다', () => {
    const history: Record<string, string> = {}, last: Record<string, string> = {};
    for (let day = 0; day < 30; day++) {
      const date = addDays(today, day);
      for (const chunk of pickPreviewChunks('daily', [], history, date, seededRng(day))) {
        if (last[chunk.en]) expect(date >= addDays(last[chunk.en], 14)).toBe(true);
        last[chunk.en] = date; history[chunk.id] = date;
      }
    }
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
    ['She like coffee.', 'She likes coffee.', 'likes'],
    ['I bought book yesterday.', 'You bought a book yesterday.', 'a'],
    ['We meet Monday.', 'We meet on Monday.', 'on'],
    ['I work here since last year.', "I've worked here since last year.", "I've worked"],
  ])('%s → %s 는 바뀐 부분만 강조한다', (user, ai, expected) => {
    const result = detectRecast(user, ai); expect(result).not.toBeNull(); expect(ai.slice(result!.start, result!.end)).toBe(expected);
  });
  it.each([
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
    expect(buildTalkGrowth({ ...log(), lines: [], corrections: undefined, previewChunks: [], retells: [] })).toEqual({ averageEnglishWords: null, retellWordsPerMinute: null, correctionRate: null, selfFixedRate: null, englishRatio: .75, reuseRate: null });
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
      const state = defaultState(), current = log(); current.growth = buildTalkGrowth(current); state.data.parent.talks = [current]; state.data.parent.previewHistory = { [chunk.id]: today };
      state.data.kid1.talks = [{ ...current, id: 'child' }]; state.data.kid1.previewHistory = { [chunk.id]: today };
      const restored = importState(exportState(state)); expect(restored.version).toBe(2); expect(restored.data.parent.talks).toEqual([current]); expect(restored.data.parent.previewHistory).toEqual({ [chunk.id]: today });
      for (const key of ['growth', 'retells', 'previewChunks', 'retrievalApplied']) expect(restored.data.kid1.talks[0]).not.toHaveProperty(key);
      expect(restored.data.kid1.previewHistory).toBeUndefined();
      const before = defaultState(), after = normalizeState(before, today); expect(after.data.kid1).toEqual(before.data.kid1); expect(after.data.parent.talks).toEqual([]);
    } finally { vi.useRealTimers(); }
  });
  it('형식·길이·개수·수치 상한을 확인하고 손상된 선택 필드만 뺀다', () => {
    expect(normalizePracticeFields({ ...log(), previewChunks: ['bad', chunk.id, chunk.id], retrievalApplied: ['', 'a'.repeat(161), item.better] }).previewChunks).toEqual([chunk.id]);
    expect(normalizePracticeFields({ ...log(), retrievalApplied: ['', 'a'.repeat(161), item.better] }).retrievalApplied).toEqual([item.better]);
    for (const value of [NaN, Infinity, -1, 2]) expect(normalizeGrowth({ ...buildTalkGrowth(log()), englishRatio: value })).toBeUndefined();
    const current = log(); current.retells = [{ text: 'Hello.', seconds: 121, limit: 120 }]; expect(normalizePracticeFields(current).retells).toEqual([]);
  });
});
