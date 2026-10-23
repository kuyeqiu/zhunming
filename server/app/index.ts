import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleAdminRoute, isAdminRoute } from './admin';
import { handleAuthRoute, isAuthRoute } from './auth';
import { getDb } from './db';
import { getBalance, listEntitlements, listOrders, listProducts, redeemCode } from './billing';
import { readJsonBody, sendError, sendJson } from './http';
import { describeAccess } from './gate';
import { resolveSession } from './session';

/**
 * 应用层（账号/订单/权益）请求入口。
 *
 * 与排盘 API（/api/v1/*）分开：
 * - /api/v1/* 由 src/lib/public-api 处理，无状态、可缓存；
 * - /api/app/* 是我们的业务后端，有会话、有数据库。
 * 返回 true 表示已处理，调用方不再往下走静态分发。
 */
export async function handleAppRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
): Promise<boolean> {
  if (!url.pathname.startsWith('/api/app/')) return false;
  const method = request.method ?? 'GET';

  if (url.pathname === '/api/app/health') {
    const db = getDb();
    const row = db.prepare('SELECT count(*) AS n FROM users').get() as { n: number };
    sendJson(response, 200, { ok: true, users: row.n });
    return true;
  }

  if (isAuthRoute(url.pathname)) {
    const user = resolveSession(request);
    return handleAuthRoute(request, response, url, { user });
  }

  // 付费墙状态：前端用来显示剩余免费次数与开通入口
  if (url.pathname === '/api/app/access' && method === 'GET') {
    sendJson(response, 200, { ok: true, access: describeAccess(request) });
    return true;
  }

  // 商品列表：公开，不需要登录（购买页要用）
  if (url.pathname === '/api/app/products' && method === 'GET') {
    sendJson(response, 200, { ok: true, products: listProducts() });
    return true;
  }

  const user = resolveSession(request);

  if (isAdminRoute(url.pathname)) {
    return handleAdminRoute(request, response, url, { user });
  }

  if (url.pathname === '/api/app/me/summary' && method === 'GET') {
    if (!user) {
      sendError(response, 401, '请先登录。');
      return true;
    }
    sendJson(response, 200, {
      ok: true,
      user,
      balance: getBalance(user.id),
      entitlements: listEntitlements(user.id),
      orders: listOrders(user.id, 20),
    });
    return true;
  }

  if (url.pathname === '/api/app/redeem' && method === 'POST') {
    if (!user) {
      sendError(response, 401, '请先登录。');
      return true;
    }
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(request);
    } catch {
      sendError(response, 400, '请求格式不正确。');
      return true;
    }
    const code = typeof body.code === 'string' ? body.code : '';
    const result = redeemCode(user.id, code);
    if (!result.ok) {
      sendError(response, 400, result.error);
      return true;
    }
    sendJson(response, 200, { ...result, ok: true });
    return true;
  }

  sendError(response, 404, '接口不存在。');
  return true;
}
