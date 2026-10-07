import type { GenerateRequest, SessionRequest } from '../../shared/ai';
import type { Env } from './env';
import { generateText, hangup, openCall, ProxyError } from './openai';
import {
  chargeSession,
  dateKeys,
  emptyLedger,
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
        s.needsHangup || this.closing.has(s.id)
          ? Date.now() + 5000
          : Math.max(Date.now() + 1000, s.start + s.remaining * 1000),
      );
    await this.state.storage.setAlarm(Math.min(mirrorDue, ...(deadlines.length ? deadlines : [Date.now() + 86400000])));
  }

  private closing = new Map<string, Promise<number>>();

  private async snapshot<T>(read: (ledger: Ledger) => T): Promise<T> {
    return this.state.blockConcurrencyWhile(async () =>
      read((await this.state.storage.get<Ledger>('ledger')) ?? emptyLedger()),
    );
  }
  private async update<T>(change: (ledger: Ledger) => T): Promise<T> {
    return this.state.blockConcurrencyWhile(async () => {
      const ledger = (await this.state.storage.get<Ledger>('ledger')) ?? emptyLedger();
      const result = change(ledger);
      await this.save(ledger);
      return result;
    });
  }
  private async closeOnce(id: string): Promise<number> {
    for (;;) {
      const snapshot = await this.snapshot((ledger) => ledger.sessions[id]);
      if (!snapshot) throw new ProxyError('invalid', 400);
      if (snapshot.ended && !snapshot.needsHangup) return snapshot.charged ?? 0;
      // OpenAI를 기다리는 동안 다른 프로필·사용량 조회·알람의 저장 잠금을 막지 않는다.
      if (snapshot.callId) await hangup(this.env, snapshot.callId);
      const charged = await this.update((ledger) => {
        const current = ledger.sessions[id];
        if (!current) throw new ProxyError('invalid', 400);
        // 연결 응답이 늦게 도착했다면 새 call ID를 다음 반복에서 종료한다.
        if (current.callId !== snapshot.callId) return;
        chargeSession(ledger, current, Date.now());
        current.needsHangup = false;
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
    if (await this.snapshot((ledger) => ledger.sessions[id]?.needsHangup)) return this.closeSession(id);
    return seconds;
  }
  private async expire(): Promise<void> {
    const ids = await this.snapshot((ledger) =>
      Object.values(ledger.sessions)
        .filter(
          (session) =>
            session.needsHangup || (!session.ended && Date.now() >= session.start + session.remaining * 1000),
        )
        .map((session) => session.id),
    );
    await Promise.all(ids.map((id) => this.closeSession(id)));
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
