import { Link, useLocation } from 'react-router-dom';
import { cn } from 'cn';

const PRIMARY_LINKS = [
  { href: '/chart', label: '排盘', match: '/chart', exclude: '/profile' },
  { href: '/divination/liuyao', label: '占问', match: '/divination', exclude: '/divination/almanac' },
  { href: '/divination/almanac', label: '择日' },
  { href: '/profile', label: '岁庚' },
];

/**
 * 顶部一行导航：排盘 / 占问 / 择日 / 岁庚，账号入口「我的」固定在右端。
 * 岁庚＝出生年月日时之纪，这里用来收个人资料。
 */
export function InkTopBar() {
  const location = useLocation();

  const isActive = (item: (typeof PRIMARY_LINKS)[number]) => {
    const match: string = 'match' in item && item.match ? item.match : item.href;
    if (!location.pathname.startsWith(match)) return false;
    if ('exclude' in item && item.exclude && location.pathname.startsWith(item.exclude)) {
      return false;
    }
    return true;
  };

  return (
    <header className="ink-topbar">
      <Link className="ink-topbar__brand" to="/" aria-label="准命首页">
        <span className="ink-topbar__seal" aria-hidden="true">
          准
        </span>
        <span className="ink-topbar__name">准命</span>
      </Link>

      <nav className="ink-topbar__nav" aria-label="主导航">
        {PRIMARY_LINKS.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={isActive(item) ? 'is-active' : ''}
            aria-current={isActive(item) ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ink-topbar__actions">
        <Link
          to="/account"
          className={cn(
            'ink-topbar__account',
            location.pathname === '/account' && 'is-active',
          )}
          aria-current={location.pathname === '/account' ? 'page' : undefined}
        >
          我的
        </Link>
      </div>
    </header>
  );
}
