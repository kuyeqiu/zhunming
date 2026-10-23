import { useCallback, useEffect, useState } from 'react';
import '@/styles/admin.css';
import {
  AdminForbiddenError,
  adminApi,
  type AdminAuditRow,
  type AdminBatchRow,
  type AdminOrderRow,
  type AdminOverview,
  type AdminProductRow,
  type AdminUserRow,
} from '@/lib/admin-api';

type Tab = 'overview' | 'users' | 'orders' | 'products' | 'cdk' | 'audit';

const TABS: Array<{ id: Tab; label: string; hint: string }> = [
  { id: 'overview', label: '概览', hint: '关键计数' },
  { id: 'users', label: '用户', hint: '角色与状态' },
  { id: 'orders', label: '订单', hint: '跨用户流水' },
  { id: 'products', label: '商品', hint: '套餐与单次' },
  { id: 'cdk', label: '兑换码', hint: '批次与核销' },
  { id: 'audit', label: '审计', hint: '写操作留痕' },
];

function money(cents: number): string {
  return `¥${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function day(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 后台不需要水墨诗意，要的是密度与可扫描性：等宽数字、紧行距、细边框。 */
export function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [batches, setBatches] = useState<AdminBatchRow[]>([]);
  const [audit, setAudit] = useState<AdminAuditRow[]>([]);
  const [query, setQuery] = useState('');
  const [codes, setCodes] = useState<string[]>([]);

  const load = useCallback(async (target: Tab) => {
    setLoading(true);
    setError(null);
    try {
      if (target === 'overview') setOverview((await adminApi.overview()).overview);
      if (target === 'users') setUsers((await adminApi.users(query)).users);
      if (target === 'orders') setOrders((await adminApi.orders()).orders);
      if (target === 'products') setProducts((await adminApi.products()).products);
      if (target === 'cdk') setBatches((await adminApi.batches()).batches);
      if (target === 'audit') setAudit((await adminApi.audit()).entries);
    } catch (loadError) {
      if (loadError instanceof AdminForbiddenError) setForbidden(true);
      else setError(loadError instanceof Error ? loadError.message : '加载失败。');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  if (forbidden) {
    return (
      <div className="admin-shell admin-shell--denied">
        <h1>404</h1>
        <p>页面不存在。</p>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        <div className="admin-brand">
          <span className="admin-brand__mark">命</span>
          <span className="admin-brand__text">
            管理后台
            <small>mingyu admin</small>
          </span>
        </div>
        <nav>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'is-active' : ''}
              onClick={() => setTab(item.id)}
            >
              <span>{item.label}</span>
              <small>{item.hint}</small>
            </button>
          ))}
        </nav>
        <a className="admin-nav__back" href="/">
          ← 返回站点
        </a>
      </aside>

      <main className="admin-main">
        <header className="admin-head">
          <h1>{TABS.find((item) => item.id === tab)?.label}</h1>
          <div className="admin-head__actions">
            {notice ? <span className="admin-notice">{notice}</span> : null}
            <button type="button" onClick={() => void load(tab)} disabled={loading}>
              {loading ? '读取中…' : '刷新'}
            </button>
          </div>
        </header>

        {error ? <p className="admin-error">{error}</p> : null}

        {tab === 'overview' && overview ? (
          <div className="admin-stats">
            {[
              ['用户总数', overview.users],
              ['有效用户', overview.activeUsers],
              ['已付订单', overview.paidOrders],
              ['营收', money(overview.revenueCents)],
              ['活跃权益', overview.activeEntitlements],
              ['兑换码使用', `${overview.cdkUsed}/${overview.cdkTotal}`],
            ].map(([label, value]) => (
              <div key={String(label)} className="admin-stat">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        ) : null}

        {tab === 'users' ? (
          <>
            <div className="admin-toolbar">
              <input
                type="search"
                value={query}
                placeholder="搜索邮箱或称呼"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void load('users');
                }}
              />
              <button type="button" onClick={() => void load('users')}>
                查询
              </button>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>邮箱</th>
                  <th>称呼</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th className="num">余额</th>
                  <th className="num">权益</th>
                  <th className="num">消费</th>
                  <th>注册</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.id}>
                    <td>{row.email}</td>
                    <td>{row.displayName ?? '—'}</td>
                    <td>
                      <span className={`admin-tag admin-tag--${row.role}`}>{row.role}</span>
                    </td>
                    <td>
                      <span className={`admin-tag admin-tag--${row.status}`}>{row.status}</span>
                    </td>
                    <td className="num">{row.credits}</td>
                    <td className="num">{row.entitlements}</td>
                    <td className="num">{money(row.spentCents)}</td>
                    <td>{day(row.createdAt)}</td>
                    <td className="admin-row-actions">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await adminApi.updateUser(row.id, {
                              role: row.role === 'admin' ? 'user' : 'admin',
                            });
                            setNotice(`${row.email} 角色已更新`);
                            void load('users');
                          } catch (updateError) {
                            setError(updateError instanceof Error ? updateError.message : '更新失败');
                          }
                        }}
                      >
                        {row.role === 'admin' ? '降为用户' : '设为管理'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await adminApi.updateUser(row.id, {
                              status: row.status === 'active' ? 'disabled' : 'active',
                            });
                            setNotice(`${row.email} 状态已更新`);
                            void load('users');
                          } catch (updateError) {
                            setError(updateError instanceof Error ? updateError.message : '更新失败');
                          }
                        }}
                      >
                        {row.status === 'active' ? '停用' : '启用'}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="admin-empty">
                      没有匹配的用户
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </>
        ) : null}

        {tab === 'orders' ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>用户</th>
                <th>商品</th>
                <th className="num">金额</th>
                <th>渠道</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((row) => (
                <tr key={row.id}>
                  <td>{day(row.createdAt)}</td>
                  <td>{row.email ?? '—'}</td>
                  <td>{row.productName ?? '—'}</td>
                  <td className="num">{money(row.amountCents)}</td>
                  <td>{row.channel}</td>
                  <td>
                    <span className={`admin-tag admin-tag--${row.status}`}>{row.status}</span>
                  </td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-empty">
                    还没有订单
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        ) : null}

        {tab === 'products' ? (
          <>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>编码</th>
                  <th>名称</th>
                  <th>类型</th>
                  <th className="num">价格</th>
                  <th className="num">天数</th>
                  <th className="num">额度</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {products.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <code>{row.code}</code>
                    </td>
                    <td>{row.name}</td>
                    <td>{row.kind === 'membership' ? '包周期' : '单次'}</td>
                    <td className="num">{money(row.priceCents)}</td>
                    <td className="num">{row.durationDays}</td>
                    <td className="num">{row.quota}</td>
                    <td>
                      <span className={`admin-tag admin-tag--${row.active ? 'paid' : 'disabled'}`}>
                        {row.active ? '上架' : '下架'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <form
              className="admin-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                try {
                  await adminApi.saveProduct({
                    code: String(form.get('code') ?? '').trim(),
                    name: String(form.get('name') ?? '').trim(),
                    kind: form.get('kind') === 'single' ? 'single' : 'membership',
                    priceCents: Math.round(Number(form.get('price') ?? 0) * 100),
                    durationDays: Number(form.get('days') ?? 0),
                    quota: Number(form.get('quota') ?? 0),
                  });
                  setNotice('商品已保存');
                  void load('products');
                  event.currentTarget.reset();
                } catch (saveError) {
                  setError(saveError instanceof Error ? saveError.message : '保存失败');
                }
              }}
            >
              <h2>新增 / 更新商品</h2>
              <label>
                编码
                <input name="code" required placeholder="member_month" />
              </label>
              <label>
                名称
                <input name="name" required placeholder="会员 · 包月" />
              </label>
              <label>
                类型
                <select name="kind" defaultValue="membership">
                  <option value="membership">包周期</option>
                  <option value="single">单次</option>
                </select>
              </label>
              <label>
                价格（元）
                <input name="price" type="number" min="0" step="0.01" defaultValue="29" />
              </label>
              <label>
                天数
                <input name="days" type="number" min="0" defaultValue="30" />
              </label>
              <label>
                额度
                <input name="quota" type="number" min="0" defaultValue="999" />
              </label>
              <button type="submit">保存</button>
            </form>
          </>
        ) : null}

        {tab === 'cdk' ? (
          <>
            <form
              className="admin-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                try {
                  const result = await adminApi.createBatch({
                    name: String(form.get('name') ?? '').trim() || undefined,
                    count: Number(form.get('count') ?? 1),
                    productId: String(form.get('productId') ?? ''),
                    credits: Number(form.get('credits') ?? 0),
                    maxUses: Number(form.get('maxUses') ?? 1),
                    expiresDays: Number(form.get('expiresDays') ?? 0),
                  });
                  setCodes(result.codes);
                  setNotice(`已生成 ${result.codes.length} 个兑换码`);
                  void load('cdk');
                } catch (createError) {
                  setError(createError instanceof Error ? createError.message : '生成失败');
                }
              }}
            >
              <h2>生成兑换码</h2>
              <label>
                批次名
                <input name="name" placeholder="双十一" />
              </label>
              <label>
                数量
                <input name="count" type="number" min="1" max="200" defaultValue="5" />
              </label>
              <label>
                关联商品
                <select name="productId" defaultValue={products[0]?.id ?? ''}>
                  <option value="">仅充值余额</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                面额（点）
                <input name="credits" type="number" min="0" defaultValue="0" />
              </label>
              <label>
                每码可用次数
                <input name="maxUses" type="number" min="1" defaultValue="1" />
              </label>
              <label>
                有效天数
                <input name="expiresDays" type="number" min="0" defaultValue="0" />
              </label>
              <button type="submit">生成</button>
            </form>

            {codes.length > 0 ? (
              <pre className="admin-codes">{codes.join('\n')}</pre>
            ) : null}

            <table className="admin-table">
              <thead>
                <tr>
                  <th>批次</th>
                  <th>备注</th>
                  <th className="num">总数</th>
                  <th className="num">已用</th>
                  <th>创建</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>{batch.name}</td>
                    <td>{batch.note ?? '—'}</td>
                    <td className="num">{batch.total}</td>
                    <td className="num">{batch.used}</td>
                    <td>{day(batch.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}

        {tab === 'audit' ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作</th>
                <th>对象</th>
                <th>操作者</th>
                <th>内容</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((entry) => (
                <tr key={entry.id}>
                  <td>{day(entry.createdAt)}</td>
                  <td>
                    <code>{entry.action}</code>
                  </td>
                  <td>{entry.target ?? '—'}</td>
                  <td>{entry.actorId ?? '—'}</td>
                  <td className="admin-payload">{entry.payload ?? '—'}</td>
                </tr>
              ))}
              {audit.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-empty">
                    暂无记录
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        ) : null}
      </main>
    </div>
  );
}
