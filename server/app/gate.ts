import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { getDb } from './db';
import { getClientIp } from './http';
import { newId, nowIso } from './security';
import { resolveSession } from './session';

/**
 * 付费墙。
 *
 * 只锁一处：**内置 AI 解读**（/api/v1/ai/analyze）。排盘、盘面、历法、古籍全部免费。
 * 理由：把排盘也锁住会让"功能尽可能都有"直接失效，也会毁掉首屏体验；
 * 而 AI 解读是唯一有边际成本的功能，理应承担变现。
 *
 * 免费额度按身份计：登录用户按 user_id，未登录按 IP 哈希。
 * 会员（active membership 权益）不限次。
 */

const USAGE_KIND = 'ai.analyze';

export type AiGateVerdict =
  | { allowed: true; identity: string; tier: 'member' | 'free'; remaining: number }
  | {
      allowed: false;
      identity: string;
      tier: 'free';
      message: string;
      used: number;
      limit: number;
    };

function freeDailyLimit(): number {
  const raw = Number(process.env.MINGYU_FREE_AI_DAILY ?? 3);
  if (!Number.isFinite(raw) || raw < 0) return 3;
  return Math.floor(raw);
}

export function paywallEnabled(): boolean {
  return (process.env.MINGYU_PAYWALL_ENABLED ?? 'true') !== 'false';
}

function hashIp(ip: string): string {
  return createHash('sha256').update(`mingyu:${ip}`).digest('hex').slice(0, 16);
}

export function isMember(userId: string): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM entitlements
        WHERE user_id = ? AND kind = 'membership' AND quota > 0
          AND (expires_at IS NULL OR expires_at > ?)
        LIMIT 1`,
    )
    .get(userId, nowIso());
  return Boolean(row);
}

function usedToday(identity: string): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const row = getDb()
    .prepare(
      `SELECT count(*) AS n FROM ai_usage
        WHERE identity = ? AND kind = ? AND created_at >= ?`,
    )
    .get(identity, USAGE_KIND, start.toISOString()) as { n: number } | undefined;
  return row?.n ?? 0;
}

function recordUsage(identity: string, userId: string | null) {
  getDb()
    .prepare(`INSERT INTO ai_usage (id, user_id, identity, kind, units, created_at) VALUES (?, ?, ?, ?, 1, ?)`)
    .run(newId('use'), userId, identity, USAGE_KIND, nowIso());
}

export function checkAiAccess(request: IncomingMessage): AiGateVerdict {
  const user = resolveSession(request);
  const identity = user ? `usr:${user.id}` : `ip:${hashIp(getClientIp(request))}`;

  if (!paywallEnabled()) {
    return { allowed: true, identity, tier: 'free', remaining: Number.POSITIVE_INFINITY };
  }

  if (user && isMember(user.id)) {
    // 会员也记流水，但不设限：用于后台统计与后续按量计费
    recordUsage(identity, user.id);
    return { allowed: true, identity, tier: 'member', remaining: Number.POSITIVE_INFINITY };
  }

  const limit = freeDailyLimit();
  const used = usedToday(identity);
  if (used >= limit) {
    return {
      allowed: false,
      identity,
      tier: 'free',
      used,
      limit,
      message:
        limit === 0
          ? 'AI 解读需要开通会员后使用。'
          : `今日免费解读已用完（${used}/${limit}）。开通会员可无限次解读。`,
    };
  }

  recordUsage(identity, user?.id ?? null);
  return { allowed: true, identity, tier: 'free', remaining: Math.max(0, limit - used - 1) };
}

/** 供前端展示剩余额度 */
export function describeAccess(request: IncomingMessage) {
  const user = resolveSession(request);
  if (!paywallEnabled()) {
    return { paywall: false, tier: 'free' as const, limit: null, used: 0, remaining: null };
  }
  const identity = user ? `usr:${user.id}` : `ip:${hashIp(getClientIp(request))}`;
  const member = Boolean(user && isMember(user.id));
  const limit = freeDailyLimit();
  const used = usedToday(identity);
  return {
    paywall: true,
    tier: member ? ('member' as const) : ('free' as const),
    limit: member ? null : limit,
    used,
    remaining: member ? null : Math.max(0, limit - used),
  };
}
