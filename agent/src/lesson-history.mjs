import { createModels } from '@earendil-works/pi-ai';
import { fauxProvider, fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';

// 练习开关：默认带上历史；运行时加 --no-history，第二次请求就只发送新问题。
const rememberHistory = !process.argv.includes('--no-history');

// 离线预设模型：不联网、不收费，也不会理解问题。
// 它只报告自己收到了哪些角色的消息，并把收到的消息记到 received，方便打印出来对照。
// 注意：pi-ai 会先把 systemPrompt 变成第一条 system 消息，再交给模型接入对象。
let received = [];
const offline = fauxProvider({ provider: 'lesson-offline', models: [{ id: 'message-counter' }] });
const reportRoles = (context) => {
  received = context.messages;
  const roles = context.messages.map((message) => message.role).join(' → ');
  return fauxAssistantMessage(`（离线回复）模型收到 ${context.messages.length} 条：${roles}`);
};
offline.setResponses([reportRoles, reportRoles]);

const models = createModels();
models.setProvider(offline.provider);
const model = offline.getModel();
const systemPrompt = '你是一个简洁的助手。';

// 第 1 次请求：只有一条用户消息。
const firstQuestion = { role: 'user', content: '我叫小李。', timestamp: Date.now() };
const firstRequest = { systemPrompt, messages: [firstQuestion] };
const firstReply = await models.completeSimple(model, firstRequest);
printRound(1, firstRequest, firstReply);

// 第 2 次请求：用户问一个依赖上一轮内容的问题。
const secondQuestion = { role: 'user', content: '我叫什么？', timestamp: Date.now() };

// 本节重点：模型不会自己记住上一次请求。
// 想让它“看到”之前的对话，程序要把第 1 轮的问题和回复，按顺序放进这次的消息列表。
const secondMessages = rememberHistory
  ? [firstQuestion, firstReply, secondQuestion]
  : [secondQuestion];
const secondRequest = { systemPrompt, messages: secondMessages };
const secondReply = await models.completeSimple(model, secondRequest);
printRound(2, secondRequest, secondReply);

console.log(rememberHistory
  ? '\n[结论] 第 2 次请求带上了历史；真实模型可以从中读到“我叫小李”。'
  : '\n[结论] 第 2 次请求没有历史；真实模型无法知道你叫什么。');

/** 打印一次请求：程序发送的内容、模型实际收到的内容，以及收到的回复。 */
function printRound(round, request, reply) {
  console.log(`\n========== 第 ${round} 次请求 ==========`);
  console.log('[程序发送的请求内容]');
  console.log(JSON.stringify({ systemPrompt: request.systemPrompt, messages: request.messages.map(brief) }, null, 2));
  console.log('[模型实际收到的消息]');
  console.log(JSON.stringify(received.map(brief), null, 2));
  console.log('[收到的回复]', reply.content[0].text);
}

/** 只打印 role 和 content。消息里的 timestamp、模型回复里的 usage 等记录字段省略，避免干扰阅读。 */
function brief(message) {
  return { role: message.role, content: message.content };
}
