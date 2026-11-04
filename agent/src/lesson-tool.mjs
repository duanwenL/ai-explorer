import { Type } from '@earendil-works/pi-ai';
import { createFakeModel, showDetail } from './lesson-tool-fake-model.mjs';

// 准备：拿到一个模型。这里是假模型（不联网），当成真实模型看即可。
const { models, model } = createFakeModel();
const systemPrompt = '你是一个简洁的助手。';
const question = { role: 'user', content: '18 乘 7 等于多少？', timestamp: Date.now() };

// ========== 第 1 步：写工具说明 —— 给模型看的“说明书” ==========
// 告诉模型：有个工具叫 multiply，能算乘法，需要两个整数 a 和 b。
const multiplyTool = {
  name: 'multiply',
  description: '计算两个整数的乘积。',
  parameters: Type.Object({ a: Type.Integer(), b: Type.Integer() }),
};

// ========== 第 2 步：写工具函数 —— 程序自己运行的代码 ==========
// 模型看不到这段代码，也运行不了它。
function runMultiply(args) {
  return args.a * args.b;
}

// ========== 第 3 步：第 1 次问模型，带上问题和说明书 ==========
const firstRequest = { systemPrompt, messages: [question], tools: [multiplyTool] };
console.log('【第 1 次请求】发给模型：问题 + 工具说明书（multiply）');
showDetail('第 1 次请求', firstRequest);

const firstReply = await models.completeSimple(model, firstRequest);
const toolCall = firstReply.content[0]; // 模型的回复里，第一块内容就是“请调用工具”
console.log(`【第 1 次回复】模型没有回答，而是说：请调用 ${toolCall.name}，参数 ${JSON.stringify(toolCall.arguments)}`);

// ========== 第 4 步：程序执行工具 ==========
// 把模型给的参数 { a: 18, b: 7 } 交给第 2 步的函数，真正算出结果。
const value = runMultiply(toolCall.arguments);
console.log(`【程序执行工具】runMultiply(${JSON.stringify(toolCall.arguments)}) = ${value}`);

// ========== 第 5 步：把结果告诉模型，第 2 次问模型 ==========
// 结果要包装成一条 toolResult 消息。toolCallId 填模型给的调用编号，表示“这是那次调用的结果”。
const resultMessage = {
  role: 'toolResult',
  toolCallId: toolCall.id,
  toolName: toolCall.name,
  content: [{ type: 'text', text: String(value) }],
  isError: false,
  timestamp: Date.now(),
};

// 消息按顺序带上：原问题 → 模型的调用要求 → 工具结果。模型看到全部过程，才能回答。
const secondRequest = { systemPrompt, messages: [question, firstReply, resultMessage], tools: [multiplyTool] };
console.log(`【第 2 次请求】发给模型的消息：${secondRequest.messages.map((m) => m.role).join(' → ')}`);
showDetail('第 2 次请求', secondRequest);

const secondReply = await models.completeSimple(model, secondRequest);
console.log(`【第 2 次回复】${secondReply.content[0].text}`);
