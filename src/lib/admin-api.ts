/**
 * 管理后台客户端（/api/app/admin/*）。
 *
 * 非管理员拿到的是 404（与不存在的接口同形），因此这里把 404 统一转成"无权访问"，
 * 由页面决定渲染成 404 还是提示，不向外泄露后台存在性。
 */

export type AdminOverview = {
  users: number;
  activeUsers: number;
  paidOrders: number;
  revenueCents: number;
  activeEntitlements: number;
  cdkUsed: number;
  cdkTotal: number;
};

export type AdminUserRow = {
  id: string;
  email: string;
  displayName: string | null;
  role: 'user' | 'admin';
  status: 'active' | 'disabled';
  createdAt: string;
  credits: number;
  entitlements: number;
  spentCents: number;
};

export type AdminOrderRow = {
  id: string;
  email: string | null;
  productName: string | null;
  amountCents: number;
  status: string;
  channel: string;
  createdAt: string;
  paidAt: string | null;
};

export type AdminProductRow = {
  id: string;
  code: string;
  name: string;
  kind: 'membership' | 'single';
  priceCents: number;
  durationDays: number;
  quota: number;
  active: boolean;
};

export type AdminBatchRow = {
  id: string;
  name: string;
  note: string | null;
  createdAt: string;
  total: number;
  used: number;
};

export type AdminAuditRow = {
  id: string;
  actorId: string | null;
  action: string;
  target: string | null;
  payload: string | null;
  createdAt: string;
};

export class AdminForbiddenError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/app/admin/${path}`, {
    credentials: 'include',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  if (response.status === 404 || response.status === 401) {
    throw new AdminForbiddenError('无权访问');
  }
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // ignore
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `请求失败（${response.status}）`;
    throw new Error(message);
  }
  return payload as T;
}

export const adminApi = {
  overview: () => call<{ overview: AdminOverview }>('overview'),
  users: (q = '') => call<{ users: AdminUserRow[] }>(`users?q=${encodeURIComponent(q)}`),
  updateUser: (id: string, patch: { role?: string; status?: string }) =>
    call<{ ok: boolean }>(`users/${id}`, { method: 'POST', body: JSON.stringify(patch) }),
  orders: () => call<{ orders: AdminOrderRow[] }>('orders'),
  products: () => call<{ products: AdminProductRow[] }>('products'),
  saveProduct: (input: {
    code: string;
    name: string;
    kind: 'membership' | 'single';
    priceCents: number;
    durationDays: number;
    quota: number;
  }) => call<{ ok: boolean }>('products', { method: 'POST', body: JSON.stringify(input) }),
  batches: () => call<{ batches: AdminBatchRow[] }>('cdk/batches'),
  createBatch: (input: {
    name?: string;
    count: number;
    productId?: string;
    credits?: number;
    maxUses?: number;
    expiresDays?: number;
  }) => call<{ batchId: string; codes: string[] }>('cdk/batches', { method: 'POST', body: JSON.stringify(input) }),
  audit: (limit = 100) => call<{ entries: AdminAuditRow[] }>(`audit?limit=${limit}`),
};
