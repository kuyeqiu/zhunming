import { useEffect, useState } from 'react';
import { INK_MOTIF_LABELS, InkMotif, type InkMotifName } from './InkArt';

const MOTIF_STORAGE_KEY = 'mingyu.ink.motif';

function readStoredMotif(): InkMotifName {
  if (typeof window === 'undefined') return 'shadow';
  try {
    const value = window.localStorage.getItem(MOTIF_STORAGE_KEY);
    if (value === 'shadow' || value === 'eye') return value;
  } catch {
    // 隐私模式下 localStorage 会抛错，降级到默认值即可
  }
  return 'shadow';
}

export type InkHeroProps = {
  /** 竖排题字，默认「知命不惧」 */
  title?: string;
  /** 题跋，两行用 \n 分隔 */
  poem?: string;
  /** 朱砂闲章文字 */
  seal?: string;
  /** 右侧书法大字 */
  calligraphy?: string;
  /** 点击「展卷起盘」 */
  onStart?: () => void;
  /** 是否显示主视觉切换器 */
  showMotifSwitch?: boolean;
};

/**
 * 水墨首屏。
 *
 * 布局是「留白 + 竖排题字 + 中央主视觉 + 书法大字」，
 * 竖排用 writing-mode: vertical-rl 真排，不是图片。
 */
export function InkHero({
  title = '知命不惧',
  poem = '推步星躔\n照见本心',
  seal = '语',
  calligraphy = '观命知语',
  onStart,
  showMotifSwitch = true,
}: InkHeroProps) {
  const [motif, setMotif] = useState<InkMotifName>(readStoredMotif);

  useEffect(() => {
    try {
      window.localStorage.setItem(MOTIF_STORAGE_KEY, motif);
    } catch {
      // 忽略存储失败
    }
  }, [motif]);

  const motifs: InkMotifName[] = ['shadow', 'eye'];

  return (
    <section className="ink-hero" aria-label="准命·水墨首屏">
      <div className="ink-hero__canvas">
        <div className="ink-vertical ink-hero__title">{title}</div>

        <div className="ink-vertical ink-hero__poem">
          {poem.split('\n').map((line, index) => (
            <span key={`${line}-${index}`}>
              {line}
              {index < poem.split('\n').length - 1 ? <br /> : null}
            </span>
          ))}
          <span className="ink-seal" style={{ marginTop: '14px' }}>
            {seal}
          </span>
        </div>

        <div className="ink-artwork-stack">
          {motifs.map((name) => (
            <div
              key={name}
              className="ink-artwork ink-ink-in"
              data-active={name === motif}
              aria-hidden={name !== motif}
            >
              <InkMotif name={name} />
            </div>
          ))}
        </div>

        <div className="ink-vertical ink-hero__calligraphy" aria-hidden="true">
          {calligraphy}
        </div>
      </div>

      <button type="button" className="ink-scroll-hint" onClick={onStart}>
        <span>展卷起盘</span>
        <span className="ink-scroll-hint__line" aria-hidden="true" />
      </button>

      {showMotifSwitch ? (
        <div className="ink-motif-switch" style={{ marginTop: '26px' }} role="group" aria-label="画境切换">
          <span>画境</span>
          {motifs.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={name === motif}
              onClick={() => setMotif(name)}
            >
              {INK_MOTIF_LABELS[name]}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
