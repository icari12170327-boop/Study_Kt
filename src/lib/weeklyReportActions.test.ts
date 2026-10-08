import { describe, expect, it, vi } from 'vitest';
import { copyWeeklyReport, runWeeklyAi } from './weeklyReportActions';
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function handlers() { return { pending: vi.fn(), error: vi.fn(), save: vi.fn() }; }

describe('화면에서 사용하는 주간 요약 요청 흐름', () => {
  it('응답 전에 연속 클릭해도 한 번만 요청하고 한 번만 저장한다', async () => {
    const active = { current: null as AbortController | null }, callbacks = handlers();
    const response = deferred<string>(), request = vi.fn(() => response.promise);
    const first = runWeeklyAi(active, request, callbacks);
    await runWeeklyAi(active, request, callbacks);
    expect(request).toHaveBeenCalledTimes(1); expect(callbacks.pending.mock.calls).toEqual([[true]]);
    response.resolve('요약'); await first;
    expect(callbacks.save).toHaveBeenCalledExactlyOnceWith('요약');
    expect(callbacks.pending.mock.calls).toEqual([[true], [false]]); expect(active.current).toBeNull();
  });
  it('실패 뒤 오류와 대기 상태를 갱신하고 다음 클릭으로 재시도할 수 있다', async () => {
    const active = { current: null as AbortController | null }, callbacks = handlers();
    const request = vi.fn().mockRejectedValueOnce(new Error('연결 실패')).mockResolvedValueOnce('새 요약');
    await runWeeklyAi(active, request, callbacks);
    expect(callbacks.error).toHaveBeenLastCalledWith('연결 실패'); expect(callbacks.save).not.toHaveBeenCalled();
    expect(callbacks.pending).toHaveBeenLastCalledWith(false); expect(active.current).toBeNull();
    await runWeeklyAi(active, request, callbacks);
    expect(request).toHaveBeenCalledTimes(2); expect(callbacks.error).toHaveBeenLastCalledWith('');
    expect(callbacks.save).toHaveBeenCalledExactlyOnceWith('새 요약');
  });
  it('화면 이동으로 취소한 응답은 새 화면의 결과·상태를 바꾸지 않는다', async () => {
    const active = { current: null as AbortController | null }, oldCallbacks = handlers(), newCallbacks = handlers();
    const old = deferred<string>(), next = deferred<string>();
    const first = runWeeklyAi(active, () => old.promise, oldCallbacks);
    active.current!.abort(); active.current = null;
    const second = runWeeklyAi(active, () => next.promise, newCallbacks);
    old.resolve('지난 화면'); await first;
    expect(oldCallbacks.save).not.toHaveBeenCalled(); expect(oldCallbacks.pending.mock.calls).toEqual([[true]]);
    expect(newCallbacks.pending.mock.calls).toEqual([[true]]);
    next.resolve('현재 화면'); await second;
    expect(newCallbacks.save).toHaveBeenCalledExactlyOnceWith('현재 화면'); expect(newCallbacks.pending).toHaveBeenLastCalledWith(false);
  });
});

describe('화면에서 사용하는 리포트 복사', () => {
  it('클립보드 성공이면 전체 문구를 한 번 복사하고 대체 상자를 지운다', async () => {
    const write = vi.fn(async () => {});
    expect(await copyWeeklyReport('가족 리포트\n잘한 점', write)).toEqual({ status: '복사했어요.', fallback: null });
    expect(write).toHaveBeenCalledExactlyOnceWith('가족 리포트\n잘한 점');
  });
  it('클립보드 거부이면 글자 손실 없이 선택 상자에 전달하고 재시도도 가능하다', async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error('거부')).mockResolvedValueOnce(undefined), text = '가족 리포트\n한 줄 요약';
    expect(await copyWeeklyReport(text, write)).toEqual({ status: '복사하지 못했어요. 아래 글을 선택해서 복사해 주세요.', fallback: text });
    expect(await copyWeeklyReport(text, write)).toEqual({ status: '복사했어요.', fallback: null });
  });
  it('클립보드 API가 없어도 예외를 던지지 않고 선택 상자 문구를 반환한다', async () => {
    expect((await copyWeeklyReport('가족 리포트')).fallback).toBe('가족 리포트');
  });
});
