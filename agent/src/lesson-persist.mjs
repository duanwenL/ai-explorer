import { mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BACKGROUND_CONTEXT as CONTEXT } from '@earendil-works/chord/context';
import { createRegistry, Harness } from '@earendil-works/pi-durable';
import { openNodeSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/node';
import { createFakeModel } from './lesson-persist-fake-model.mjs';

// 数据库文件的位置：agent/data/lesson-persist.sqlite。对话历史就存在这个文件里。
// （LESSON_DB 只给自动测试用，让测试写到临时文件，不影响你练习的数据库。）
const databasePath = process.env.LESSON_DB ?? fileURLToPath(new URL('../data/lesson-persist.sqlite', import.meta.url));

// 练习开关：加 --reset 删除数据库文件，从头开始。
if (process.argv.includes('--reset')) {
  for (const suffix of ['', '-wal', '-shm']) await rm(databasePath + suffix, { force: true });
  console.log('【已清空】数据库文件已删除，下次运行是一个全新的对话。');
  process.exit(0);
}
const input = process.argv[2] ?? '你好';

// 准备：拿到一个模型（假模型，不联网）。
const { models, model } = createFakeModel();

// ========== 第 1 步：打开数据库 —— 本课唯一的新东西 ==========
// 第六课用 new MemoryStorage()，历史存在内存，程序结束就没了。
// 这次换成 SQLite 数据库文件：文件不存在就新建，存在就打开，里面保存着以前的对话。
await mkdir(dirname(databasePath), { recursive: true });
const storage = await openNodeSqliteStorage(databasePath);

// ========== 第 2 步：打开框架，拿到对话（和第六课一样） ==========
// harness.root：数据库里还没有对话就新建一个；已经有了，就直接返回原来那个，历史都在。
const harness = await Harness.open(storage, { models, registry: createRegistry() }, CONTEXT);
const conversation = await harness.root(CONTEXT, {
  agent: { model: { provider: model.provider, modelId: model.id }, instructions: '你是一个简洁的助手。' },
});

// ========== 第 3 步：提交前，先看数据库里已经有多少历史 ==========
const before = await conversation.context(CONTEXT);
console.log(`【打开数据库】${databasePath}`);
console.log(`【已有历史】${before.messages.length} 条消息：${before.messages.map((m) => m.role).join(' → ') || '（空）'}`);

// ========== 第 4 步：提交问题，等框架完成（和第六课一样） ==========
console.log(`【提交问题】${input}`);
const submission = await conversation.submit({ type: 'input', content: input }, CONTEXT);
await submission.wait(CONTEXT);

// ========== 第 5 步：读出最终回答，关闭框架 ==========
// 新的问题和回答，框架已经自动写进数据库了。下次运行会一起读出来。
const { messages } = await conversation.context(CONTEXT);
console.log(`【模型回复】${messages.at(-1).content.find((block) => block.type === 'text').text}`);
console.log(`【现在共有】${messages.length} 条消息，已保存到数据库。`);
await harness.close(CONTEXT);
