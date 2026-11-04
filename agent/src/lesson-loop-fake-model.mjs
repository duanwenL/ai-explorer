import { createModels } from '@earendil-works/pi-ai';
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';

/**
 * 第四课的假模型：代替真实大模型，不联网、不收费。当成真实模型看即可，不需要读懂这个文件。
 *
 * 问题是“(18 × 7) + 5 等于多少？”。它的三次回复是提前写好的：
 *   第 1 次：请调用 multiply，参数 a=18、b=7。
 *   第 2 次：读出上一个工具结果（126），请调用 add，参数 a=126、b=5。
 *   第 3 次：读出上一个工具结果（131），用文字回答。
 */
export function createFakeModel() {
  const lastResult = (context) => context.messages.at(-1).content[0].text;
  const offline = fauxProvider({ provider: 'lesson-offline', models: [{ id: 'loop-demo' }] });
  offline.setResponses([
    () => fauxAssistantMessage(fauxToolCall('multiply', { a: 18, b: 7 }, { id: 'call-1' }), { stopReason: 'toolUse' }),
    (context) => fauxAssistantMessage(
      fauxToolCall('add', { a: Number(lastResult(context)), b: 5 }, { id: 'call-2' }), { stopReason: 'toolUse' }),
    (context) => fauxAssistantMessage(`(18 × 7) + 5 = ${lastResult(context)}。`),
  ]);
  const models = createModels();
  models.setProvider(offline.provider);
  return { models, model: offline.getModel() };
}
