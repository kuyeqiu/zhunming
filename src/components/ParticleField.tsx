import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  twinkle: number;
  accent: boolean;
}

interface ParticleFieldProps {
  className?: string;
  /** 粒子密度：每 10000px² 的粒子数，最终数量被限制在 24–140 之间 */
  density?: number;
  /** 粒子间画连线的距离阈值（px） */
  linkDistance?: number;
}

/**
 * 星空粒子背景：纯 Canvas 手写，零第三方依赖。
 *
 * 全部绘制发生在访客浏览器里，服务器只是多托管一个几 KB 的静态 JS，零压力。
 * 客户端每帧做 O(n²) 距离判定，n≤140 时约一万次比较，低端设备负担也极小。
 * 三个降级口：标签页隐藏或滚出视口时暂停重绘；devicePixelRatio 封顶 2 避免 4K
 * 屏画布过大；prefers-reduced-motion 只画一帧静态星点、不进动画循环。
 */
export function ParticleField({ className, density = 1.1, linkDistance = 132 }: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    let particles: Particle[] = [];
    let width = 1;
    let height = 1;
    let raf = 0;
    let inView = true;
    const pointer = { x: Number.NaN, y: Number.NaN };

    const spawn = (): Particle => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.24,
      vy: (Math.random() - 0.5) * 0.24,
      radius: 0.6 + Math.random() * 1.4,
      twinkle: Math.random() * Math.PI * 2,
      accent: Math.random() < 0.08,
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(24, Math.min(140, Math.round(((width * height) / 10000) * density)));
      if (particles.length > count) {
        particles = particles.slice(0, count);
      }
      while (particles.length < count) particles.push(spawn());
    };

    const draw = (animate: boolean) => {
      context.clearRect(0, 0, width, height);

      if (animate) {
        for (const particle of particles) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          if (particle.x < -24) particle.x = width + 24;
          else if (particle.x > width + 24) particle.x = -24;
          if (particle.y < -24) particle.y = height + 24;
          else if (particle.y > height + 24) particle.y = -24;
          particle.twinkle += 0.02;
        }
      }

      context.lineWidth = 1;
      const pointerActive = Number.isFinite(pointer.x) && Number.isFinite(pointer.y);
      for (let i = 0; i < particles.length; i += 1) {
        const a = particles[i]!;
        for (let j = i + 1; j < particles.length; j += 1) {
          const b = particles[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          if (dx > linkDistance || dx < -linkDistance || dy > linkDistance || dy < -linkDistance) {
            continue;
          }
          const distance = Math.hypot(dx, dy);
          if (distance >= linkDistance) continue;
          const alpha = (1 - distance / linkDistance) * 0.32;
          context.strokeStyle = `rgba(197, 207, 236, ${alpha.toFixed(3)})`;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
        if (pointerActive) {
          const dx = a.x - pointer.x;
          const dy = a.y - pointer.y;
          const reach = linkDistance * 1.2;
          const distance = Math.hypot(dx, dy);
          if (distance < reach) {
            const alpha = (1 - distance / reach) * 0.5;
            context.strokeStyle = `rgba(230, 196, 160, ${alpha.toFixed(3)})`;
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(pointer.x, pointer.y);
            context.stroke();
          }
        }
      }

      for (const particle of particles) {
        const glow = 0.5 + Math.sin(particle.twinkle) * 0.28;
        context.fillStyle = particle.accent
          ? `rgba(224, 150, 118, ${glow.toFixed(3)})`
          : `rgba(243, 241, 233, ${glow.toFixed(3)})`;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      }
    };

    const tick = () => {
      if (inView && !document.hidden) draw(true);
      raf = window.requestAnimationFrame(tick);
    };

    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver((entries) => {
      inView = entries[0]?.isIntersecting ?? true;
    });
    intersectionObserver.observe(canvas);

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    };
    const onPointerLeave = () => {
      pointer.x = Number.NaN;
      pointer.y = Number.NaN;
    };
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      draw(false);
    } else {
      raf = window.requestAnimationFrame(tick);
    }

    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [density, linkDistance]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
