import { fileURLToPath } from 'node:url';
import { createDemoProvider } from './providers.mjs';
import { CONTEXT, openLearningAgent, runInput } from './session.mjs';

const trace = message => console.log(message);
console.log('AI 探索实验室 · Agent 离线流程演示');
console.log('模型输出是预设的，工具执行和 SQLite 存储是真实的；不会联网或产生模型费用。');
const demo = createDemoProvider(trace);
const session = await openLearningAgent({
  databasePath: fileURLToPath(new URL('../data/demo.sqlite', import.meta.url)),
  provider: demo.provider, modelId: demo.getModel().id, trace,
});
try {
  console.log('[用户输入] 请用工具计算 18 × 7。');
  // 固定 requestId：重跑演示复用原来的回答，不重复调用模型/工具。
  const result = await runInput(session.root, '请用工具计算 18 × 7。', 'demo-multiply-v1');
  console.log(`[最终回答] ${result.text}`);
  console.log(`[持久化] ${session.databasePath}`);
  console.log(`[提交 ID] ${result.submissionId}`);
  if (demo.state.callCount === 0) console.log('[重复运行] 已从 SQLite 复用同一请求的结果，没有重复执行。');
} finally {
  await session.harness.close(CONTEXT);
}
