import type { IncomingMessage, ServerResponse } from 'node:http';
import { getDb } from './db';
import {
  buildLogoutCookie,
  buildSessionCookie,
  getClientIp,
  hitRateLimit,
  isHttps,
  readJsonBody,
  sendError,
  sendJson,
} from './http';
import {
  createSessionToken,
  describePasswordProblem,
  hashPassword,
  newId,
  normalizeEmail,
  nowIso,
  verifyPassword,
} from './security';
import { createSession, resolveSession, revokeAllSessions, revokeCurrentSession, sessionCookieMaxAge } from './session';

type AuthContext = {
  user: ReturnType<typeof resolveSession>;
};

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  password_hash: string;
  role: string;
  status: string;
};

const AUTH_PREFIX = '/api/app/auth/';

export function isAuthRoute(pathname: string): boolean {
  return pathname.startsWith(AUTH_PREFIX);
}

type PublicUserSource = {
  id: string;
  email: string;
  role: string;
  display_name?: string | null;
  displayName?: string | null;
};

function publicUser(row: PublicUserSource) {
  const displayName = row.display_name ?? row.displayName ?? null;
  return {
    id: row.id,
    email: row.email,
    displayName,
    role: row.role === 'admin' ? ('admin' as const) : ('user' as const),
  };
}

function startSession(
  request: IncomingMessage,
  response: ServerResponse,
  userId: string,
): { expiresAt: string } {
  const token = createSessionToken();
  const { expiresAt } = createSession({
    userId,
    token,
    ip: getClientIp(request),
    userAgent: String(request.headers['user-agent'] ?? ''),
  });
  response.setHeader(
    'Set-Cookie',
    buildSessionCookie(token, { maxAgeSeconds: sessionCookieMaxAge(), secure: isHttps(request) }),
  );
  return { expiresAt };
}

export async function handleAuthRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: AuthContext,
): Promise<boolean> {
  const route = url.pathname.slice(AUTH_PREFIX.length);
  const method = request.method ?? 'GET';
  const ip = getClientIp(request);

  if (route === 'me' && method === 'GET') {
    if (!context.user) {
      sendJson(response, 200, { ok: true, user: null });
      return true;
    }
    sendJson(response, 200, { ok: true, user: publicUser(context.user) });
    return true;
  }

  if (route === 'register' && method === 'POST') {
    if (hitRateLimit(`register:${ip}`, 10, 10 * 60_000)) {
      sendError(response, 429, '注册过于频繁，请稍后再试。');
      return true;
    }
    const body = await safeBody(request, response);
    if (!body) return true;
    const email = normalizeEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email) {
      sendError(response, 400, '邮箱格式不正确。');
      return true;
    }
    const problem = describePasswordProblem(password);
    if (problem) {
      sendError(response, 400, problem);
      return true;
    }
    const db = getDb();
    const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email) as
      | { id: string }
      | undefined;
    if (existing) {
      sendError(response, 409, '该邮箱已注册，请直接登录。');
      return true;
    }
    const bootstrapAdmin = (process.env.MINGYU_BOOTSTRAP_ADMIN_EMAIL ?? '').trim().toLowerCase();
    const role = bootstrapAdmin && bootstrapAdmin === email ? 'admin' : 'user';
    const id = newId('usr');
    const now = nowIso();
    db.prepare(
      `INSERT INTO users (id, email, display_name, password_hash, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
    ).run(
      id,
      email,
      typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 40) || null : null,
      await hashPassword(password),
      role,
      now,
      now,
    );
    db.prepare(`INSERT INTO balances (user_id, credits, updated_at) VALUES (?, 0, ?)`).run(id, now);
    startSession(request, response, id);
    const displayName =
      typeof body.displayName === 'string' && body.displayName.trim()
        ? body.displayName.trim().slice(0, 40)
        : null;
    sendJson(response, 201, {
      ok: true,
      user: { id, email, displayName, role },
    });
    return true;
  }

  if (route === 'login' && method === 'POST') {
    const body = await safeBody(request, response);
    if (!body) return true;
    const email = normalizeEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) {
      sendError(response, 400, '请填写邮箱与密码。');
      return true;
    }
    if (hitRateLimit(`login:${ip}:${email}`, 8, 10 * 60_000)) {
      sendError(response, 429, '尝试过多，请 10 分钟后再试。');
      return true;
    }
    const db = getDb();
    const row = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as UserRow | undefined;
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      sendError(response, 401, '邮箱或密码不正确。');
      return true;
    }
    if (row.status !== 'active') {
      sendError(response, 403, '账号已被停用，请联系管理员。');
      return true;
    }
    startSession(request, response, row.id);
    sendJson(response, 200, { ok: true, user: publicUser(row) });
    return true;
  }

  if (route === 'logout' && method === 'POST') {
    revokeCurrentSession(request);
    response.setHeader('Set-Cookie', buildLogoutCookie());
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (route === 'password' && method === 'POST') {
    if (!context.user) {
      sendError(response, 401, '请先登录。');
      return true;
    }
    const body = await safeBody(request, response);
    if (!body) return true;
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    const problem = describePasswordProblem(newPassword);
    if (problem) {
      sendError(response, 400, problem);
      return true;
    }
    const db = getDb();
    const row = db
      .prepare(`SELECT * FROM users WHERE id = ?`)
      .get(context.user.id) as UserRow | undefined;
    if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
      sendError(response, 401, '当前密码不正确。');
      return true;
    }
    db.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).run(
      await hashPassword(newPassword),
      nowIso(),
      row.id,
    );
    // 改密后所有会话失效（含当前），前端需要重新登录
    revokeAllSessions(row.id);
    response.setHeader('Set-Cookie', buildLogoutCookie());
    sendJson(response, 200, { ok: true });
    return true;
  }

  sendError(response, 404, '接口不存在。');
  return true;
}

async function safeBody(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<Record<string, unknown> | null> {
  try {
    return await readJsonBody(request);
  } catch (error) {
    const message =
      error instanceof Error && error.message === 'BODY_TOO_LARGE'
        ? '请求体过大。'
        : '请求格式不正确。';
    sendError(response, 400, message);
    return null;
  }
}
