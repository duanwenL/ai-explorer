import { Type } from '@earendil-works/pi-ai';
import { createFakeModel } from './lesson-error-fake-model.mjs';

// 练习开关：默认把错误交给模型；运行时加 --throw，出错就直接抛出，观察程序崩溃。
const throwErrors = process.argv.includes('--throw');

// 准备：拿到一个模型。这里是假模型（不联网），当成真实模型看即可。
const { models, model } = createFakeModel();
const systemPrompt = '你是一个简洁的助手。';
const question = { role: 'user', content: '18 乘 7 等于多少？', timestamp: Date.now() };

// ========== 第 1 步：工具说明书 + 工具函数（和第四课一样） ==========
const tools = [
  { name: 'multiply', description: '计算两个整数的乘积。', parameters: Type.Object({ a: Type.Integer(), b: Type.Integer() }) },
];
const runners = {
  multiply: (args) => {
    // 模型填的参数不一定对。不是整数就报错，不能拿错误的参数去算。
    if (!Number.isInteger(args.a) || !Number.isInteger(args.b)) {
      throw new Error(`参数 a 和 b 必须是整数，收到的是 ${JSON.stringify(args)}`);
    }
    return args.a * args.b;
  },
};

// ========== 第 2 步：执行一次工具调用 —— 本课重点 ==========
// 出错时不让程序崩溃，而是把错误写成一段文字返回，稍后交给模型。
function runTool(call) {
  const run = runners[call.name];

  // 错误 1：模型给的工具名不存在。
  if (!run) {
    return fail(`没有叫 ${call.name} 的工具。可用工具：${Object.keys(runners).join('、')}`);
  }

  // 错误 2：工具函数执行时报错。try 里出错，会跳到 catch，程序不会崩溃。
  try {
    return { isError: false, text: String(run(call.arguments)) };
  } catch (error) {
    return fail(`工具执行出错：${error.message}`);
  }
}

/** 把错误包装成结果。加了 --throw 时改成直接抛出，演示不处理错误会怎样。 */
function fail(text) {
  if (throwErrors) throw new Error(text);
  return { isError: true, text };
}

// ========== 第 3 步：循环（和第四课一样，只是改用 runTool 执行工具） ==========
const messages = [question];
const MAX_ROUNDS = 6;
let answer = null;

try {
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    console.log(`【第 ${round} 轮】发给模型 ${messages.length} 条消息`);
    const reply = await models.completeSimple(model, { systemPrompt, messages, tools });
    messages.push(reply);

    if (reply.stopReason !== 'toolUse') {
      answer = reply.content[0].text;
      break;
    }

    for (const block of reply.content) {
      if (block.type !== 'toolCall') continue;
      console.log(`  模型要求：调用 ${block.name}，参数 ${JSON.stringify(block.arguments)}`);
      const result = runTool(block);
      console.log(result.isError ? `  出错，把错误交给模型：${result.text}` : `  程序执行成功：${result.text}`);
      messages.push({
        role: 'toolResult',
        toolCallId: block.id,
        toolName: block.name,
        content: [{ type: 'text', text: result.text }], // 成功是结果，出错是错误说明，模型都能读到
        isError: result.isError, // 告诉模型：这次是成功还是出错
        timestamp: Date.now(),
      });
    }
  }
  console.log(answer === null ? `【停止】已问了 ${MAX_ROUNDS} 轮，程序主动停止。` : `【最终回答】${answer}`);
} catch (error) {
  // 只有加了 --throw 才会走到这里：错误没有交给模型，循环中断，用户拿不到回答。
  console.log(`【程序崩溃】${error.message}`);
  console.log('后面的轮次都没有执行，模型没有机会改正，用户拿不到回答。');
  process.exitCode = 1;
}
