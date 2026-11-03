# 第一课上手：一次模型请求发送什么、收到什么

这一课先学模型调用，不学习 MindPad、工具、数据库或复杂 Agent 会话。入口是 [src/lesson-model.mjs](../../src/lesson-model.mjs)。

## 1. 先学三个知识点

### 输入不是只有一句问题

一次请求可以包含固定要求与消息列表：

- `systemPrompt`：给模型的固定要求，例如“你是一个简洁的助手”。
- `messages`：本次发送的消息列表。
- 每条消息的 `role`：是谁说的。`user` 表示用户，`assistant` 表示模型的答复。
- 每条消息的 `content`：实际内容，例如“你好，请介绍自己”。
- `timestamp`：消息时间，不是要模型回答的问题。

本节只发送一条用户消息。后面学习多轮时，才会发送先前的消息。本节的对象是 pi-ai 的输入格式，具体服务接口的 HTTP 格式由接入对象适配，不一定原样使用这些字段名。

### 调用方法负责请求并收集完整回复

`models.completeSimple(model, request)` 使用指定的模型，提交输入并取得完整回复。这里只做一次调用，没有模型与工具之间的执行循环。

`await` 表示等这个异步调用取得结果后，再执行后面的代码。真实网络请求可能失败，完整的错误处理后面单独学。

### 输出是结构化回复，不是只有字符串

本节回复中的 `content` 是内容块列表，每个文字块都有 `type: text` 和 `text`。`stopReason` 表示此次输出为什么结束；本节的 `stop` 表示正常结束。

程序从文字块里取出 `text`，再显示给用户。现在只取第一块，不使用复杂的数组操作；以后处理真实模型时再学习多块输出。

## 2. 本节使用离线预设模型

`fauxProvider` 是 pi-ai 提供的离线模拟接入对象。这里预先设置了一段固定回复，不发网络请求、不用 API key、不产生模型费用。

这不是模型理解了你的问题，而是教学用的固定输出。即使换成“请介绍 Java”，回复也不会变成 Java 介绍。本节只验证请求构造、异步调用与回复读取；下一步接真实 API 时，才学习真实模型生成回复。

## 3. 先运行一次

在终端进入项目根目录：

`cd /Users/smzdm/IdeaProjects/ai-explorer`

当前终端选择 Java 21，供 Maven 使用：

`export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"`

`export PATH="$JAVA_HOME/bin:$PATH"`

运行第一课：

`mvn -pl agent -Plesson-model verify`

Maven 使用项目私有 Node.js，安装锁定依赖、执行测试和检查，再运行本课。只选择 `agent` 模块，不构建 `rag`，也不启动网站或 Docker。首次依赖安装可能需要网络；本课的模型调用本身始终离线。

注意：验证阶段也会运行已有计算示例的 SQLite 测试，可能显示 SQLite 实验特性提示；这是其他测试，不表示第一课打开了数据库。

重点找这些输出：

- `[传入的问题]`：程序准备发送的问题。
- `[请求内容]`：固定要求与用户消息。
- `[回复内容块]`：一段预设的 `text` 内容块。
- `[结束原因] stop`：回复正常结束。
- `[显示给用户]`：从内容块里取出的文字。
- `[模型请求次数] 1`：本课只请求一次。

## 4. 只看两处重点代码

先看输入对象：

```24:27:agent/src/lesson-model.mjs
const request = {
  systemPrompt: '你是一个简洁的助手。',
  messages: [{ role: 'user', content: question, timestamp: Date.now() }],
};
```

固定要求与用户问题分开。第 26 行的 `question` 使用文件第 5 行准备的问题。

再看调用：

```34:34:agent/src/lesson-model.mjs
const response = await models.completeSimple(model, request);
```

这一行请求模型并等待完整回复。`model` 是选择的模型，`request` 是输入，`response` 是收到的结构化答复。

文件中的离线模型准备、模型接入集合和打印代码都有注释。这次先知道它们各自的作用，不需要把所有接口一次背下来。

## 5. 你自己动手：只改问题

1. 打开 `agent/src/lesson-model.mjs`。
2. 把第 5 行的默认问题改成“请介绍 Java”。保留这一行的其他结构。
3. 保存后再运行 `mvn -pl agent -Plesson-model verify`。
4. 观察：传入的问题与请求内容改变了，预设回复仍然相同。

这个区别说明：输入与输出是两份数据，离线预设模型不是一个真实回答问题的模型。测试没有把默认问题措辞写死，修改问题后仍然可以运行。

第一次 Maven 验证成功后，也可以在项目根目录直接使用已安装的私有 Node.js：

`./target/frontend/node/node agent/src/lesson-model.mjs`

想暂时换问题而不改源码，可以运行：

`./target/frontend/node/node agent/src/lesson-model.mjs "请介绍 Java。"`

这样只运行本课，不重复安装依赖和执行全部测试。仍然是离线预设回复。

## 6. 下一步

这次先运行和改问题，不做口头测验。确认你能找到“请求里实际带了什么”和“程序显示哪段回复”之后，下一课再学习 provider（模型服务接入对象），并连接你已有的真实模型 API。真实接入会用独立聊天配置；未经明确请求，不运行付费模型。

本节已于 2026-11-03 实际运行 Maven 验证：7 个 Agent 测试通过、代码检查通过，第一课打印一次离线请求及回复，构建成功。
