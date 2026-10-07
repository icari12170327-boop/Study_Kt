import type { Env } from './env';
import { endActiveSchema, endSchema, generateSchema, inputSchemas, sessionSchema } from './validation';
export { FamilyUsage } from './family';
// 입력 길이와 무관하게 같은 길이의 SHA-256 결과를 비교한다.
export async function authenticated(header: string | null, token: string): Promise<boolean> {
  if (!token || token.length < 32 || !header?.startsWith('Bearer ') || header.length > 4096) return false;
  const encode = new TextEncoder();
  const [a, b] = await Promise.all(
    [header.slice(7), token].map(async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', encode.encode(s)))),
  );
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const allowed = env.ALLOWED_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!origin || !allowed.includes(origin)) return Response.json({ error: 'unauthorized' }, { status: 403 });
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      Vary: 'Origin',
      'Cache-Control': 'no-store',
    };
    const json = (error: string, status: number) => Response.json({ ok: false, error }, { status, headers: cors });
    if (request.method === 'OPTIONS') {
      if (
        !['GET', 'POST'].includes(request.headers.get('Access-Control-Request-Method') ?? '') ||
        (request.headers.get('Access-Control-Request-Headers') ?? '')
          .split(',')
          .some((h) => h.trim() && !['authorization', 'content-type'].includes(h.trim().toLowerCase()))
      )
        return json('invalid', 400);
      return new Response(null, { status: 204, headers: cors });
    }
    if (!(await authenticated(request.headers.get('Authorization'), env.FAMILY_TOKEN)))
      return json('unauthorized', 401);
    const path = new URL(request.url).pathname;
    if (!['/api/usage', '/api/realtime/active', '/api/realtime/end-active', '/api/realtime/session', '/api/realtime/end', '/api/generate'].includes(path))
      return json('invalid', 404);
    if (request.method !== (['/api/usage', '/api/realtime/active'].includes(path) ? 'GET' : 'POST')) return json('invalid', 405);
    let body: unknown;
    if (request.method === 'POST') {
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json('invalid', 400);
      try {
        // 스트림을 읽으며 상한을 검사해 Content-Length 생략으로 우회하지 못하게 한다.
        const reader = request.body?.getReader();
        if (!reader) return json('invalid', 400);
        let size = 0;
        const chunks: Uint8Array[] = [];
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 128000) {
            await reader.cancel();
            return json('invalid', 400);
          }
          chunks.push(value);
        }
        body = JSON.parse(await new Blob(chunks as BlobPart[]).text());
        if (path === '/api/realtime/session') body = sessionSchema.parse(body);
        else if (path === '/api/realtime/end') body = endSchema.parse(body);
        else if (path === '/api/realtime/end-active') body = endActiveSchema.parse(body);
        else {
          const parsed = generateSchema.parse(body);
          body = { ...parsed, input: inputSchemas[parsed.kind].parse(parsed.input) };
        }
      } catch {
        return json('invalid', 400);
      }
    }
    if (!env.OPENAI_API_KEY) return json('server', 503);
    try {
      const response = await env.FAMILY.get(env.FAMILY.idFromName('family')).fetch(
        new Request(`https://family${path}`, {
          method: request.method,
          ...(body === undefined
            ? {}
            : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
        }),
      );
      const headers = new Headers(response.headers);
      Object.entries(cors).forEach(([key, value]) => headers.set(key, value));
      return new Response(response.body, { status: response.status, headers });
    } catch {
      return json('server', 502);
    }
  },
};
