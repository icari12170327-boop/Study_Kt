import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiError, errorForResponse, fetchUsage, generate, normalizeAiConfig } from './ai';
const cfg = { endpoint: 'https://worker.example/', token: 'f'.repeat(32) };
const usage = {
  today: {
    kid1: { talkSeconds: 120, generates: 2 },
    kid2: { talkSeconds: 30, generates: 0 },
    parent: { talkSeconds: 10, generates: 3 },
  },
  month: { talkSeconds: 160, estimatedKrw: 40 },
};
afterEach(() => vi.unstubAllGlobals());
describe('AI 클라이언트', () => {
  it('주소를 정규화하고 HTTPS와 로컬 개발 HTTP만 허용한다', () => {
    expect(normalizeAiConfig(cfg).endpoint).toBe('https://worker.example');
    expect(normalizeAiConfig({ ...cfg, endpoint: 'http://localhost:8787' }).endpoint).toBe('http://localhost:8787');
    for (const endpoint of [
      'http://worker.example',
      'https://user:pass@worker.example',
      'https://worker.example?key=value',
      'https://worker.example/#secret',
      'javascript:alert(1)',
    ])
      expect(() => normalizeAiConfig({ ...cfg, endpoint })).toThrow(AiError);
    expect(() => normalizeAiConfig({ ...cfg, token: 'short' })).toThrow(AiError);
  });
  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [429, 'limit'],
    [409, 'busy'],
    [500, 'server'],
  ])('상태 %s를 오류 %s로 바꾼다', (status, kind) => {
    expect(errorForResponse(Number(status)).kind).toBe(kind);
  });
  it('안전 검사 오류를 분류한다', () => expect(errorForResponse(400, 'unsafe').kind).toBe('unsafe'));
  it('가족 토큰은 헤더로만 보내며 사용량을 검증한다', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(usage));
    vi.stubGlobal('fetch', fetcher);
    expect(await fetchUsage(cfg)).toEqual(usage);
    expect(fetcher.mock.calls[0][0]).toBe('https://worker.example/api/usage');
    expect(fetcher.mock.calls[0][1].headers).toEqual({ Authorization: `Bearer ${cfg.token}` });
  });
  it('생성 kind와 데이터만 보내고 실패·잘못된 응답을 구분한다', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ ok: true, data: { cards: [] } }))
      .mockResolvedValueOnce(Response.json({ error: 'limit' }, { status: 429 }))
      .mockResolvedValueOnce(Response.json({ today: {}, month: { talkSeconds: -1, estimatedKrw: 0 } }))
      .mockRejectedValueOnce(new Error('비밀 외부 오류'));
    vi.stubGlobal('fetch', fetcher);
    expect(await generate(cfg, { profileId: 'parent', level: 'adult', kind: 'reading-quiz', input: {} })).toEqual({
      cards: [],
    });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).not.toHaveProperty('instructions');
    await expect(fetchUsage(cfg)).rejects.toMatchObject({ kind: 'limit' });
    await expect(fetchUsage(cfg)).rejects.toMatchObject({ kind: 'server' });
    await expect(fetchUsage(cfg)).rejects.toMatchObject({ kind: 'network' });
  });
  it('HTML이나 잘못된 생성 응답도 오류로 처리한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('<html>'))
        .mockResolvedValueOnce(Response.json({ ok: false })),
    );
    await expect(fetchUsage(cfg)).rejects.toMatchObject({ kind: 'server' });
    await expect(
      generate(cfg, { profileId: 'parent', level: 'adult', kind: 'reading-quiz', input: {} }),
    ).rejects.toMatchObject({ kind: 'server' });
  });
});
