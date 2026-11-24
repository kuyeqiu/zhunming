import { memo, useEffect, useRef } from 'react';

const STORAGE_KEY = 'mingyu.result.panes';
const MIN_W = 260;
const MAX_W = 820;
const DEFAULT_LEFT = 400;
const DEFAULT_RIGHT = 400;

function readSaved(): { l?: number; r?: number } {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function applyWidth(stage: HTMLElement, prop: string, px: number) {
  stage.style.setProperty(prop, `${Math.min(MAX_W, Math.max(MIN_W, px))}px`);
}

/**
 * 结果页栏宽拖拽手柄。改 .result-tab-stage 上的 --w-left / --w-right，
 * 宽度记忆于 localStorage。drafts/result-page 手柄逻辑的移植版。
 */
export const ResultPaneResizer = memo(function ResultPaneResizer(props: {
  /** 拖动的变量与方向：left 往右拖加宽，right 往左拖加宽 */
  side: 'left' | 'right';
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const stage = el?.parentElement;
    if (!el || !stage) return;
    const prop = props.side === 'left' ? '--w-left' : '--w-right';

    // 还原记忆宽度（只还原一次，双方共用同一份存储）
    const saved = readSaved();
    if (props.side === 'left' && saved.l) applyWidth(stage, '--w-left', saved.l);
    if (props.side === 'right' && saved.r) applyWidth(stage, '--w-right', saved.r);

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const cur =
        parseFloat(getComputedStyle(stage).getPropertyValue(prop)) ||
        (props.side === 'left' ? DEFAULT_LEFT : DEFAULT_RIGHT);
      const dir = props.side === 'left' ? 1 : -1;
      el.classList.add('on');
      document.body.classList.add('rw-resizing');
      el.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) =>
        applyWidth(stage, prop, cur + (ev.clientX - startX) * dir);
      const up = () => {
        el.classList.remove('on');
        document.body.classList.remove('rw-resizing');
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        const s = readSaved();
        const now =
          parseFloat(getComputedStyle(stage).getPropertyValue(prop)) ||
          (props.side === 'left' ? DEFAULT_LEFT : DEFAULT_RIGHT);
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ l: props.side === 'left' ? now : s.l, r: props.side === 'right' ? now : s.r }),
          );
        } catch {
          /* 存储不可用时静默 */
        }
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
    };
    el.addEventListener('pointerdown', onDown);
    return () => el.removeEventListener('pointerdown', onDown);
  }, [props.side]);

  return <div ref={ref} className={`rw-rh rw-rh-${props.side}`} title="拖拽调整栏宽" />;
});
