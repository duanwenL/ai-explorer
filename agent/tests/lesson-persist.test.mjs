import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const lesson = fileURLToPath(new URL('../src/lesson-persist.mjs', import.meta.url));

/** 第七课：历史存进 SQLite，程序重启后接着上次的对话；--reset 后从头开始。 */
test('第七课重启后从数据库读回历史', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lesson-persist-'));
  const env = { ...process.env, LESSON_DB: join(dir, 'test.sqlite') };
  const run = (...args) =>
    execFileSync(process.execPath, ['--no-warnings', lesson, ...args], { encoding: 'utf8', env, timeout: 30_000 });
  try {
    const first = run('我叫小李。');
    assert.match(first, /【已有历史】0 条消息/);
    assert.match(first, /我看到了 1 条用户消息：「我叫小李。」/);

    const second = run('我叫什么？');
    assert.match(second, /【已有历史】3 条消息：system → user → assistant/);
    assert.match(second, /我看到了 2 条用户消息：「我叫小李。」「我叫什么？」/);
    assert.match(second, /【现在共有】5 条消息/);

    assert.match(run('--reset'), /【已清空】/);
    assert.match(run('我叫什么？'), /【已有历史】0 条消息/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
