/** 화면의 요청 참조를 공유해 빠른 중복 클릭과 화면 이동 뒤의 결과를 차단한다. */
export async function runWeeklyAi<T>(
  active: { current: AbortController | null },
  request: (signal: AbortSignal) => Promise<T>,
  handlers: { pending: (value: boolean) => void; error: (message: string) => void; save: (result: T) => void },
): Promise<void> {
  if (active.current) return;
  const controller = new AbortController(); active.current = controller;
  handlers.pending(true); handlers.error('');
  try {
    const result = await request(AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]));
    if (active.current === controller && !controller.signal.aborted) handlers.save(result);
  } catch (reason) {
    if (active.current === controller && !controller.signal.aborted) handlers.error(reason instanceof Error ? reason.message : '요약을 만들지 못했어요.');
  } finally {
    if (active.current === controller) { active.current = null; handlers.pending(false); }
  }
}

export interface ReportCopyResult { status: string; fallback: string | null }
/** 클립보드가 없거나 거부되면 같은 리포트 전체를 선택 가능한 화면으로 전달한다. */
export async function copyWeeklyReport(text: string, write?: (text: string) => Promise<void>): Promise<ReportCopyResult> {
  try {
    if (!write) throw new Error('클립보드를 사용할 수 없어요.');
    await write(text);
    return { status: '복사했어요.', fallback: null };
  } catch {
    return { status: '복사하지 못했어요. 아래 글을 선택해서 복사해 주세요.', fallback: text };
  }
}
