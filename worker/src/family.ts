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
    await this.state.storage.setAlarm(
      Math.min(
        mirrorDue,
        active.length ? Math.min(...active.map((s) => s.start + s.remaining * 1000)) : Date.now() + 86400000,
      ),
    );
  }

  private async expire(ledger: Ledger): Promise<void> {
    for (const session of Object.values(ledger.sessions)) {
      if (session.ended || Date.now() < session.start + session.remaining * 1000) continue;
      if (session.callId) await hangup(this.env, session.callId);
      chargeSession(ledger, session, Date.now());
    }
  }
  async alarm(): Promise<void> {
    await this.state.blockConcurrencyWhile(async () => {
      const ledger = (await this.state.storage.get<Ledger>('ledger')) ?? emptyLedger();
      try {
        await this.expire(ledger);
        await this.save(ledger);
      } catch {
        await this.state.storage.setAlarm(Date.now() + 5000);
      }
    });
  }
  async fetch(request: Request): Promise<Response> {
    // 텍스트 모델을 기다리는 동안 종료 알람이 막히지 않게 예약만 직렬화한다.
    if (new URL(request.url).pathname === '/api/generate') {
      const req = (await request.json()) as GenerateRequest;
      const reservation = await this.state.blockConcurrencyWhile(async () => {
        const ledger = (await this.state.storage.get<Ledger>('ledger')) ?? emptyLedger();
        const today = todayUsage(ledger, dateKeys(Date.now()).day);
        if (
          Object.values(today).reduce((sum, u) => sum + u.generates, 0) >=
          setting(this.env.GENERATE_LIMIT_DAY_TOTAL, 200)
        )
          return false;
        // 실패한 호출도 비용이 발생할 수 있어 요청을 먼저 센다.
        today[req.profileId].generates++;
        await this.save(ledger);
        return true;
      });
      if (!reservation) return Response.json({ ok: false, error: 'limit' }, { status: 429 });
      try {
        return Response.json({ ok: true, data: await generateText(this.env, req) });
      } catch (error) {
        return Response.json(
          { ok: false, error: error instanceof ProxyError ? error.code : 'server' },
          { status: error instanceof ProxyError ? error.status : 502 },
        );
      }
    }
    return this.state.blockConcurrencyWhile(async () => {
      const ledger = (await this.state.storage.get<Ledger>('ledger')) ?? emptyLedger();
      const path = new URL(request.url).pathname;
      try {
        await this.expire(ledger);
        const now = Date.now();
        const { day, month } = dateKeys(now);
        if (path === '/api/usage') {
          // 진행 중인 시간도 화면에 포함한다. 저장된 확정 사용량은 종료 때 더한다.
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
          await this.save(ledger);
          return Response.json({
            today,
            month: {
              talkSeconds: monthSeconds,
              estimatedKrw: Math.round((monthSeconds / 60) * setting(this.env.KRW_PER_TALK_MINUTE, 15)),
            },
          });
        }
        const input = await request.json();
        if (path === '/api/realtime/session') {
          const req = input as SessionRequest;
          const remaining = remainingSeconds(ledger, this.env, req.profileId, now);
          if (!remaining) throw new ProxyError('limit', 429);
          if (Object.values(ledger.sessions).some((s) => !s.ended && s.profileId === req.profileId))
            throw new ProxyError('busy', 409);
          const id = crypto.randomUUID();
          const session = { id, profileId: req.profileId, start: now, day, month, remaining };
          ledger.sessions[id] = session;
          todayUsage(ledger, day)[req.profileId].sessionId = id;
          todayUsage(ledger, day)[req.profileId].startedAt = now;
          await this.save(ledger);
          try {
            const call = await openCall(this.env, req, remaining);
            ledger.sessions[id].callId = call.callId;
            await this.save(ledger);
            const remainingForClient = Math.max(0, remaining - Math.ceil((Date.now() - now) / 1000));
            if (!remainingForClient) {
              await hangup(this.env, call.callId);
              chargeSession(ledger, ledger.sessions[id], Date.now());
              await this.save(ledger);
              throw new ProxyError('limit', 429);
            }
            return Response.json({
              sessionId: id,
              answerSdp: call.answerSdp,
              remainingSeconds: remainingForClient,
            });
          } catch (error) {
            if (ledger.sessions[id].callId && !ledger.sessions[id].ended) {
              try {
                await hangup(this.env, ledger.sessions[id].callId!);
              } catch {
                throw error;
              }
            }
            delete ledger.sessions[id];
            await this.save(ledger);
            throw error;
          }
        }
        if (path === '/api/realtime/end') {
          const { sessionId } = input as { sessionId: string; seconds: number };
          const session = ledger.sessions[sessionId];
          if (!session) throw new ProxyError('invalid', 400);
          if (!session.ended) {
            if (session.callId) await hangup(this.env, session.callId);
            chargeSession(ledger, session, Date.now());
          }
          await this.save(ledger);
          return Response.json({ ok: true, seconds: session.charged });
        }
        throw new ProxyError('invalid', 404);
      } catch (error) {
        if (error instanceof ProxyError)
          return Response.json({ ok: false, error: error.code }, { status: error.status });
        // 외부 응답·자막·비밀값은 오류 응답이나 로그로 내보내지 않는다.
        return Response.json({ ok: false, error: 'server' }, { status: 502 });
      }
    });
  }
}
