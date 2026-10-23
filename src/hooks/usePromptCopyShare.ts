import { useEffect, useMemo, useState } from 'react';
import { shareText } from '@/utils/share-text';

export interface PromptCopyShare {
  copyState: string;
  shareState: string;
  handleCopy: () => Promise<void>;
  handleShare: () => Promise<void>;
}

export function usePromptCopyShare(promptText: string): PromptCopyShare {
  const [copyResult, setCopyResult] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [shareResult, setShareResult] = useState<
    | { type: 'idle' }
    | { type: 'system' }
    | { type: 'copied' }
    | { type: 'failed'; message: string }
  >({ type: 'idle' });

  useEffect(() => {
    setCopyResult('idle');
    setShareResult({ type: 'idle' });
  }, [promptText]);

  const copyState = useMemo(() => {
    if (!promptText) return '暂无内容';
    if (copyResult === 'copied') return '已复制';
    if (copyResult === 'failed') return '复制失败';
    return '复制提问内容';
  }, [copyResult, promptText]);

  const shareState = useMemo(() => {
    if (!promptText) return '暂无内容';
    if (shareResult.type === 'system') return '已调起系统分享';
    if (shareResult.type === 'copied') return '已复制，可粘贴分享';
    if (shareResult.type === 'failed') return shareResult.message;
    return '分享提问内容';
  }, [shareResult, promptText]);

  async function handleCopy() {
    if (!promptText) {
      setCopyResult('failed');
      return;
    }

    try {
      await navigator.clipboard.writeText(promptText);
      setCopyResult('copied');
    } catch {
      setCopyResult('failed');
    }
  }

  async function handleShare() {
    if (!promptText) {
      setShareResult({ type: 'failed', message: '分享失败' });
      return;
    }

    try {
      const result = await shareText(promptText);
      if (result.type === 'system') {
        setShareResult(result);
        return;
      }

      await navigator.clipboard.writeText(promptText);
      setShareResult({ type: 'copied' });
    } catch (error) {
      setShareResult({
        type: 'failed',
        message: error instanceof Error ? error.message : '分享失败',
      });
    }
  }

  return { copyState, shareState, handleCopy, handleShare };
}
