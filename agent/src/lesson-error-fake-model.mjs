import { createModels } from '@earendil-works/pi-ai';
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';

/**
 * 第五课的假模型：代替真实大模型，不联网、不收费。当成真实模型看即可，不需要读懂这个文件。
 *
 * 问题是“18 乘 7 等于多少？”。它的四次回复是提前写好的，模拟模型犯错再改正：
 *   第 1 次：工具名写错，调用 mul（实际只有 multiply）。
 *   第 2 次：名字改对了，但参数 b 填成文字 "七"。
 *   第 3 次：参数也改对，调用 multiply(18, 7)。
 *   第 4 次：读出工具结果，用文字回答。
 * 真实模型会读错误信息再改正；这里的改正过程是写死的，只用来演示数据怎么流动。
 */
export function createFakeModel() {
  const offline = fauxProvider({ provider: 'lesson-offline', models: [{ id: 'error-demo' }] });
  offline.setResponses([
    () => fauxAssistantMessage(fauxToolCall('mul', { a: 18, b: 7 }, { id: 'call-1' }), { stopReason: 'toolUse' }),
    () => fauxAssistantMessage(fauxToolCall('multiply', { a: 18, b: '七' }, { id: 'call-2' }), { stopReason: 'toolUse' }),
    () => fauxAssistantMessage(fauxToolCall('multiply', { a: 18, b: 7 }, { id: 'call-3' }), { stopReason: 'toolUse' }),
    (context) => fauxAssistantMessage(`18 × 7 = ${context.messages.at(-1).content[0].text}。`),
  ]);
  const models = createModels();
  models.setProvider(offline.provider);
  return { models, model: offline.getModel() };
}
