import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { OPIC_QUESTIONS } from './questions';
import { OPIC_TYPES } from '../../../shared/opic';

describe('주제별 오픽 문항 품질·기존 기록 호환', () => {
  it('처음 배포할 182개 id·주제·유형·최소 난이도를 유지한다', () => {
    const metadata = OPIC_QUESTIONS.map(q => [q.id, q.topic, q.type, q.minLevel]);
    expect(createHash('sha256').update(JSON.stringify(metadata)).digest('hex')).toBe('a776804f014c1615d6f4565c2024b726489307432f227be908b95ad1acc3c939');
  });
  it('유형별 첫 여덟 단어가 같은 공통 문장을 두 개 넘게 재사용하지 않는다', () => {
    for (const type of OPIC_TYPES) {
      const prefixes = new Map<string, number>();
      for (const q of OPIC_QUESTIONS.filter(q => q.type === type)) {
        const prefix = q.en.toLowerCase().split(/\s+/).slice(0, 8).join(' ');
        prefixes.set(prefix, (prefixes.get(prefix) ?? 0) + 1);
      }
      expect(Math.max(...prefixes.values()), type).toBeLessThanOrEqual(2);
    }
    expect(new Set(OPIC_QUESTIONS.map(q => q.en)).size).toBe(182);
    expect(new Set(OPIC_QUESTIONS.map(q => q.ko)).size).toBe(182);
  });
  it('모든 한국어 원고에 기존 조사 오류·틀에서 나온 어색한 표현이 없다', () => {
    const wrong = /(?:영화|카페|여행지|서비스|기기|가게|식사|장소)(?:을|과)|예약를|준비를 하려고|찾기를 하려고|예약 같은 계획|평소 한 주에서|과 관련한 일을 할 때/;
    for (const q of OPIC_QUESTIONS) expect(q.ko, q.id).not.toMatch(wrong);
  });
  it('롤플레이 문제는 시간 불가 상황만 돌려 쓰지 않고 실제 주제별 문제를 묻는다', () => {
    const solutions = OPIC_QUESTIONS.filter(q => q.type === 'roleplay-solution');
    for (const q of solutions) expect(q.en, q.id).not.toMatch(/You planned to|the time you chose is no longer available/);
    expect(solutions.find(q => q.topic === 'shopping')?.en).toContain('does not turn on');
    expect(solutions.find(q => q.topic === 'cafe')?.en).toContain('milk');
    expect(solutions.find(q => q.topic === 'transport')?.en).toContain('train has been delayed');
  });
});
