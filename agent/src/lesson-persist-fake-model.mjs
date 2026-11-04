import { createModels } from '@earendil-works/pi-ai';
import { fauxProvider, fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';

/**
 * 第七课的假模型：不联网、不收费，也不理解问题。当成真实模型看即可，不需要读懂这个文件。
 *
 * 它只报告“这次请求里，我看到了哪些用户消息”。
 * 用它来验证：程序重启后，框架有没有把以前的对话从数据库里读出来、一起发给模型。
 */
export function createFakeModel() {
  const reportUserMessages = (context) => {
    const userTexts = context.messages.filter((m) => m.role === 'user').map((m) => `「${m.content}」`);
    return fauxAssistantMessage(`（假模型）我看到了 ${userTexts.length} 条用户消息：${userTexts.join('')}`);
  };
  const offline = fauxProvider({ provider: 'lesson-offline', models: [{ id: 'persist-demo' }] });
  offline.setResponses([reportUserMessages, reportUserMessages, reportUserMessages]);
  const models = createModels();
  models.setProvider(offline.provider);
  return { models, model: offline.getModel() };
}
