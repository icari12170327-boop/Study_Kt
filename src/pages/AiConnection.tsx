import { parentPersona } from '../lib/voices';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { AiError, endActiveSessions, fetchActiveSessions, fetchUsage, normalizeAiConfig, type ActiveSession, type Usage } from '../lib/ai';
import { startTalk, stopLocalTalks, type TalkHandle, type TalkState } from '../lib/realtime';
const labels: Record<TalkState, string> = {
  connecting: '연결 중',
  listening: '듣는 중',
  thinking: '생각 중',
  speaking: '말하는 중',
  ended: '종료',
  error: '오류',
};
const duration = (seconds: number) => `${Math.floor(seconds / 60)}분 ${Math.floor(seconds % 60)}초`;
export function AiConnection() {
  const { state, update } = useStore();
  const [endpoint, setEndpoint] = useState(state.ai.endpoint ?? '');
  const [token, setToken] = useState(state.ai.token ?? '');
  const [usage, setUsage] = useState<Usage>();
  const [sessions, setSessions] = useState<ActiveSession[]>();
  const [ending, setEnding] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [talkState, setTalkState] = useState<TalkState>('ended');
  const [transcript, setTranscript] = useState('');
  const handle = useRef<TalkHandle | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const alive = useRef(true);
  const connected = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
      void handle.current?.stop();
    };
  }, []);
  useEffect(() => {
    let active = true;
    try {
      normalizeAiConfig(state.ai);
      void fetchActiveSessions(state.ai).then((value) => {
        if (active) setSessions(value);
      }).catch((e: unknown) => {
        if (active) setError(e instanceof AiError ? e.message : '진행 중인 대화를 확인하지 못했어요.');
      });
    } catch {
      // 연결 설정이 없으면 보호자가 저장한 뒤 조회한다.
    }
    return () => { active = false; };
  }, [state.ai]);
  const config = () => normalizeAiConfig({ endpoint, token });
  const showError = (e: unknown) => {
    if (alive.current) setError(e instanceof AiError ? e.message : '연결 설정을 확인해 주세요.');
  };
  const refresh = async () => {
    setBusy(true);
    setError('');
    try {
      const [value, active] = await Promise.all([fetchUsage(config()), fetchActiveSessions(config())]);
      if (alive.current) {
        setUsage(value);
        setSessions(active);
        setMessage('Worker 연결을 확인했어요.');
      }
    } catch (e) {
      showError(e);
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const forceEnd = async (profileId: ActiveSession['profileId'] | 'all') => {
    const name = profileId === 'all' ? '모두' : state.profiles.find((p) => p.id === profileId)?.name ?? profileId;
    const question = profileId === 'all' ? '진행 중인 모든 대화를 끝낼까요?' : `${name}의 대화를 끝낼까요?`;
    if (!confirm(`${question} 아이가 대화 중이면 바로 끊겨요.`)) return;
    setEnding(true);
    setError('');
    try {
      const ai = config();
      // 로컬 마이크는 즉시 끄고, 종료 보고의 성공 여부와 관계없이 서버 강제 종료를 요청한다.
      void stopLocalTalks(ai, profileId).catch(showError);
      const result = await endActiveSessions(ai, profileId);
      const [active, value] = await Promise.all([fetchActiveSessions(ai), fetchUsage(ai)]);
      if (alive.current) {
        setSessions(active);
        setUsage(value);
        setMessage(`${result.closed}개 대화를 끝냈어요. 기록한 시간: ${duration(result.chargedSeconds)}`);
      }
    } catch (e) {
      showError(e);
    } finally {
      if (alive.current) setEnding(false);
    }
  };
  const save = () => {
    try {
      const ai = config();
      update((draft) => {
        draft.ai = ai;
      });
      setEndpoint(ai.endpoint);
      setUsage(undefined);
      setSessions(undefined);
      setError('');
      setMessage('이 기기에 저장했어요. 백업에는 가족 토큰이 들어가지 않아요.');
    } catch (e) {
      showError(e);
    }
  };
  const test = async () => {
    setBusy(true);
    setError('');
    setTranscript('');
    connected.current = false;
    try {
      const ai = config();
      const value = await startTalk(
        ai,
        {
          profileId: 'parent',
          level: 'adult',
          mode: 'biz-talk',
          scenarioId: 'biz-free',
          persona: parentPersona(state.settings.parent.talk),
        },
        {
          onState: (s) => {
            if (!alive.current) return;
            setTalkState(s);
            if (s === 'listening' && !connected.current) {
              connected.current = true;
              setMessage('영어로 인사해 보세요. 연결 후 10초에 자동으로 끝나요.');
              void fetchActiveSessions(ai).then((active) => {
                if (alive.current) setSessions(active);
              }).catch(showError);
              timer.current = setTimeout(() => {
                void handle.current?.stop();
              }, 10000);
            }
            if (s === 'ended') {
              clearTimeout(timer.current);
              handle.current = undefined;
              setBusy(false);
              setMessage('음성 테스트가 끝났어요. 소리가 들렸는지 확인해 주세요.');
              void Promise.all([fetchUsage(ai), fetchActiveSessions(ai)])
                .then(([u, active]) => {
                  if (alive.current) {
                    setUsage(u);
                    setSessions(active);
                  }
                })
                .catch(showError);
            }
          },
          onAssistantText: (_, text, done) => {
            if (alive.current) setTranscript((old) => (done ? text : (old + text).slice(-1000)));
          },
          onUserText: () => {},
          onError: showError,
        },
      );
      if (!alive.current) await value.stop();
      else handle.current = value;
    } catch (e) {
      showError(e);
      if (alive.current) setBusy(false);
    }
  };
  return (
    <div className="form">
      <div className="panel form">
        <p className="small muted">Worker 주소와 가족 토큰을 입력하세요. OpenAI 키는 Worker에만 등록해요.</p>
        <label>
          Worker 주소
          <input
            type="url"
            value={endpoint}
            disabled={busy}
            onChange={(e) => {
              setEndpoint(e.target.value);
              setUsage(undefined);
              setSessions(undefined);
            }}
            placeholder="https://study-kt-proxy.example.workers.dev"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <label>
          가족 토큰
          <input
            type="password"
            value={token}
            disabled={busy}
            onChange={(e) => {
              setToken(e.target.value);
              setUsage(undefined);
              setSessions(undefined);
            }}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="row-center">
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            설정 저장
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={() => {
              void refresh();
            }}
          >
            연결 확인 · 사용량 새로고침
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={() => {
              void test();
            }}
          >
            10초 음성 연결 테스트
          </button>
        </div>
        <p className="small muted">음성 테스트는 마이크를 사용하고 보호자 대화 시간에 포함돼요. 헤드셋을 권장해요.</p>
        {busy && (
          <div className="row-center">
            <span role="status">{labels[talkState]}</span>
            {handle.current && (
              <button
                className="btn"
                onClick={() => {
                  void handle.current?.stop();
                }}
              >
                테스트 끝내기
              </button>
            )}
          </div>
        )}
        {message && <p role="status">{message}</p>}
        {error && (
          <p role="alert" className="bad-text">
            {error}
          </p>
        )}
        {transcript && <p lang="en">{transcript}</p>}
      </div>
      <div className="panel form">
        <h2>진행 중인 대화</h2>
        {sessions === undefined ? <p>연결을 확인하면 진행 중인 대화가 보여요.</p> : sessions.length === 0 ? <p>진행 중인 대화 없음</p> : <>
          {sessions.map((session) => <div key={session.sessionId} className="panel">
            <h3>{state.profiles.find((p) => p.id === session.profileId)?.name}</h3>
            <p>시작: {new Date(session.startedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>
            <p>경과 시간: {duration(session.elapsedSeconds)} · 남은 시간: {duration(session.remainingSeconds)}</p>
            <button className="btn" disabled={ending} onClick={() => { void forceEnd(session.profileId); }}>이 대화 끝내기</button>
          </div>)}
          {sessions.length >= 2 && <button className="btn" disabled={ending} onClick={() => { void forceEnd('all'); }}>모두 끝내기</button>}
        </>}
        <p className="small muted">외부 통화 종료에 실패하면 서버가 다시 시도해요. 사용한 시간은 기록돼요.</p>
      </div>
      <div className="panel">
        <h2>AI 사용량</h2>
        <p className="small muted">
          사용량 날짜는 한국 시간 기준이에요. 저장하거나 연결 확인을 누른 주소의 기록을 보여 줘요.
        </p>
        {usage ? (
          <>
            {(['kid1', 'kid2', 'parent'] as const).map((id) => (
              <p key={id}>
                {state.profiles.find((p) => p.id === id)?.name}: 오늘 {duration(usage.today[id].talkSeconds)} · 텍스트
                생성 {usage.today[id].generates}회
              </p>
            ))}
            <p>이번 달 가족 대화: {duration(usage.month.talkSeconds)}</p>
            <p>이번 달 예상 음성 비용: 약 {usage.month.estimatedKrw.toLocaleString('ko-KR')}원</p>
            <p className="small muted">
              설정한 분당 단가로 계산한 추정치예요. 텍스트 생성·입력 음성 전사 비용은 별도예요.
            </p>
          </>
        ) : (
          <p>연결을 확인하면 오늘과 이번 달 사용량이 보여요.</p>
        )}
      </div>
    </div>
  );
}
