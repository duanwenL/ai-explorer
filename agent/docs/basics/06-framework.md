# 第六课：用 pi-durable 框架代替手写循环

入口是 [src/lesson-framework.mjs](../../src/lesson-framework.mjs)。假模型在 [src/lesson-framework-fake-model.mjs](../../src/lesson-framework-fake-model.mjs)，回复和第四课完全一样，只是每次被请求时打印一行。

## 一句话

**第四、五课手写的循环（请求模型、执行工具、追加历史、处理错误、判断结束），框架全部替你做。你只需要定义工具、创建对话、提交问题。**

## 运行

`export PATH="$HOME/IdeaProjects/ai-explorer/target/frontend/node:$PATH"`

`cd ~/IdeaProjects/ai-explorer/agent`

`node src/lesson-framework.mjs`

```
【提交问题】(18 × 7) + 5 等于多少？
【第 1 次请求模型】框架发了 2 条消息
  【框架执行工具】multiply(18, 7) → 126
【第 2 次请求模型】框架发了 4 条消息
  【框架执行工具】add(126, 5) → 131
【第 3 次请求模型】框架发了 6 条消息
【框架完成】状态：done
【对话历史】共 7 条：system → user → assistant → toolResult → assistant → toolResult → assistant
【最终回答】(18 × 7) + 5 = 131。
```

和第四课的过程一模一样：请求 3 次模型，执行 2 次工具。区别是这次代码里**没有写循环**。

消息条数比第四课多 1 条，是因为框架把 `instructions`（相当于 `systemPrompt`）作为第一条 `system` 消息放进了历史。

## 第四课的代码，在框架里变成了什么

| 第四、五课手写的 | 框架里的写法 |
|---|---|
| `tools`（说明书）+ `runners`（函数），分两处写 | `defineTool({ name, description, parameters, execute })`，写在一起 |
| `runners[block.name]` 按名字找函数 | `registry.install(...)` 把工具放进工具箱，框架按名字找 |
| `messages` 列表，自己 `push` | 框架自动维护，用 `conversation.context()` 读出来 |
| `for` 循环 + 判断 `stopReason` | `conversation.submit(...)` + `submission.wait(...)` |
| `runTool` 里的 `try/catch` | 框架自动把错误变成 `isError` 的工具结果 |
| `systemPrompt` | `agent.instructions` |

## 5 步

1. **定义工具**：`defineTool` 把说明书和 `execute` 函数合成一个对象。`execute` 返回 `{ output: [{ type: 'text', text: ... }] }`，`output` 就是交给模型的结果文字，相当于以前 `toolResult` 里的 `content`。
2. **放进工具箱**：`createRegistry()` 创建工具箱，`registry.install(...)` 把工具放进去。`defineExtension` 是把一组工具打成一个包，起名叫 `lesson`。
3. **打开框架，创建对话**：
   - `Harness.open(存储, { models, registry }, CONTEXT)`：打开框架，告诉它用哪个模型入口、哪个工具箱。
   - `MemoryStorage`：历史只存在内存里，程序结束就没了。
   - `harness.root(...)`：创建一个对话，配置用哪个模型、指令是什么、能用哪些工具。
   - `CONTEXT`：框架每个方法都要传的参数，用来支持取消操作。照着传即可。
4. **提交问题，等待完成**：`submit` 交出问题，`wait` 一直等到框架拿到文字答案。中间的所有轮次都在 `wait` 期间完成。
5. **读结果**：`conversation.context()` 返回框架保存的历史，`messages` 就是第四课手写的那个列表。最后一条是模型的文字回答。

## 动手：工具不可用时，框架会怎样

把第 46 行的 `tools: [multiply, add]` 改成 `tools: [multiply]`，即这个对话不能用 `add`，再运行：

```
【第 2 次请求模型】框架发了 4 条消息
【第 3 次请求模型】框架发了 6 条消息
【最终回答】(18 × 7) + 5 = <harness>
[error] Tool add is not available
</harness>。
```

- 第 2 次请求后，没有出现 `【框架执行工具】add`：框架发现这个工具不可用，没有执行。
- 程序没有崩溃，框架把错误 `Tool add is not available` 作为工具结果交给了模型，这就是第五课手写的 `runTool` 做的事。
- 假模型只会把最后一个工具结果原样放进回答，所以回答里出现了错误文字。真实模型读到这个错误，会换一种方式回答。

练完改回原样。

## 下一课

本课用 `MemoryStorage`，程序一结束历史就没了。下一课换成 SQLite 数据库，看程序重启后怎么接着上次的对话继续聊，这也是框架名字里 durable（持久）的意思。
