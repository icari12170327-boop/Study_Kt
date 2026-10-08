import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestWordProblems } from './wordProblems';
import { planWordProblems } from '../content/math/wordProblem';
const cfg = { endpoint: 'https://worker.example', token: 't'.repeat(32) };
const items = planWordProblems(Array.from({ length: 20 }, () => ({ problem: { skill: 'g3-add3', question: '23 + 4 =', answer: { kind: 'int' as const, value: 27 } } })), 20, ['공룡'], 'g3');
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('문장제 한 번 요청과 10초 제한', () => {
  it('최대 8개를 한번에 요청하고 정답·지시문은 전송하지 않는다', async () => {
    const response = { items: [{ id: items[0].id, story: '23개와 4개예요.', question: '모두 몇 개인가요?' }] };
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true, data: response })); vi.stubGlobal('fetch', fetcher);
    expect(await requestWordProblems(cfg, 'kid2', 'g3', items)).toEqual(response); expect(fetcher).toHaveBeenCalledOnce();
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body).toEqual({ profileId: 'kid2', level: 'g3', kind: 'word-problem', input: { items } });
    for (const item of body.input.items) expect(item).not.toHaveProperty('answer');
    expect(body).not.toHaveProperty('instructions');
  });
  it('fetch가 중지를 무시해도 10초에 복귀하며 늦은 응답은 사용하지 않는다', async () => {
    vi.useFakeTimers(); let resolve!: (value: Response) => void;
    const fetcher = vi.fn().mockImplementation(() => new Promise<Response>(done => { resolve = done; })); vi.stubGlobal('fetch', fetcher);
    const request = requestWordProblems(cfg, 'kid2', 'g3', items); let completed = false; void request.then(() => { completed = true; });
    await vi.advanceTimersByTimeAsync(9999); expect(completed).toBe(false);
    await vi.advanceTimersByTimeAsync(1); expect(await request).toBeNull(); expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    resolve(Response.json({ ok: true, data: { items: [] } })); await Promise.resolve(); expect(await request).toBeNull(); expect(fetcher).toHaveBeenCalledOnce();
  });
  it('실패·미설정·빈 계획도 재시도 없이 종료한다', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('실패')); vi.stubGlobal('fetch', fetcher);
    expect(await requestWordProblems(cfg, 'kid2', 'g3', items)).toBeNull(); expect(fetcher).toHaveBeenCalledOnce();
    expect(await requestWordProblems({}, 'kid2', 'g3', items)).toBeNull();
    expect(await requestWordProblems(cfg, 'kid2', 'g3', [])).toBeNull(); expect(fetcher).toHaveBeenCalledOnce();
  });
});
