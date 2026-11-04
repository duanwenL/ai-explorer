import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const lesson = fileURLToPath(new URL('../src/lesson-error.mjs', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [lesson, ...args], { encoding: 'utf8', timeout: 15_000 });

/** 默认：两种错误都交给模型，模型改正后第 4 轮得到答案。 */
test('第五课把工具错误交给模型，最终得到回答', () => {
  const { stdout, status } = run();
  assert.equal(status, 0);
  assert.match(stdout, /出错，把错误交给模型：没有叫 mul 的工具。可用工具：multiply/);
  assert.match(stdout, /出错，把错误交给模型：工具执行出错：参数 a 和 b 必须是整数/);
  assert.match(stdout, /程序执行成功：126/);
  assert.match(stdout, /【最终回答】18 × 7 = 126。/);
});

/** 加 --throw：第 1 个错误就让程序中断，拿不到回答。 */
test('第五课加 --throw 后第一次出错就崩溃', () => {
  const { stdout, status } = run('--throw');
  assert.equal(status, 1);
  assert.match(stdout, /【程序崩溃】没有叫 mul 的工具/);
  assert.equal(stdout.includes('第 2 轮'), false);
  assert.equal(stdout.includes('最终回答'), false);
});
