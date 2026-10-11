/** 실패한 항목만 골라 최대 세 요청을 실행한다. 취소 뒤 늦은 결과는 저장하지 않는다. */
export async function runOpicFeedbackBatch<T>(indices: readonly number[], request: (index: number) => Promise<T>, save: (index: number, result: T) => void, signal: AbortSignal): Promise<number[]> {
  let cursor = 0;
  const failures: number[] = [];
  const worker = async () => {
    while (!signal.aborted && cursor < indices.length) {
      const index = indices[cursor++];
      try { const result = await request(index); if (!signal.aborted) save(index, result); }
      catch { if (!signal.aborted) failures.push(index); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, indices.length) }, worker));
  return failures.sort((a, b) => a - b);
}
