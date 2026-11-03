import { createModels } from '@earendil-works/pi-ai';
import { fauxProvider, fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';

// 第一次练习只改这句话。命令行传入的问题优先，否则使用这里的默认问题。
const question = process.argv[2] ?? '你好，请用一句话介绍自己。';

// 这是离线预设模型：不会联网，不需要 API key，也不会产生模型费用。
// 它只返回下面写好的文字，不会像真实模型那样理解或回答你的问题。
const offline = fauxProvider({
  provider: 'lesson-offline',
  models: [{ id: 'fixed-reply' }],
});
offline.setResponses([
  fauxAssistantMessage('你好！这是一段预设的离线回复，不是真实大模型生成的回答。'),
]);

// Models 是模型接入集合。把离线 provider（模型服务接入对象）加入集合。
const models = createModels();
models.setProvider(offline.provider);
const model = offline.getModel();

// 本节重点：构造一次模型请求。这里的对象是 pi-ai 接收的输入格式。
// systemPrompt 是固定要求；messages 是消息列表；role=user 表示用户消息。
const request = {
  systemPrompt: '你是一个简洁的助手。',
  messages: [{ role: 'user', content: question, timestamp: Date.now() }],
};
console.log('[说明] 离线练习：一次模型请求，没有工具、数据库或 Agent 会话。');
console.log('[传入的问题]', question);
console.log('[请求内容]', JSON.stringify(request, null, 2));

// 本节重点：completeSimple 请求模型并等待完整回复，不涉及工具执行循环。
// await 表示先等回复回来，再执行下面的打印代码。
const response = await models.completeSimple(model, request);
console.log('[回复内容块]', JSON.stringify(response.content));
console.log('[结束原因]', response.stopReason);

// 此离线回复只有一个文字块；只取这一块，暂时不学习复杂的数组处理。
const firstBlock = response.content[0];
if (response.stopReason !== 'stop' || firstBlock?.type !== 'text') {
  throw new Error('本节预期一次正常结束的文字回复');
}
console.log('[显示给用户]', firstBlock.text);
console.log('[模型请求次数]', offline.state.callCount);
