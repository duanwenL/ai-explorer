import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createChatProvider, readChatConfig } from './providers.mjs';
import { CONTEXT, openLearningAgent, runInput } from './session.mjs';

async function main() {
  const question = process.argv.slice(2).join(' ').trim();
  if (!question || question.length > 2_000) {
    throw new Error('用法：npm run chat -- "请用工具计算 18 × 7"，问题最多 2000 字符。');
  }
  // 配置先校验，通过后才创建会话和访问 API。
  const config = readChatConfig();
  console.log('AI 探索实验室 · 真实聊天模型（调用可能产生费用）');
  const session = await openLearningAgent({
    databasePath: fileURLToPath(new URL('../data/chat.sqlite', import.meta.url)),
    provider: createChatProvider(config), modelId: config.modelId,
    trace: message => console.log(message),
  });
  try {
    console.log(`[会话] ${session.root.id}`);
    const result = await runInput(session.root, question, randomUUID());
    console.log(`[最终回答] ${result.text}`);
    console.log(`[持久化] ${session.databasePath}`);
  } finally {
    await session.harness.close(CONTEXT);
  }
}

try {
  await main();
} catch {
  // 不回显 SDK 原始错误，避免日志中出现上游响应或凭据。
  console.error('Agent 未完成：请检查问题长度、CHAT_BASE_URL / CHAT_API_KEY / CHAT_MODEL、模型工具调用支持和额度。');
  process.exitCode = 1;
}
