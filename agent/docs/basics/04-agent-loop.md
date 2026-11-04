# 第四课：把工具调用写成循环，这就是 Agent

入口是 [src/lesson-loop.mjs](../../src/lesson-loop.mjs)。假模型在 [src/lesson-loop-fake-model.mjs](../../src/lesson-loop-fake-model.mjs)，不需要读懂，当成真实模型看即可。

## 一句话

**一直问模型：它要工具，程序就执行并把结果交回去，再问；它给出文字答案，就停。**

第三课只调用一次工具，所以手写两次请求就够了。可是模型要调用几次工具，程序事先不知道，所以要写成循环。

## 例子

问题是 `(18 × 7) + 5 等于多少？`，要用两次工具：先乘，再加。

## 运行

`export PATH="$HOME/IdeaProjects/ai-explorer/target/frontend/node:$PATH"`

`cd ~/IdeaProjects/ai-explorer/agent`

`node src/lesson-loop.mjs`

```
【第 1 轮】发给模型 1 条消息：user
  模型要求：调用 multiply，参数 {"a":18,"b":7}
  程序执行：multiply → 126
【第 2 轮】发给模型 3 条消息：user → assistant → toolResult
  模型要求：调用 add，参数 {"a":126,"b":5}
  程序执行：add → 131
【第 3 轮】发给模型 5 条消息：user → assistant → toolResult → assistant → toolResult
  模型回复文字：(18 × 7) + 5 = 131。
【最终回答】(18 × 7) + 5 = 131。
```

每一轮，消息都比上一轮多 2 条：模型的回复 `assistant`、工具结果 `toolResult`。

## 和第三课比，变了 3 处

**1. 工具函数按名字存放（第 2 步）**

```js
const runners = {
  multiply: (args) => args.a * args.b,
  add: (args) => args.a + args.b,
};
```

模型说要调用 `add`，程序就运行 `runners['add']`。第三课是写死调用 `runMultiply`，现在模型说哪个名字，程序就找哪个函数。

**2. 历史放在一个列表里，不断追加（第 3 步）**

```js
const messages = [question];
...
messages.push(reply);       // 追加模型回复
messages.push({ role: 'toolResult', ... });  // 追加工具结果
```

`push` 是往列表末尾加一项。每一轮都把整份 `messages` 发给模型，所以模型能看到之前所有的调用和结果。

**3. 用循环代替手写的两次请求（第 3 步）**

每一轮做的事：

1. 把 `messages` 发给模型，拿到 `reply`。
2. 把 `reply` 追加进 `messages`。
3. 看 `reply.stopReason`：
   - 不是 `toolUse`：模型给出了文字答案，`break` 跳出循环。
   - 是 `toolUse`：逐个执行工具调用，把结果追加进 `messages`，进入下一轮。

## 为什么要有 `MAX_ROUNDS`

模型可能一直要求调用工具，循环就停不下来，还会一直产生费用。所以要设上限：最多问 5 轮，到了就主动停止。

## 动手

把 `const MAX_ROUNDS = 5;` 改成 `2`，再运行。第 2 轮之后，模型还在要求调用工具，程序输出：

```
【停止】已问了 2 轮，模型仍在要求调用工具，程序主动停止。
```

练完改回 `5`。

## 这个循环和框架的关系

这个循环就是 Agent 的核心。真实框架（比如本项目用的 `pi-durable`）做的也是这件事，另外还处理：

- 模型给了不存在的工具名、或参数填错时怎么办；
- 工具执行报错时，把错误告诉模型；
- 把 `messages` 存进数据库，程序重启后能接着聊。

下一课先讲第一件：工具出错怎么办。
