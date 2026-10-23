import type { IncomingMessage } from 'node:http';
import { getDb } from './db';
import { hashSessionToken, nowIso } from './security';
import { parseCookies, SESSION_COOKIE } from './http';

export type SessionUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: 'user' | 'admin';
  status: 'active' | 'disabled';
};

const SESSION_TTL_DAYS = 30;

export function createSession(params: {
  userId: string;
  token: string;
  ip: string;
  userAgent: string;
}): { expiresAt: string } {
  const db = getDb();
  const tokenHash = hashSessionToken(params.token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000).toISOString();
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    `ses_${tokenHash.slice(0, 24)}`,
    params.userId,
    tokenHash,
    nowIso(),
    expiresAt,
    params.ip,
    params.userAgent.slice(0, 300),
  );
  return { expiresAt };
}

export function resolveSession(request: IncomingMessage): SessionUser | null {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT s.id AS session_id, s.expires_at, s.revoked_at,
              u.id, u.email, u.display_name, u.role, u.status
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?`,
    )
    .get(hashSessionToken(token)) as
    | {
        session_id: string;
        expires_at: string;
        revoked_at: string | null;
        id: string;
        email: string;
        display_name: string | null;
        role: string;
        status: string;
      }
    | undefined;

  if (!row) return null;
  if (row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  if (row.status !== 'active') return null;

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role === 'admin' ? 'admin' : 'user',
    status: 'active',
  };
}

export function revokeCurrentSession(request: IncomingMessage): void {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return;
  getDb()
    .prepare(`UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL`)
    .run(nowIso(), hashSessionToken(token));
}

export function revokeAllSessions(userId: string): void {
  getDb()
    .prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
    .run(nowIso(), userId);
}

export function sessionCookieMaxAge(): number {
  return SESSION_TTL_DAYS * 86400;
}
