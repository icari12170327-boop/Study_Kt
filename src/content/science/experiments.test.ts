import { describe, expect, it } from 'vitest';
import { SCIENCE_CARDS } from './experiments';

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
