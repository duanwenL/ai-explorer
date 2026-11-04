import { Type } from '@earendil-works/pi-ai';
import { createFakeModel } from './lesson-loop-fake-model.mjs';

// 准备：拿到一个模型。这里是假模型（不联网），当成真实模型看即可。
const { models, model } = createFakeModel();
const systemPrompt = '你是一个简洁的助手。';
const question = { role: 'user', content: '(18 × 7) + 5 等于多少？', timestamp: Date.now() };

// ========== 第 1 步：工具说明书 —— 发给模型看，这次有两个工具 ==========
const tools = [
  { name: 'multiply', description: '计算两个整数的乘积。', parameters: Type.Object({ a: Type.Integer(), b: Type.Integer() }) },
  { name: 'add', description: '计算两个整数的和。', parameters: Type.Object({ a: Type.Integer(), b: Type.Integer() }) },
];

// ========== 第 2 步：工具函数 —— 按名字存放，程序靠名字找到要运行的函数 ==========
// 第三课是写死调用 runMultiply；这次模型说哪个名字，就运行 runners[那个名字]。
const runners = {
  multiply: (args) => args.a * args.b,
  add: (args) => args.a + args.b,
};

// ========== 第 3 步：循环 —— 一直问模型，直到它不再要求调用工具 ==========
const messages = [question]; // 对话历史：每一轮都往里追加，下一轮整份发给模型
const MAX_ROUNDS = 5; // 最多问 5 次，防止模型一直要求调用工具、程序停不下来
let answer = null;

for (let round = 1; round <= MAX_ROUNDS; round++) {
  console.log(`【第 ${round} 轮】发给模型 ${messages.length} 条消息：${messages.map((m) => m.role).join(' → ')}`);
  const reply = await models.completeSimple(model, { systemPrompt, messages, tools });
  messages.push(reply); // 模型的回复也是历史的一部分，要追加进去

  // 情况 A：模型不再要求调用工具，说明它给出了文字答案。结束循环。
  if (reply.stopReason !== 'toolUse') {
    answer = reply.content[0].text;
    console.log(`  模型回复文字：${answer}`);
    break;
  }

  // 情况 B：模型要求调用工具。逐个执行，把结果追加进历史，然后进入下一轮。
  for (const block of reply.content) {
    if (block.type !== 'toolCall') continue; // 只处理工具调用块，跳过其他内容
    console.log(`  模型要求：调用 ${block.name}，参数 ${JSON.stringify(block.arguments)}`);
    const value = runners[block.name](block.arguments); // 按名字找到函数并运行
    console.log(`  程序执行：${block.name} → ${value}`);
    messages.push({
      role: 'toolResult',
      toolCallId: block.id,
      toolName: block.name,
      content: [{ type: 'text', text: String(value) }],
      isError: false,
      timestamp: Date.now(),
    });
  }
}

// ========== 第 4 步：输出结果 ==========
if (answer === null) {
  console.log(`【停止】已问了 ${MAX_ROUNDS} 轮，模型仍在要求调用工具，程序主动停止。`);
} else {
  console.log(`【最终回答】${answer}`);
}
