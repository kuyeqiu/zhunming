/**
 * 业务后端客户端（/api/app/*）。
 *
 * 与排盘 API（/api/v1/*）分开：这里是有会话的写操作，一律 same-origin + credentials: 'include'。
 * 统一把 { ok:false, error } 转成抛错，调用方只处理成功分支。
 */

export type AppUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: 'user' | 'admin';
};

export type AppProduct = {
  id: string;
  code: string;
  name: string;
  kind: 'membership' | 'single';
  priceCents: number;
  durationDays: number;
  quota: number;
  active: boolean;
};

export type AppEntitlement = {
  id: string;
  kind: 'membership' | 'single';
  productName: string | null;
  quota: number;
  expiresAt: string | null;
  active: boolean;
};

export type AppOrder = {
  id: string;
  productName: string | null;
  amountCents: number;
  status: string;
  channel: string;
  createdAt: string;
  paidAt: string | null;
};

export type AppAccess = {
  paywall: boolean;
  tier: 'free' | 'member';
  limit: number | null;
  used: number;
  remaining: number | null;
};
export type AppSummary = {
  user: AppUser;
  balance: number;
  entitlements: AppEntitlement[];
  orders: AppOrder[];
};

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // 非 JSON 响应（例如网关错误页）走下面的兜底
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `请求失败（${response.status}）`;
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export const appApi = {
  async me(): Promise<AppUser | null> {
    const data = await request<{ ok: boolean; user: AppUser | null }>('/api/app/auth/me');
    return data.user ?? null;
  },

  async register(input: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<AppUser> {
    const data = await request<{ ok: boolean; user: AppUser }>('/api/app/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.user;
  },

  async login(input: { email: string; password: string }): Promise<AppUser> {
    const data = await request<{ ok: boolean; user: AppUser }>('/api/app/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return data.user;
  },

  async logout(): Promise<void> {
    await request('/api/app/auth/logout', { method: 'POST' });
  },

  async products(): Promise<AppProduct[]> {
    const data = await request<{ ok: boolean; products: AppProduct[] }>('/api/app/products');
    return data.products ?? [];
  },

  async summary(): Promise<AppSummary> {
    return request<AppSummary>('/api/app/me/summary');
  },

  async access(): Promise<AppAccess> {
    const data = await request<{ ok: boolean; access: AppAccess }>('/api/app/access');
    return data.access;
  },

  async redeem(code: string): Promise<{ productName: string | null; balance: number }> {
    return request('/api/app/redeem', { method: 'POST', body: JSON.stringify({ code }) });
  },
};

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
