# 第二课：模型不会自己记住上一轮

入口是 [src/lesson-history.mjs](../../src/lesson-history.mjs)。这一课仍然离线运行，不调用真实模型、不产生费用。

## 1. 知识点

**每次模型请求都是独立的。** 模型不会自动记得上一次请求说过什么。

想让模型“记得”，程序要在下一次请求里，把之前的消息按顺序再发送一次：

1. 第 1 轮用户问题：`user`
2. 第 1 轮模型回复：`assistant`
3. 这一轮新问题：`user`

这个消息列表就是**对话历史**。所谓“多轮对话”，就是每次请求都带上历史。

另外，`pi-ai` 会把 `systemPrompt` 转成一条 `system` 消息，放在最前面再交给模型。所以模型一侧收到的条数，比程序 `messages` 里多一条。

## 2. 运行

先在当前终端使用项目自带的 Node.js 22：

`export PATH="$HOME/IdeaProjects/ai-explorer/target/frontend/node:$PATH"`

`cd ~/IdeaProjects/ai-explorer/agent`

带历史运行：

`node src/lesson-history.mjs`

不带历史运行：

`node src/lesson-history.mjs --no-history`

## 3. 看输出

每次请求打印三部分：

- `[程序发送的请求内容]`：程序交给 `completeSimple` 的 `systemPrompt` 和 `messages`。
- `[模型实际收到的消息]`：pi-ai 把 `systemPrompt` 转成 `system` 消息后，模型一侧收到的完整列表。
- `[收到的回复]`：离线模型的回复。它不会回答问题，只报告收到了哪些角色的消息。

为了便于阅读，每条消息只打印 `role` 和 `content`，省略时间戳和用量统计等记录字段。

- 带历史时，第 2 次请求里能看到“我叫小李。”和第 1 次的回复。
- 不带历史时，第 2 次请求里只有“我叫什么？”。

换成真实模型时，前者可以回答“小李”，后者无法知道名字。

## 4. 重点代码

```34:37:agent/src/lesson-history.mjs
// 想让它“看到”之前的对话，程序要把第 1 轮的问题和回复，按顺序放进这次的消息列表。
const secondMessages = rememberHistory
  ? [firstQuestion, firstReply, secondQuestion]
  : [secondQuestion];
```

`firstReply` 是第 1 次调用返回的模型回复，可以直接放进下一次的消息列表。

## 5. 动手

1. 把第 36 行的 `[firstQuestion, firstReply, secondQuestion]` 改为 `[firstQuestion, secondQuestion]`，即去掉模型回复。
2. 运行 `node src/lesson-history.mjs`，观察第 2 次模型收到的角色变成什么。
3. 改回原样。

## 6. 为什么要学这个

对话越长，每次要发送的历史越多。保存历史、在程序重启后恢复历史，都要由程序完成。这正是后面 `pi-durable` 负责的事情之一：它把会话历史保存在 SQLite 中，下次请求时自动带上。
