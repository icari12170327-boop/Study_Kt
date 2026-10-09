import type { GenerateRequest, SessionRequest } from '../../shared/ai';
import type { Env } from './env';
import { generateText, hangup, openCall, ProxyError } from './openai';
import {
  chargeSession,
  abandonHangup,
  hangupDeadline,
  dateKeys,
  emptyLedger,
  elapsedSeconds,
  pruneLedger,
  remainingSeconds,
  setting,
  todayUsage,
  type Ledger,
} from './usage';

// 가족의 요청과 상태 변경을 직렬화해 KV의 동시 갱신 손실을 막는다.
export class FamilyUsage {
  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {}
  private async save(ledger: Ledger): Promise<void> {
    pruneLedger(ledger, Date.now());
    await this.state.storage.put('ledger', ledger);
    const active = Object.values(ledger.sessions).filter((s) => !s.ended);
    // 같은 KV 키는 초당 한 번만 쓰고 중간 갱신은 다음 알람에서 합친다.
    const mirror = (await this.state.storage.get<Record<string, { value: string; at: number }>>('mirror')) ?? {};
    const desired: Record<string, string> = {};
    for (const [day, usage] of Object.entries(ledger.days)) {
      if (day < dateKeys(Date.now() - 86400000).day) continue;
      for (const [profile, record] of Object.entries(usage))
        desired[`usage:${day}:${profile}`] = JSON.stringify(record);
    }
    for (const [month, seconds] of Object.entries(ledger.months))
      desired[`month:${month}`] = JSON.stringify({ talkSeconds: seconds });
    for (const profile of ['kid1', 'kid2', 'parent'])
      desired[`active:${profile}`] = JSON.stringify(active.find((s) => s.profileId === profile) ?? null);
    let mirrorDue = Infinity;
    for (const [key, value] of Object.entries(desired)) {
      const previous = mirror[key];
      if (previous?.value === value) continue;
      if (previous && Date.now() - previous.at < 1000) {
        mirrorDue = Math.min(mirrorDue, previous.at + 1000);
        continue;
      }
      try {
        if (value === 'null') await this.env.USAGE.delete(key);
        else {
          const session = active.find((s) => key === `active:${s.profileId}`);
          const ttl = session
            ? Math.max(60, Math.ceil((session.start + session.remaining * 1000 - Date.now()) / 1000) + 120)
            : key.startsWith('month:')
              ? 405 * 86400
              : 95 * 86400;
          await this.env.USAGE.put(key, value, { expirationTtl: ttl });
        }
        mirror[key] = { value, at: Date.now() };
      } catch {
        mirrorDue = Math.min(mirrorDue, Date.now() + 2000);
      }
    }
    await this.state.storage.put(
      'mirror',
      Object.fromEntries(Object.entries(mirror).filter(([, record]) => record.at >= Date.now() - 405 * 86400000)),
    );
    const deadlines = Object.values(ledger.sessions)
      .filter((s) => !s.ended || s.needsHangup)
      .map((s) =>
        s.needsHangup
          ? Math.max(Date.now() + 1000, Math.min(s.nextHangupAt ?? Date.now() + 5000, hangupDeadline(s)))
          : this.closing.has(s.id)
          ? Date.now() + 5000
          : Math.max(Date.now() + 1000, s.start + s.remaining * 1000),
      );
    await this.state.storage.setAlarm(Math.min(mirrorDue, ...(deadlines.length ? deadlines : [Date.now() + 86400000])));
  }

  private closing = new Map<string, Promise<number>>();

  // blockConcurrencyWhile 안에서 예외가 나면 Durable Object가 초기화되고 호출 전체가 502로 바뀐다.
  // 그래서 콜백 안에서는 예외를 결과로 감싸 돌려주고, 잠금 밖에서 다시 던진다(busy, limit 등이 그대로 전달됨).
  private async snapshot<T>(read: (ledger: Ledger) => T): Promise<T> {
    const outcome = await this.state.blockConcurrencyWhile(async () => {
      try {
        return { ok: true as const, value: read((await this.state.storage.get<Ledger>('ledger')) ?? emptyLedger()) };
      } catch (error) {
        return { ok: false as const, error };
      }
    });
    if (!outcome.ok) throw outcome.error;
    return outcome.value;
  }
  private async update<T>(change: (ledger: Ledger) => T): Promise<T> {
    const outcome = await this.state.blockConcurrencyWhile(async () => {
      try {
        const ledger = (await this.state.storage.get<Ledger>('ledger')) ?? emptyLedger();
        const value = change(ledger);
        await this.save(ledger);
        return { ok: true as const, value };
      } catch (error) {
        // 저장 오류도 잠금 밖으로 전달해 객체가 초기화되지 않게 한다.
        return { ok: false as const, error };
      }
    });
    if (!outcome.ok) throw outcome.error;
    return outcome.value;
  }
  private async closeOnce(id: string): Promise<number> {
    for (;;) {
      const snapshot = await this.update((ledger) => {
        const current = ledger.sessions[id];
        if (!current) throw new ProxyError('invalid', 400);
        if (!current.ended) {
          // 외부 종료 실패와 무관하게 사용 시간을 먼저 확정하고 다음 대화를 허용한다.
          chargeSession(ledger, current, Date.now());
          current.needsHangup = !!current.callId;
        }
        const failures = current.hangupFailures ?? 0;
        if (abandonHangup(current, Date.now())) console.error('hangup retry limit', failures);
        return { ...current };
      });
      if (snapshot.ended && (!snapshot.needsHangup || (snapshot.nextHangupAt ?? 0) > Date.now())) return snapshot.charged ?? 0;
      // OpenAI를 기다리는 동안 다른 프로필·사용량 조회·알람의 저장 잠금을 막지 않는다.
      if (snapshot.callId) {
        try {
          await hangup(this.env, snapshot.callId);
        } catch {
          await this.update((ledger) => {
            const current = ledger.sessions[id];
            if (!current?.ended || !current.needsHangup) return;
            current.hangupFailures = (current.hangupFailures ?? 0) + 1;
            const failures = current.hangupFailures;
            if (abandonHangup(current, Date.now())) {
              // 실패 횟수만 기록하고 통화 정보나 외부 응답 본문은 남기지 않는다.
              console.error('hangup retry limit', failures);
              return;
            }
            // 계속 실패할 때 호출 비용을 줄이도록 5초 → 1분 → 최대 10분으로 늦춘다.
            const delay = current.hangupFailures === 1 ? 5000 : current.hangupFailures === 2 ? 60000 : 600000;
            current.nextHangupAt = Math.min(Date.now() + delay, hangupDeadline(current));
          });
          return snapshot.charged ?? 0;
        }
      }
      const charged = await this.update((ledger) => {
        const current = ledger.sessions[id];
        if (!current) throw new ProxyError('invalid', 400);
        // 연결 응답이 늦게 도착했다면 새 call ID를 다음 반복에서 종료한다.
        if (current.callId !== snapshot.callId) return;
        chargeSession(ledger, current, Date.now());
        current.needsHangup = false;
        delete current.hangupFailures;
        delete current.nextHangupAt;
        return current.charged ?? 0;
      });
      if (charged !== undefined) return charged;
    }
  }
  private async closeSession(id: string): Promise<number> {
    let job = this.closing.get(id);
    if (!job) {
      job = this.closeOnce(id).finally(() => this.closing.delete(id));
      this.closing.set(id, job);
    }
    const seconds = await job;
    // 종료 직후 연결 응답이 도착한 경쟁 상황도 같은 종료 경로로 정리한다.
    if (await this.snapshot((ledger) => {
      const session = ledger.sessions[id];
      return session?.needsHangup && session.nextHangupAt === undefined;
    })) return this.closeSession(id);
    return seconds;
  }
  private async expire(): Promise<void> {
    const ids = await this.snapshot((ledger) =>
      Object.values(ledger.sessions)
        .filter(
          (session) =>
            (session.needsHangup && !this.closing.has(session.id) && Date.now() >= Math.min(session.nextHangupAt ?? 0, hangupDeadline(session))) || (!session.ended && Date.now() >= session.start + session.remaining * 1000),
        )
        .map((session) => session.id),
    );
    await Promise.all(ids.map(async (id) => {
      try {
        await this.closeSession(id);
      } catch (error) {
        // 강제 종료 후 남은 외부 정리 실패는 새 대화를 막지 않고 알람에 맡긴다.
        if (!(await this.snapshot((ledger) => ledger.sessions[id]?.ended))) throw error;
      }
    }));
  }
  private async endActive(profileId: SessionRequest['profileId'] | 'all'): Promise<Response> {
    const closed = await this.update((ledger) => {
      const sessions = Object.values(ledger.sessions).filter((s) => !s.ended && (profileId === 'all' || s.profileId === profileId));
      return sessions.map((session) => {
        // 외부 종료를 기다리기 전에 서버 경과 시간을 한 번만 기록하고 busy를 해제한다.
        chargeSession(ledger, session, Date.now());
        session.needsHangup = !!session.callId;
        return { id: session.id, seconds: session.charged ?? 0 };
      });
    });
    await Promise.all(closed.map(async ({ id }) => {
      try {
        await this.closeSession(id);
      } catch {
        // needsHangup과 점진적 대기 알람은 이미 저장돼 있다.
      }
    }));
    return Response.json({ ok: true, closed: closed.length, chargedSeconds: closed.reduce((sum, s) => sum + s.seconds, 0) });
  }
  async alarm(): Promise<void> {
    try {
      await this.expire();
      await this.update(() => {});
    } catch {
      await this.state.storage.setAlarm(Date.now() + 5000);
    }
  }
  private async startSession(req: SessionRequest): Promise<Response> {
    const reservation = await this.update((ledger) => {
      const now = Date.now();
      const { day, month } = dateKeys(now);
      const remaining = remainingSeconds(ledger, this.env, req.profileId, now);
      if (!remaining) throw new ProxyError('limit', 429);
      if (Object.values(ledger.sessions).some((s) => !s.ended && s.profileId === req.profileId))
        throw new ProxyError('busy', 409);
      const id = crypto.randomUUID();
      const session = { id, profileId: req.profileId, start: now, day, month, remaining };
      ledger.sessions[id] = session;
      todayUsage(ledger, day)[req.profileId].sessionId = id;
      todayUsage(ledger, day)[req.profileId].startedAt = now;
      return session;
    });
    let call: Awaited<ReturnType<typeof openCall>>;
    try {
      call = await openCall(this.env, req, reservation.remaining);
    } catch (error) {
      await this.update((ledger) => {
        const current = ledger.sessions[reservation.id];
        if (current && !current.ended && !current.callId) delete ledger.sessions[reservation.id];
      });
      throw error;
    }
    let remaining: number;
    try {
      remaining = await this.update((ledger) => {
        // 기존 종료 기록이 먼저 저장돼 있어도 늦게 생성된 통화 ID의 정리를 예약한다.
        const current = (ledger.sessions[reservation.id] ??= { ...reservation, ended: true, charged: 0 });
        current.callId = call.callId;
        const seconds = Math.max(0, current.remaining - Math.ceil((Date.now() - current.start) / 1000));
        if (current.ended || !seconds) {
          current.needsHangup = true;
          return 0;
        }
        return seconds;
      });
    } catch (error) {
      // 통화 ID를 저장하지 못했으면 응답을 보내지 않고 외부 통화를 즉시 정리한다.
      await hangup(this.env, call.callId);
      throw error;
    }
    if (!remaining) {
      await this.closeSession(reservation.id);
      throw new ProxyError('limit', 429);
    }
    return Response.json({ sessionId: reservation.id, answerSdp: call.answerSdp, remainingSeconds: remaining });
  }
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    try {
      if (path === '/api/realtime/active') {
        const sessions = await this.snapshot((ledger) => Object.values(ledger.sessions).filter((s) => !s.ended).map((s) => ({
          profileId: s.profileId,
          sessionId: s.id,
          startedAt: s.start,
          elapsedSeconds: elapsedSeconds(s, Date.now()),
          remainingSeconds: Math.max(0, s.remaining - Math.ceil((Date.now() - s.start) / 1000)),
        })));
        return Response.json({ sessions });
      }
      if (path === '/api/realtime/end-active') {
        const { profileId } = await request.json() as { profileId: SessionRequest['profileId'] | 'all' };
        return await this.endActive(profileId);
      }
      if (path === '/api/generate') {
        const req = (await request.json()) as GenerateRequest;
        const reserved = await this.update((ledger) => {
          const today = todayUsage(ledger, dateKeys(Date.now()).day);
          if (
            Object.values(today).reduce((sum, u) => sum + u.generates, 0) >=
            setting(this.env.GENERATE_LIMIT_DAY_TOTAL, 200)
          )
            return false;
          // 실패한 호출도 비용이 발생할 수 있어 요청을 먼저 센다.
          today[req.profileId].generates++;
          return true;
        });
        if (!reserved) throw new ProxyError('limit', 429);
        return Response.json({ ok: true, data: await generateText(this.env, req) });
      }
      await this.expire();
      if (path === '/api/usage') {
        return this.update((ledger) => {
          const now = Date.now();
          const { day, month } = dateKeys(now);
          const today = Object.fromEntries(
            Object.entries(todayUsage(ledger, day)).map(([id, record]) => [
              id,
              { talkSeconds: record.talkSeconds, generates: record.generates },
            ]),
          ) as ReturnType<typeof todayUsage>;
          let monthSeconds = ledger.months[month] ?? 0;
          for (const s of Object.values(ledger.sessions).filter((s) => !s.ended)) {
            const seconds = Math.min(s.remaining, Math.max(0, Math.floor((now - s.start) / 1000)));
            if (s.day === day) today[s.profileId].talkSeconds += seconds;
            if (s.month === month) monthSeconds += seconds;
          }
          return Response.json({
            today,
            remainingSeconds: Object.fromEntries((['kid1', 'kid2', 'parent'] as const).map((id) => [id, remainingSeconds(ledger, this.env, id, now)])),
            month: {
              talkSeconds: monthSeconds,
              estimatedKrw: Math.round((monthSeconds / 60) * setting(this.env.KRW_PER_TALK_MINUTE, 15)),
            },
          });
        });
      }
      const input = await request.json();
      if (path === '/api/realtime/session') return await this.startSession(input as SessionRequest);
      if (path === '/api/realtime/end') {
        const { sessionId } = input as { sessionId: string };
        return Response.json({ ok: true, seconds: await this.closeSession(sessionId) });
      }
      throw new ProxyError('invalid', 404);
    } catch (error) {
      // 외부 응답·자막·비밀값은 오류 응답이나 로그로 내보내지 않는다.
      return Response.json(
        { ok: false, error: error instanceof ProxyError ? error.code : 'server' },
        { status: error instanceof ProxyError ? error.status : 502 },
      );
    }
  }
}
