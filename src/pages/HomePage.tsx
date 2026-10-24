import { useEffect, useRef } from 'react';
import { InkParticleField } from '@/components/InkParticleField';

/**
 * 首页＝水墨粒子场。
 *
 * 一整屏：黑底、按水墨画采样的粒子、风、鼠标扰动——与参考 demo 完全一致，
 * 只叠加一行标题。没有按钮、没有边框、没有表单；排盘与占问的入口在顶栏导航里。
 */
export function HomePage() {
  const heroRef = useRef<HTMLElement | null>(null);

  // 首屏在场时把 <html> 标记为 data-home-hero，顶栏据此转透明浮在夜幕上；
  // 本页只有这一屏，标记随组件卸载移除。
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

  return (
    <div className="workspace-home-page">
      <section ref={heroRef} className="workspace-home-hero">
        <InkParticleField className="workspace-home-hero-field" />
        <div className="workspace-home-hero-veil" aria-hidden="true" />
        <div className="workspace-home-hero-copy">
          <h1>观象知命</h1>
          <p>输入问题，选择算法，一步开始</p>
        </div>
        <span className="workspace-home-hero-hint" aria-hidden="true">
          移动鼠标 · 扰动粒子
        </span>
      </section>
    </div>
  );
}
