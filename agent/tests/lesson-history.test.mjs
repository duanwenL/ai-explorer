import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const lesson = fileURLToPath(new URL('../src/lesson-history.mjs', import.meta.url));
const run = (...args) => execFileSync(process.execPath, [lesson, ...args], { encoding: 'utf8', timeout: 15_000 });
/** 取出“第 2 次请求”之后的输出，只检查第二次请求。 */
const secondRound = (output) => output.split('第 2 次请求')[1];

/** 默认带历史：第二次请求按顺序带上第一轮问题、第一轮回复和新问题。 */
test('第二课默认把上一轮对话放进第二次请求', () => {
  const output = run();
  assert.match(output, /\[程序发送的请求内容\]/);
  assert.match(output, /"role": "system"/);
  const second = secondRound(output);
  assert.ok(second.includes('"content": "我叫小李。"'));
  assert.ok(second.includes('"role": "assistant"'));
  assert.match(second, /\[收到的回复\] （离线回复）模型收到 4 条：system → user → assistant → user/);
  assert.match(output, /带上了历史/);
});

/** 不带历史：第二次请求只有新问题，模型一侧看不到第一轮内容。 */
test('第二课加 --no-history 后第二次请求只发送新问题', () => {
  const output = run('--no-history');
  const second = secondRound(output);
  assert.equal(second.includes('我叫小李。'), false);
  assert.match(second, /\[收到的回复\] （离线回复）模型收到 2 条：system → user/);
  assert.match(output, /没有历史/);
});
