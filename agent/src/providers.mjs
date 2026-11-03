import { createProvider, envApiKeyAuth } from '@earendil-works/pi-ai';
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';
import * as completions from '@earendil-works/pi-ai/api/openai-completions';

/** 预设模型输出，不调用任何网络；第二次输出确实读取实际工具结果。 */
export function createDemoProvider(trace = () => {}) {
  const demo = fauxProvider({ provider: 'demo', models: [{ id: 'scripted-calculator' }] });
  demo.setResponses([
    () => {
      trace('[模型输出·预设] 调用 calculate，operation=multiply，a=18，b=7');
      return fauxAssistantMessage(fauxToolCall('calculate', { operation: 'multiply', a: 18, b: 7 }), { stopReason: 'toolUse' });
    },
    (context) => {
      const result = context.messages.findLast(message => message.role === 'toolResult');
      if (!result || result.isError) throw new Error('演示没有取得成功的工具结果');
      const text = result.content.find(block => block.type === 'text')?.text;
      const value = JSON.parse(text).value;
      trace(`[模型输入·预设] 读取实际工具结果：${value}`);
      return fauxAssistantMessage(`18 × 7 = ${value}。结果来自 calculate 工具。`);
    },
  ]);
  return demo;
}

/** 独立聊天配置，绝不回退到向量模型的密钥。 */
export function readChatConfig(env = process.env) {
  for (const key of ['CHAT_BASE_URL', 'CHAT_API_KEY', 'CHAT_MODEL']) {
    if (!env[key]?.trim()) throw new Error(`请单独配置 ${key}，不会复用 EMBEDDING_API_KEY。`);
  }
  const url = new URL(env.CHAT_BASE_URL.trim());
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('CHAT_BASE_URL 必须是无凭据、查询参数和片段的 HTTP(S) API 基址。');
  }
  if (url.protocol === 'http:' && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('远程聊天 API 请使用 HTTPS，本机回环地址才允许 HTTP。');
  }
  return { baseUrl: url.href.replace(/\/+$/, ''), modelId: env.CHAT_MODEL.trim() };
}

export function createChatProvider(config) {
  return createProvider({
    id: 'chat', name: '单独配置的聊天模型', baseUrl: config.baseUrl,
    auth: { apiKey: envApiKeyAuth('Chat API key', ['CHAT_API_KEY']) },
    models: [{
      id: config.modelId, name: config.modelId, provider: 'chat', api: 'openai-completions',
      baseUrl: config.baseUrl, reasoning: false, input: ['text'],
      // 仅用于学习示例的本地预算元数据，不声明这些是供应商的真实价格/上下文上限。
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 16_384, maxTokens: 2_048,
    }],
    api: completions,
  });
}
