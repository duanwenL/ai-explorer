# 第 5 部分：一次工作怎样进入模型与工具循环？

[学习目录](README.md) · [上一部分：独立工作](04-business-task.md) · [下一部分：等待用户](06-ask-human.md)

## 只解决这个问题

TaskDoc 已经创建了，那么哪个地方真正把问题交给模型？

先记住：**MindPad 准备和管理这项工作；pi-durable 组织模型与工具之间的执行循环。**

## 先对照自己的两行代码

打开 [session.mjs](../../src/session.mjs)：

```57:58:agent/src/session.mjs
  const submission = await root.submit({ type: 'input', content, requestId }, CONTEXT);
  const settled = await submission.wait(CONTEXT);
```

`submit()` 提交输入，返回提交对象；`wait()` 等这次输入处理收束。提交对象不是最终答案，等待结果也需要结合状态解释。你自己的演示在后面根据答案编号读取正文。

## MindPad 多做了哪两件事

### Kernel：准备一个能执行的会话

打开 [kernel.ts](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/runtime/kernel.ts)，只定位 `admitAndRun()`、`runAdmitted()` 和其中的 `createConversation()`。

先看三件事：

- 检查工作状态、资源和同一会话的占用，符合条件才运行。
- 为任务建立或复用原生会话，明确配置模型、指令、允许使用的工具与工作目录。
- 保存 `runtimeConversationId`，知道业务任务对应哪个原生会话。

这里的“原生会话”就是 `pi-durable` 提供的会话，不是网页上的一条消息。

### TaskExecutor：准备本轮内容并提交

打开 [executor.ts](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/runtime/executor.ts)，只定位 `runAttempt()` 中的提交位置：

```434:440:/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/runtime/executor.ts
        const sub = await conv.submit(
          { type: "input", content, requestId, entry: {
            kind: "wp.execution.input",
            data: boundary,
          } },
          CTX,
        );
```

- `content`：准备好的本轮输入与必要背景。前面会按任务需要整理附件、相关历史、技能说明和完成条件。
- `requestId`：这次原生提交的标识。
- `entry`：同时记录这次输入的来源信息。
- `boundary`：本轮执行来源与版本记录，用来检查结果是否仍属于这一轮。先理解用途，不必展开全部字段。

同一段代码的第 451 行会等待 `sub.wait()`，同时监测执行异常。`wait()` 并不自己读表格或生成报告。

## 工具循环发生在哪

模型提出结构化工具调用后，框架执行允许的工具，把工具结果加入历史，再调用模型。模型可能连续要求多个工具；一次用户输入可以产生多次模型请求。

你熟悉的“先要求 calculate，工具算出 126，再输出答案”，就是这个基本过程。MindPad 增加了更多工具与业务限制，而不是让你为每一次工具调用重新写一次 `submit()`。

## 读懂的标准

1. `Kernel` 和 `TaskExecutor` 各负责什么？
2. 一次提交是否只能调用一次模型？
3. `sub.wait()` 返回，是否必然意味着业务工作成功完成？

答案要点：前者管理准入、会话和状态，后者准备输入并驱动执行；可以多次调用模型；还要检查原生状态、用户等待和业务完成条件。

## 本节先不学

历史压缩、并发资源预算、执行来源版本字段和自动补全循环。下一部分先看一个具体的“尚未完成”情况：缺资料，需要问用户。
