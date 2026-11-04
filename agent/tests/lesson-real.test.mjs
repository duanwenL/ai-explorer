import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const lesson = fileURLToPath(new URL('../src/lesson-real.mjs', import.meta.url));
const run = promisify(execFile);

/** 本机假接口：按 OpenAI Chat Completions 流式格式回复，报告收到了几条用户消息。 */
function startFakeApi() {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      if (req.headers.authorization !== 'Bearer test-only') {
        res.writeHead(401, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: { message: 'invalid api key' } }));
      }
      const users = JSON.parse(body).messages.filter((m) => m.role === 'user').length;
      const chunk = (delta, finish = null) =>
        `data: ${JSON.stringify({ id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(chunk({ role: 'assistant', content: `收到 ${users} 条用户消息` }) + chunk({}, 'stop') + 'data: [DONE]\n\n');
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/** 第八课：真实模型接口 + SQLite，重启后历史一起发给接口；密钥错误时给出失败提示。 */
test('第八课通过 OpenAI 兼容接口对话并持久保存', async () => {
  const server = await startFakeApi();
  const dir = mkdtempSync(join(tmpdir(), 'lesson-real-'));
  const env = {
    ...process.env, LESSON_DB: join(dir, 'test.sqlite'),
    CHAT_BASE_URL: `http://127.0.0.1:${server.address().port}/v1`, CHAT_API_KEY: 'test-only', CHAT_MODEL: 'm',
  };
  const ask = (question, extra = {}) =>
    run(process.execPath, ['--no-warnings', lesson, question], { encoding: 'utf8', env: { ...env, ...extra }, timeout: 30_000 });
  try {
    assert.match((await ask('我叫小李。')).stdout, /【模型回复】收到 1 条用户消息/);
    const second = (await ask('我叫什么？')).stdout;
    assert.match(second, /【已有历史】3 条消息/);
    assert.match(second, /【模型回复】收到 2 条用户消息/);

    const failed = await ask('密钥错误', { CHAT_API_KEY: 'wrong' }).then(() => null, (error) => error);
    assert.equal(failed?.code, 1);
    assert.match(failed.stdout, /【请求失败】/);
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
