# 第八课：把假模型换成真实模型

入口是 [src/lesson-real.mjs](../../src/lesson-real.mjs)。这一课**没有假模型文件**：请求会通过网络发给真实的大模型，**每次调用都会产生费用**（一问一答通常很便宜，但不是免费的）。

## 一句话

**把第七课的 `createFakeModel()` 换成一个真实模型的入口，其他代码几乎不变。数据库、框架、提交、等待，全部和第七课一样。**

前七课用假模型，是为了让你看清每一步；框架并不关心模型是真是假，它只认 `models` 这个入口。

## 第 0 步：准备 .env（只做一次）

真实模型需要三样东西：接口地址、密钥、模型名。它们放在 `agent/.env` 文件里，**不写进代码**。项目的 `.gitignore` 已经忽略 `.env`，密钥不会被提交。

```
cd ~/IdeaProjects/ai-explorer/agent
cp .env.example .env
```

用 IDEA 打开 `agent/.env`，填写三行（等号两边不要加空格和引号）：

```
CHAT_BASE_URL=https://api.openhubs.com/v1
CHAT_API_KEY=你的密钥
CHAT_MODEL=deepseek-v4-pro
```

- `CHAT_BASE_URL`：接口地址，通常以 `/v1` 结尾。上面是 `rag` 模块已经在用的 openhubs 地址；用别的服务商就换成它的地址。
- `CHAT_API_KEY`：密钥。可以和 `rag` 模块用同一个 openhubs 账号的密钥，但要单独填在这里。
- `CHAT_MODEL`：模型名，要换成你的服务商实际提供的名字（`deepseek-v4-pro` 只是举例）。

这三个变量和服务商无关：只要服务商兼容 OpenAI 的 Chat Completions 接口（大多数国内外服务商都兼容），填上对应的值就能用。

## 运行

`export PATH="$HOME/IdeaProjects/ai-explorer/target/frontend/node:$PATH"`

`cd ~/IdeaProjects/ai-explorer/agent`

`node src/lesson-real.mjs "我叫小李。"`

程序一开始会读取 `agent/.env`，把三行配置放进 `process.env`，之后用 `process.env.CHAT_MODEL` 这样的写法就能拿到。它按代码文件的位置找 `.env`，所以终端在 `agent` 还是 `agent/src` 目录运行都可以。

```
【使用模型】deepseek-v4-pro（https://api.openhubs.com/v1，调用会产生费用）
【已有历史】0 条消息：（空）
【提交问题】我叫小李。
【模型回复】你好，小李！有什么可以帮你的吗？
【现在共有】3 条消息，已保存到数据库。
```

真实模型的回复每次都可能不一样，你看到的文字和上面不同是正常的。再运行一次：

`node src/lesson-real.mjs "我叫什么？"`

```
【已有历史】3 条消息：system → user → assistant
【提交问题】我叫什么？
【模型回复】你叫小李。
```

这次模型真的答出来了。它能“记得”，原因和第七课一样：框架从数据库读出上次的对话，连同新问题一起发给了模型。模型本身仍然什么都不记得（第二课）。

## 和第七课相比，改了什么

| 第七课 | 第八课 |
|---|---|
| `createFakeModel()` 返回 `models` | `readChatConfig()` + `createChatProvider()` + `models.setProvider()` |
| 不联网、不收费，回复是写死的 | 请求发到 `CHAT_BASE_URL`，按用量收费，回复是模型生成的 |
| 永远成功 | 可能失败，要检查 `settled.status` |
| 数据库 `data/lesson-persist.sqlite` | 数据库 `data/lesson-real.sqlite`，两课互不影响 |

## 5 步

1. **准备真实模型**：`readChatConfig()` 读取并检查 `CHAT_BASE_URL` 和 `CHAT_MODEL`，缺了就提示。`createChatProvider(config)` 创建一个“按 OpenAI 格式发请求”的模型入口。`models.setProvider(...)` 把它交给 `models`，这一步和假模型完全一样。密钥 `CHAT_API_KEY` 在真正发请求时才从环境变量里读，代码里从头到尾看不到密钥。
2. **打开数据库和框架**：和第七课一样。多了一行 `conversation.configure(agent)`：对话已经存在时，`harness.root` 会沿用数据库里保存的旧配置；`configure` 把当前配置写进去，这样你在 `.env` 换了模型，下次运行就用新模型，历史保留。
3. **提交问题，等待完成**：和第七课一样。
4. **检查是否成功**：这是真实模型带来的新问题。密钥写错、余额不足、模型名写错、网络不通，都会让请求失败。框架不会让程序崩溃，而是让 `wait` 返回一个 `status` 不是 `done` 的结果，程序据此打印提示。
5. **读出回答，关闭框架**：和第七课一样。

## 动手 1：看看失败是什么样

把 `.env` 里的 `CHAT_API_KEY` 故意改错一个字符，再运行：

```
【请求失败】状态：unanswered，原因：model_error
请检查 .env 里的 CHAT_BASE_URL、CHAT_API_KEY、CHAT_MODEL。
```

`unanswered` 表示这个问题没有得到回答，`model_error` 表示是模型那一步出了错。改回正确的密钥，再运行一次，这次能正常回答，程序继续使用同一个对话。

如果 `.env` 不存在或少填了一行，会看到 `【缺少配置】请单独配置 CHAT_BASE_URL…`，这就是配置没被读到。

## 动手 2：换一个指令

把第 47 行（`const agent = ...` 那一行）的 `instructions` 改成 `'你是一个说话像古人的助手，用文言文回答。'`，然后继续问：

`node src/lesson-real.mjs "我叫什么？"`

模型仍然记得你叫小李，但说话方式变了。这说明：**历史和指令是两样东西**。历史存在数据库里；指令每次运行由 `configure` 写进去，改代码就能换。

想从头开始时运行 `node src/lesson-real.mjs --reset`（这个命令不请求模型）。练完把指令改回原样。

## 下一课

这一课的对话没有工具。下一课把第六课的计算工具加回来，看真实模型自己决定什么时候调用工具。
