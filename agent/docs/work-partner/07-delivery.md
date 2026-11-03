# 第 7 部分：为什么有回复还不一定算完成？

[学习目录](README.md) · [上一部分：等待用户](06-ask-human.md) · [下一部分：保存与恢复](08-persistence.md)

## 只解决这个问题

模型说“报告已经完成”，宿主为什么还要检查成果、登记交付？

**模型的文字是一个输出，不自动证明业务目标已经达到。** 普通问答可以只交文字；用户明确要求文件或结构化结果时，还需要对应成果和检查。

## 一个具体例子

用户要求“生成一份可以下载的费用报告”。模型只回复“已生成报告”，但没有真实文件，这个要求就没有完成。

如果工作明确声明了必须提供某个文件，宿主会检查文件与结果等完成条件。这里先理解明确条件，不把“所有内容质量都能被程序自动证明”当成承诺。

## 先分清四件事

1. **候选结果**：执行器拿到了模型正文或结构化结果，先保存为可能交付的结果。
2. **成果登记**：通过 `artifact.write` 创建或 `artifact.register` 登记真实文件，让宿主知道文件位置及其身份。
3. **完成检查**：存在明确完成条件时，检查当前结果与文件是否满足要求。
4. **正式交付**：业务工作完成时，记录交付版本，再发布相应答复与成果引用。

文件登记不等于邮件已发送；真正外发成功仍需要发送工具的真实回执。

## 按这个顺序看源码

打开 [executor.ts](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/runtime/executor.ts)，只定位 `storeTaskOutput()` 和 `completionIssues()`。前者保存输出，后者收集未满足的完成要求。先不展开补全修复分支。

打开 [artifacts.ts](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/runtime/artifacts.ts)，只定位 `artifactWriteTool()` 与 `artifactRegisterTool()`，看工具描述，理解“创建新成果”和“登记已有文件”的用途。

再打开 [kernel.ts](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/runtime/kernel.ts)，看正式完成时的入口：

```1326:1327:/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/runtime/kernel.ts
      if (finalState === "completed") {
        await recordDelivery(tx, doc);
```

只有业务状态走到 `completed`，才从这个分支记录正式交付。附近的代码还会把本轮结果发布成助手消息，并关联成果文件和交付版本。

## 为什么要有交付版本

第一次费用报告交给用户后，用户可能说“请加上部门占比”。旧交付是只读快照，修订产生新交付版本，不应该悄悄把用户已收到的旧版本覆盖。

工作文件与交付快照因此不是同一种文件：前者可以继续编辑，后者代表一次已经交出的结果。

## 读懂的标准

1. 模型说“已生成”，可以代替真实文件吗？
2. `artifact.register` 成功，能证明邮件收件人已经收到吗？
3. 修订成果，为什么保留旧交付版本？

答案要点：不能；登记与渠道送达不同；旧交付是历史证据，修订应有新版本。

## 本节先不学

复杂质量验证器、独立模型审稿、自动补全策略和流程发布。先分清输出、登记、检查、交付。
