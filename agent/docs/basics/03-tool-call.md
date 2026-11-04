# 第三课：模型只提出调用工具，程序负责执行

入口是 [src/lesson-tool.mjs](../../src/lesson-tool.mjs)，从上到下按 5 步写好。假模型放在另一个文件 [src/lesson-tool-fake-model.mjs](../../src/lesson-tool-fake-model.mjs)，不需要读懂，当成真实模型看即可。

## 一句话

**模型不会算，它只会说“请帮我调用 multiply，参数是 18 和 7”。程序去算，再把 126 告诉模型，模型才回答。**

## 运行

`export PATH="$HOME/IdeaProjects/ai-explorer/target/frontend/node:$PATH"`

`cd ~/IdeaProjects/ai-explorer/agent`

`node src/lesson-tool.mjs`

输出 5 行，正好对应代码的 5 步：

```
【第 1 次请求】发给模型：问题 + 工具说明书（multiply）
【第 1 次回复】模型没有回答，而是说：请调用 multiply，参数 {"a":18,"b":7}
【程序执行工具】runMultiply({"a":18,"b":7}) = 126
【第 2 次请求】发给模型的消息：user → assistant → toolResult
【第 2 次回复】18 × 7 = 126。
```

想看每次请求的完整内容，运行 `node src/lesson-tool.mjs --detail`。

## 5 步

| 步骤 | 谁做 | 做什么 | 代码里的变量 |
|---|---|---|---|
| 第 1 步 | 程序 | 写工具说明书：名字、用途、参数 | `multiplyTool` |
| 第 2 步 | 程序 | 写真正做乘法的函数 | `runMultiply` |
| 第 3 步 | 模型 | 读说明书，回复“请调用 multiply，参数 18、7” | `firstReply`、`toolCall` |
| 第 4 步 | 程序 | 用这两个参数调用函数，算出 126 | `value` |
| 第 5 步 | 模型 | 看到 126，回答“18 × 7 = 126” | `resultMessage`、`secondReply` |

第 1、2 步只是准备，第 3 步才第一次问模型。

## 最容易混的两点

**1. 说明书和函数是两样东西。**

- `multiplyTool`（第 1 步）会发给模型，模型只能读它。
- `runMultiply`（第 2 步）留在程序里，模型看不到、也运行不了。

**2. 问了两次模型。**

- 第 1 次只带问题，模型回复的是调用要求，不是答案。
- 第 2 次带上三条消息：原问题、模型的调用要求、工具结果。这就是第二课的“带上历史”，只是多了一条 `toolResult`。

## 动手

把 `runMultiply` 里的 `return args.a * args.b;` 改成 `return args.a * args.b + 1;`，再运行。最终回答变成 `127`：模型直接用程序给的结果，所以工具代码必须写对。练完改回原样。

## 下一课

这一课是手写的：只调用一次工具，而且程序写死了调用 `runMultiply`。真实情况下模型可能连续调用多次、调用不同工具，这时要写一个循环，按名字找工具、执行、把结果交回模型，直到模型给出文字答案。这个循环就是 Agent。
