# 第 4 部分：聊天与独立工作有什么区别？

[学习目录](README.md) · [上一部分：消息入口](03-message-entry.md) · [下一部分：执行循环](05-execution-loop.md)

## 只解决这个问题

为什么收到一条消息之后，还需要创建“工作任务”？

**消息记录用户说了什么，业务任务记录一项工作做到哪一步。** 它们有联系，但不是同一个概念。

## 一个具体例子

用户说：“帮我统计这个表格，生成费用报告。”

普通对话可以询问需求、说明能力，或调用 `conversation.work` 工具来创建一项独立工作。这样，后续“暂停报告”“补充统计要求”“查看报告”都有明确的工作对象。

如果用户只问“你支持什么文件”，可以直接回答，不必因为每一句咨询都创建独立业务工作。

## 只看 start 这一条分支

打开 [conversation-inputs.ts](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/runtime/conversation-inputs.ts)，定位 `tools()` 中的 `conversation.work`，只读 `action === 'start'` 分支。

```251:253:/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/runtime/conversation-inputs.ts
            const child:CommandEnvelope={...envelope,taskId:undefined,kind:'task.create',commandId:operationId,payload:{...envelope.payload,content:part,queueManaged:false,
              selectedSkills:current.workSelectedSkills??current.selectedSkills??[]}};
            const result=await kernel.createTask(child,async(tx,taskId)=>{
```

逐行理解：

- 第 251 行：准备一个新命令，类型为 `task.create`，携带这项工作的输入。变量叫 `child`，这里先按“新工作命令”理解，不必把它直接等同于框架的子任务机制。
- 第 252 行：把当前工作的技能选择带入这个新工作。
- 第 253 行：让业务内核创建任务记录。

该分支随后返回“已排队”的结果，并通知执行器调度。工具返回的接收回执不是费用报告；原对话不应该再重复执行已经交给独立任务的工作。

## TaskDoc 保存什么

打开 [task-doc.ts](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/runtime/task-doc.ts)，只找这些字段：

- `taskId`：是哪项工作。
- `content`、`taskInputIds`：原始内容与输入来源记录。
- `state`：现在是排队、运行、等待输入，还是完成或中断。
- `runtimeConversationId`：这项工作对应哪个框架会话。
- `outputText`、`artifactIds`、`deliveryRevision`：文字结果、成果文件与交付版本。

先学四种状态：`queued` 是排队，`running` 是运行，`waiting_input` 是等用户，`completed` 是完成。其他状态留到相关章节。

`TaskDoc` 是 MindPad 的业务任务文档。`pi-durable` 内部也有用于模型生成和工具调用的 Task，两者用途不同，不能看到同一个英文词就当成同一层。

## 读懂的标准

1. “新工作已排队”能证明报告已经生成了吗？
2. 用户要求暂停时，为什么需要任务编号？
3. `TaskDoc` 的业务状态与框架内部工具调用状态是一回事吗？

答案要点：只能证明已接纳并排队；要明确控制哪项工作；业务任务和框架执行任务是不同层次。

## 本节先不学

任务依赖、多伙伴分工、自动化和工作流。下一部分只跟这一项任务怎样真正执行。
