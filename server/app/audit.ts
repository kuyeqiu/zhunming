import { getDb } from './db';
import { newId, nowIso } from './security';

/** 审计：后台所有写操作都留痕，便于事后追责与排查。 */
export function recordAudit(params: {
  actorId: string | null;
  action: string;
  target?: string | null;
  payload?: unknown;
}): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO audit_log (id, actor_id, action, target, payload, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId('aud'),
        params.actorId,
        params.action,
        params.target ?? null,
        params.payload === undefined ? null : JSON.stringify(params.payload).slice(0, 4000),
        nowIso(),
      );
  } catch (error) {
    // 审计失败不能影响主流程，但要留日志
    console.error('审计写入失败', error);
  }
}

export type AuditEntry = {
  id: string;
  actorId: string | null;
  action: string;
  target: string | null;
  payload: string | null;
  createdAt: string;
};

export function listAudit(limit = 100): AuditEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT id, actor_id, action, target, payload, created_at
         FROM audit_log ORDER BY created_at DESC LIMIT ?`,
    )
    .all(Math.min(500, Math.max(1, limit))) as Array<{
    id: string;
    actor_id: string | null;
    action: string;
    target: string | null;
    payload: string | null;
    created_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    target: row.target,
    payload: row.payload,
    createdAt: row.created_at,
  }));
}
