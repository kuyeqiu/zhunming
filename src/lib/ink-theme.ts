/**
 * 夜墨（暗色）开关。
 *
 * 刻意不跟随系统：宣纸底是这套设计的核心表达，`prefers-color-scheme` 会让一半用户
 * 看到没调过的暗色（上一版就是这样出现"黑侧栏 + 白纸块"的割裂）。
 * 暗色只作为显式选择存在，落在 documentElement 的 data-ink-mode 上，供 CSS 选择。
 */

export type InkMode = 'light' | 'dark';

const STORAGE_KEY = 'mingyu.ink.mode';

export function readInkMode(): InkMode {
  if (typeof document === 'undefined') return 'light';
  const attr = document.documentElement.dataset.inkMode;
  if (attr === 'dark' || attr === 'light') return attr;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyInkMode(mode: InkMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.inkMode = mode;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // 隐私模式下写入会失败，忽略即可
  }
}

export function toggleInkMode(): InkMode {
  const next: InkMode = readInkMode() === 'dark' ? 'light' : 'dark';
  applyInkMode(next);
  return next;
}
