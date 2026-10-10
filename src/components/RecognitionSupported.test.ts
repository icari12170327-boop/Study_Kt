// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StoreProvider } from '../store/StoreContext';
import { defaultState } from '../store/defaults';
import { SpeakingSession } from '../pages/SpeakingSession';
import { TalkCorrections } from './TalkCorrections';
import { TalkRetell } from './TalkRetell';
import { buildTalkGrowth } from '../lib/talkGrowth';
import { toDateKey } from '../lib/date';
import type { TalkLog } from '../types';

vi.mock('../content/english/session', () => ({ buildSpeakingSession: () => [{ key: 'sent:test', sentence: { id: 'test', en: 'I went home.', ko: '집에 갔어요.', tag: '일상' } }] }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const item = { said: 'I go home yesterday.', better: 'I went home yesterday.', focus: 'went', whyKo: '지난 일이에요.', hintKo: '언제 한 일인가요?', pattern: 'tense' as const };
let host: HTMLDivElement, root: Root, clock: number;
// 실제 speech.ts를 통과하며 stop() 뒤 최종 결과가 오는 Web Speech API를 재현한다.
class Recognition {
  static latest: Recognition;
  static stoppedText = '';
  static starts = 0;
  onresult?: (event: { results: { transcript: string }[][] }) => void;
  onerror?: (event: { error: string }) => void;
  onend?: () => void;
  constructor() { Recognition.latest = this; }
  start() { Recognition.starts++; }
  stop() { if (Recognition.stoppedText) this.result(Recognition.stoppedText); this.onend?.(); }
  result(text: string) { this.onresult?.({ results: [[{ transcript: text }]] }); }
  error(error: string) { this.onerror?.({ error }); }
}
const saved = () => JSON.parse(localStorage.getItem('study-kt:v1')!);
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(el => el.textContent?.trim() === text)!;
const click = async (text: string) => { await act(async () => button(text).click()); };
const result = async (text: string) => { await act(async () => Recognition.latest.result(text)); };
async function mount(kind: 'speaking' | 'corrections' | 'retell') {
  const date = toDateKey(), state = defaultState();
  const log: TalkLog = { id: 'supported', mode: 'coach', date, seconds: 60, englishRatio: 1, lines: [{ role: 'kid', text: item.said, at: 1 }], corrections: { items: [{ ...item }], praiseKo: '잘했어요.', createdAt: date } };
  log.growth = buildTalkGrowth(log);
  state.data.parent.talks = [log];
  state.data.parent.retrieval = [{ id: 'target', text: item.better, focus: item.focus, mode: 'coach', stage: 0, dueDate: date, misses: 0, createdAt: date, source: 'correction' }];
  state.settings.kid2.missions.forEach(m => { m.enabled = m.type === 'speaking'; m.target = 1; });
  localStorage.setItem('study-kt:v1', JSON.stringify(state));
  const child = kind === 'speaking' ? createElement(SpeakingSession, { profileId: 'kid2', go: vi.fn() }) : kind === 'corrections' ? createElement(TalkCorrections, { log }) : createElement(TalkRetell, { log });
  await act(async () => root.render(createElement(StoreProvider, null, child)));
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 11, 12)); clock = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => clock); vi.spyOn(Math, 'random').mockReturnValue(0.5);
  vi.stubGlobal('SpeechRecognition', Recognition); vi.stubGlobal('webkitSpeechRecognition', undefined);
  Recognition.stoppedText = ''; Recognition.starts = 0;
  localStorage.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('자연 종료와 사용자 멈춤은 같은 채점·SRS·미션·보상으로 이어진다', async () => {
  const outputs = [];
  for (const manual of [false, true]) {
    await mount('speaking'); const before = saved(); await click('🎤 말하기');
    expect(button('듣기 멈춤').classList.contains('on')).toBe(true); expect(button('듣기 멈춤').getAttribute('aria-pressed')).toBe('true');
    if (manual) { Recognition.stoppedText = 'I went home.'; await click('듣기 멈춤'); } else await result('I went home.');
    expect(host.textContent).toContain('통과! 100점'); expect(button('🎤 말하기').classList.contains('btn-mic')).toBe(true);
    expect(saved().data).toEqual(before.data);
    await click('다음 문장'); expect(host.textContent).toContain('미션 목록으로'); outputs.push(saved().data.kid2);
    await act(async () => root.render(null));
  }
  expect(outputs[1]).toEqual(outputs[0]);
  expect(outputs[1].srs['sent:test']).toMatchObject({ box: 1, seen: 1, lapses: 0 });
  expect(outputs[1].days[toDateKey()].progress.speaking).toBe(1);
  expect(outputs[1].days[toDateKey()].completed).toBe(true);
});
it('입력 전환과 언마운트는 멈춤 직후 최종 결과와 늦은 결과를 버린다', async () => {
  for (const leave of [false, true]) {
    await mount('speaking'); await click('🎤 말하기'); const before = saved(); Recognition.stoppedText = 'I went home.';
    if (leave) await act(async () => root.render(null)); else await click('⌨️ 입력');
    await result('I went home.'); expect(saved().data).toEqual(before.data); expect(host.textContent).not.toContain('통과!');
    await act(async () => root.render(null));
  }
});
it.each(['no-speech', 'aborted', 'network'])('일시 오류 %s는 대체 모드 없이 다시 말할 수 있다', async error => {
  await mount('speaking'); await click('🎤 말하기'); await act(async () => Recognition.latest.error(error));
  expect(button('🎤 말하기').disabled).toBe(false); expect(button('마이크 다시 확인')).toBeUndefined();
  await click('🎤 말하기'); await result('I went home.'); expect(host.textContent).toContain('통과!');
});
it.each(['not-allowed', 'service-not-allowed', 'audio-capture'])('권한 오류 %s 뒤 명시적 재확인만 마이크를 다시 활성화한다', async error => {
  await mount('speaking'); await click('🎤 말하기'); await act(async () => Recognition.latest.error(error));
  expect(button('🎤 말하기').disabled).toBe(true); expect(Recognition.starts).toBe(1);
  await act(async () => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
  expect(button('🎤 말하기').disabled).toBe(true); await click('마이크 다시 확인');
  expect(button('🎤 말하기').disabled).toBe(false); expect(Recognition.starts).toBe(1);
  await click('🎤 말하기'); await result('I went home.'); expect(host.textContent).toContain('통과!'); expect(Recognition.starts).toBe(2);
});
it('보호자 교정의 직접 고침·따라 말하기는 정상 인식하고 수동 멈춤은 계속 취소한다', async () => {
  await mount('corrections'); await click('🎤 말하기'); Recognition.stoppedText = item.better; await click('듣기 멈춤');
  expect(host.querySelector('textarea')?.value).toBe('');
  await click('🎤 말하기'); await result(item.better); await click('고친 문장 확인'); expect(host.textContent).toContain('직접 고쳤어요!');
  expect(saved().data.parent.talks[0].corrections.items[0].selfFixed).toBe(true);
  await click('듣고 따라 말하기'); await click('🎤 따라 말하기'); await click('듣기 멈춤'); expect(host.textContent).not.toContain('잘 따라 말했어요!');
  await click('🎤 따라 말하기'); await result(item.better); expect(host.textContent).toContain('잘 따라 말했어요!');
});
it('다시 말하기는 수동 취소·문장 누적·120/90초·표현 성공을 유지한다', async () => {
  await mount('retell'); await click('2분 다시 말하기 시작'); expect(host.textContent).toContain('남은 시간 120초');
  Recognition.stoppedText = item.better; await click('🎤 문장 말하기'); await click('듣기 멈춤'); expect(host.querySelector('textarea')?.value).toBe('');
  for (const text of [item.better, 'We had tea.']) { await click('🎤 문장 말하기'); await result(text); }
  expect(host.querySelector('textarea')?.value).toBe(`${item.better} We had tea.`);
  clock = 120500; await act(async () => vi.advanceTimersByTime(250));
  expect(saved().data.parent.talks[0].retells[0].seconds).toBe(120); expect(saved().data.parent.retrieval[0].stage).toBe(1);
  await click('1분 30초로 한 번 더'); expect(host.textContent).toContain('남은 시간 90초');
  await click('🎤 문장 말하기'); await result(item.better); clock = 210500; await act(async () => vi.advanceTimersByTime(250));
  expect(saved().data.parent.talks[0].retells[1].seconds).toBe(90); expect(saved().data.parent.retrieval[0].stage).toBe(1);
});
