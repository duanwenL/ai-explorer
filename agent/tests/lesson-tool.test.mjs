import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const lesson = fileURLToPath(new URL('../src/lesson-tool.mjs', import.meta.url));
const run = (...args) => execFileSync(process.execPath, [lesson, ...args], { encoding: 'utf8', timeout: 15_000 });

/** 第三课：模型提出调用 → 程序执行 → 结果带进第 2 次请求 → 最终回答。 */
test('第三课按 5 步输出工具调用过程', () => {
  const output = run();
  assert.match(output, /【第 1 次回复】模型没有回答，而是说：请调用 multiply，参数 \{"a":18,"b":7\}/);
  assert.match(output, /【程序执行工具】runMultiply\(\{"a":18,"b":7\}\) = 126/);
  assert.match(output, /【第 2 次请求】发给模型的消息：user → assistant → toolResult/);
  assert.match(output, /【第 2 次回复】18 × 7 = 126。/);
  assert.equal(output.includes('完整内容'), false);
});

/** 加 --detail：额外打印完整请求，能看到工具说明和 toolCallId。 */
test('第三课加 --detail 打印完整请求', () => {
  const output = run('--detail');
  assert.ok(output.includes('"description": "计算两个整数的乘积。"'));
  assert.ok(output.includes('"toolCallId": "call-1"'));
});
