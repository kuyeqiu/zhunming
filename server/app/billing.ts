import { getDb, withTransaction } from './db';
import { addDaysIso, newId, nowIso } from './security';

/**
 * 收费核心：商品 → 订单 → 权益，加一条独立的余额账。
 *
 * 设计约束（见 .agents/notes/proposed/architecture/2026-10-21-account-admin-billing-architecture.md）：
 * - 余额是唯一扣费入口，兑换码与未来的在线支付都先入账到余额，避免多套账；
 * - 权益带 expires_at 与 quota，会员看时间、单次看次数；
 * - 兑换码支持批次、使用次数上限、过期时间与使用审计。
 */

export type Product = {
  id: string;
  code: string;
  name: string;
  kind: 'membership' | 'single';
  priceCents: number;
  durationDays: number;
  quota: number;
  active: boolean;
};

type ProductRow = {
  id: string;
  code: string;
  name: string;
  kind: string;
  price_cents: number;
  duration_days: number;
  quota: number;
  active: number;
};

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    kind: row.kind === 'single' ? 'single' : 'membership',
    priceCents: row.price_cents,
    durationDays: row.duration_days,
    quota: row.quota,
    active: row.active === 1,
  };
}

export function listProducts(includeInactive = false): Product[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM products ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY price_cents ASC`,
    )
    .all() as ProductRow[];
  return rows.map(toProduct);
}

export function upsertProduct(input: {
  code: string;
  name: string;
  kind: 'membership' | 'single';
  priceCents: number;
  durationDays: number;
  quota: number;
}): Product {
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM products WHERE code = ?`).get(input.code) as
    | ProductRow
    | undefined;
  if (existing) {
    db.prepare(
      `UPDATE products SET name = ?, kind = ?, price_cents = ?, duration_days = ?, quota = ? WHERE id = ?`,
    ).run(input.name, input.kind, input.priceCents, input.durationDays, input.quota, existing.id);
    return toProduct({ ...existing, ...input, price_cents: input.priceCents } as ProductRow);
  }
  const id = newId('prd');
  db.prepare(
    `INSERT INTO products (id, code, name, kind, price_cents, duration_days, quota, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
  ).run(
    id,
    input.code,
    input.name,
    input.kind,
    input.priceCents,
    input.durationDays,
    input.quota,
    nowIso(),
  );
  return {
    id,
    code: input.code,
    name: input.name,
    kind: input.kind,
    priceCents: input.priceCents,
    durationDays: input.durationDays,
    quota: input.quota,
    active: true,
  };
}

export function getBalance(userId: string): number {
  const db = getDb();
  const row = db.prepare(`SELECT credits FROM balances WHERE user_id = ?`).get(userId) as
    | { credits: number }
    | undefined;
  return row?.credits ?? 0;
}

function creditBalance(db: ReturnType<typeof getDb>, userId: string, delta: number) {
  db.prepare(
    `INSERT INTO balances (user_id, credits, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET credits = MAX(0, credits + ?), updated_at = excluded.updated_at`,
  ).run(userId, Math.max(0, delta), nowIso(), delta);
}

export function grantEntitlement(input: {
  userId: string;
  productId: string | null;
  kind: 'membership' | 'single';
  durationDays: number;
  quota: number;
}): string {
  const db = getDb();
  const id = newId('ent');
  const expiresAt = input.durationDays > 0 ? addDaysIso(input.durationDays) : null;
  db.prepare(
    `INSERT INTO entitlements (id, user_id, product_id, kind, quota, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.userId, input.productId, input.kind, input.quota, expiresAt, nowIso());
  return id;
}

export type EntitlementView = {
  id: string;
  kind: 'membership' | 'single';
  productName: string | null;
  quota: number;
  expiresAt: string | null;
  active: boolean;
};

export function listEntitlements(userId: string): EntitlementView[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT e.id, e.kind, e.quota, e.expires_at, p.name AS product_name
         FROM entitlements e
         LEFT JOIN products p ON p.id = e.product_id
        WHERE e.user_id = ?
        ORDER BY e.created_at DESC`,
    )
    .all(userId) as Array<{
    id: string;
    kind: string;
    quota: number;
    expires_at: string | null;
    product_name: string | null;
  }>;
  const now = Date.now();
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind === 'single' ? 'single' : 'membership',
    productName: row.product_name,
    quota: row.quota,
    expiresAt: row.expires_at,
    active: (!row.expires_at || new Date(row.expires_at).getTime() > now) && row.quota > 0,
  }));
}

export type RedeemResult =
  | { ok: true; credits: number; productName: string | null; balance: number }
  | { ok: false; error: string };

/** 兑换码核销：整段走事务，避免并发重复使用。 */
export function redeemCode(userId: string, rawCode: string): RedeemResult {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: '请输入兑换码。' };

  return withTransaction((db) => {
    const row = db
      .prepare(
        `SELECT c.*, p.name AS product_name, p.kind AS product_kind,
                p.duration_days, p.quota AS product_quota
           FROM cdk_codes c
           LEFT JOIN products p ON p.id = c.product_id
          WHERE c.code = ?`,
      )
      .get(code) as
      | {
          code: string;
          batch_id: string | null;
          product_id: string | null;
          credits: number;
          max_uses: number;
          used_count: number;
          expires_at: string | null;
          product_name: string | null;
          product_kind: string | null;
          duration_days: number | null;
          product_quota: number | null;
        }
      | undefined;

    if (!row) return { ok: false as const, error: '兑换码无效。' };
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false as const, error: '兑换码已过期。' };
    }
    if (row.used_count >= row.max_uses) {
      return { ok: false as const, error: '兑换码已被使用。' };
    }

    const alreadyUsed = db
      .prepare(`SELECT 1 FROM cdk_redemptions WHERE code = ? AND user_id = ?`)
      .get(code, userId);
    if (alreadyUsed) return { ok: false as const, error: '你已使用过该兑换码。' };

    db.prepare(`UPDATE cdk_codes SET used_count = used_count + 1 WHERE code = ?`).run(code);
    db.prepare(
      `INSERT INTO cdk_redemptions (id, code, user_id, created_at) VALUES (?, ?, ?, ?)`,
    ).run(newId('rdm'), code, userId, nowIso());

    if (row.credits > 0) creditBalance(db, userId, row.credits);

    if (row.product_id) {
      db.prepare(
        `INSERT INTO entitlements (id, user_id, product_id, kind, quota, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        newId('ent'),
        userId,
        row.product_id,
        row.product_kind === 'single' ? 'single' : 'membership',
        row.product_quota ?? 0,
        (row.duration_days ?? 0) > 0 ? addDaysIso(row.duration_days ?? 0) : null,
        nowIso(),
      );
    }

    db.prepare(
      `INSERT INTO orders (id, user_id, product_id, amount_cents, status, channel, created_at, paid_at)
       VALUES (?, ?, ?, 0, 'paid', 'cdk', ?, ?)`,
    ).run(newId('ord'), userId, row.product_id, nowIso(), nowIso());

    const balance = (
      db.prepare(`SELECT credits FROM balances WHERE user_id = ?`).get(userId) as
        | { credits: number }
        | undefined
    )?.credits ?? 0;

    return { ok: true as const, credits: row.credits, productName: row.product_name, balance };
  });
}

export type OrderView = {
  id: string;
  productName: string | null;
  amountCents: number;
  status: string;
  channel: string;
  createdAt: string;
  paidAt: string | null;
};

export function listOrders(userId: string, limit = 50): OrderView[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT o.id, o.amount_cents, o.status, o.channel, o.created_at, o.paid_at, p.name AS product_name
         FROM orders o
         LEFT JOIN products p ON p.id = o.product_id
        WHERE o.user_id = ?
        ORDER BY o.created_at DESC
        LIMIT ?`,
    )
    .all(userId, limit) as Array<{
    id: string;
    amount_cents: number;
    status: string;
    channel: string;
    created_at: string;
    paid_at: string | null;
    product_name: string | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    productName: row.product_name,
    amountCents: row.amount_cents,
    status: row.status,
    channel: row.channel,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  }));
}
