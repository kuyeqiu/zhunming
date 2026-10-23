import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { readInkMode, toggleInkMode, type InkMode } from '@/lib/ink-theme';

const PRIMARY_LINKS = [
  { href: '/chart/bazi', label: '排盘' },
  { href: '/divination/liuyao', label: '占问' },
  { href: '/calendar', label: '历法' },
  { href: '/account', label: '我的' },
];

/**
 * 顶部一行导航：取代原来的 248px 常驻侧栏。
 *
 * 只有五个入口 + 两个动作（工具抽屉、夜墨）。工具全集仍在抽屉里，
 * 所以去掉侧栏不会丢功能，只是把"墙"藏到一次点击之后。
 */
export function InkTopBar({ onOpenTools }: { onOpenTools: () => void }) {
  const location = useLocation();
  const [mode, setMode] = useState<InkMode>(readInkMode);

  useEffect(() => {
    setMode(readInkMode());
  }, []);

  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(`${href}/`);

  return (
    <header className="ink-topbar">
      <Link className="ink-topbar__brand" to="/" aria-label="命语首页">
        <span className="ink-topbar__seal" aria-hidden="true">
          命
        </span>
        <span className="ink-topbar__name">命语</span>
      </Link>

      <nav className="ink-topbar__nav" aria-label="主导航">
        {PRIMARY_LINKS.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={isActive(item.href) ? 'is-active' : ''}
            aria-current={isActive(item.href) ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ink-topbar__actions">
        <button type="button" onClick={onOpenTools} aria-label="打开全部工具">
          工具
        </button>
        <button
          type="button"
          aria-label={mode === 'dark' ? '切换为浅色' : '切换为夜墨'}
          onClick={() => setMode(toggleInkMode())}
        >
          {mode === 'dark' ? '昼' : '夜'}
        </button>
      </div>
    </header>
  );
}
