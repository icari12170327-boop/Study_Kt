import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultState } from '../store/defaults';
import { WordProblemText } from './WordProblemText';
import { WordProblemSettings } from './WordProblemSettings';
import { MathSession } from '../pages/MathSession';
let state = defaultState();
vi.mock('../store/StoreContext', () => ({ useStore: () => ({ state, update: vi.fn() }) }));
beforeEach(() => { state = defaultState(); });
describe('문장제 표시와 준비 화면', () => {
  it('AI 문구를 HTML로 해석하지 않고 원문 텍스트로 표시한다', () => {
    const text = '<img src=x onerror="alert(1)">23개와 4개예요.\n모두 몇 개인가요?';
    const html = renderToStaticMarkup(createElement(WordProblemText, { story: text }));
    expect(html).not.toContain('<img'); expect(html).toContain('&lt;img'); expect(html).toContain('23개와 4개'); expect(html).toContain('🔊 읽어 주기');
  });
  it('관심사는 기존 대화 설정을 쓰고 비율은 0/20/40을 제공한다', () => {
    state.settings.kid1.talk!.interests = ['축구', '공룡'];
    const html = renderToStaticMarkup(createElement(WordProblemSettings, { profileId: 'kid1' }));
    expect(html).toContain('축구, 공룡'); expect(html).toContain('AI 친구와 같은 관심사');
    for (const value of ['0', '20', '40']) expect(html).toContain(`value="${value}"`);
  });
  it('연결 설정이 없어도 바로 원래 수학 화면과 단일 키패드를 표시한다', () => {
    const html = renderToStaticMarkup(createElement(MathSession, { profileId: 'kid2', go: () => {} }));
    expect(html).toContain('question-text'); expect(html.match(/class="number-answer"/g)).toHaveLength(1);
    expect(html).not.toContain('word-problem-text'); expect(html).not.toContain('생성 중');
  });
});
