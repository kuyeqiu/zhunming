import type { AiEnv } from '../../src/lib/ai/proxy';
import { getDb } from './db';
import { nowIso } from './security';

export type ManagedSettingKey =
  | 'AI_BUILTIN_ENABLED'
  | 'AI_PROVIDER_NAME'
  | 'AI_BASE_URL'
  | 'AI_MODEL'
  | 'AI_API_KEY'
  | 'MINGYU_PAYWALL_ENABLED'
  | 'MINGYU_FREE_AI_DAILY';

export type AdminAiConfigView = {
  builtinEnabled: boolean;
  providerName: string;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  apiKeyMasked: string;
  keySource: 'db' | 'env' | 'empty';
  paywallEnabled: boolean;
  freeAiDaily: number;
  updatedAt: string | null;
};

export type AdminAiConfigPatch = {
  builtinEnabled?: boolean;
  providerName?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  clearApiKey?: boolean;
  paywallEnabled?: boolean;
  freeAiDaily?: number;
};

let cachedRows: Map<string, { value: string; updatedAt: string }> | null = null;

function loadAllSettings(): Map<string, { value: string; updatedAt: string }> {
  if (cachedRows) return cachedRows;
  const db = getDb();
  const rows = db
    .prepare(`SELECT key, value, updated_at FROM app_settings`)
    .all() as Array<{ key: string; value: string; updated_at: string }>;
  const map = new Map<string, { value: string; updatedAt: string }>();
  for (const row of rows) {
    map.set(row.key, { value: row.value, updatedAt: row.updated_at });
  }
  cachedRows = map;
  return map;
}

export function invalidateSettingsCache() {
  cachedRows = null;
}

export function getEffectiveSetting(key: ManagedSettingKey): string | undefined {
  const fromDb = loadAllSettings().get(key);
  if (fromDb !== undefined) return fromDb.value;
  return process.env[key];
}

export function getEffectiveAiEnv(): AiEnv {
  const settings = loadAllSettings();
  const merged: Record<string, string | undefined> = { ...process.env };
  for (const [key, entry] of settings.entries()) {
    merged[key] = entry.value;
  }
  if (merged.AI_BUILTIN_ENABLED !== undefined) {
    merged.AI_DEFAULT_ENABLED = merged.AI_BUILTIN_ENABLED;
  }
  return merged as AiEnv;
}

export function maskSecret(secret: string | undefined): string {
  const trimmed = (secret ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}****`;
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`;
}

export function getAdminAiConfigView(): AdminAiConfigView {
  const settings = loadAllSettings();
  const dbKey = settings.get('AI_API_KEY')?.value?.trim() ?? '';
  const envKey = (process.env.AI_API_KEY ?? '').trim();
  const effectiveKey = dbKey || envKey;
  const keySource: AdminAiConfigView['keySource'] = dbKey ? 'db' : envKey ? 'env' : 'empty';

  const builtinRaw = getEffectiveSetting('AI_BUILTIN_ENABLED') ?? getEffectiveSetting('AI_API_KEY');
  const builtinEnabled =
    getEffectiveSetting('AI_BUILTIN_ENABLED') !== undefined
      ? getEffectiveSetting('AI_BUILTIN_ENABLED') !== 'false'
      : Boolean(builtinRaw);

  const paywallEnabled = (getEffectiveSetting('MINGYU_PAYWALL_ENABLED') ?? 'true') !== 'false';
  const freeDailyRaw = Number(getEffectiveSetting('MINGYU_FREE_AI_DAILY') ?? 3);
  const freeAiDaily = Number.isFinite(freeDailyRaw) && freeDailyRaw >= 0 ? Math.floor(freeDailyRaw) : 3;

  let latestUpdatedAt: string | null = null;
  for (const entry of settings.values()) {
    if (!latestUpdatedAt || entry.updatedAt > latestUpdatedAt) {
      latestUpdatedAt = entry.updatedAt;
    }
  }

  return {
    builtinEnabled,
    providerName: (getEffectiveSetting('AI_PROVIDER_NAME') ?? 'DeepSeek').trim(),
    baseUrl: (getEffectiveSetting('AI_BASE_URL') ?? 'https://api.deepseek.com/v1').trim(),
    model: (getEffectiveSetting('AI_MODEL') ?? 'deepseek-chat').trim(),
    hasApiKey: Boolean(effectiveKey),
    apiKeyMasked: maskSecret(effectiveKey),
    keySource,
    paywallEnabled,
    freeAiDaily,
    updatedAt: latestUpdatedAt,
  };
}

export function saveAdminAiConfig(patch: AdminAiConfigPatch): AdminAiConfigView {
  const db = getDb();
  const now = nowIso();
  const upsert = db.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  );
  const remove = db.prepare(`DELETE FROM app_settings WHERE key = ?`);

  if (typeof patch.builtinEnabled === 'boolean') {
    upsert.run('AI_BUILTIN_ENABLED', patch.builtinEnabled ? 'true' : 'false', now);
  }
  if (typeof patch.providerName === 'string') {
    upsert.run('AI_PROVIDER_NAME', patch.providerName.trim().slice(0, 80), now);
  }
  if (typeof patch.baseUrl === 'string') {
    const cleaned = patch.baseUrl.trim().replace(/\/+$/u, '');
    if (cleaned) upsert.run('AI_BASE_URL', cleaned, now);
  }
  if (typeof patch.model === 'string') {
    const cleaned = patch.model.trim().slice(0, 120);
    if (cleaned) upsert.run('AI_MODEL', cleaned, now);
  }
  if (patch.clearApiKey) {
    remove.run('AI_API_KEY');
  } else if (typeof patch.apiKey === 'string' && patch.apiKey.trim()) {
    upsert.run('AI_API_KEY', patch.apiKey.trim(), now);
  }
  if (typeof patch.paywallEnabled === 'boolean') {
    upsert.run('MINGYU_PAYWALL_ENABLED', patch.paywallEnabled ? 'true' : 'false', now);
  }
  if (typeof patch.freeAiDaily === 'number' && Number.isFinite(patch.freeAiDaily)) {
    upsert.run('MINGYU_FREE_AI_DAILY', String(Math.max(0, Math.min(9999, Math.floor(patch.freeAiDaily)))), now);
  }

  invalidateSettingsCache();
  return getAdminAiConfigView();
}

export async function testAdminAiConnection(input: {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}): Promise<{
  ok: boolean;
  latencyMs: number;
  model: string;
  replyPreview?: string;
  error?: string;
}> {
  const env = getEffectiveAiEnv();
  const baseUrl = (input.baseUrl?.trim() || env.AI_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/u, '');
  const model = input.model?.trim() || env.AI_MODEL || 'deepseek-chat';
  const apiKey = input.apiKey?.trim() || env.AI_API_KEY || '';

  if (!apiKey) {
    return { ok: false, latencyMs: 0, model, error: '尚未配置 API Key，请先输入后再测试。' };
  }
  if (!/^https?:\/\//i.test(baseUrl)) {
    return { ok: false, latencyMs: 0, model, error: 'Base URL 必须以 http:// 或 https:// 开头。' };
  }

  const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: '请回复：连接正常' }],
        max_tokens: 16,
        stream: false,
      }),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    const rawText = await res.text();
    if (!res.ok) {
      let detail = rawText.slice(0, 200);
      try {
        const parsed = JSON.parse(rawText) as { error?: { message?: string }; message?: string };
        detail = parsed?.error?.message || parsed?.message || detail;
      } catch {
        // ignore
      }
      return { ok: false, latencyMs, model, error: `HTTP ${res.status}: ${detail}` };
    }
    let replyPreview = '接口响应成功';
    try {
      const parsed = JSON.parse(rawText) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = parsed?.choices?.[0]?.message?.content?.trim();
      if (content) replyPreview = content.slice(0, 60);
    } catch {
      // ignore
    }
    return { ok: true, latencyMs, model, replyPreview };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? '请求超时（15 秒），请检查 Base URL 或服务器网络。'
        : err instanceof Error
          ? err.message
          : '网络请求失败。';
    return { ok: false, latencyMs, model, error: message };
  } finally {
    clearTimeout(timer);
  }
}
