import { randomInt } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { listAudit, recordAudit } from './audit';
import { listProducts, upsertProduct } from './billing';
import { getDb, withTransaction } from './db';
import { readJsonBody, sendError, sendJson } from './http';
import { describePasswordProblem, hashPassword, newId, nowIso } from './security';
import type { SessionUser } from './session';
import { getAdminAiConfigView, saveAdminAiConfig, testAdminAiConnection } from './settings';

/**
 * 管理后台 API。
 *
 * 两条硬规则：
 * 1. 非 admin 一律 **404**（不是 403）——不暴露"这里有个后台"。
 * 2. 所有写操作都进 audit_log，管理员的每次改动都可追溯。
 */

const ADMIN_PREFIX = '/api/app/admin/';

export function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith(ADMIN_PREFIX);
}

const CDK_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCdk(): string {
  let raw = '';
  for (let i = 0; i < 12; i += 1) raw += CDK_ALPHABET[randomInt(CDK_ALPHABET.length)];
  return raw.replace(/(.{4})(?=.)/g, '$1-');
}

type Ctx = { user: SessionUser | null };

export async function handleAdminRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  context: Ctx,
): Promise<boolean> {
  if (!context.user || context.user.role !== 'admin') {
    // 与不存在的接口保持同一响应，避免探测
    sendError(response, 404, '接口不存在。');
    return true;
  }
  const admin = context.user;
  const route = url.pathname.slice(ADMIN_PREFIX.length);
  const method = request.method ?? 'GET';
  const db = getDb();

  if (route === 'overview' && method === 'GET') {
    const users = (db.prepare(`SELECT count(*) AS n FROM users`).get() as { n: number }).n;
    const activeUsers = (
      db.prepare(`SELECT count(*) AS n FROM users WHERE status = 'active'`).get() as { n: number }
    ).n;
    const paidOrders = (
      db.prepare(`SELECT count(*) AS n FROM orders WHERE status = 'paid'`).get() as { n: number }
    ).n;
    const revenue = (
      db
        .prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS s FROM orders WHERE status = 'paid'`)
        .get() as { s: number }
    ).s;
    const activeEntitlements = (
      db
        .prepare(
          `SELECT count(*) AS n FROM entitlements
            WHERE quota > 0 AND (expires_at IS NULL OR expires_at > ?)`,
        )
        .get(nowIso()) as { n: number }
    ).n;
    const cdkUsed = (
      db.prepare(`SELECT COALESCE(SUM(used_count), 0) AS n FROM cdk_codes`).get() as { n: number }
    ).n;
    const cdkTotal = (db.prepare(`SELECT count(*) AS n FROM cdk_codes`).get() as { n: number }).n;
    sendJson(response, 200, {
      ok: true,
      overview: { users, activeUsers, paidOrders, revenueCents: revenue, activeEntitlements, cdkUsed, cdkTotal },
    });
    return true;
  }

  if (route === 'users' && method === 'GET') {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const limit = Math.min(200, Number(url.searchParams.get('limit') ?? 50) || 50);
    const now = nowIso();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartIso = todayStart.toISOString();
    const rows = db
      .prepare(
        `SELECT u.id, u.email, u.display_name, u.role, u.status, u.created_at,
                COALESCE(b.credits, 0) AS credits,
                (SELECT count(*) FROM entitlements e WHERE e.user_id = u.id
                   AND e.quota > 0 AND (e.expires_at IS NULL OR e.expires_at > ?)) AS entitlements,
                (SELECT COALESCE(SUM(amount_cents), 0) FROM orders o
                   WHERE o.user_id = u.id AND o.status = 'paid') AS spent,
                (SELECT count(*) FROM ai_usage a
                   WHERE a.identity = ('usr:' || u.id) AND a.kind = 'ai.analyze' AND a.created_at >= ?) AS used_today,
                (SELECT count(*) FROM entitlements e
                   WHERE e.user_id = u.id AND e.kind = 'membership' AND e.quota > 0 AND e.expires_at IS NULL) AS lifetime_memberships,
                (SELECT MAX(e.expires_at) FROM entitlements e
                   WHERE e.user_id = u.id AND e.kind = 'membership' AND e.quota > 0 AND e.expires_at > ?) AS member_expires_at
           FROM users u LEFT JOIN balances b ON b.user_id = u.id
          WHERE (? = '' OR lower(u.email) LIKE ? OR lower(COALESCE(u.display_name, '')) LIKE ?)
          ORDER BY u.created_at DESC LIMIT ?`,
      )
      .all(now, todayStartIso, now, q, `%${q}%`, `%${q}%`, limit) as Array<{
      id: string;
      email: string;
      display_name: string | null;
      role: string;
      status: string;
      created_at: string;
      credits: number;
      entitlements: number;
      spent: number;
      used_today: number;
      lifetime_memberships: number;
      member_expires_at: string | null;
    }>;
    sendJson(response, 200, {
      ok: true,
      users: rows.map((row) => ({
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        role: row.role,
        status: row.status,
        createdAt: row.created_at,
        credits: row.credits,
        entitlements: row.entitlements,
        spentCents: row.spent,
        usedToday: row.used_today,
        memberStatus:
          row.lifetime_memberships > 0 ? 'lifetime' : row.member_expires_at ? 'timed' : 'none',
        memberExpiresAt: row.lifetime_memberships > 0 ? null : row.member_expires_at,
      })),
    });
    return true;
  }

  const userPatch = /^users\/([A-Za-z0-9_]+)$/.exec(route);
  if (userPatch && method === 'POST') {
    const targetId = userPatch[1];
    const body = await safeBody(request, response);
    if (!body) return true;
    const target = db.prepare(`SELECT id, email, role, status FROM users WHERE id = ?`).get(targetId) as
      | { id: string; email: string; role: string; status: string }
      | undefined;
    if (!target) {
      sendError(response, 404, '用户不存在。');
      return true;
    }

    const role = body.role === 'admin' || body.role === 'user' ? body.role : null;
    const status = body.status === 'active' || body.status === 'disabled' ? body.status : null;
    const hasDisplayName = typeof body.displayName === 'string';
    const nextDisplayName = hasDisplayName ? String(body.displayName).trim().slice(0, 40) || null : undefined;
    const hasCredits =
      (typeof body.credits === 'number' || typeof body.credits === 'string') &&
      String(body.credits).trim() !== '' &&
      Number.isFinite(Number(body.credits));
    const nextCredits = hasCredits ? Math.max(0, Math.min(999_999, Math.floor(Number(body.credits)))) : undefined;
    const membershipAction =
      body.membershipAction === 'extend_days' ||
      body.membershipAction === 'lifetime' ||
      body.membershipAction === 'revoke'
        ? body.membershipAction
        : null;
    const membershipDays = Math.max(1, Math.min(3650, Math.floor(Number(body.membershipDays) || 30)));
    const resetTodayUsage = body.resetTodayUsage === true;
    const newPassword = typeof body.newPassword === 'string' && body.newPassword.length > 0 ? body.newPassword : null;

    if (
      !role &&
      !status &&
      !hasDisplayName &&
      !hasCredits &&
      !membershipAction &&
      !resetTodayUsage &&
      !newPassword
    ) {
      sendError(response, 400, '没有可更新的字段。');
      return true;
    }
    if (target.id === admin.id && role === 'user') {
      sendError(response, 400, '不能取消自己的管理员权限。');
      return true;
    }
    if (newPassword) {
      const problem = describePasswordProblem(newPassword);
      if (problem) {
        sendError(response, 400, problem);
        return true;
      }
    }

    const now = nowIso();
    const hashedPassword = newPassword ? await hashPassword(newPassword) : null;

    withTransaction((tx) => {
      if (role) {
        tx.prepare(`UPDATE users SET role = ?, updated_at = ? WHERE id = ?`).run(role, now, target.id);
      }
      if (hasDisplayName) {
        tx.prepare(`UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?`).run(
          nextDisplayName ?? null,
          now,
          target.id,
        );
      }
      if (status) {
        tx.prepare(`UPDATE users SET status = ?, updated_at = ? WHERE id = ?`).run(status, now, target.id);
        if (status === 'disabled') {
          tx.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).run(
            now,
            target.id,
          );
        }
      }
      if (hashedPassword) {
        tx.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).run(
          hashedPassword,
          now,
          target.id,
        );
        tx.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).run(
          now,
          target.id,
        );
      }
      if (nextCredits !== undefined) {
        tx.prepare(
          `INSERT INTO balances (user_id, credits, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET credits = excluded.credits, updated_at = excluded.updated_at`,
        ).run(target.id, nextCredits, now);
      }
      if (membershipAction === 'revoke') {
        tx.prepare(
          `UPDATE entitlements SET quota = 0 WHERE user_id = ? AND kind = 'membership' AND quota > 0`,
        ).run(target.id);
      } else if (membershipAction === 'lifetime') {
        tx.prepare(
          `UPDATE entitlements SET quota = 0 WHERE user_id = ? AND kind = 'membership' AND quota > 0`,
        ).run(target.id);
        tx.prepare(
          `INSERT INTO entitlements (id, user_id, product_id, kind, quota, expires_at, created_at)
           VALUES (?, ?, NULL, 'membership', 999999, NULL, ?)`,
        ).run(newId('ent'), target.id, now);
      } else if (membershipAction === 'extend_days') {
        const current = tx
          .prepare(
            `SELECT MAX(expires_at) AS max_exp FROM entitlements
              WHERE user_id = ? AND kind = 'membership' AND quota > 0 AND expires_at > ?`,
          )
          .get(target.id, now) as { max_exp: string | null } | undefined;
        const baseMs = current?.max_exp ? Math.max(Date.now(), Date.parse(current.max_exp)) : Date.now();
        const nextExpiresAt = new Date(baseMs + membershipDays * 86400_000).toISOString();
        tx.prepare(
          `UPDATE entitlements SET quota = 0 WHERE user_id = ? AND kind = 'membership' AND quota > 0`,
        ).run(target.id);
        tx.prepare(
          `INSERT INTO entitlements (id, user_id, product_id, kind, quota, expires_at, created_at)
           VALUES (?, ?, NULL, 'membership', 999999, ?, ?)`,
        ).run(newId('ent'), target.id, nextExpiresAt, now);
      }
      if (resetTodayUsage) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        tx.prepare(
          `DELETE FROM ai_usage WHERE identity = ? AND kind = 'ai.analyze' AND created_at >= ?`,
        ).run(`usr:${target.id}`, todayStart.toISOString());
      }
    });

    recordAudit({
      actorId: admin.id,
      action: 'user.update',
      target: target.id,
      payload: {
        email: target.email,
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
        ...(hasDisplayName ? { displayName: nextDisplayName } : {}),
        ...(nextCredits !== undefined ? { credits: nextCredits } : {}),
        ...(membershipAction
          ? { membershipAction, ...(membershipAction === 'extend_days' ? { membershipDays } : {}) }
          : {}),
        ...(resetTodayUsage ? { resetTodayUsage: true } : {}),
        ...(newPassword ? { passwordReset: true } : {}),
      },
    });
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (route === 'orders' && method === 'GET') {
    const limit = Math.min(200, Number(url.searchParams.get('limit') ?? 50) || 50);
    const rows = db
      .prepare(
        `SELECT o.id, o.amount_cents, o.status, o.channel, o.created_at, o.paid_at,
                p.name AS product_name, u.email
           FROM orders o
           LEFT JOIN products p ON p.id = o.product_id
           LEFT JOIN users u ON u.id = o.user_id
          ORDER BY o.created_at DESC LIMIT ?`,
      )
      .all(limit) as Array<{
      id: string;
      amount_cents: number;
      status: string;
      channel: string;
      created_at: string;
      paid_at: string | null;
      product_name: string | null;
      email: string | null;
    }>;
    sendJson(response, 200, {
      ok: true,
      orders: rows.map((row) => ({
        id: row.id,
        email: row.email,
        productName: row.product_name,
        amountCents: row.amount_cents,
        status: row.status,
        channel: row.channel,
        createdAt: row.created_at,
        paidAt: row.paid_at,
      })),
    });
    return true;
  }

  if (route === 'products' && method === 'GET') {
    sendJson(response, 200, { ok: true, products: listProducts(true) });
    return true;
  }

  if (route === 'products' && method === 'POST') {
    const body = await safeBody(request, response);
    if (!body) return true;
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const kind = body.kind === 'single' ? 'single' : 'membership';
    if (!code || !name) {
      sendError(response, 400, '商品编码与名称必填。');
      return true;
    }
    const product = upsertProduct({
      code,
      name,
      kind,
      priceCents: Math.max(0, Math.round(Number(body.priceCents) || 0)),
      durationDays: Math.max(0, Math.round(Number(body.durationDays) || 0)),
      quota: Math.max(0, Math.round(Number(body.quota) || 0)),
    });
    recordAudit({ actorId: admin.id, action: 'product.upsert', target: product.id, payload: product });
    sendJson(response, 200, { ok: true, product });
    return true;
  }

  if (route === 'cdk/batches' && method === 'GET') {
    const rows = db
      .prepare(
        `SELECT b.id, b.name, b.note, b.created_at,
                (SELECT count(*) FROM cdk_codes c WHERE c.batch_id = b.id) AS total,
                (SELECT COALESCE(SUM(used_count), 0) FROM cdk_codes c WHERE c.batch_id = b.id) AS used
           FROM cdk_batches b ORDER BY b.created_at DESC LIMIT 100`,
      )
      .all() as Array<{
      id: string;
      name: string;
      note: string | null;
      created_at: string;
      total: number;
      used: number;
    }>;
    sendJson(response, 200, {
      ok: true,
      batches: rows.map((row) => ({
        id: row.id,
        name: row.name,
        note: row.note,
        createdAt: row.created_at,
        total: row.total,
        used: row.used,
      })),
    });
    return true;
  }

  if (route === 'cdk/batches' && method === 'POST') {
    const body = await safeBody(request, response);
    if (!body) return true;
    const count = Math.max(1, Math.min(200, Math.round(Number(body.count) || 1)));
    const productId = typeof body.productId === 'string' ? body.productId : '';
    const credits = Math.max(0, Math.round(Number(body.credits) || 0));
    const maxUses = Math.max(1, Math.round(Number(body.maxUses) || 1));
    const expiresDays = Math.max(0, Math.round(Number(body.expiresDays) || 0));
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : `批次 ${nowIso().slice(0, 10)}`;
    if (!productId && credits <= 0) {
      sendError(response, 400, '请指定商品或面额。');
      return true;
    }

    const created = withTransaction((tx) => {
      const batchId = newId('bat');
      const now = nowIso();
      tx.prepare(`INSERT INTO cdk_batches (id, name, note, created_at) VALUES (?, ?, ?, ?)`).run(
        batchId,
        name,
        typeof body.note === 'string' ? body.note.slice(0, 200) : null,
        now,
      );
      const expiresAt =
        expiresDays > 0 ? new Date(Date.now() + expiresDays * 86400_000).toISOString() : null;
      const insert = tx.prepare(
        `INSERT INTO cdk_codes (code, batch_id, product_id, credits, max_uses, used_count, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      );
      const codes: string[] = [];
      while (codes.length < count) {
        const code = randomCdk();
        if (tx.prepare(`SELECT 1 FROM cdk_codes WHERE code = ?`).get(code)) continue;
        insert.run(code, batchId, productId || null, credits, maxUses, expiresAt, now);
        codes.push(code);
      }
      return { batchId, codes };
    });

    recordAudit({
      actorId: admin.id,
      action: 'cdk.batch.create',
      target: created.batchId,
      payload: { count, productId, credits, maxUses, expiresDays, name },
    });
    sendJson(response, 200, { ok: true, ...created });
    return true;
  }

  if (route === 'audit' && method === 'GET') {
    const limit = Number(url.searchParams.get('limit') ?? 100) || 100;
    sendJson(response, 200, { ok: true, entries: listAudit(limit) });
    return true;
  }

  if (route === 'ai-config' && method === 'GET') {
    sendJson(response, 200, { ok: true, config: getAdminAiConfigView() });
    return true;
  }

  if (route === 'ai-config' && method === 'POST') {
    const body = await safeBody(request, response);
    if (!body) return true;
    const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : undefined;
    if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
      sendError(response, 400, 'API Base URL 必须以 http:// 或 https:// 开头。');
      return true;
    }
    const updated = saveAdminAiConfig({
      builtinEnabled: typeof body.builtinEnabled === 'boolean' ? body.builtinEnabled : undefined,
      providerName: typeof body.providerName === 'string' ? body.providerName : undefined,
      baseUrl,
      model: typeof body.model === 'string' ? body.model : undefined,
      apiKey: typeof body.apiKey === 'string' ? body.apiKey : undefined,
      clearApiKey: body.clearApiKey === true,
      paywallEnabled: typeof body.paywallEnabled === 'boolean' ? body.paywallEnabled : undefined,
      freeAiDaily:
        typeof body.freeAiDaily === 'number' || typeof body.freeAiDaily === 'string'
          ? Number(body.freeAiDaily)
          : undefined,
    });
    recordAudit({
      actorId: admin.id,
      action: 'ai.config.update',
      target: 'app_settings',
      payload: {
        builtinEnabled: updated.builtinEnabled,
        providerName: updated.providerName,
        baseUrl: updated.baseUrl,
        model: updated.model,
        apiKeyUpdated: Boolean(typeof body.apiKey === 'string' && body.apiKey.trim()),
        apiKeyCleared: body.clearApiKey === true,
        paywallEnabled: updated.paywallEnabled,
        freeAiDaily: updated.freeAiDaily,
      },
    });
    sendJson(response, 200, { ok: true, config: updated });
    return true;
  }

  if (route === 'ai-config/test' && method === 'POST') {
    const body = await safeBody(request, response);
    if (!body) return true;
    const result = await testAdminAiConnection({
      baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
      model: typeof body.model === 'string' ? body.model : undefined,
      apiKey: typeof body.apiKey === 'string' ? body.apiKey : undefined,
    });
    sendJson(response, 200, { ok: true, result });
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
  } catch {
    sendError(response, 400, '请求格式不正确。');
    return null;
  }
}
