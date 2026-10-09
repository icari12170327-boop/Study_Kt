import { useEffect, useRef, useState } from 'react';
import type { Level, ProfileId } from '../types';
import { useStore } from '../store/StoreContext';
import { buildWeeklyStats, compareStats, reportText, reportValue, weekRange, weeklyNoticeDay, type ReportTrend, type WeeklyStats } from '../lib/weeklyReport';
import { copyWeeklyReport, runWeeklyAi } from '../lib/weeklyReportActions';
import { requestWeeklyAi, saveWeeklyAi } from '../lib/weeklyAi';
import { aiReady } from '../lib/talk';
import { useStoryDate } from '../components/stories/useStoryDate';
import { badgeLabel } from '../content/science/units';
import { PUZZLE_LABELS, PUZZLE_TYPES } from '../content/puzzles/registry';

export function WeeklyReport() {
  const { state } = useStore();
  const today = useStoryDate();
  const [pid, setPid] = useState<'kid1' | 'kid2'>('kid1');
  const [offset, setOffset] = useState(0);
  const range = weekRange(today, offset);
  const profile = state.profiles.find(p => p.id === pid)!;
  const stats = buildWeeklyStats(state, pid, range);
  const previous = buildWeeklyStats(state, pid, weekRange(today, offset - 1));
  return <div className="weekly-report">
    <div className="form-grid panel">
      <label>아이 선택<select value={pid} onChange={event => setPid(event.target.value as 'kid1' | 'kid2')}>
        {state.profiles.filter(p => p.id !== 'parent').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      <label>주 선택<select value={offset} onChange={event => setOffset(Number(event.target.value))}>
        <option value={0}>이번 주</option><option value={-1}>지난주</option><option value={-2}>그 전 주</option>
      </select></label>
    </div>
    <h2>{profile.name} · 주간 학습 리포트</h2>
    <p className="muted">{range.start} ~ {range.end} · 월요일부터 일요일</p>
    <p className="small muted">보관된 기록 기준이에요. 이번 주는 현재까지의 기록이며, 화살표는 선택한 주의 전주와 비교해요.</p>
    <ReportBody key={`${pid}-${range.start}`} stats={stats} previous={previous} profileName={profile.name} level={profile.level} today={today} />
  </div>;
}

const TREND: Record<ReportTrend, string> = { up: '▲', down: '▼', same: '–', none: '' };
function Metric({ label, value, unit = '', trend = 'none', max }: { label: string; value: number | null | undefined; unit?: string; trend?: ReportTrend; max?: number }) {
  const text = value === 0 && unit !== '%' ? `기록 없음 · 0${unit}` : reportValue(value, unit);
  return <div className="weekly-metric"><span>{label}</span><strong>{text} {TREND[trend] && <span className="weekly-trend" aria-label={`전주 대비 ${trend === 'up' ? '증가' : trend === 'down' ? '감소' : '동일'}`}>{TREND[trend]}</span>}</strong>
    {max && <div className="weekly-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (value ?? 0) / max * 100)}%` }} /></div>}
  </div>;
}

function ReportBody({ stats, previous, profileName, level, today }: { stats: WeeklyStats; previous: WeeklyStats; profileName: string; level: Level; today: string }) {
  const { state, update } = useStore();
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState(''), [copyFallback, setCopyFallback] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null), copyBox = useRef<HTMLTextAreaElement>(null);
  const { attendance: a, math: m, science: s, talk: t, play: p } = stats;
  const data = state.data[stats.profileId], cached = data.weeklyAi?.[stats.range.start];
  const trend = compareStats(stats, previous);
  useEffect(() => () => { controller.current?.abort(); controller.current = null; }, []);
  useEffect(() => { if (copyFallback !== null) { copyBox.current?.focus(); copyBox.current?.select(); } }, [copyFallback]);
  const makeAi = async () => {
    if (level === 'adult' || !aiReady(state.ai)) return;
    await runWeeklyAi(controller, signal => requestWeeklyAi(state.ai, stats, level, signal), {
      pending: setPending, error: setError,
      save: result => update(draft => saveWeeklyAi(draft.data[stats.profileId], stats.range.start, result, today)),
    });
  };
  const copy = async () => {
    const result = await copyWeeklyReport(reportText(stats, cached, profileName), navigator.clipboard ? text => navigator.clipboard.writeText(text) : undefined);
    setCopyStatus(result.status); setCopyFallback(result.fallback);
  };
  const metric = (label: string, value: number | null | undefined, key: string, unit = '', max?: number) => <Metric label={label} value={value} trend={trend[key]} unit={unit} max={max} />;
  return <>
    <div className="weekly-sections">
      <section className="panel"><h3>🗓️ 출석과 보상</h3>
        {metric('하루 미션 완료', a.completedDays, 'completedDays', '/7일', 7)}
        {metric('기간 내 최장 연속 학습', a.streak, 'streak', '일')}
        {metric('이번 주 받은 별', a.stars, 'stars', '개')}
        <p className="small muted">누적 별: {data.stars}개 · 별 지급 날짜는 저장되지 않아요.</p>
        {metric('이번 주 받은 쿠폰', a.coupons, 'coupons', '개')}
      </section>
      <section className="panel"><h3>🔢 수학 도전</h3>
        {metric('푼 문제', m.solved, 'mathSolved', '문제')}
        {metric('정답률', m.accuracy, 'mathAccuracy', '%', 100)}
        <p>현재 레벨 {m.currentLevel}</p><p>주 시작 → 끝: {reportValue(m.levelStart)} → {reportValue(m.levelEnd)} {TREND[trend.mathLevel]}</p>
        {metric('찍기 감지', m.guesses, 'guesses', '회')}
        {metric('문장제 정답률', m.storyAccuracy, 'storyAccuracy', '%', 100)}
        <h4>함께 살펴볼 단원</h4>
        {m.weakSkills.length ? m.weakSkills.map(row => <Metric key={row.skill} label={row.label} value={row.accuracy} unit="%" max={100} />) : <p className="muted">기록 없음</p>}
      </section>
      <section className="panel"><h3>🔬 과학 문제</h3>
        {metric('푼 문제', s.solved, 'scienceSolved', '문제')}
        {metric('정답률', s.accuracy, 'scienceAccuracy', '%', 100)}
        {metric('새 도감 카드', s.newCards, 'newCards', '장')}
        {metric('새 배지', s.newBadges.length, 'newBadges', '개')}
        {s.newBadges.map(id => <p key={id} className="small">🏅 {badgeLabel(id)}</p>)}
      </section>
      <section className="panel"><h3>🗣️ 영어 대화</h3>
        {metric('대화 시간', t.minutes, 'talkMinutes', '분')}{metric('대화 횟수', t.sessions, 'talkSessions', '회')}
        <h4>오늘의 한 줄</h4>
        {t.highlights.length ? t.highlights.map((line, index) => <p key={index}>{line}</p>) : <p className="muted">기록 없음</p>}
      </section>
      <section className="panel"><h3>🎯 자유 놀이</h3>
        {metric('빙고', p.bingoGames, 'bingoGames', '판')}{metric('한 판 최다 찾은 줄', p.bingoBest, 'bingoBest', '줄')}
        <p className="small muted">빙고 제한 시간과 설정은 판마다 다를 수 있어요.</p>
        {metric('맞힌 퍼즐', p.puzzlesSolved, 'puzzlesSolved', '개')}
        {metric('퍼즐 난이도 변경', p.puzzleLevelUps, 'puzzleLevelUps', '회')}
        <p className="small muted">현재 난이도: {PUZZLE_TYPES.map(type => `${PUZZLE_LABELS[type]} ${data.puzzles?.levels[type]?.level ?? (level === 'g5' ? 2 : 1)}`).join(' · ')}</p>
        {metric('낚시', p.fishing, 'fishing', '판')}{metric('형제 대결', p.duels, 'duels', '판')}{metric('받은 왕관 👑', p.crowns, 'crowns', '회')}
        {metric('오비 달리기', p.obby, 'obby', '판')}{metric('이번 주 최고 Stage', p.obbyBest, 'obbyBest')}
        {metric('이번 주 읽은 이야기', p.storyEpisodes, 'storyEpisodes', '화')}
        <p className="small muted">누적 완주: {Object.values(data.stories ?? {}).reduce((sum, story) => sum + story.finished, 0)}화 · 완주 날짜는 저장되지 않아요.</p>
      </section>
    </div>
    <section className="panel"><h3>✨ AI 한마디</h3>
      <p className="small muted">버튼을 누르면 숫자 요약만 보내요. 대화 원문과 오늘의 한 줄은 보내지 않아요.</p>
      {cached && <div className="weekly-ai"><h4>잘한 점</h4><p>{cached.goodKo}</p><h4>살펴볼 점</h4><p>{cached.watchKo}</p><h4>다음 주 제안</h4><p>{cached.nextKo}</p></div>}
      {!aiReady(state.ai) && <p className="muted">AI 연결을 설정하면 요약을 만들 수 있어요. 숫자 요약은 그대로 볼 수 있어요.</p>}
      {level === 'adult' && <p className="muted">아이 학년을 초3 또는 초5로 설정해 주세요.</p>}
      <button className="btn btn-primary" disabled={pending || !aiReady(state.ai) || level === 'adult'} onClick={() => void makeAi()}>{pending ? '요약 만드는 중…' : error ? '다시 시도' : cached ? '다시 만들기' : '✨ AI 요약 만들기'}</button>
      {error && <p role="alert">{error}</p>}
    </section>
    <section className="panel"><button className="btn btn-soft" onClick={() => void copy()}>복사하기</button>
      <p className="small" role="status">{copyStatus}</p>
      {copyFallback !== null && <label>복사용 리포트<textarea ref={copyBox} readOnly value={copyFallback} rows={14} /></label>}
    </section>
  </>;
}

export function WeeklyReportNotice({ go, profileId }: { go: import('../route').Go; profileId: ProfileId }) {
  const today = useStoryDate();
  return profileId === 'parent' && weeklyNoticeDay(today) ? <button className="btn btn-soft weekly-notice" onClick={() => go({ name: 'parent', tab: 'weekly' })}>📊 이번 주 리포트가 준비됐어요</button> : null;
}
