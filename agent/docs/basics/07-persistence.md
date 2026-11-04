# 第七课：把对话存进数据库，重启后接着聊

入口是 [src/lesson-persist.mjs](../../src/lesson-persist.mjs)。假模型在 [src/lesson-persist-fake-model.mjs](../../src/lesson-persist-fake-model.mjs)，它不理解问题，只报告“这次请求里我看到了哪些用户消息”，用来检查以前的对话有没有被一起发给模型。

## 一句话

**把第六课的 `new MemoryStorage()` 换成一个 SQLite 数据库文件，框架就会把每条消息写进文件。程序重启后再打开同一个文件，对话从上次停下的地方继续。**

这就是框架名字里 durable（持久）的意思。

## 运行

`export PATH="$HOME/IdeaProjects/ai-explorer/target/frontend/node:$PATH"`

`cd ~/IdeaProjects/ai-explorer/agent`

这一课要**连续运行几次**，每次是一个新的程序，问题写在命令后面：

`node src/lesson-persist.mjs --reset`

`node src/lesson-persist.mjs "我叫小李。"`

```
【打开数据库】/Users/smzdm/IdeaProjects/ai-explorer/agent/data/lesson-persist.sqlite
【已有历史】0 条消息：（空）
【提交问题】我叫小李。
【模型回复】（假模型）我看到了 1 条用户消息：「我叫小李。」
【现在共有】3 条消息，已保存到数据库。
```

程序已经结束了。再运行一次，问一个需要“记得上一轮”的问题：

`node src/lesson-persist.mjs "我叫什么？"`

```
【打开数据库】/Users/smzdm/IdeaProjects/ai-explorer/agent/data/lesson-persist.sqlite
【已有历史】3 条消息：system → user → assistant
【提交问题】我叫什么？
【模型回复】（假模型）我看到了 2 条用户消息：「我叫小李。」「我叫什么？」
【现在共有】5 条消息，已保存到数据库。
```

- 第二次运行一开始，`【已有历史】` 就是 3 条：上次的指令、问题和回答，是从数据库文件里读出来的。
- 模型这次看到了 2 条用户消息，包括上一个程序里说的「我叫小李。」。真实模型拿到这段历史，就能回答“你叫小李”。
- 回想第二课：模型自己不记得任何东西，程序必须把历史一起发过去。第二课历史存在一个变量里，程序一结束就丢了；这次历史存在文件里，所以能跨越重启。

终端里还会出现一行 `ExperimentalWarning: SQLite is an experimental feature`。这是 Node.js 提醒它自带的 SQLite 功能还在试验阶段，不影响结果，可以忽略。

## 和第六课相比，只改了一处

| 第六课 | 第七课 |
|---|---|
| `new MemoryStorage()` | `await openNodeSqliteStorage('…/lesson-persist.sqlite')` |
| 历史存在内存，程序结束就没了 | 历史存在 `agent/data/lesson-persist.sqlite` 文件里 |
| 每次运行都是新对话 | 每次运行接着同一个对话 |

`Harness.open`、`harness.root`、`submit`、`wait`、`context` 的写法和第六课完全一样。**换存储不需要改其他代码**，框架负责什么时候写入、什么时候读出。

## 5 步

1. **打开数据库**：`openNodeSqliteStorage(路径)`。文件不存在就新建一个空数据库；文件已经存在就直接打开，里面是以前的对话。前面的 `mkdir` 只是确保 `data` 目录存在。
2. **打开框架，拿到对话**：`harness.root(...)` 的意思是“拿到主对话”。数据库里还没有对话时，它按传入的配置新建一个；已经有了，就返回原来那个，历史都在里面。
3. **提交前看历史**：`conversation.context()` 读出数据库里已有的消息。第一次是 0 条，之后每次运行多 2 条（一问一答）。
4. **提交问题，等待完成**：和第六课一样。框架把以前的历史加上新问题一起发给模型。
5. **读回答，关闭框架**：新的问题和回答在 `wait` 期间已经自动写进数据库，不需要手动“保存”。`harness.close` 关闭框架和数据库文件。

`--reset` 是本课自己加的练习开关，作用就是删掉数据库文件。删掉之后，下一次运行就是一个全新的对话。

## 动手 1：多聊几轮

不加 `--reset`，接着运行几次，每次换一个问题：

`node src/lesson-persist.mjs "我喜欢喝咖啡。"`

`node src/lesson-persist.mjs "我喜欢喝什么？"`

观察 `【已有历史】` 每次多 2 条，模型看到的用户消息越来越多。这就是聊天软件“记得你说过的话”的原理：每次都把全部历史发给模型。

然后运行 `node src/lesson-persist.mjs --reset`，再问一次 `"我叫什么？"`，确认历史回到 0 条。

## 动手 2：换回内存存储，看会发生什么

把第 1 步换回第六课的写法：

1. 在文件开头的 `import` 下面加一行：`import { MemoryStorage } from '@earendil-works/pi-durable/storage/memory';`
2. 把 `const storage = await openNodeSqliteStorage(databasePath);` 改成 `const storage = new MemoryStorage();`

再连续运行两次：

`node src/lesson-persist.mjs "我叫小李。"`

`node src/lesson-persist.mjs "我叫什么？"`

```
【已有历史】0 条消息：（空）
【提交问题】我叫什么？
【模型回复】（假模型）我看到了 1 条用户消息：「我叫什么？」
```

第二次运行的历史又是 0 条，模型只看到了「我叫什么？」，不知道你叫小李。屏幕上仍然打印“已保存到数据库”，但其实什么都没写进文件，程序一结束就丢了。

练完改回原样。

## 下一课

到这里，第二课到第七课手写过的东西，框架都已经替你做了：保存历史、调用工具、处理错误、循环、持久保存。下一课把假模型换成真实模型，用 [src/chat.mjs](../../src/chat.mjs) 和一个真正会回答的模型多轮对话。
