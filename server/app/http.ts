import type { IncomingMessage, ServerResponse } from 'node:http';

export type JsonValue = unknown;

export const MAX_JSON_BODY_BYTES = 64 * 1024;

export function sendJson(response: ServerResponse, status: number, payload: JsonValue) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body).toString(),
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

export function sendError(response: ServerResponse, status: number, message: string) {
  sendJson(response, status, { ok: false, error: message });
}

export async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > MAX_JSON_BODY_BYTES) {
      throw new Error('BODY_TOO_LARGE');
    }
    chunks.push(buf);
  }
  if (!size) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) return {};
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('BODY_NOT_OBJECT');
  }
  return parsed as Record<string, unknown>;
}

function isLoopback(address: string | undefined): boolean {
  if (!address) return false;
  return address === '::1' || address === '127.0.0.1' || address.startsWith('127.');
}

/**
 * 取客户端 IP。
 *
 * 只有当直连方是本机（反向代理）时才相信 X-Real-IP，
 * 否则任何人都能伪造请求头来绕过登录限流与审计。
 */
export function getClientIp(request: IncomingMessage): string {
  const socketAddress = request.socket.remoteAddress ?? '';
  const forwarded = request.headers['x-real-ip'];
  if (isLoopback(socketAddress) && typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.trim();
  }
  return socketAddress.replace(/^::ffff:/, '');
}

export function isHttps(request: IncomingMessage): boolean {
  const proto = request.headers['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.split(',')[0]?.trim() === 'https') return true;
  return Boolean((request.socket as { encrypted?: boolean }).encrypted);
}

export function parseCookies(request: IncomingMessage): Record<string, string> {
  const header = request.headers.cookie;
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    out[name] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

export const SESSION_COOKIE = 'my_sess';

export function buildSessionCookie(
  token: string,
  options: { maxAgeSeconds: number; secure: boolean },
): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${options.maxAgeSeconds}`,
  ];
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

export function buildLogoutCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** 简易滑动窗口限流：单进程内存足够，重启即清空（可接受）。 */
const buckets = new Map<string, number[]>();

export function hitRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const stamps = (buckets.get(key) ?? []).filter((time) => now - time < windowMs);
  stamps.push(now);
  buckets.set(key, stamps);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k);
    }
  }
  return stamps.length > limit;
}
