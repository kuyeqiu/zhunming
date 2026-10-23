import { randomInt } from 'node:crypto';
import { getDb } from './db';
import { newId, nowIso } from './security';
import { upsertProduct } from './billing';

/**
 * 初始化脚本：建默认商品 + 一批兑换码。
 * 用法：node --import=tsx server/app/seed.ts [批次数]
 * 幂等：商品按 code upsert；兑换码每次生成新的批次。
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(length = 12): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

function groupCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, '$1-');
}

const DEFAULT_PRODUCTS = [
  {
    code: 'member_month',
    name: '会员 · 包月',
    kind: 'membership' as const,
    priceCents: 2900,
    durationDays: 30,
    quota: 999,
  },
  {
    code: 'member_year',
    name: '会员 · 包年',
    kind: 'membership' as const,
    priceCents: 19900,
    durationDays: 365,
    quota: 9999,
  },
  {
    code: 'report_single',
    name: '单次 · 深度解读',
    kind: 'single' as const,
    priceCents: 990,
    durationDays: 0,
    quota: 1,
  },
];

function seed() {
  for (const product of DEFAULT_PRODUCTS) upsertProduct(product);

  const count = Math.max(1, Math.min(500, Number(process.argv[2] ?? 5)));
  const db = getDb();
  const batchId = newId('bat');
  const now = nowIso();
  db.prepare(`INSERT INTO cdk_batches (id, name, note, created_at) VALUES (?, ?, ?, ?)`).run(
    batchId,
    `演示批次 ${now.slice(0, 10)}`,
    'seed 生成，仅用于联调',
    now,
  );

  const monthly = db.prepare(`SELECT id FROM products WHERE code = 'member_month'`).get() as {
    id: string;
  };

  const codes: string[] = [];
  const insert = db.prepare(
    `INSERT INTO cdk_codes (code, batch_id, product_id, credits, max_uses, used_count, expires_at, created_at)
     VALUES (?, ?, ?, ?, 1, 0, NULL, ?)`,
  );
  while (codes.length < count) {
    const code = groupCode(randomCode());
    const exists = db.prepare(`SELECT 1 FROM cdk_codes WHERE code = ?`).get(code);
    if (exists) continue;
    insert.run(code, batchId, monthly.id, 0, now);
    codes.push(code);
  }

  console.log(`已创建商品 ${DEFAULT_PRODUCTS.length} 个，兑换码 ${codes.length} 个（批次 ${batchId}）：`);
  for (const code of codes) console.log(`  ${code}`);
}

seed();
