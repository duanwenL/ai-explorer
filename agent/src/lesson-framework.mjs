import { BACKGROUND_CONTEXT as CONTEXT } from '@earendil-works/chord/context';
import { Type } from '@earendil-works/pi-ai';
import { createRegistry, defineExtension, defineTool, Harness } from '@earendil-works/pi-durable';
import { MemoryStorage } from '@earendil-works/pi-durable/storage/memory';
import { createFakeModel } from './lesson-framework-fake-model.mjs';

// 准备：拿到一个模型。和第四课同一套假回复（不联网），当成真实模型看即可。
const { models, model } = createFakeModel();

// ========== 第 1 步：定义工具 —— 说明书和执行函数写在一起 ==========
// 第四课分成 tools（说明书）和 runners（函数）两处；defineTool 把它们合成一个对象。
const multiply = defineTool({
  name: 'multiply',
  description: '计算两个整数的乘积。',
  parameters: Type.Object({ a: Type.Integer(), b: Type.Integer() }),
  execute: async (args) => {
    const value = args.a * args.b;
    console.log(`  【框架执行工具】multiply(${args.a}, ${args.b}) → ${value}`);
    return { output: [{ type: 'text', text: String(value) }] }; // 交给模型的结果文字
  },
});
const add = defineTool({
  name: 'add',
  description: '计算两个整数的和。',
  parameters: Type.Object({ a: Type.Integer(), b: Type.Integer() }),
  execute: async (args) => {
    const value = args.a + args.b;
    console.log(`  【框架执行工具】add(${args.a}, ${args.b}) → ${value}`);
    return { output: [{ type: 'text', text: String(value) }] };
  },
});

// ========== 第 2 步：把工具放进工具箱，交给框架 ==========
// 模型说要调用 add，框架就在工具箱里按名字找到 add。相当于第四课的 runners[block.name]。
const registry = createRegistry();
registry.install(defineExtension({ name: 'lesson', tools: [multiply, add] }));

// ========== 第 3 步：打开框架，创建一个对话 ==========
// MemoryStorage：对话历史只存在内存里，程序结束就没了。存进数据库是下一课的内容。
// CONTEXT：框架每个方法都要传的参数，用来支持取消操作。本课照着传即可。
const harness = await Harness.open(new MemoryStorage(), { models, registry }, CONTEXT);
const conversation = await harness.root(CONTEXT, {
  agent: {
    model: { provider: model.provider, modelId: model.id }, // 用哪个模型
    instructions: '你是一个简洁的助手。', // 相当于以前的 systemPrompt
    tools: [multiply, add], // 这个对话可以用哪些工具
  },
});

// ========== 第 4 步：提交问题，等框架跑完整个循环 ==========
// 第四课的 for 循环、push 历史、执行工具、判断 stopReason，全部在这两行里由框架完成。
console.log('【提交问题】(18 × 7) + 5 等于多少？');
const submission = await conversation.submit({ type: 'input', content: '(18 × 7) + 5 等于多少？' }, CONTEXT);
const settled = await submission.wait(CONTEXT); // 等到框架拿到文字答案
console.log(`【框架完成】状态：${settled.status}`);

// ========== 第 5 步：看框架保存的对话历史和最终回答 ==========
// messages 就是第四课手写的 messages 列表，这次由框架维护。
const { messages } = await conversation.context(CONTEXT);
console.log(`【对话历史】共 ${messages.length} 条：${messages.map((m) => m.role).join(' → ')}`);
const lastMessage = messages.at(-1);
console.log(`【最终回答】${lastMessage.content.find((block) => block.type === 'text').text}`);

await harness.close(CONTEXT); // 用完关闭框架
