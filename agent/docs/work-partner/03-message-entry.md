# 第 3 部分：用户消息怎样到达执行服务？

[学习目录](README.md) · [上一部分：工具](02-tools.md) · [下一部分：独立工作](04-business-task.md)

## 只解决这个问题

用户在网页输入一句话后，前端、Java 服务和 Node.js 服务分别做了什么？

这里的 Node.js 运行服务在代码中叫 Host，负责实际运行 Agent。Java 代理负责请求转发和身份处理，两者不是同一个程序。

## 跟一条普通消息

假设用户输入：“你好，你能帮我做什么？”本节只跟踪消息送达，不讨论模型怎样回答。

### 第一步：前端发送 HTTP 请求

打开 [workpartner.js](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/frontend/src/api/workpartner.js)，只看 `sendMessage()`：

```98:102:/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/frontend/src/api/workpartner.js
export function sendMessage(employeeId, msg) {
  return request({
    url: `${WP}/employees/${employeeId}/messages`,
    method: "post",
    data: msg,
```

`employeeId` 标识要找哪个伙伴，`msg` 是消息内容和类型。这里的 `WP` 为 `/api/work-partners`。前端没有在这几行里直接调用模型，也没有执行业务工具。

### 第二步：Java 代理组装命令

打开 [WorkPartnerProxyController.java](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/agent/src/main/java/com/smzdm/mindpad/workpartner/WorkPartnerProxyController.java)，只看 `sendMessage()` 中 `new_task` 分支。

代理从已认证的请求上下文取得用户身份，准备消息载荷，再转发给 Host：

```226:229:/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/agent/src/main/java/com/smzdm/mindpad/workpartner/WorkPartnerProxyController.java
          WorkPartnerHostClient.CommandOutcome r =
              hostClient.sendCommand(
                  commandId, "conversation.input", employeeId, sessionId, null, null, payload);
          return translate(r, commandId);
```

这里最重要的是 `conversation.input`：它表示一条普通对话输入。前端把类型叫 `new_task`，不代表这里马上创建一个独立业务工作。“你好”也经过这个入口。

### 第三步：Host 保存输入并排队

打开 [conversation-inputs.ts](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/runtime/conversation-inputs.ts)，只看 `ConversationInputs.accept()`：

- 检查消息内容和命令标识。
- 处理重复提交或标识冲突。
- 创建对话输入的排队记录，并保存来源。
- 通知执行器检查这个会话有没有可以运行的输入。

这里只接收与安排输入，没有先另外调用一个“意图分类模型”。之后怎样理解用户请求，由进入原生对话后的模型与工具过程处理。

## 读懂的标准

1. 前端的 `sendMessage()` 就是模型请求吗？
2. Java 代理和 Node.js Host 各负责什么？
3. 前端的 `new_task` 在普通消息路径上转成什么命令？

答案要点：它是发给业务服务的 HTTP 请求；代理处理身份和转发，Host 组织 Agent 执行；转成 `conversation.input`。

## 本节先不学

附件上传、群聊、事件流重连、输入合并和复杂队列策略。下一部分才讲“对话输入怎样创建独立工作”。
