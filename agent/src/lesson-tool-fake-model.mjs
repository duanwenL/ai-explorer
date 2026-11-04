import { createModels } from '@earendil-works/pi-ai';
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';

/**
 * 假模型：代替真实大模型，不联网、不收费。学习第三课时把它当成真实模型即可，不需要读懂这个文件。
 *
 * 它的两次回复是提前写死的：
 *   第 1 次：不回答问题，而是回复“请调用 multiply，参数 a=18、b=7”。
 *   第 2 次：读出最后一条消息（工具结果）里的数字，回复“18 × 7 = 这个数字”。
 */
export function createFakeModel() {
  const offline = fauxProvider({ provider: 'lesson-offline', models: [{ id: 'tool-demo' }] });
  offline.setResponses([
    () => fauxAssistantMessage(fauxToolCall('multiply', { a: 18, b: 7 }, { id: 'call-1' }), { stopReason: 'toolUse' }),
    (context) => fauxAssistantMessage(`18 × 7 = ${context.messages.at(-1).content[0].text}。`),
  ]);
  const models = createModels();
  models.setProvider(offline.provider);
  return { models, model: offline.getModel() };
}

/** 运行时加 --detail，才打印请求的完整内容。时间戳、用量统计等记录字段省略。 */
export function showDetail(title, request) {
  if (!process.argv.includes('--detail')) return;
  const messages = request.messages.map(({ role, content, toolCallId }) => ({ role, ...(toolCallId ? { toolCallId } : {}), content }));
  console.log(`  ---- ${title}的完整内容 ----`);
  console.log(JSON.stringify({ systemPrompt: request.systemPrompt, tools: request.tools, messages }, null, 2)
    .split('\n').map((line) => `  ${line}`).join('\n'));
}
