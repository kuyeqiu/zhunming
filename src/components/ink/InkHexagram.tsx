import { useEffect, useMemo, type CSSProperties } from 'react';
import {
  getContextHexagramLot,
  getHexagramFullName,
  getHexagramLines,
  getShichenLabel,
  formatSolarDateLabel,
  type HexagramLot,
} from '@/lib/hexagram-lot';
import {
  computeRealDailyAlmanac,
  computeRealDailyHexagram,
  getHexagramGuidance,
} from '@/lib/daily-almanac-hexagram';

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

const ALL_STROKE_URLS = [...YANG_STROKES, ...YIN_STROKES] as const;

let strokesPreloaded = false;
function preloadInkStrokes() {
  if (strokesPreloaded || typeof window === 'undefined') return;
  strokesPreloaded = true;
  for (const url of ALL_STROKE_URLS) {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
  }
}

export type InkHexagramSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type InkHexagramTone = 'solid' | 'soft' | 'watermark';

type InkHexagramProps = {
  lot: HexagramLot;
  size?: InkHexagramSize;
  tone?: InkHexagramTone;
  animate?: boolean;
  title?: string;
  className?: string;
};

/**
 * 水墨手绘卦象：由真实手绘墨迹爻线动态拼合全部六十四卦。
 * 每条爻线按卦序与爻位自动错落选用不同墨痕与轻微翻转，保持真实手绘墨韵。
 */
export function InkHexagram({
  lot,
  size = 'md',
  tone = 'solid',
  animate = true,
  title,
  className = '',
}: InkHexagramProps) {
  const lines = useMemo(() => getHexagramLines(lot), [lot]);

  useEffect(() => {
    preloadInkStrokes();
  }, []);

  const strokeItems = useMemo(
    () =>
      lines.map((yao, index) => {
        const pool = yao === 1 ? YANG_STROKES : YIN_STROKES;
        const variantIdx = (lot.no * 5 + index * 2 + (yao === 1 ? 1 : 0)) % pool.length;
        const flipX = (lot.no + index * 3) % 2 === 1;
        const microRotate = (((lot.no * 7 + index * 11) % 9) - 4) * 0.11;
        const microShift = (((lot.no * 3 + index * 5) % 5) - 2) * 0.45;
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

  const classes = [
    'ink-hexagram',
    `ink-hexagram--${size}`,
    `ink-hexagram--${tone}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} role="img" aria-label={label} title={title ?? label}>
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
            <img src={item.src} alt="" draggable={false} decoding="async" loading="eager" />
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * 岁庚页右侧主展示区：
 * - 上方：真实《梅花易数》时间起卦（手绘水墨大卦 + 卦名、卦辞、白话卦义、本卦可做/不宜）
 * - 下方：真实黄历择日「今日吉凶」（干支农历、建除十二神、黄道黑道、冲煞、黄历宜忌、彭祖百忌）
 * 严格按当日天时与历法推算，绝不随机，不提供随意点换。
 */
export function InkHexagramShowcase({ className = '' }: { contextKey?: string; className?: string }) {
  const dailyHex = useMemo(() => computeRealDailyHexagram(), []);
  const almanac = useMemo(() => computeRealDailyAlmanac(), []);

  return (
    <aside
      className={`ink-hex-showcase ${className}`.trim()}
      aria-label="今日之卦与今日吉凶"
    >
      <div className="ink-hex-showcase__top">
        <div className="ink-hex-showcase__art">
          <InkHexagram
            lot={dailyHex.lot}
            size="xl"
            tone="solid"
            title={`${dailyHex.fullName}（${dailyHex.lot.trigrams}）`}
          />
          <span className="ink-hex-showcase__art-hint">
            时间起卦 · {dailyHex.movingYaoName}动
            {dailyHex.changedName ? ` · 变${dailyHex.changedName}` : ''}
          </span>
        </div>

        <div className="ink-hex-showcase__scroll">
          <div className="ink-hex-showcase__scroll-head">
            <span className="ink-hex-showcase__kicker">今日之卦 · 梅花时间起卦</span>
            <span className="ink-hex-showcase__seal">第{dailyHex.lot.no}卦</span>
          </div>

          <div className="ink-hex-showcase__title-row">
            <h3 className="ink-hex-showcase__name">{dailyHex.fullName}</h3>
            <span className="ink-hex-showcase__trigrams">
              {dailyHex.lot.trigrams}
              {dailyHex.tiYongRelation ? ` · ${dailyHex.tiYongRelation}` : ''}
            </span>
          </div>

          <p className="ink-hex-showcase__quote">《周易》：{dailyHex.lot.text}</p>

          <p className="ink-hex-showcase__meaning">{dailyHex.guidance.plainMeaning}</p>

          <div className="ink-hex-showcase__advice">
            <div className="ink-hex-showcase__advice-row">
              <span className="ink-hex-fortune__yiji-tag is-yi">宜</span>
              <span>{dailyHex.guidance.suitable.join(' · ')}</span>
            </div>
            <div className="ink-hex-showcase__advice-row">
              <span className="ink-hex-fortune__yiji-tag is-ji">忌</span>
              <span>{dailyHex.guidance.avoid.join(' · ')}</span>
            </div>
          </div>

          <div className="ink-hex-showcase__scroll-foot">
            <span className="ink-hex-showcase__time">
              {almanac.lunarDate} · {dailyHex.shichenLabel}
              {dailyHex.interName ? ` · 互卦${dailyHex.interName}` : ''}
            </span>
          </div>
        </div>
      </div>

      <section className="ink-hex-fortune" aria-label="今日吉凶">
        <header className="ink-hex-fortune__header">
          <h3 className="ink-hex-fortune__heading">今日吉凶</h3>
          <span className="ink-hex-fortune__sub">
            {almanac.dateLabel} · {almanac.lunarDate} · {almanac.ganzhiLabel}
          </span>
        </header>

        <div className="ink-hex-fortune__card">
          <div className="ink-hex-fortune__lead">
            <span
              className={`ink-hex-fortune__verdict${almanac.isAuspicious ? ' is-auspicious' : ''}`}
            >
              {almanac.verdict}
            </span>
            <div className="ink-hex-fortune__lead-copy">
              <p className="ink-hex-fortune__basis">{almanac.basisSummary}</p>
              <p className="ink-hex-fortune__detail">{almanac.detail}</p>
            </div>
          </div>

          <div className="ink-hex-fortune__meta-grid">
            <div className="ink-hex-fortune__meta-item">
              <span>建除</span>
              <strong>{almanac.dayOfficer}日</strong>
            </div>
            <div className="ink-hex-fortune__meta-item">
              <span>值神</span>
              <strong>
                {almanac.twelveStar}（{almanac.isYellowRoad ? '黄道' : '黑道'}）
              </strong>
            </div>
            <div className="ink-hex-fortune__meta-item">
              <span>冲煞</span>
              <strong>{almanac.clash}</strong>
            </div>
            {almanac.currentHour ? (
              <div className="ink-hex-fortune__meta-item">
                <span>当前{almanac.currentHour.name}</span>
                <strong>
                  {almanac.currentHour.ganzhi} · {almanac.currentHour.twelveStar}（
                  {almanac.currentHour.isYellowRoad ? '黄道' : '黑道'}）
                </strong>
              </div>
            ) : null}
          </div>

          <div className="ink-hex-fortune__yiji">
            <div className="ink-hex-fortune__yiji-group">
              <span className="ink-hex-fortune__yiji-tag is-yi">宜</span>
              <span className="ink-hex-fortune__yiji-list">
                {almanac.recommends.slice(0, 10).join(' · ')}
              </span>
            </div>
            <div className="ink-hex-fortune__yiji-group">
              <span className="ink-hex-fortune__yiji-tag is-ji">忌</span>
              <span className="ink-hex-fortune__yiji-list">
                {almanac.avoids.slice(0, 10).join(' · ')}
              </span>
            </div>
          </div>

          {almanac.pengZu ? (
            <p className="ink-hex-fortune__pengzu">彭祖百忌：{almanac.pengZu}</p>
          ) : null}
        </div>
      </section>
    </aside>
  );
}

/**
 * 桌面端右侧留白伴随组件（用于排盘输入、占问、排盘目录、账户、案例等页）：
 * 按当前页面语境 + 时辰呈现确定性水墨卦象与白话卦义；开启 showFortune 时展示真实黄历今日吉凶。
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
  const lot = useMemo(() => getContextHexagramLot(contextKey), [contextKey]);
  const fullName = useMemo(() => getHexagramFullName(lot), [lot]);
  const guidance = useMemo(() => getHexagramGuidance(lot), [lot]);
  const almanac = useMemo(() => (showFortune ? computeRealDailyAlmanac() : null), [showFortune]);

  return (
    <aside className={`ink-hex-aside ${className}`.trim()} aria-label={`${fullName}水墨卦象`}>
      <div className="ink-hex-aside__art">
        <InkHexagram lot={lot} size="lg" tone="soft" title={`${fullName}（${lot.trigrams}）`} />
      </div>

      <div className="ink-hex-aside__meta">
        <div className="ink-hex-aside__title-line">
          <strong>{fullName}</strong>
          <span>{lot.trigrams}</span>
        </div>
        <p className="ink-hex-aside__quote">{guidance.plainMeaning}</p>
        {caption ? <p className="ink-hex-aside__caption">{caption}</p> : null}
      </div>

      {almanac ? (
        <div className="ink-hex-aside__fortune">
          <div className="ink-hex-aside__fortune-head">
            <span>今日黄历 · {almanac.dayOfficer}日</span>
            <strong className={almanac.isAuspicious ? 'is-auspicious' : ''}>
              {almanac.verdict}
            </strong>
          </div>
          <p>{almanac.basisSummary}</p>
          <div className="ink-hex-aside__fortune-tags">
            <span>宜：{almanac.recommends.slice(0, 4).join('、')}</span>
            <span>忌：{almanac.avoids.slice(0, 4).join('、')}</span>
          </div>
        </div>
      ) : null}

      <div className="ink-hex-aside__foot">
        <span>
          {almanac
            ? `${almanac.lunarDate} · ${almanac.ganzhiLabel}`
            : `${formatSolarDateLabel()} · ${getShichenLabel()}`}
        </span>
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
  const lot = useMemo(() => getContextHexagramLot(contextKey, { salt }), [contextKey, salt]);
  const fullName = useMemo(() => getHexagramFullName(lot), [lot]);

  return (
    <div className={`ink-hex-divider ${className}`.trim()} aria-label={`分隔卦象 ${fullName}`}>
      <span className="ink-hex-divider__rule" aria-hidden="true" />
      <span className="ink-hex-divider__center">
        <InkHexagram lot={lot} size="xs" tone="soft" />
        <span className="ink-hex-divider__label">{fullName}</span>
      </span>
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
  const lot = useMemo(() => getContextHexagramLot(contextKey), [contextKey]);
  const fullName = useMemo(() => getHexagramFullName(lot), [lot]);

  return (
    <div className={`ink-hex-empty ${className}`.trim()}>
      <InkHexagram lot={lot} size="md" tone="soft" title={`${fullName}（${lot.trigrams}）`} />
      <span className="ink-hex-empty__hex-name">
        {fullName} · {lot.trigrams}
      </span>
      <h3 className="ink-hex-empty__title">{title}</h3>
      <p className="ink-hex-empty__text">{text}</p>
    </div>
  );
}
