// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StoreProvider } from '../store/StoreContext';
import { defaultState } from '../store/defaults';
import { normalizeState } from '../store/storage';
import { SpeakingSession } from '../pages/SpeakingSession';
import { TalkCorrections } from './TalkCorrections';
import { TalkRetell } from './TalkRetell';
import * as speech from '../lib/speech';
import type { TalkLog } from '../types';
import { toDateKey } from '../lib/date';
vi.mock('../lib/speech', async original => ({ ...await original<typeof import('../lib/speech')>(), canSpeak: vi.fn(() => false), canRecognize: vi.fn(), listenOnce: vi.fn() }));
vi.mock('../content/english/session', () => ({ buildSpeakingSession: () => [{ key: 'sent:test', sentence: { id: 'test', en: 'I went home.', ko: '집에 갔어요.', tag: '일상' } }] }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, host: HTMLDivElement;
const item = { said: 'I go home yesterday.', better: 'I went home yesterday.', focus: 'went', whyKo: '지난 일이에요.', hintKo: '언제인가요?', pattern: 'tense' as const };
const log = (): TalkLog => ({ id: 'fallback', date: toDateKey(), mode: 'coach', seconds: 60, englishRatio: 1, lines: [{ role: 'kid', text: item.said, at: 1 }], corrections: { items: [item], praiseKo: '잘했어요.', createdAt: toDateKey() } });
beforeEach(() => { localStorage.clear(); vi.mocked(speech.canRecognize).mockReset(); vi.mocked(speech.listenOnce).mockReset(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.restoreAllMocks(); });
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === text)!;
async function click(text: string) { await act(async () => button(text).click()); }
async function input(value: string) { await act(async () => { const field = host.querySelector('textarea, input:not([type=checkbox])')!; const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })); }); }
async function mount(kind: string) {
  const state = normalizeState(defaultState()); state.data.parent.talks = [log()]; localStorage.setItem('study-kt:v1', JSON.stringify(state));
  const child = kind === '말하기' ? createElement(SpeakingSession, { profileId: 'kid2', go: vi.fn() }) : kind === '다시 말하기' ? createElement(TalkRetell, { log: log() }) : createElement(TalkCorrections, { log: log() });
  await act(async () => root.render(createElement(StoreProvider, null, child)));
  if (kind === '다시 말하기') await click('2분 다시 말하기 시작');
  if (kind === '코치 따라 말하기') { await click('모르겠어요'); await click('듣고 따라 말하기'); }
}
for (const kind of ['말하기', '먼저 고쳐 보기', '코치 따라 말하기', '다시 말하기']) {
  it.each(['미지원', 'not-allowed', 'service-not-allowed', 'audio-capture'])(`${kind}: %s에서도 비활성 마이크와 입력으로 끝까지 진행`, async error => {
    vi.mocked(speech.canRecognize).mockReturnValue(error !== '미지원');
    vi.mocked(speech.listenOnce).mockImplementation(() => ({ promise: Promise.reject(new Error(error)), stop: vi.fn() }));
    // 미지원에서는 인식 Promise 자체가 만들어지지 않는다.
    if (error === '미지원') vi.mocked(speech.listenOnce).mockReset();
    await mount(kind);
    const micLabel = kind === '다시 말하기' ? '🎤 문장 말하기' : kind === '코치 따라 말하기' ? '🎤 따라 말하기' : '🎤 말하기';
    if (error !== '미지원') await click(micLabel);
    expect(button(micLabel).disabled).toBe(true); expect(host.textContent).toContain(kind === '말하기' ? '글자로 써도 돼요' : '이 기기에서는 음성 인식이 안 돼요');
    await click(micLabel); expect(speech.listenOnce).toHaveBeenCalledTimes(error === '미지원' ? 0 : 1);
    await click('⌨️ 입력'); await input(kind === '말하기' ? 'I went home.' : item.better);
    if (kind === '말하기') { await click('쓴 문장 확인'); await click('다음 문장'); expect(host.textContent).toContain('미션 목록으로'); }
    else if (kind === '다시 말하기') { await click('다시 말하기 끝내기'); expect(host.textContent).toContain('영어 단어'); }
    else {
      if (kind === '먼저 고쳐 보기') { await click('고친 문장 확인'); expect(host.textContent).toContain('직접 고쳤어요!'); await click('듣고 따라 말하기'); }
      else { await click('따라 쓴 문장 확인'); expect(host.textContent).toContain('잘 따라 말했어요!'); }
      await click('저장으로'); await click('저장하고 다음'); expect(host.textContent).toContain('오늘의 교정을 모두 확인했어요');
    }
  });
}
it('말하기 화면 이탈은 인식을 멈추고 늦은 응답이 학습 기록에 반영되지 않는다', async () => {
  vi.mocked(speech.canRecognize).mockReturnValue(true); let resolve!: (values: string[]) => void; const stop = vi.fn();
  vi.mocked(speech.listenOnce).mockReturnValue({ promise: new Promise(done => { resolve = done; }), stop });
  await mount('말하기'); await click('🎤 말하기'); const before = localStorage.getItem('study-kt:v1');
  await act(async () => root.render(null)); await act(async () => resolve(['I went home.']));
  expect(stop).toHaveBeenCalledOnce(); expect(localStorage.getItem('study-kt:v1')).toBe(before);
});
