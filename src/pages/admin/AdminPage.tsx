import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AdminForbiddenError,
  adminApi,
  type AdminAiConfig,
  type AdminAiTestResult,
  type AdminAuditRow,
  type AdminBatchRow,
  type AdminOrderRow,
  type AdminOverview,
  type AdminProductRow,
  type AdminUserRow,
} from '@/lib/admin-api';
import '@/styles/admin.css';

type Tab = 'overview' | 'ai' | 'users' | 'orders' | 'products' | 'cdk' | 'audit';

const TABS: Array<{ id: Tab; label: string; hint: string }> = [
  { id: 'overview', label: '概览', hint: '关键计数' },
  { id: 'ai', label: '模型与密钥', hint: 'API 与策略' },
  { id: 'users', label: '用户', hint: '角色与状态' },
  { id: 'orders', label: '订单', hint: '跨用户流水' },
  { id: 'products', label: '商品', hint: '套餐与单次' },
  { id: 'cdk', label: '兑换码', hint: '批次与核销' },
  { id: 'audit', label: '审计', hint: '写操作留痕' },
];

const AI_PRESETS = [
  { label: 'DeepSeek', providerName: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { label: 'OpenAI', providerName: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  {
    label: '通义千问',
    providerName: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  {
    label: '硅基流动',
    providerName: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
  },
] as const;

function money(cents: number): string {
  return `¥${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function day(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

  // AI 模型与密钥配置状态
  const [aiConfig, setAiConfig] = useState<AdminAiConfig | null>(null);
  const [aiBuiltinEnabled, setAiBuiltinEnabled] = useState(true);
  const [aiProviderName, setAiProviderName] = useState('DeepSeek');
  const [aiBaseUrl, setAiBaseUrl] = useState('https://api.deepseek.com/v1');
  const [aiModel, setAiModel] = useState('deepseek-chat');
  const [aiApiKeyInput, setAiApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [clearApiKey, setClearApiKey] = useState(false);
  const [aiPaywallEnabled, setAiPaywallEnabled] = useState(true);
  const [aiFreeDaily, setAiFreeDaily] = useState(3);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<AdminAiTestResult | null>(null);

  const syncAiForm = useCallback((cfg: AdminAiConfig) => {
    setAiConfig(cfg);
    setAiBuiltinEnabled(cfg.builtinEnabled);
    setAiProviderName(cfg.providerName);
    setAiBaseUrl(cfg.baseUrl);
    setAiModel(cfg.model);
    setAiPaywallEnabled(cfg.paywallEnabled);
    setAiFreeDaily(cfg.freeAiDaily);
    setAiApiKeyInput('');
    setClearApiKey(false);
  }, []);

  const load = useCallback(
    async (target: Tab) => {
      setLoading(true);
      setError(null);
      try {
        if (target === 'overview') setOverview((await adminApi.overview()).overview);
        if (target === 'ai') syncAiForm((await adminApi.aiConfig()).config);
        if (target === 'users') setUsers((await adminApi.users(query)).users);
        if (target === 'orders') setOrders((await adminApi.orders()).orders);
        if (target === 'products') setProducts((await adminApi.products()).products);
        if (target === 'cdk') {
          const [batchRes, prodRes] = await Promise.all([adminApi.batches(), adminApi.products()]);
          setBatches(batchRes.batches);
          setProducts(prodRes.products);
        }
        if (target === 'audit') setAudit((await adminApi.audit()).entries);
      } catch (loadError) {
        if (loadError instanceof AdminForbiddenError) setForbidden(true);
        else setError(loadError instanceof Error ? loadError.message : '加载失败。');
      } finally {
        setLoading(false);
      }
    },
    [query, syncAiForm],
  );

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  const handleSaveAiConfig = async (event: FormEvent) => {
    event.preventDefault();
    if (aiSaving) return;
    setAiSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await adminApi.saveAiConfig({
        builtinEnabled: aiBuiltinEnabled,
        providerName: aiProviderName.trim(),
        baseUrl: aiBaseUrl.trim(),
        model: aiModel.trim(),
        apiKey: aiApiKeyInput.trim() || undefined,
        clearApiKey,
        paywallEnabled: aiPaywallEnabled,
        freeAiDaily: Number(aiFreeDaily) || 0,
      });
      syncAiForm(res.config);
      setNotice('AI 模型与密钥配置已保存并立即生效');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    } finally {
      setAiSaving(false);
    }
  };

  const handleTestAiConfig = async () => {
    if (aiTesting) return;
    setAiTesting(true);
    setAiTestResult(null);
    setError(null);
    try {
      const res = await adminApi.testAiConfig({
        baseUrl: aiBaseUrl.trim(),
        model: aiModel.trim(),
        apiKey: aiApiKeyInput.trim() || undefined,
      });
      setAiTestResult(res.result);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : '测试请求失败');
    } finally {
      setAiTesting(false);
    }
  };

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
        <nav aria-label="后台导航">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`admin-nav__item${tab === item.id ? ' is-active' : ''}`}
              onClick={() => {
                setNotice(null);
                setError(null);
                setTab(item.id);
              }}
            >
              <span className="admin-nav__label">{item.label}</span>
              <small className="admin-nav__hint">{item.hint}</small>
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
            <button
              type="button"
              className="admin-btn"
              onClick={() => void load(tab)}
              disabled={loading}
            >
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

        {tab === 'ai' ? (
          <form className="admin-ai-layout" onSubmit={handleSaveAiConfig}>
            <section className="admin-card">
              <div className="admin-card__head">
                <div>
                  <h2>模型接口与密钥（OpenAI 兼容）</h2>
                  <p>保存后立即热生效，无需重启服务；留空 API Key 表示保留当前已配置密钥。</p>
                </div>
                {aiConfig ? (
                  <span
                    className={`admin-tag ${
                      aiConfig.hasApiKey ? 'admin-tag--active' : 'admin-tag--disabled'
                    }`}
                  >
                    {aiConfig.hasApiKey
                      ? `已配置 (${aiConfig.keySource === 'db' ? '后台存储' : '环境变量'}: ${aiConfig.apiKeyMasked})`
                      : '未配置密钥'}
                  </span>
                ) : null}
              </div>

              <div className="admin-presets">
                <span className="admin-presets__label">快捷预设：</span>
                {AI_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="admin-btn admin-btn--subtle"
                    onClick={() => {
                      setAiProviderName(preset.providerName);
                      setAiBaseUrl(preset.baseUrl);
                      setAiModel(preset.model);
                      setAiTestResult(null);
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="admin-form-grid">
                <Label className="admin-field">
                  <span>供应商展示名</span>
                  <Input
                    value={aiProviderName}
                    onChange={(event) => setAiProviderName(event.target.value)}
                    placeholder="例如：DeepSeek / OpenAI"
                  />
                </Label>
                <Label className="admin-field">
                  <span>默认模型（Model）</span>
                  <Input
                    value={aiModel}
                    required
                    onChange={(event) => setAiModel(event.target.value)}
                    placeholder="例如：deepseek-chat / gpt-4o-mini"
                  />
                </Label>
                <Label className="admin-field admin-field--wide">
                  <span>API Base URL</span>
                  <Input
                    value={aiBaseUrl}
                    required
                    onChange={(event) => setAiBaseUrl(event.target.value)}
                    placeholder="https://api.deepseek.com/v1"
                  />
                </Label>
                <div className="admin-field admin-field--wide">
                  <Label htmlFor="admin-ai-api-key">API Key（密钥）</Label>
                  <div className="admin-secret-row">
                    <Input
                      id="admin-ai-api-key"
                      type={showApiKey ? 'text' : 'password'}
                      value={aiApiKeyInput}
                      disabled={clearApiKey}
                      autoComplete="new-password"
                      onChange={(event) => setAiApiKeyInput(event.target.value)}
                      placeholder={
                        aiConfig?.hasApiKey
                          ? `留空则保持原密钥（${aiConfig.apiKeyMasked}）`
                          : '请输入 sk-... 密钥'
                      }
                    />
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => setShowApiKey((v) => !v)}
                    >
                      {showApiKey ? '隐藏' : '显示'}
                    </button>
                  </div>
                  {aiConfig?.keySource === 'db' ? (
                    <label className="admin-checkbox-inline">
                      <input
                        type="checkbox"
                        checked={clearApiKey}
                        onChange={(event) => setClearApiKey(event.target.checked)}
                      />
                      <span>清空后台存储的密钥（回退至服务器环境变量）</span>
                    </label>
                  ) : null}
                </div>
              </div>

              <div className="admin-switch-list">
                <label className="admin-switch-row">
                  <input
                    type="checkbox"
                    checked={aiBuiltinEnabled}
                    onChange={(event) => setAiBuiltinEnabled(event.target.checked)}
                  />
                  <span>
                    <strong>启用站点内置 AI 解读</strong>
                    <small>关闭后前端将隐藏默认内置模型，仅允许用户自带 Key</small>
                  </span>
                </label>
              </div>
            </section>

            <section className="admin-card">
              <div className="admin-card__head">
                <div>
                  <h2>额度与付费墙策略</h2>
                  <p>控制免费用户每日可用内置 AI 解读次数，会员不限次。</p>
                </div>
                {aiConfig?.updatedAt ? (
                  <span className="admin-meta-time">上次修改：{dateTime(aiConfig.updatedAt)}</span>
                ) : null}
              </div>

              <div className="admin-form-grid">
                <label className="admin-switch-row admin-field--wide">
                  <input
                    type="checkbox"
                    checked={aiPaywallEnabled}
                    onChange={(event) => setAiPaywallEnabled(event.target.checked)}
                  />
                  <span>
                    <strong>开启 AI 付费墙与免费额度限制</strong>
                    <small>关闭后所有用户均可免费不限次使用内置 AI 解读</small>
                  </span>
                </label>

                <Label className="admin-field">
                  <span>每日免费 AI 次数（非会员）</span>
                  <Input
                    type="number"
                    min="0"
                    max="9999"
                    value={aiFreeDaily}
                    disabled={!aiPaywallEnabled}
                    onChange={(event) => setAiFreeDaily(Number(event.target.value))}
                  />
                </Label>
              </div>

              {aiTestResult ? (
                <div className={`admin-test-result ${aiTestResult.ok ? 'is-ok' : 'is-fail'}`}>
                  <strong>
                    {aiTestResult.ok
                      ? `连通成功（${aiTestResult.latencyMs}ms · ${aiTestResult.model}）`
                      : `连通失败（${aiTestResult.latencyMs}ms · ${aiTestResult.model}）`}
                  </strong>
                  <span>{aiTestResult.ok ? `返回：${aiTestResult.replyPreview}` : aiTestResult.error}</span>
                </div>
              ) : null}

              <div className="admin-card__actions">
                <button
                  type="button"
                  className="admin-btn"
                  disabled={aiTesting || aiSaving}
                  onClick={() => void handleTestAiConfig()}
                >
                  {aiTesting ? '测试中…' : '测试连通性'}
                </button>
                <button type="submit" className="admin-btn admin-btn--primary" disabled={aiSaving}>
                  {aiSaving ? '保存中…' : '保存并立即生效'}
                </button>
              </div>
            </section>
          </form>
        ) : null}

        {tab === 'users' ? (
          <>
            <div className="admin-toolbar">
              <Input
                type="search"
                value={query}
                placeholder="搜索邮箱或称呼"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void load('users');
                }}
              />
              <button type="button" className="admin-btn" onClick={() => void load('users')}>
                查询
              </button>
            </div>
            <div className="admin-table-wrap">
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
                          className="admin-btn admin-btn--sm"
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
                          className="admin-btn admin-btn--sm"
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
            </div>
          </>
        ) : null}

        {tab === 'orders' ? (
          <div className="admin-table-wrap">
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
          </div>
        ) : null}

        {tab === 'products' ? (
          <>
            <div className="admin-table-wrap">
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
            </div>

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
              <Label>
                编码
                <Input name="code" required placeholder="member_month" />
              </Label>
              <Label>
                名称
                <Input name="name" required placeholder="会员 · 包月" />
              </Label>
              <Label>
                类型
                <select name="kind" defaultValue="membership">
                  <option value="membership">包周期</option>
                  <option value="single">单次</option>
                </select>
              </Label>
              <Label>
                价格（元）
                <Input name="price" type="number" min="0" step="0.01" defaultValue="29" />
              </Label>
              <Label>
                天数
                <Input name="days" type="number" min="0" defaultValue="30" />
              </Label>
              <Label>
                额度
                <Input name="quota" type="number" min="0" defaultValue="999" />
              </Label>
              <button type="submit" className="admin-btn admin-btn--primary">
                保存
              </button>
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
              <Label>
                批次名
                <Input name="name" placeholder="双十一" />
              </Label>
              <Label>
                数量
                <Input name="count" type="number" min="1" max="200" defaultValue="5" />
              </Label>
              <Label>
                关联商品
                <select name="productId" defaultValue={products[0]?.id ?? ''}>
                  <option value="">仅充值余额</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </Label>
              <Label>
                面额（点）
                <Input name="credits" type="number" min="0" defaultValue="0" />
              </Label>
              <Label>
                每码可用次数
                <Input name="maxUses" type="number" min="1" defaultValue="1" />
              </Label>
              <Label>
                有效天数
                <Input name="expiresDays" type="number" min="0" defaultValue="0" />
              </Label>
              <button type="submit" className="admin-btn admin-btn--primary">
                生成
              </button>
            </form>

            {codes.length > 0 ? <pre className="admin-codes">{codes.join('\n')}</pre> : null}

            <div className="admin-table-wrap">
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
            </div>
          </>
        ) : null}

        {tab === 'audit' ? (
          <div className="admin-table-wrap">
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
                    <td>{dateTime(entry.createdAt)}</td>
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
          </div>
        ) : null}
      </main>
    </div>
  );
}
