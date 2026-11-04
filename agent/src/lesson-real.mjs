import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BACKGROUND_CONTEXT as CONTEXT } from '@earendil-works/chord/context';
import { createModels } from '@earendil-works/pi-ai';
import { createRegistry, Harness } from '@earendil-works/pi-durable';
import { openNodeSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/node';
import { createChatProvider, readChatConfig } from './providers.mjs';

// 数据库文件：agent/data/lesson-real.sqlite。和第七课分开，互不影响。
// （LESSON_DB 只给自动测试用。）
const databasePath = process.env.LESSON_DB ?? fileURLToPath(new URL('../data/lesson-real.sqlite', import.meta.url));

if (process.argv.includes('--reset')) {
  for (const suffix of ['', '-wal', '-shm']) await rm(databasePath + suffix, { force: true });
  console.log('【已清空】数据库文件已删除，下次运行是一个全新的对话。');
  process.exit(0);
}
const input = process.argv[2] ?? '你好，用一句话介绍你自己。';

// ========== 第 1 步：准备真实模型 —— 本课唯一的新东西 ==========
// 先读取 agent/.env（按本文件的位置找，终端在哪个目录运行都行），里面的三行配置会放进 process.env。
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (!process.env.LESSON_DB && existsSync(envPath)) process.loadEnvFile(envPath);

// 第七课调用 createFakeModel()，这里换成从 .env 读取的真实模型。
// readChatConfig 读取 CHAT_BASE_URL（接口地址）和 CHAT_MODEL（模型名），缺了就报错。
// CHAT_API_KEY（密钥）由 createChatProvider 在发请求时直接从环境变量读，代码里不出现密钥。
let config;
try {
  config = readChatConfig();
} catch (error) {
  console.log(`【缺少配置】${error.message}`);
  console.log('请先按第八课文档创建 agent/.env，填好 CHAT_BASE_URL、CHAT_API_KEY、CHAT_MODEL。');
  process.exit(1);
}
const provider = createChatProvider(config);
const models = createModels();
models.setProvider(provider); // 和假模型一样，把模型入口交给 models
console.log(`【使用模型】${config.modelId}（${config.baseUrl}，调用会产生费用）`);

// ========== 第 2 步：打开数据库和框架，拿到对话（和第七课一样） ==========
await mkdir(dirname(databasePath), { recursive: true });
const storage = await openNodeSqliteStorage(databasePath);
const harness = await Harness.open(storage, { models, registry: createRegistry() }, CONTEXT);
const agent = { model: { provider: provider.id, modelId: config.modelId }, instructions: '你是一个简洁的助手，用中文回答。' };
const conversation = await harness.root(CONTEXT, { agent });
// 对话已经存在时，harness.root 会沿用数据库里的旧配置。
// configure 把当前配置写进去：你在 .env 换了模型，下次运行就生效，历史保留。
await conversation.configure(agent, CONTEXT);

const before = await conversation.context(CONTEXT);
console.log(`【已有历史】${before.messages.length} 条消息：${before.messages.map((m) => m.role).join(' → ') || '（空）'}`);

// ========== 第 3 步：提交问题，等框架完成（和第七课一样） ==========
console.log(`【提交问题】${input}`);
const submission = await conversation.submit({ type: 'input', content: input }, CONTEXT);
const settled = await submission.wait(CONTEXT);

// ========== 第 4 步：检查是否成功 —— 真实模型会失败 ==========
// 假模型永远成功。真实模型可能因为密钥错误、余额不足、网络问题而失败，所以要看 status。
if (settled.status !== 'done') {
  console.log(`【请求失败】状态：${settled.status}，原因：${settled.reason ?? '未知'}`);
  console.log('请检查 .env 里的 CHAT_BASE_URL、CHAT_API_KEY、CHAT_MODEL。');
  await harness.close(CONTEXT);
  process.exit(1);
}

// ========== 第 5 步：读出回答，关闭框架（和第七课一样） ==========
const { messages } = await conversation.context(CONTEXT);
const reply = messages.at(-1).content.filter((block) => block.type === 'text').map((block) => block.text).join('');
console.log(`【模型回复】${reply}`);
console.log(`【现在共有】${messages.length} 条消息，已保存到数据库。`);
await harness.close(CONTEXT);
