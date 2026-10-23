export type ShareTextResult = { type: 'system' } | { type: 'unavailable' };

export async function shareText(text: string): Promise<ShareTextResult> {
  if (navigator.share) {
    await navigator.share({ text });
    return { type: 'system' };
  }

  return { type: 'unavailable' };
}
