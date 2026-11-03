import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const lesson = fileURLToPath(new URL('../src/lesson-model.mjs', import.meta.url));
const fixedReply = '你好！这是一段预设的离线回复，不是真实大模型生成的回答。';

/** 直接运行第一课入口，验证一次离线请求能取得可显示的文字。 */
test('第一课只请求一次离线模型，并区分请求、内容块和显示文字', () => {
  const output = execFileSync(process.execPath, [lesson], { encoding: 'utf8', timeout: 15_000 });
  // 默认问题允许学习时修改，不把练习里的措辞固定成测试要求。
  assert.match(output, /\[传入的问题\] .+/);
  assert.match(output, /"role": "user"/);
  assert.match(output, /\[回复内容块\] \[\{"type":"text","text":/);
  assert.ok(output.includes(`[显示给用户] ${fixedReply}`));
  assert.match(output, /\[结束原因\] stop/);
  assert.match(output, /\[模型请求次数\] 1/);
});

/** 改问题只改变请求：固定离线回复不会假装理解新问题。 */
test('换一个问题后请求内容改变，离线预设回复保持不变', () => {
  const output = execFileSync(process.execPath, [lesson, '请介绍 Java。'], { encoding: 'utf8', timeout: 15_000 });
  assert.match(output, /\[传入的问题\] 请介绍 Java。/);
  assert.ok(output.includes('"content": "请介绍 Java。"'));
  assert.ok(output.includes(`[显示给用户] ${fixedReply}`));
  assert.match(output, /\[模型请求次数\] 1/);
});
