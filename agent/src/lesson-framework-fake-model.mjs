import { createModels } from '@earendil-works/pi-ai';
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';

/**
 * 第六课的假模型：回复和第四课完全一样，只是每次被请求时打印一行，方便看框架请求了几次模型。
 * 当成真实模型看即可，不需要读懂这个文件。
 *
 *   第 1 次：请调用 multiply，参数 a=18、b=7。
 *   第 2 次：读出上一个工具结果（126），请调用 add，参数 a=126、b=5。
 *   第 3 次：读出上一个工具结果（131），用文字回答。
 */
export function createFakeModel() {
  const lastResult = (context) => context.messages.at(-1).content[0].text;
  let calls = 0;
  const log = (context) => console.log(`【第 ${++calls} 次请求模型】框架发了 ${context.messages.length} 条消息`);
  const offline = fauxProvider({ provider: 'lesson-offline', models: [{ id: 'framework-demo' }] });
  offline.setResponses([
    (context) => {
      log(context);
      return fauxAssistantMessage(fauxToolCall('multiply', { a: 18, b: 7 }, { id: 'call-1' }), { stopReason: 'toolUse' });
    },
    (context) => {
      log(context);
      return fauxAssistantMessage(
        fauxToolCall('add', { a: Number(lastResult(context)), b: 5 }, { id: 'call-2' }), { stopReason: 'toolUse' });
    },
    (context) => {
      log(context);
      return fauxAssistantMessage(`(18 × 7) + 5 = ${lastResult(context)}。`);
    },
  ]);
  const models = createModels();
  models.setProvider(offline.provider);
  return { models, model: offline.getModel() };
}
