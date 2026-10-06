/** 비교용 정규화: 소문자, 축약형 펼치기, 구두점 제거 */
export function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\b(i)'m\b/g, '$1 am')
    .replace(/\b(\w+)'re\b/g, '$1 are')
    .replace(/\b(\w+)'ll\b/g, '$1 will')
    .replace(/\b(\w+)'ve\b/g, '$1 have')
    .replace(/\b(\w+)'d\b/g, '$1 would')
    .replace(/\bcan't\b/g, 'can not')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/\b(\w+)n't\b/g, '$1 not')
    .replace(/\bcannot\b/g, 'can not')
    .replace(/\b(it|that|what|there|here|he|she|let)'s\b/g, '$1 s')
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export interface SpeechScore {
  /** 0~1, 목표 문장 단어 중 순서대로 맞게 말한 비율 */
  score: number;
  /** 목표 문장 단어별로 말했는지 여부 */
  matched: { word: string; ok: boolean }[];
}

/** 목표 문장과 인식된 문장을 단어 단위 LCS로 비교한다. */
export function scoreSpeech(target: string, spoken: string): SpeechScore {
  const displayWords = target.split(/\s+/).filter(Boolean);
  const t = displayWords.map((w) => normalizeWords(w).join(' '));
  const s = normalizeWords(spoken);
  const tTokens = t.map((w) => w.split(' ').filter(Boolean));

  // 목표 문장을 정규화된 토큰으로 펼치고 원래 단어 인덱스를 기억한다.
  const flat: { tok: string; idx: number }[] = [];
  tTokens.forEach((toks, idx) => toks.forEach((tok) => flat.push({ tok, idx })));

  const n = flat.length;
  const m = s.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = flat[i].tok === s[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const hit = new Array(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (flat[i].tok === s[j]) {
      hit[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  const wordOk = displayWords.map((_, idx) => {
    const toks = flat.map((f, k) => ({ ...f, k })).filter((f) => f.idx === idx);
    return toks.length === 0 || toks.every((f) => hit[f.k]);
  });
  return {
    score: n === 0 ? 1 : hit.filter(Boolean).length / n,
    matched: displayWords.map((word, idx) => ({ word, ok: wordOk[idx] })),
  };
}
