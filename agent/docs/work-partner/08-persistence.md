# 第 8 部分：状态存在哪里，重启后怎样处理？

[学习目录](README.md) · [上一部分：交付](07-delivery.md)

## 只解决这个问题

服务关掉后，为什么还能知道工作做到了哪里？为什么有些操作恢复后不能直接再做一次？

**会话、输入和业务状态需要持久保存；外部系统里已经发生的动作，需要另行确认。** 这两件事不能混为一谈。

## 先看存储位置

打开 [main.ts](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/main.ts)，找到启动配置中的 SQLite 路径：

```35:37:/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/main.ts
  sqlitePath: join(dataDir, "runtime.sqlite"),
  models: getModels(),
  modelRef: { provider: model.provider, modelId: model.id },
```

第 35 行指定保存状态的数据库文件。`server.ts` 用 `openNodeSqliteStorage()` 打开它，再交给 `Harness.open()`。

原生会话和业务文档由这个持久存储承载；报告等成果文件另存在工作目录，不代表全部文件二进制都塞进 SQLite。网页展示还使用宿主事件与中心状态投影。

## 三种编号先分开

- `taskId`：哪一项业务工作。
- `commandId`：哪一次业务命令，例如发消息、回答问题或暂停工作。
- `requestId`：哪一次提交给原生会话的请求。

同一项工作可以有多个用户命令、多个原生请求。恢复一项工作，不意味着永远只用第一次请求编号。

重试同一次命令应保留原标识；同编号但内容不同会被视为冲突。原生会话的同一 `requestId` 可以查到已有提交。这些去重机制不自动证明外部发送或写入只发生了一次。

## 重启后做什么

打开 [server.ts](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/api/server.ts)，只看启动末尾的一小段：

```4765:4768:/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/api/server.ts
  await recordings.recover();
  await processJobs.recover();
  await groupCoordinator.recoverDissolved();
  await kernel.recoverRunning();
```

先只关注第 4768 行：内核对保存的工作状态进行恢复处理。其余是录制、进程和群组等扩展功能的恢复，本节先跳过。

再在本文件定位 `reconcile()`：它核对已保存命令、修复队列或状态展示，并通知执行器检查可运行的工作。这里不意味着每项中断工作都会无条件自动继续。

## 外部效果未知：一个必须记住的例子

假设发送邮件后服务突然退出，来不及保存成功回执。邮件可能已经发出，也可能没有。

数据库保存了请求意图，不等于能证明收件人收到或没收到。直接换编号再次发送，可能发送两封。

打开 [legacy-tools.ts](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/runtime/legacy-tools.ts)，定位 `MCP_EFFECT_UNKNOWN`、`MAIL_EFFECT_UNKNOWN`。这类情况会记录 `effect_unknown`，即“外部操作效果未知”。执行器会中断，并要求核实原操作，而不是简单重做。

因此纯计算工具的 `replay: 'safe'` 不能直接照搬到付款、发邮件等工具上。安全恢复还需要副作用策略和外部回执。

## 读懂的标准

1. `taskId`、`commandId`、`requestId` 分别标识什么？
2. SQLite 保存状态，能自动保证邮件只发送一次吗？
3. 发送结果未知时，为什么不能简单换编号重发？

答案要点：工作、业务命令、原生请求；不能；外部动作可能已经发生，先核实原操作才能避免重复。

## 到这里，你已经掌握了什么

可以区分伙伴配置、工具、对话输入、业务任务、原生执行、等待用户、成果交付和恢复限制。下一步再挑一个专题深入：技能、长期记忆、浏览器、工作流、自动化或多伙伴协作。每次仍只学一个。
