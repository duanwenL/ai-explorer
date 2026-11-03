# 第 1 部分：一个伙伴到底是什么？

[学习目录](README.md) · [下一部分：工具](02-tools.md)

## 只解决这个问题

工作伙伴怎样通过配置，决定“用哪个模型、按什么要求回答、能做哪些事”？

先记住：**同一个模型，配置不同的要求和工具，就可以承担不同的伙伴角色。** 创建一个伙伴，并不等于训练一个新模型。

## 从你自己的代码开始

先打开 [src/session.mjs](../../src/session.mjs)，只看 `agent` 对象：

```38:42:agent/src/session.mjs
    const agent = {
      model: { provider: provider.id, modelId },
      instructions: '你是帮助学习 Agent 的简洁助手。需要加法或乘法时使用 calculate 工具，根据真实结果回答。工具只支持两个绝对值不超过一百万的整数。',
      tools: [calculator], // pi-durable 接收工具注册对象，再按 name 持久化。
    };
```

逐行理解：

- 第 38 行：准备一份 Agent 配置；这时还没有提交用户问题。
- 第 39 行：指定模型来源和模型编号，决定请求发给谁。
- 第 40 行：给模型固定要求，告诉它这段对话应该怎样回答。
- 第 41 行：选择这段对话可以使用的工具。这里放的是工具注册对象。
- 第 42 行：配置对象结束。

如果用户问“18 × 7”，用户的问题是另一份输入，后面才通过 `submit()` 提交。`instructions` 不是本次问题本身。

## MindPad 怎么扩展它

打开 [capabilities.ts](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/runtime/capabilities.ts)，先只看这几项：

```20:25:/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/runtime/capabilities.ts
export type CapabilitySnapshot = {
  ownerUserId?: string;
  revision: number;
  employee?: { name: string; avatarRef: string };
  model: { provider: string; modelId: string };
  instructions: string;
```

这里的 `employee` 是代码对伙伴身份的命名，不表示它是一个人。`CapabilitySnapshot` 是“能力快照”：记录这次工作采用的配置。第 22 行的 `revision` 是配置版本。

接着只在本文件定位 `capabilityResolver()`：它请求中心服务的 `employee_config`，整理模型、要求和技能等配置。工具选择会在后面的会话配置环节完成，不是这里列出技能就自动开放所有工具。

再打开 [instructions.ts](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/runtime/instructions.ts)，只定位 `partnerInstructions()`。它把平台规则与伙伴自己的固定要求组合起来。先不逐条背平台规则，也不用学习 `review`、`workflow_authoring` 等分支。

## 一个具体例子

假设“费用助手”和“代码助手”使用同一个模型：费用助手配置费用分析要求与表格相关能力，代码助手配置代码检查要求与代码相关能力。差别主要在配置和可用能力，而不是名字让模型自动学会了新东西。

## 读懂的标准

用自己的话回答：

1. 换 `model`、改 `instructions`、加 `tools`，各自改变什么？
2. `agent` 配置和用户提交的“18 × 7”，是同一份东西吗？
3. 把伙伴名字改成“费用专家”，会自动获得读取表格的能力吗？

答案要点：分别改变模型、固定要求和可用工具；配置与用户问题分开；名字不会代替工具或技能配置。

## 本节先不学

模型网关认证、群组权限、技能版本安装、长期记忆和任务恢复。本节能说清那三项配置，就可以进入第 2 部分。
