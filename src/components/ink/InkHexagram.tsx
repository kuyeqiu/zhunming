import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  getContextHexagramLot,
  getDailyFortune,
  getDailyHexagramLot,
  getHexagramFullName,
  getHexagramLines,
  getRandomHexagramLot,
  getShichenLabel,
  formatSolarDateLabel,
  type HexagramLot,
} from '@/lib/hexagram-lot';

const YANG_STROKES = [
  '/ink-hexagrams/yang-1.webp',
  '/ink-hexagrams/yang-2.webp',
  '/ink-hexagrams/yang-3.webp',
] as const;

const YIN_STROKES = [
  '/ink-hexagrams/yin-1.webp',
  '/ink-hexagrams/yin-2.webp',
  '/ink-hexagrams/yin-3.webp',
] as const;

export type InkHexagramSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type InkHexagramTone = 'solid' | 'soft' | 'watermark';

type InkHexagramProps = {
  lot: HexagramLot;
  size?: InkHexagramSize;
  tone?: InkHexagramTone;
  animate?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
};

/**
 * 水墨手绘卦象：由真实手绘墨迹爻线动态拼合全部六十四卦。
 * 每条爻线按卦序与爻位自动错落选用不同墨痕与轻微翻转，避免机械重复感。
 */
export function InkHexagram({
  lot,
  size = 'md',
  tone = 'solid',
  animate = true,
  interactive = false,
  onClick,
  title,
  className = '',
}: InkHexagramProps) {
  const lines = useMemo(() => getHexagramLines(lot), [lot]);

  const strokeItems = useMemo(
    () =>
      lines.map((yao, index) => {
        const pool = yao === 1 ? YANG_STROKES : YIN_STROKES;
        const variantIdx = (lot.no * 5 + index * 2 + (yao === 1 ? 1 : 0)) % pool.length;
        const flipX = ((lot.no + index * 3) % 2) === 1;
        const microRotate = (((lot.no * 7 + index * 11) % 9) - 4) * 0.11; // -0.44deg .. +0.44deg
        const microShift = (((lot.no * 3 + index * 5) % 5) - 2) * 0.45; // -0.9% .. +0.9%
        return {
          src: pool[variantIdx],
          yao,
          flipX,
          microRotate,
          microShift,
          delayMs: index * 48,
        };
      }),
    [lines, lot.no],
  );

  const label = `${getHexagramFullName(lot)}（${lot.trigrams}）`;

  const inner = (
    <span
      key={lot.no}
      className={`ink-hexagram__stack${animate ? ' is-animated' : ''}`}
      aria-hidden="true"
    >
      {strokeItems.map((item, index) => (
        <span
          key={`${lot.no}-${index}`}
          className="ink-hexagram__line"
          style={
            {
              '--ink-hex-delay': `${item.delayMs}ms`,
              '--ink-hex-shift': `${item.microShift}%`,
              '--ink-hex-rot': `${item.microRotate}deg`,
              '--ink-hex-flip': item.flipX ? -1 : 1,
            } as CSSProperties
          }
        >
          <img
            src={item.src}
            alt=""
            draggable={false}
            decoding="async"
            loading="eager"
          />
        </span>
      ))}
    </span>
  );

  const classes = [
    'ink-hexagram',
    `ink-hexagram--${size}`,
    `ink-hexagram--${tone}`,
    interactive ? 'is-interactive' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (interactive && onClick) {
    return (
      <button
        type="button"
        className={classes}
        onClick={onClick}
        title={title ?? `${label} · 点击换一卦`}
        aria-label={title ?? `${label}，点击换一卦`}
      >
        {inner}
      </button>
    );
  }

  return (
    <span className={classes} role="img" aria-label={label} title={title ?? label}>
      {inner}
    </span>
  );
}

/**
 * 岁庚页右侧主展示区：严格呼应设计稿布局——
 * 上方：左侧水墨大卦 + 右侧卦象笺框（卦名、上下卦、卦辞、换卦）
 * 下方：书法「今日吉凶」标题 + 运势宜忌长卡
 */
export function InkHexagramShowcase({
  contextKey = 'profile',
  className = '',
}: {
  contextKey?: string;
  className?: string;
}) {
  const [mode, setMode] = useState<'daily' | 'cast'>('daily');
  const [lot, setLot] = useState<HexagramLot>(() => getDailyHexagramLot());

  useEffect(() => {
    if (mode === 'daily') {
      setLot(getDailyHexagramLot());
    }
  }, [contextKey, mode]);

  const handleRecast = useCallback(() => {
    setMode('cast');
    setLot((current) => getRandomHexagramLot(current.no));
  }, []);

  const handleRestoreDaily = useCallback(() => {
    setMode('daily');
    setLot(getDailyHexagramLot());
  }, []);

  const fullName = useMemo(() => getHexagramFullName(lot), [lot]);
  const fortune = useMemo(() => getDailyFortune(lot), [lot]);
  const isAuspicious = fortune.verdict.includes('吉');

  return (
    <aside
      className={`ink-hex-showcase ${className}`.trim()}
      aria-label="今日之卦与今日吉凶"
    >
      <div className="ink-hex-showcase__top">
        <div className="ink-hex-showcase__art">
          <InkHexagram
            lot={lot}
            size="xl"
            tone="solid"
            interactive
            onClick={handleRecast}
            title={`${fullName} · 点击随缘换一卦`}
          />
          <span className="ink-hex-showcase__art-hint">轻点卦象可随缘变卦</span>
        </div>

        <div className="ink-hex-showcase__scroll">
          <div className="ink-hex-showcase__scroll-head">
            <span className="ink-hex-showcase__kicker">
              {mode === 'daily' ? '今日之卦' : '随缘一卦'}
            </span>
            <span className="ink-hex-showcase__seal">第{lot.no}卦</span>
          </div>

          <div className="ink-hex-showcase__title-row">
            <h3 className="ink-hex-showcase__name">{fullName}</h3>
            <span className="ink-hex-showcase__trigrams">{lot.trigrams}</span>
          </div>

          <p className="ink-hex-showcase__quote">{lot.text}</p>

          <div className="ink-hex-showcase__scroll-foot">
            <span className="ink-hex-showcase__time">
              {fortune.dateLabel} · {fortune.shichenLabel}
            </span>
            <div className="ink-hex-showcase__actions">
              {mode === 'cast' ? (
                <button
                  type="button"
                  className="ink-hex-action-btn"
                  onClick={handleRestoreDaily}
                >
                  归今日卦
                </button>
              ) : null}
              <button
                type="button"
                className="ink-hex-action-btn is-accent"
                onClick={handleRecast}
              >
                换一卦
              </button>
            </div>
          </div>
        </div>
      </div>

      <section className="ink-hex-fortune" aria-label="今日吉凶">
        <header className="ink-hex-fortune__header">
          <h3 className="ink-hex-fortune__heading">今日吉凶</h3>
          <span className="ink-hex-fortune__sub">
            {fullName} · {fortune.shichenLabel}
          </span>
        </header>

        <div className="ink-hex-fortune__card">
          <div className="ink-hex-fortune__lead">
            <span
              className={`ink-hex-fortune__verdict${isAuspicious ? ' is-auspicious' : ''}`}
            >
              {fortune.verdict}
            </span>
            <p className="ink-hex-fortune__detail">{fortune.detail}</p>
          </div>

          <div className="ink-hex-fortune__yiji">
            <div className="ink-hex-fortune__yiji-group">
              <span className="ink-hex-fortune__yiji-tag is-yi">宜</span>
              <span className="ink-hex-fortune__yiji-list">
                {fortune.suitable.join(' · ')}
              </span>
            </div>
            <div className="ink-hex-fortune__yiji-group">
              <span className="ink-hex-fortune__yiji-tag is-ji">忌</span>
              <span className="ink-hex-fortune__yiji-list">
                {fortune.avoid.join(' · ')}
              </span>
            </div>
          </div>
        </div>
      </section>
    </aside>
  );
}

/**
 * 桌面端右侧留白伴随组件（用于排盘输入、占问、账户、案例、排盘目录等页）：
 * 随当前页面语境、时辰自动流转卦象，支持点击变卦，轻墨不喧宾夺主。
 */
export function InkHexagramAside({
  contextKey,
  caption,
  showFortune = false,
  className = '',
}: {
  contextKey: string;
  caption?: string;
  showFortune?: boolean;
  className?: string;
}) {
  const [salt, setSalt] = useState(0);
  const [customLot, setCustomLot] = useState<HexagramLot | null>(null);

  // 路由或工具切换时，回到该语境的对应卦象并触发水墨过渡
  useEffect(() => {
    setCustomLot(null);
    setSalt(0);
  }, [contextKey]);

  const lot = useMemo(
    () => customLot ?? getContextHexagramLot(contextKey, { salt }),
    [contextKey, customLot, salt],
  );
  const fullName = useMemo(() => getHexagramFullName(lot), [lot]);
  const fortune = useMemo(() => (showFortune ? getDailyFortune(lot) : null), [lot, showFortune]);

  const handleCycle = useCallback(() => {
    setCustomLot((current) => getRandomHexagramLot((current ?? lot).no));
  }, [lot]);

  return (
    <aside className={`ink-hex-aside ${className}`.trim()} aria-label={`${fullName}水墨卦象`}>
      <div className="ink-hex-aside__art">
        <InkHexagram
          lot={lot}
          size="lg"
          tone="soft"
          interactive
          onClick={handleCycle}
          title={`${fullName} · 点击换一卦`}
        />
      </div>

      <div className="ink-hex-aside__meta">
        <div className="ink-hex-aside__title-line">
          <strong>{fullName}</strong>
          <span>{lot.trigrams}</span>
        </div>
        <p className="ink-hex-aside__quote">{lot.text}</p>
        {caption ? <p className="ink-hex-aside__caption">{caption}</p> : null}
      </div>

      {fortune ? (
        <div className="ink-hex-aside__fortune">
          <div className="ink-hex-aside__fortune-head">
            <span>今日吉凶</span>
            <strong className={fortune.verdict.includes('吉') ? 'is-auspicious' : ''}>
              {fortune.verdict}
            </strong>
          </div>
          <p>{fortune.detail}</p>
          <div className="ink-hex-aside__fortune-tags">
            <span>宜：{fortune.suitable.slice(0, 2).join('、')}</span>
            <span>忌：{fortune.avoid[0]}</span>
          </div>
        </div>
      ) : null}

      <div className="ink-hex-aside__foot">
        <span>
          {formatSolarDateLabel()} · {getShichenLabel()}
        </span>
        <button type="button" className="ink-hex-action-btn" onClick={handleCycle}>
          换一卦
        </button>
      </div>
    </aside>
  );
}

/**
 * 章节分隔水墨卦象（用于教程页、账户页区块之间）
 */
export function InkHexagramDivider({
  contextKey,
  salt = 0,
  className = '',
}: {
  contextKey: string;
  salt?: number;
  className?: string;
}) {
  const [lot, setLot] = useState<HexagramLot>(() => getContextHexagramLot(contextKey, { salt }));

  useEffect(() => {
    setLot(getContextHexagramLot(contextKey, { salt }));
  }, [contextKey, salt]);

  const fullName = useMemo(() => getHexagramFullName(lot), [lot]);

  return (
    <div className={`ink-hex-divider ${className}`.trim()} aria-label={`分隔卦象 ${fullName}`}>
      <span className="ink-hex-divider__rule" aria-hidden="true" />
      <button
        type="button"
        className="ink-hex-divider__center"
        onClick={() => setLot((curr) => getRandomHexagramLot(curr.no))}
        title={`${fullName} · 点击换一卦`}
      >
        <InkHexagram lot={lot} size="xs" tone="soft" />
        <span className="ink-hex-divider__label">{fullName}</span>
      </button>
      <span className="ink-hex-divider__rule" aria-hidden="true" />
    </div>
  );
}

/**
 * 空状态水墨卦象占位（用于文字与数理空白结果区、空案例列表等）
 */
export function InkHexagramEmpty({
  contextKey,
  title,
  text,
  className = '',
}: {
  contextKey: string;
  title: string;
  text: string;
  className?: string;
}) {
  const [lot, setLot] = useState<HexagramLot>(() => getContextHexagramLot(contextKey));

  useEffect(() => {
    setLot(getContextHexagramLot(contextKey));
  }, [contextKey]);

  const fullName = useMemo(() => getHexagramFullName(lot), [lot]);

  return (
    <div className={`ink-hex-empty ${className}`.trim()}>
      <InkHexagram
        lot={lot}
        size="md"
        tone="soft"
        interactive
        onClick={() => setLot((curr) => getRandomHexagramLot(curr.no))}
        title={`${fullName} · 点击换一卦`}
      />
      <span className="ink-hex-empty__hex-name">
        {fullName} · {lot.trigrams}
      </span>
      <h3 className="ink-hex-empty__title">{title}</h3>
      <p className="ink-hex-empty__text">{text}</p>
    </div>
  );
}
