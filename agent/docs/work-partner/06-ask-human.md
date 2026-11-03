# 第 6 部分：缺资料时，怎样问用户再继续？

[学习目录](README.md) · [上一部分：执行循环](05-execution-loop.md) · [下一部分：交付](07-delivery.md)

## 只解决这个问题

工作做到一半发现缺少重要资料，怎样停下来问用户，并在回答后继续？

**模型提出问题，工具结束当前原生执行，宿主保存问题和业务等待状态。** 结束一次原生执行，不等于业务工作已经完成。

## 一个具体例子

假设用户要求统计费用，但没有说明采用哪个月份，而且表格有多个期间，程序也无法可靠判断。

模型可以调用 `ask_human`，问“统计哪个月份？”。用户回答后，原工作采用这个补充条件继续。它不是重新创建一项完全无关的费用统计。

## 看 ask_human 的执行结果

打开 [wp-tools.ts](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/runtime/wp-tools.ts)，先看工具名称、描述和问题参数，然后只看执行部分：

```37:44:/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/runtime/wp-tools.ts
    replay: "unsafe",
    async execute(args: Record<string, unknown>) {
      const { question } = humanQuestion(args);
      return {
        output: [{ type: "text", text: `已提问：${question}` }],
        control: { terminate: true },
      };
    },
```

- 第 37 行：重放策略声明；先知道它不能照计算工具那样直接声明为可安全重跑，细节留到第 8 部分。
- 第 39 行：从结构化参数中提取问题。
- 第 41 行：返回工具结果，说明提出了什么问题。
- 第 42 行：通知框架终止当前运行。

这几行没有独自完成全部业务等待处理，也不是靠“已提问”三个字触发状态变化。

## 宿主接着做什么

打开 [executor.ts](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/runtime/executor.ts)，定位 `questions`、`suspendForInput()` 和返回 `waiting_input` 的分支：

1. 从真实的结构化工具调用及其结果里识别问题，不靠匹配普通文字。
2. 通过 `suspendForInput()` 保存问题，关联任务和输入编号。
3. 返回 `waiting_input`，表示业务工作等待用户。

随后内核保存业务状态并释放相应执行占用。它不是让浏览器的一次 HTTP 请求一直阻塞到用户回答。

回答路径可以在 [WorkPartnerProxyController.java](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/agent/src/main/java/com/smzdm/mindpad/workpartner/WorkPartnerProxyController.java) 的 `answer` 分支找到：回答携带 `taskId`、`inputId`，被转为 `task.answer`。内核记录回答并重新安排原工作执行。

## 读懂的标准

1. 模型普通文字说“请提供月份”，一定会变成持久提问卡吗？
2. `terminate: true` 是否等于费用报告完成？
3. 用户回答时，为什么要关联原任务和问题编号？

答案要点：普通文字不等于结构化 `ask_human` 调用；结束当前运行不等于业务完成；要把回答交给正确的原工作与问题。

## 本节先不学

多题表单、跳过问题、私密凭据卡和审批选择。先把“提出问题、保存等待、收到回答、继续原工作”四件事分清。
