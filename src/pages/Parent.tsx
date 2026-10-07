import { MyPhrases } from '../components/MyPhrases';
import { normalizeBingoSettings, type ProductMix } from '../content/math/bingo';
import { useRef, useState } from 'react';
import { useStore } from '../store/StoreContext';
import type { Level, MissionType, ProfileId } from '../types';
import { MISSION_META, type Go } from '../route';
import { formatKoreanDate, lastNDays, toDateKey } from '../lib/date';
import { currentStreak, dayRatio } from '../lib/progress';
import { countMastered } from '../lib/srs';
import { SKILL_MAP, formatAnswer } from '../content/math/skills';
import { defaultMathState, mathLevelsFor } from '../content/math/levels';
import { setMathLevel } from '../content/math/adaptive';
import { VOCAB_DECKS, VOCAB_DECK_MAP, vocabKey } from '../content/english/vocab';
import { SENTENCE_DECKS } from '../content/english/sentences';
import { defaultSettings, defaultState } from '../store/defaults';
import { exportState, importState } from '../store/storage';
import { ProgressBar, TopBar } from '../components/common';
import { ScienceOverview } from '../components/ScienceOverview';
import { MathOverview } from '../components/MathOverview';
import { AiConnection } from './AiConnection';
import { aiReady } from '../lib/talk';
import { TalkRecords } from './TalkRecords';

type Tab = 'overview' | 'settings' | 'coupons' | 'backup' | 'ai' | 'talks';

const LEVEL_LABEL: Record<Level, string> = { g3: '초등 3학년', g5: '초등 5학년', adult: '성인' };

export function Parent({ go }: { go: Go }) {
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <div className="page">
      <TopBar title="🔒 보호자 모드" onBack={() => go({ name: 'profiles' })} />
      <div className="tabs">
        {(
          [
            ['overview', '학습 현황'],
            ['settings', '미션 설정'],
            ['coupons', '쿠폰'],
            ['backup', '백업·보안'],
            ['ai', 'AI 연결'],
            ['talks', '대화 기록'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'settings' && <Settings />}
      {tab === 'coupons' && <Coupons />}
      {tab === 'backup' && <Backup />}
      {tab === 'ai' && <AiConnection />}
      {tab === 'talks' && <TalkRecords />}
    </div>
  );
}

function Overview() {
  const { state } = useStore();
  const today = toDateKey();
  const week = lastNDays(7, today);
  const twoWeeks = lastNDays(14, today);
  const [openWrong, setOpenWrong] = useState<ProfileId | null>(null);

  return (
    <div className="overview">
      {state.profiles.map((p) => {
        const data = state.data[p.id];
        const settings = state.settings[p.id];
        const weekLogs = week.map((d) => data.days[d]);
        const correct = weekLogs.reduce((s, l) => s + (l?.correct ?? 0), 0);
        const total = weekLogs.reduce((s, l) => s + (l?.total ?? 0), 0);
        const doneDays = weekLogs.filter((l) => l?.completed).length;

        // 최근 2주 연산 단원별 정답률 (약한 단원 순)
        const skillAgg: Record<string, { correct: number; total: number }> = {};
        for (const d of twoWeeks) {
          for (const [skill, s] of Object.entries(data.days[d]?.mathBySkill ?? {})) {
            const a = (skillAgg[skill] ??= { correct: 0, total: 0 });
            a.correct += s.correct;
            a.total += s.total;
          }
        }
        const skillRows = Object.entries(skillAgg)
          .filter(([, s]) => s.total > 0)
          .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total);

        const vocabKeys = settings.vocabDecks.flatMap((id) => VOCAB_DECK_MAP[id]?.cards.map((c) => vocabKey(id, c.id)) ?? []);

        return (
          <div key={p.id} className="panel">
            <div className="panel-head">
              <span className="profile-avatar small">{p.avatar}</span>
              <div>
                <strong>{p.name}</strong> <span className="muted small">{LEVEL_LABEL[p.level]}</span>
                <div className="small muted">
                  🔥 {currentStreak(data, today)}일 · ⭐ {data.stars} · 이번 주 {doneDays}/7일 완료 · 정답률 {total ? Math.round((correct / total) * 100) : 0}%
                </div>
              </div>
            </div>

            <div className="week-bars">
              {week.map((d) => {
                const ratio = dayRatio(data.days[d], settings, { aiReady: aiReady(state.ai) });
                return (
                  <div key={d} className="week-bar" title={formatKoreanDate(d)}>
                    <div className="week-bar-fill" style={{ height: `${Math.max(4, ratio * 100)}%`, opacity: data.days[d]?.completed ? 1 : 0.45 }} />
                    <div className="week-bar-label">{formatKoreanDate(d).split(' ')[2]?.replace(/[()]/g, '')}</div>
                  </div>
                );
              })}
            </div>

            {vocabKeys.length > 0 && (
              <div className="small">
                단어 장기 기억(4단계 이상): {countMastered(vocabKeys, data.srs)} / {vocabKeys.length}
              </div>
            )}

            {(p.level !== 'adult' || settings.missions.some((mission) => mission.type === 'math' && mission.enabled)) &&
              <MathOverview data={data} today={today} />}

            {skillRows.length > 0 && (
              <div className="skill-table">
                <div className="small muted">최근 2주 연산 단원별 정답률</div>
                {skillRows.map(([skill, s]) => (
                  <div key={skill} className="skill-row">
                    <span>{SKILL_MAP[skill]?.label ?? skill}</span>
                    <ProgressBar value={s.correct} max={s.total} color={s.correct / s.total < 0.7 ? '#ef4444' : '#10b981'} />
                    <span className="small">
                      {s.correct}/{s.total}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {p.level !== 'adult' && <ScienceOverview data={data} />}

            {data.wrongNotes.length > 0 && (
              <>
                <button className="link-btn" onClick={() => setOpenWrong(openWrong === p.id ? null : p.id)}>
                  오답노트 {data.wrongNotes.length}개 {openWrong === p.id ? '접기' : '보기'}
                </button>
                {openWrong === p.id && (
                  <ul className="wrong-list">
                    {data.wrongNotes.map((w) => (
                      <li key={w.id}>
                        {w.problem.question} <span className="muted">→ 정답 {formatAnswer(w.problem)}</span>
                        {w.given && <span className="bad-text"> (입력: {w.given})</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Settings() {
  const { state, update } = useStore();
  const [pid, setPid] = useState<ProfileId>('kid1');
  const profile = state.profiles.find((p) => p.id === pid)!;
  const settings = state.settings[pid];
  const bingo = normalizeBingoSettings(settings.bingo, profile.level);

  const setMission = (type: MissionType, patch: { enabled?: boolean; target?: number }) =>
    update((d) => {
      const m = d.settings[pid].missions.find((x) => x.type === type);
      if (m) Object.assign(m, patch);
      if (type === 'talk' && patch.target !== undefined && d.settings[pid].talk) d.settings[pid].talk.dailyMinutes = patch.target;
    });

  const toggle = (field: 'vocabDecks' | 'speakingDecks', id: string) =>
    update((d) => {
      const list = d.settings[pid][field];
      d.settings[pid][field] = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    });

  return (
    <div className="form">
      <div className="tabs">
        {state.profiles.map((p) => (
          <button key={p.id} className={`tab ${pid === p.id ? 'active' : ''}`} onClick={() => setPid(p.id)}>
            {p.avatar} {p.name}
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="form-grid">
          <label>
            이름
            <input value={profile.name} onChange={(e) => update((d) => void (d.profiles.find((p) => p.id === pid)!.name = e.target.value))} />
          </label>
          <label>
            아바타 (이모지)
            <input value={profile.avatar} onChange={(e) => update((d) => void (d.profiles.find((p) => p.id === pid)!.avatar = e.target.value))} />
          </label>
          <label>
            학년
            <select
              value={profile.level}
              onChange={(e) => {
                const level = e.target.value as Level;
                if (!confirm(`${LEVEL_LABEL[level]} 기본 미션으로 바꿀까요? (학습 기록은 유지돼요)`)) return;
                update((d) => {
                  d.profiles.find((p) => p.id === pid)!.level = level;
                  d.settings[pid] = defaultSettings(level, pid);
                  d.data[pid].math = setMathLevel(d.data[pid].math, defaultMathState(level).level, level, toDateKey());
                });
              }}
            >
              {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </select>
          </label>
          <label>
            미션 완료 보상
            <input value={settings.rewardLabel} onChange={(e) => update((d) => void (d.settings[pid].rewardLabel = e.target.value))} />
          </label>
        </div>
      </div>

      <div className="panel">
        <div className="form-label">하루 미션</div>
        {settings.missions.map((m) => (
          <div key={m.type} className="mission-setting">
            <label className="check">
              <input type="checkbox" checked={m.enabled} onChange={(e) => setMission(m.type, { enabled: e.target.checked })} />
              {pid === 'parent' && m.type === 'talk' ? '💼 비즈니스 프리토킹' : `${MISSION_META[m.type].icon} ${MISSION_META[m.type].title}`}
            </label>
            <input
              aria-label={`${pid === 'parent' && m.type === 'talk' ? '비즈니스 프리토킹' : MISSION_META[m.type].title} 하루 목표`}
              type="number"
              min={1}
              max={100}
              value={m.target}
              onChange={(e) => setMission(m.type, { target: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })}
            />
            <span className="small muted">{MISSION_META[m.type].unit}</span>
          </div>
        ))}
      </div>

      {pid !== 'parent' && profile.level !== 'adult' && <div className="panel">
        <label className="check">
          <input type="checkbox" checked={bingo.enabled} onChange={(event) => update((draft) => {
            draft.settings[pid].bingo = { ...bingo, enabled: event.target.checked };
          })} />
          🎯 수학 빙고: 켜기/끄기
        </label>
        <div className="form-grid">
          <label>빙고 제한 시간
            <select value={bingo.limitSec} onChange={(event) => update((draft) => {
              draft.settings[pid].bingo = { ...bingo, limitSec: Number(event.target.value) };
            })}>
              {Array.from({ length: 9 }, (_, i) => 60 + i * 30).map(sec => <option key={sec} value={sec}>{Math.floor(sec / 60)}분{sec % 60 ? ' 30초' : ''}</option>)}
            </select>
          </label>
          {profile.level === 'g5' && <label>곱셈 문제 양
            <select value={bingo.productMix} onChange={(event) => update((draft) => {
              draft.settings[pid].bingo = { ...bingo, productMix: event.target.value as ProductMix };
            })}>
              <option value="off">끄기 · 0개</option><option value="few">적게 · 1개</option>
              <option value="normal">보통 · 2~3개</option><option value="many">많이 · 4개</option>
            </select>
          </label>}
        </div>
        <p className="small muted">다음 게임부터 적용해요. 별과 쿠폰 없이 자유롭게 놀아요.</p>
      </div>}

      <div className="panel">
        <label>
          수학 레벨 수동 조정
          <select value={state.data[pid].math.level} onChange={(event) => update((draft) => {
            draft.data[pid].math = setMathLevel(draft.data[pid].math, Number(event.target.value), profile.level, toDateKey());
          })}>
            {mathLevelsFor(profile.level).map((row) => (
              <option key={row.level} value={row.level}>레벨 {row.level} · {row.mainSkills.map((id) => SKILL_MAP[id].label).join(', ')}</option>
            ))}
          </select>
        </label>
        <p className="small muted">오늘은 선택한 레벨을 유지해요. 다음 학습일에 정답률과 풀이 시간으로 조정돼요.</p>
      </div>

      <div className="panel">
        <div className="form-label">단어장</div>
        <div className="chip-wrap">
          {VOCAB_DECKS.map((d) => (
            <button key={d.id} className={`chip ${settings.vocabDecks.includes(d.id) ? 'on' : ''}`} onClick={() => toggle('vocabDecks', d.id)}>
              {d.title} ({d.cards.length})
            </button>
          ))}
        </div>
        <div className="form-label">말하기 문장</div>
        <div className="chip-wrap">
          {SENTENCE_DECKS.map((d) => (
            <button key={d.id} className={`chip ${settings.speakingDecks.includes(d.id) ? 'on' : ''}`} onClick={() => toggle('speakingDecks', d.id)}>
              {d.title} ({d.sentences.length})
            </button>
          ))}
        </div>
      </div>
      {pid === 'parent' && profile.level === 'adult' && <MyPhrases />}
    </div>
  );
}

function Coupons() {
  const { state, update } = useStore();
  const rows = state.profiles.flatMap((p) => state.data[p.id].coupons.filter((c) => !c.usedAt).map((c) => ({ p, c })));
  if (rows.length === 0) return <p className="muted center">사용하지 않은 쿠폰이 없어요.</p>;
  return (
    <div className="coupon-list">
      {rows.map(({ p, c }) => (
        <div key={c.id} className="coupon">
          <div className="coupon-label">
            {p.avatar} {p.name} · {c.label}
          </div>
          <div className="small muted">{formatKoreanDate(c.earnedAt)} 획득</div>
          <button
            className="btn btn-primary"
            onClick={() =>
              update((d) => {
                const x = d.data[p.id].coupons.find((k) => k.id === c.id);
                if (x) x.usedAt = toDateKey();
              })
            }
          >
            사용 처리
          </button>
        </div>
      ))}
    </div>
  );
}

function Backup() {
  const { state, update, replace } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

  const download = () => {
    const blob = new Blob([exportState(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-kt-backup-${toDateKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restore = async (file: File) => {
    try {
      const next = importState(await file.text(), state.ai);
      if (!confirm('지금 기록을 백업 파일 내용으로 바꿀까요?')) return;
      replace(next);
      setMessage('복원했어요.');
    } catch (e) {
      setMessage(`복원 실패: ${(e as Error).message}`);
    }
  };

  return (
    <div className="form">
      <div className="panel">
        <div className="form-label">데이터 백업</div>
        <p className="small muted">기록은 이 기기의 브라우저에만 저장돼요. 기기를 바꾸거나 브라우저 데이터를 지우기 전에 백업해 주세요.</p>
        <div className="row-center">
          <button className="btn btn-primary" onClick={download}>
            백업 파일 받기
          </button>
          <button className="btn btn-soft" onClick={() => fileRef.current?.click()}>
            백업 파일로 복원
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void restore(f);
              e.target.value = '';
            }}
          />
        </div>
        {message && <p className="small">{message}</p>}
      </div>
      <div className="panel">
        <div className="form-label">보안</div>
        <div className="row-center">
          <button
            className="btn btn-soft"
            onClick={() => {
              if (!confirm('PIN을 초기화할까요? 다음에 보호자 모드에 들어올 때 새 PIN을 만들어요.')) return;
              update((d) => {
                d.parentPin = undefined;
              });
              setMessage('PIN을 초기화했어요.');
            }}
          >
            PIN 다시 만들기
          </button>
          <button
            className="btn btn-ghost danger"
            onClick={() => {
              if (!confirm('모든 학습 기록을 지울까요? 되돌릴 수 없어요.')) return;
              if (!confirm('정말 지울까요? 먼저 백업 파일을 받아 두는 걸 권해요.')) return;
              replace({ ...defaultState(), parentPin: state.parentPin });
              setMessage('초기화했어요.');
            }}
          >
            전체 초기화
          </button>
        </div>
      </div>
    </div>
  );
}
