import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { createModels } from '@earendil-works/pi-ai';
import { AssistantEntry, createRegistry, defineExtension, Harness } from '@earendil-works/pi-durable';
import { openNodeSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/node';
import { createCalculator } from './calculator.mjs';

export const CONTEXT = BACKGROUND_CONTEXT;

/** 一份 SQLite 文件是一段持久化会话。框架负责模型→工具→模型的循环。 */
export async function openLearningAgent({ databasePath, provider, modelId, trace = () => {} }) {
  const path = resolve(databasePath);
  await mkdir(dirname(path), { recursive: true });
  const models = createModels();
  let calls = 0;
  // 所有真实请求都从这个入口走。一次 CLI 运行最多 8 次模型请求，避免学习时无限调用。
  models.setProvider({
    ...provider,
    streamSimple(model, context, options) {
      if (++calls > 8) throw new Error('本次运行已达到 8 次模型请求上限');
      trace(`[模型请求 ${calls}] ${model.provider}/${model.id}，历史消息 ${context.messages.length} 条`);
      return provider.streamSimple(model, context, options);
    },
  });
  const registry = createRegistry();
  const calculator = createCalculator(trace);
  registry.install(defineExtension({ name: 'learning', tools: [calculator] }));
  const harness = await Harness.open(await openNodeSqliteStorage(path), {
    models, registry,
    settings: {
      retry: { enabled: false },
      stream: { timeoutMs: 60_000, maxRetries: 0 },
      compaction: { enabled: false },
    },
  }, CONTEXT);
  try {
    const agent = {
      model: { provider: provider.id, modelId },
      instructions: '你是帮助学习 Agent 的简洁助手。需要加法或乘法时使用 calculate 工具，根据真实结果回答。工具只支持两个绝对值不超过一百万的整数。',
      tools: [calculator], // pi-durable 接收工具注册对象，再按 name 持久化。
    };
    const root = await harness.root(CONTEXT, { agent });
    // 已有会话也应用当前模型配置，保留原有历史，不 reset。
    await root.configure(agent, CONTEXT);
    return { harness, root, databasePath: path };
  } catch (error) {
    await harness.close(CONTEXT);
    throw error;
  }
}

export async function runInput(root, content, requestId) {
  if (typeof content !== 'string' || !content.trim() || content.length > 2_000) {
    throw new Error('请输入 1 到 2000 个字符的问题');
  }
  const submission = await root.submit({ type: 'input', content, requestId }, CONTEXT);
  const settled = await submission.wait(CONTEXT);
  if (settled.status !== 'done' || settled.type !== 'input') {
    throw new Error(`Agent 未完成回答：${settled.reason ?? settled.status}。输入保存在 SQLite，可检查会话后继续。`);
  }
  const answer = await root.commit(tx => tx.entry(AssistantEntry, settled.answer), CONTEXT);
  const text = (answer?.model ?? []).flatMap(message => message.content ?? [])
    .filter(block => block.type === 'text').map(block => block.text).join('\n');
  if (!text) throw new Error('模型没有返回可显示的文字答案');
  return { text, submissionId: submission.id };
}
