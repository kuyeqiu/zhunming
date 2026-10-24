import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InkParticleField } from '@/components/InkParticleField';

/**
 * 首页＝水墨粒子场，同时是进入门。
 *
 * 整屏黑底粒子与参考 demo 完全一致，加载时粒子汇聚成画；页面不放任何按钮或边框，
 * 顶栏也整体隐藏。点击鼠标或按任意键：粒子反向消散（入场动画倒放），随后进入
 * 占问页。唯一的文字是标题与一行操作提示。
 */
const ENTER_TARGET = '/divination/liuyao';

export function HomePage() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLElement | null>(null);
  const [exiting, setExiting] = useState(false);

  // 首屏在场时标记 <html data-home-hero>，顶栏据此在首页整体隐藏；
  // 组件卸载（进入占问页）时移除标记，顶栏在其余页面照常显示。
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return undefined;
    const root = document.documentElement;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.intersectionRatio > 0.4) {
          root.dataset.homeHero = 'true';
        } else {
          delete root.dataset.homeHero;
        }
      },
      { threshold: [0, 0.4, 0.75, 1] },
    );
    observer.observe(hero);
    return () => {
      observer.disconnect();
      delete root.dataset.homeHero;
    };
  }, []);

  // 任何点击或按键都触发离场；重复触发无害。
  useEffect(() => {
    const trigger = () => setExiting(true);
    window.addEventListener('pointerdown', trigger);
    window.addEventListener('keydown', trigger);
    return () => {
      window.removeEventListener('pointerdown', trigger);
      window.removeEventListener('keydown', trigger);
    };
  }, []);

  return (
    <div className="workspace-home-page">
      <section ref={heroRef} className={`workspace-home-hero${exiting ? ' is-exiting' : ''}`}>
        <InkParticleField
          className="workspace-home-hero-field"
          exiting={exiting}
          onExited={() => navigate(ENTER_TARGET)}
        />
        <div className="workspace-home-hero-veil" aria-hidden="true" />
        <div className="workspace-home-hero-copy">
          <h1>观象知命</h1>
          <p>输入问题，选择算法，一步开始</p>
        </div>
        <span className="workspace-home-hero-hint" aria-hidden="true">
          点击任意处 · 进入
        </span>
      </section>
    </div>
  );
}
