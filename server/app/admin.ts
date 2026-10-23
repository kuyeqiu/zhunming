import { randomInt } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { listAudit, recordAudit } from './audit';
import { listProducts, upsertProduct } from './billing';
import { getDb, withTransaction } from './db';
import { readJsonBody, sendError, sendJson } from './http';
import { newId, nowIso } from './security';
import type { SessionUser } from './session';

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
    const rows = db
      .prepare(
        `SELECT u.id, u.email, u.display_name, u.role, u.status, u.created_at,
                COALESCE(b.credits, 0) AS credits,
                (SELECT count(*) FROM entitlements e WHERE e.user_id = u.id
                   AND e.quota > 0 AND (e.expires_at IS NULL OR e.expires_at > ?)) AS entitlements,
                (SELECT COALESCE(SUM(amount_cents), 0) FROM orders o
                   WHERE o.user_id = u.id AND o.status = 'paid') AS spent
           FROM users u LEFT JOIN balances b ON b.user_id = u.id
          WHERE (? = '' OR lower(u.email) LIKE ? OR lower(COALESCE(u.display_name, '')) LIKE ?)
          ORDER BY u.created_at DESC LIMIT ?`,
      )
      .all(nowIso(), q, `%${q}%`, `%${q}%`, limit) as Array<{
      id: string;
      email: string;
      display_name: string | null;
      role: string;
      status: string;
      created_at: string;
      credits: number;
      entitlements: number;
      spent: number;
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
    if (!role && !status) {
      sendError(response, 400, '没有可更新的字段。');
      return true;
    }
    if (target.id === admin.id && role === 'user') {
      sendError(response, 400, '不能取消自己的管理员权限。');
      return true;
    }
    if (role) db.prepare(`UPDATE users SET role = ?, updated_at = ? WHERE id = ?`).run(role, nowIso(), target.id);
    if (status) {
      db.prepare(`UPDATE users SET status = ?, updated_at = ? WHERE id = ?`).run(status, nowIso(), target.id);
      if (status === 'disabled') {
        db.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).run(
          nowIso(),
          target.id,
        );
      }
    }
    recordAudit({
      actorId: admin.id,
      action: 'user.update',
      target: target.id,
      payload: { role, status, email: target.email },
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
