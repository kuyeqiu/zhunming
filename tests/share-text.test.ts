import assert from 'node:assert/strict';
import test from 'node:test';
import { shareText } from '../src/utils/share-text';

test('网页分享优先使用系统分享能力', async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let sharedText = '';
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      share: async ({ text }: { text: string }) => {
        sharedText = text;
      },
    },
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else Reflect.deleteProperty(globalThis, 'navigator');
  });

  assert.deepEqual(await shareText('完整提示词'), { type: 'system' });
  assert.equal(sharedText, '完整提示词');
});

test('网页不支持系统分享时返回不可用，交由调用方回退复制', async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {},
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else Reflect.deleteProperty(globalThis, 'navigator');
  });

  assert.deepEqual(await shareText('完整提示词'), { type: 'unavailable' });
});
