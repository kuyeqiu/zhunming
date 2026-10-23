import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { appApi, isApiError, type AppAccess, type AppSummary } from '@/lib/app-api';
import { useSession } from '@/hooks/useSession';

type Mode = 'login' | 'register';

function formatDate(iso: string | null): string {
  if (!iso) return '长期有效';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatPrice(cents: number): string {
  if (cents === 0) return '免费';
  return `¥${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** 未登录：入册（登录 / 注册） */
function AccessPanel({
  onDone,
  login,
  register,
}: {
  onDone: () => void;
  login: (email: string, password: string) => Promise<unknown>;
  register: (email: string, password: string, displayName?: string) => Promise<unknown>;
}) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await register(email.trim(), password, displayName.trim() || undefined);
      onDone();
    } catch (submitError) {
      setError(isApiError(submitError) ? submitError.message : '提交失败，请稍后再试。');
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="ink-acct">
      <div className="ink-acct__mark" aria-hidden="true">
        册
      </div>
      <h1 className="ink-acct__title">入 册</h1>
      <p className="ink-acct__lead">账号用于保存解读记录与已购权益，排盘始终免费。</p>

      <div className="ink-motif-switch ink-acct__tabs" role="tablist" aria-label="登录或注册">
        <button type="button" aria-pressed={mode === 'login'} onClick={() => setMode('login')}>
          登录
        </button>
        <button type="button" aria-pressed={mode === 'register'} onClick={() => setMode('register')}>
          注册
        </button>
      </div>

      <form className="ink-acct__form" onSubmit={submit}>
        <label className="ink-field">
          <span className="ink-field__label">邮箱</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>

        {mode === 'register' ? (
          <label className="ink-field">
            <span className="ink-field__label">称呼</span>
            <input
              type="text"
              name="displayName"
              maxLength={40}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="可留空"
            />
          </label>
        ) : null}

        <label className="ink-field">
          <span className="ink-field__label">密码</span>
          <input
            type="password"
            name="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="至少 8 位"
          />
        </label>

        {error ? (
          <p className="ink-acct__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="ink-acct__actions">
          <button type="submit" className="ink-btn" disabled={pending}>
            {pending ? '处理中…' : mode === 'login' ? '登入' : '注册并登入'}
          </button>
        </div>
      </form>
    </section>
  );
}

/** 已登录：账户概览 */
function AccountView({
  summary,
  access,
  onChanged,
  onLogout,
}: {
  summary: AppSummary;
  access: AppAccess | null;
  onChanged: () => void;
  onLogout: () => void;
}) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const activeEntitlements = useMemo(
    () => summary.entitlements.filter((item) => item.active),
    [summary.entitlements],
  );

  const redeem = async (event: FormEvent) => {
    event.preventDefault();
    if (pending || !code.trim()) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await appApi.redeem(code.trim());
      setCode('');
      setMessage(
        result.productName
          ? `已开通：${result.productName}`
          : `已入账 ${result.balance} 点余额`,
      );
      onChanged();
    } catch (redeemError) {
      setError(isApiError(redeemError) ? redeemError.message : '兑换失败，请稍后再试。');
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="ink-acct ink-acct--wide">
      <header className="ink-acct__head">
        <div>
          <h1 className="ink-acct__title ink-acct__title--left">
            {summary.user.displayName || summary.user.email.split('@')[0]}
          </h1>
          <p className="ink-acct__sub">
            {summary.user.email}
            {summary.user.role === 'admin' ? ' · 管理员' : ''}
          </p>
        </div>
        <div className="ink-acct__head-actions">
          {summary.user.role === 'admin' ? (
            <Link className="ink-btn ink-btn--ghost" to="/admin">
              管理后台
            </Link>
          ) : null}
          <button type="button" className="ink-btn ink-btn--ghost" onClick={onLogout}>
            退出
          </button>
        </div>
      </header>

      <div className="ink-acct__stats">
        <div>
          <span className="ink-acct__stat-label">余额</span>
          <strong className="ink-acct__stat-value">{summary.balance}</strong>
        </div>
        <div>
          <span className="ink-acct__stat-label">有效权益</span>
          <strong className="ink-acct__stat-value">{activeEntitlements.length}</strong>
        </div>
        <div>
          <span className="ink-acct__stat-label">订单</span>
          <strong className="ink-acct__stat-value">{summary.orders.length}</strong>
        </div>
        <div>
          <span className="ink-acct__stat-label">今日解读</span>
          <strong className="ink-acct__stat-value">
            {access ? (access.tier === 'member' ? '无限' : `${access.remaining}/${access.limit}`) : '—'}
          </strong>
        </div>
      </div>

      <div className="ink-divider ink-divider--left">
        <h2>票 券</h2>
        <p>兑换码即时开通，无需等待</p>
      </div>

      <form className="ink-acct__redeem" onSubmit={redeem}>
        <label className="ink-field">
          <span className="ink-field__label">兑换码</span>
          <input
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="XXXX-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button type="submit" className="ink-btn ink-btn--seal" disabled={pending || !code.trim()}>
          {pending ? '核销中…' : '兑换'}
        </button>
      </form>
      {message ? <p className="ink-acct__ok">{message}</p> : null}
      {error ? (
        <p className="ink-acct__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="ink-divider ink-divider--left">
        <h2>权 益</h2>
      </div>
      {summary.entitlements.length === 0 ? (
        <p className="ink-acct__empty">还没有权益。兑换码开通后会出现在这里。</p>
      ) : (
        <ul className="ink-acct__list">
          {summary.entitlements.map((item) => (
            <li key={item.id} className={item.active ? '' : 'is-muted'}>
              <span className="ink-acct__list-name">{item.productName ?? '权益'}</span>
              <span className="ink-acct__list-meta">
                {item.kind === 'membership' ? '会员' : '单次'} · 额度 {item.quota} ·{' '}
                {formatDate(item.expiresAt)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="ink-divider ink-divider--left">
        <h2>订 单</h2>
      </div>
      {summary.orders.length === 0 ? (
        <p className="ink-acct__empty">暂无订单。</p>
      ) : (
        <ul className="ink-acct__list">
          {summary.orders.map((order) => (
            <li key={order.id}>
              <span className="ink-acct__list-name">{order.productName ?? '订单'}</span>
              <span className="ink-acct__list-meta">
                {formatPrice(order.amountCents)} · {order.channel} · {formatDate(order.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AccountPage() {
  const { user, loading, error, refresh, login, register, logout } = useSession();
  const [summary, setSummary] = useState<AppSummary | null>(null);
  const [access, setAccess] = useState<AppAccess | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const loadSummary = () => {
    void appApi
      .access()
      .then(setAccess)
      .catch(() => setAccess(null));
    void appApi
      .summary()
      .then((data) => {
        setSummary(data);
        setSummaryError(null);
      })
      .catch((loadError) => {
        setSummary(null);
        setSummaryError(isApiError(loadError) ? loadError.message : '无法加载账户信息。');
      });
  };

  useEffect(() => {
    if (user) loadSummary();
    else setSummary(null);
  }, [user]);

  if (loading && !user) {
    return (
      <div className="ink-page ink-acct-shell">
        <p className="ink-acct__empty">正在读取…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ink-page ink-acct-shell">
        <p className="ink-acct__error" role="alert">
          {error}
        </p>
        <button type="button" className="ink-btn" onClick={() => void refresh()}>
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="ink-page ink-acct-shell">
      {user ? (
        summary ? (
          <AccountView
            summary={summary}
            access={access}
            onChanged={loadSummary}
            onLogout={() => void logout()}
          />
        ) : (
          <p className="ink-acct__empty">{summaryError ?? '正在读取账户…'}</p>
        )
      ) : (
        <AccessPanel
          login={login}
          register={register}
          onDone={() => {
            void refresh();
          }}
        />
      )}
    </div>
  );
}
