import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const lesson = fileURLToPath(new URL('../src/lesson-loop.mjs', import.meta.url));

/** 第四课：循环问模型，按名字执行两个工具，第 3 轮得到文字答案。 */
test('第四课循环三轮后得到最终回答', () => {
  const output = execFileSync(process.execPath, [lesson], { encoding: 'utf8', timeout: 15_000 });
  assert.match(output, /程序执行：multiply → 126/);
  assert.match(output, /模型要求：调用 add，参数 \{"a":126,"b":5\}/);
  assert.match(output, /程序执行：add → 131/);
  assert.match(output, /【第 3 轮】发给模型 5 条消息：user → assistant → toolResult → assistant → toolResult/);
  assert.match(output, /【最终回答】\(18 × 7\) \+ 5 = 131。/);
  assert.equal(output.includes('第 4 轮'), false);
});
