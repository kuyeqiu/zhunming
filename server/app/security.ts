import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * 口令哈希：scrypt（Node 内置，无第三方依赖）。
 *
 * 存储格式 `scrypt$N$r$p$<salt-b64>$<hash-b64>`，把参数写进哈希串，
 * 这样以后调参数不需要迁移数据 —— 校验时按串里的参数算。
 */
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(password.normalize('NFKC'), salt, KEYLEN);
  return ['scrypt', N, R, P, salt.toString('base64'), derived.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[4] ?? '', 'base64');
  const expected = Buffer.from(parts[5] ?? '', 'base64');
  if (!salt.length || !expected.length) return false;
  const derived = await scrypt(password.normalize('NFKC'), salt, expected.length);
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** 会话令牌只以 SHA-256 摘要入库：库被读走也无法直接冒用会话。 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString('hex')}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function addDaysIso(days: number, from: Date = new Date()): string {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** 校验强度：只做下限约束，不搞复杂度表演 */
export function describePasswordProblem(password: string): string | null {
  if (typeof password !== 'string' || password.length < 8) return '密码至少 8 位。';
  if (password.length > 200) return '密码过长。';
  if (!/[a-zA-Z]/.test(password) && !/\d/.test(password)) return '密码需包含字母或数字。';
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const email = input.trim().toLowerCase();
  if (email.length < 5 || email.length > 254) return null;
  return EMAIL_RE.test(email) ? email : null;
}
