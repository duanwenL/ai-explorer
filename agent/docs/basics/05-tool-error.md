# 第五课：工具出错时，把错误交给模型

入口是 [src/lesson-error.mjs](../../src/lesson-error.mjs)。假模型在 [src/lesson-error-fake-model.mjs](../../src/lesson-error-fake-model.mjs)，不需要读懂，当成真实模型看即可。

## 一句话

**工具出错时程序不要崩溃，而是把错误写成文字，当作工具结果交给模型。模型读到错误，就能自己改正再试。**

## 模型会犯哪两种错

1. **工具名写错**：比如调用 `mul`，实际只有 `multiply`。程序在 `runners` 里找不到这个名字。
2. **参数填错**：比如 `b` 应该是整数，模型填了文字 `"七"`。工具函数执行时报错。

## 运行

`export PATH="$HOME/IdeaProjects/ai-explorer/target/frontend/node:$PATH"`

`cd ~/IdeaProjects/ai-explorer/agent`

`node src/lesson-error.mjs`

```
【第 1 轮】发给模型 1 条消息
  模型要求：调用 mul，参数 {"a":18,"b":7}
  出错，把错误交给模型：没有叫 mul 的工具。可用工具：multiply
【第 2 轮】发给模型 3 条消息
  模型要求：调用 multiply，参数 {"a":18,"b":"七"}
  出错，把错误交给模型：工具执行出错：参数 a 和 b 必须是整数，收到的是 {"a":18,"b":"七"}
【第 3 轮】发给模型 5 条消息
  模型要求：调用 multiply，参数 {"a":18,"b":7}
  程序执行成功：126
【第 4 轮】发给模型 7 条消息
【最终回答】18 × 7 = 126。
```

模型错了两次，读到错误说明后改正，第 3 轮成功。假模型的改正过程是写死的；真实模型会根据错误文字自己改。

## 重点代码：`runTool`

和第四课相比，循环没变，只是执行工具改成调用 `runTool`：

```js
function runTool(call) {
  const run = runners[call.name];

  // 错误 1：模型给的工具名不存在。
  if (!run) {
    return fail(`没有叫 ${call.name} 的工具。可用工具：...`);
  }

  // 错误 2：工具函数执行时报错。try 里出错，会跳到 catch，程序不会崩溃。
  try {
    return { isError: false, text: String(run(call.arguments)) };
  } catch (error) {
    return fail(`工具执行出错：${error.message}`);
  }
}
```

- `runners[call.name]` 找不到时是 `undefined`，`!run` 就成立，说明工具名不存在。
- `try { ... } catch (error) { ... }`：`try` 里的代码报错时，程序不会停止，而是跳到 `catch`，`error.message` 是错误文字。
- 两种错误都返回 `{ isError: true, text: 错误说明 }`，和成功结果的形状一样，所以循环里可以同样处理。

返回值放进 `toolResult` 消息：

```js
content: [{ type: 'text', text: result.text }], // 成功是结果，出错是错误说明
isError: result.isError,                        // 告诉模型：这次是成功还是出错
```

**错误说明要写清楚**：哪里错了、正确的应该是什么。比如“可用工具：multiply”，模型读到就知道该改成哪个名字。

## 动手：看看不处理错误会怎样

运行 `node src/lesson-error.mjs --throw`。这个开关让出错时直接抛出，不交给模型：

```
【第 1 轮】发给模型 1 条消息
  模型要求：调用 mul，参数 {"a":18,"b":7}
【程序崩溃】没有叫 mul 的工具。可用工具：multiply
后面的轮次都没有执行，模型没有机会改正，用户拿不到回答。
```

对比两次输出：同样的错误，交给模型就能继续，直接抛出就全部中断。

## 这个和框架的关系

`pi-durable` 也是这样做的：工具名不存在、参数不符合 `parameters` 规定的格式、工具执行报错，都会变成 `isError: true` 的工具结果交给模型。参数格式检查由框架按说明书自动完成，不需要像本课这样在函数里手写。

到这里，Agent 循环的基础就学完了：**请求模型 → 执行工具（出错也交回）→ 带上历史再请求 → 直到文字答案**。下一课把第四、五课手写的循环，换成 `pi-durable` 框架来做，对照着看框架帮你省了哪些代码。
