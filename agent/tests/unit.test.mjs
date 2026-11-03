import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCalculator } from '../src/calculator.mjs';
import { readChatConfig } from '../src/providers.mjs';
import { runInput } from '../src/session.mjs';

test('计算工具执行真实加法与乘法', async () => {
  const messages = [];
  const tool = createCalculator(message => messages.push(message));
  const sum = await tool.execute({ operation: 'add', a: -7, b: 18 });
  const product = await tool.execute({ operation: 'multiply', a: 18, b: 7 });
  assert.equal(JSON.parse(sum.output[0].text).value, 11);
  assert.equal(JSON.parse(product.output[0].text).value, 126);
  assert.equal(messages.length, 2);
  assert.equal(tool.replay, 'safe');
});

test('聊天配置独立于向量密钥', () => {
  assert.throws(() => readChatConfig({ EMBEDDING_API_KEY: 'test-only' }), /CHAT_BASE_URL/);
  const config = readChatConfig({
    CHAT_BASE_URL: 'https://example.com/v1/', CHAT_API_KEY: 'test-only', CHAT_MODEL: 'model',
  });
  assert.deepEqual(config, { baseUrl: 'https://example.com/v1', modelId: 'model' });
  assert.equal(Object.hasOwn(config, 'apiKey'), false);
});

test('远程聊天基址拒绝 HTTP 与 URL 内嵌凭据', () => {
  for (const baseUrl of ['http://example.com/v1', 'https://name:password@example.com/v1',
    'https://example.com/v1?key=value', 'https://example.com/v1#fragment']) {
    assert.throws(() => readChatConfig({
      CHAT_BASE_URL: baseUrl, CHAT_API_KEY: 'test-only', CHAT_MODEL: 'model',
    }));
  }
  assert.equal(readChatConfig({
    CHAT_BASE_URL: 'http://127.0.0.1:1234/v1', CHAT_API_KEY: 'test-only', CHAT_MODEL: 'model',
  }).baseUrl, 'http://127.0.0.1:1234/v1');
});

test('非法输入在访问会话前被拒绝', async () => {
  const root = { submit() { throw new Error('不应调用 submit'); } };
  for (const question of ['', '   ', 'a'.repeat(2001), null]) {
    await assert.rejects(runInput(root, question, 'test-id'), /1 到 2000/);
  }
});
