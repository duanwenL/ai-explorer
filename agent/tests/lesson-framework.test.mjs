import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const lesson = fileURLToPath(new URL('../src/lesson-framework.mjs', import.meta.url));

/** 第六课：框架自动完成三次模型请求、两次工具执行，历史与第四课一致（多一条 system）。 */
test('第六课由 pi-durable 跑完工具循环', () => {
  const output = execFileSync(process.execPath, [lesson], { encoding: 'utf8', timeout: 30_000 });
  assert.match(output, /【框架执行工具】multiply\(18, 7\) → 126/);
  assert.match(output, /【框架执行工具】add\(126, 5\) → 131/);
  assert.match(output, /【第 3 次请求模型】/);
  assert.equal(output.includes('第 4 次请求模型'), false);
  assert.match(output, /【框架完成】状态：done/);
  assert.match(output, /共 7 条：system → user → assistant → toolResult → assistant → toolResult → assistant/);
  assert.match(output, /【最终回答】\(18 × 7\) \+ 5 = 131。/);
});
