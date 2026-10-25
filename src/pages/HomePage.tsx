import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InkParticleField } from '@/components/InkParticleField';
import { buildWorkspaceLaunchState } from '@/lib/workspace-launch';
import { buildWorkspaceFeaturePath } from '@/lib/workspace';

/**
 * 首页＝水墨粒子场（与参考 demo 一致）＋ 一个问题输入框，别无他物。
 *
 * 本页在 App.tsx 里独立于 WorkspaceShell 渲染：没有顶栏、没有容器包裹，
 * 任何缓存状态下都不可能出现外壳残留。输入问题后回车（或点击任意空白处），
 * 粒子反向消散，随后带问题进入占问页；空着回车则聚焦输入框。
 */
const ENTER_METHOD = 'liuyao';

export function HomePage() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [exiting, setExiting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // 纯场景模式：隐藏全局纸纹层，保持与 demo 完全一致的黑
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.pureScene = 'true';
    return () => {
      delete root.dataset.pureScene;
    };
  }, []);

  useEffect(() => {
    const isFormField = (target: EventTarget | null) =>
      target instanceof HTMLElement && target.closest('textarea, input, button, a') !== null;
    const onPointerDown = (event: PointerEvent) => {
      if (!isFormField(event.target)) setExiting(true);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isFormField(event.target)) setExiting(true);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  function submit() {
    if (question.trim()) {
      setExiting(true);
    } else {
      inputRef.current?.focus();
    }
  }

  // 离场导航：粒子消散播完即走；动画循环可能被暂停（后台标签页、部分 WebView），
  // 1.2s 兜底强制跳转，保证任何环境下都不会卡在黑屏。
  const leftRef = useRef(false);
  const text = question.trim();
  const leave = () => {
    if (leftRef.current) return;
    leftRef.current = true;
    navigate(buildWorkspaceFeaturePath(ENTER_METHOD) + (text ? `?q=${encodeURIComponent(text)}` : ''), {
      // 始终弹窗补用户信息，不自动起卦
      state: buildWorkspaceLaunchState(text || undefined),
    });
  };

  useEffect(() => {
    if (!exiting) return undefined;
    const timer = window.setTimeout(leave, 1200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exiting]);

  return (
    <div className="workspace-home-page">
      <section className={`workspace-home-hero${exiting ? ' is-exiting' : ''}`}>
        <InkParticleField
          className="workspace-home-hero-field"
          exiting={exiting}
          onExited={leave}
        />
        <div className="workspace-home-hero-veil" aria-hidden="true" />
        <div className="workspace-home-hero-ask">
          <textarea
            ref={inputRef}
            className="workspace-home-hero-question"
            value={question}
            placeholder="写下想问的事…"
            aria-label="写下想问的事"
            rows={1}
            spellCheck={false}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />
        </div>
        <span className="workspace-home-hero-hint" aria-hidden="true">
          回车开始 · 点击任意处进入
        </span>
      </section>
    </div>
  );
}
