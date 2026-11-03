# 第 2 部分：工具怎样交给模型，再由程序执行？

[学习目录](README.md) · [上一部分：伙伴配置](01-partner-config.md) · [下一部分：消息入口](03-message-entry.md)

## 只解决这个问题

模型能选择工具，那么它看到了什么？选完之后，又是谁真正执行？

**模型主要根据工具名称、描述和参数定义选择工具。执行函数留在程序里，由框架调用。** 模型请求不会因为注册了工具，就自动附上工具的完整实现源代码。

## 先读自己的计算工具

打开 [calculator.mjs](../../src/calculator.mjs)，只看 `defineTool()`：

```6:12:agent/src/calculator.mjs
  return defineTool({
    name: 'calculate',
    description: '计算两个整数的加法或乘法。需要精确计算时调用，不要心算。',
    parameters: Type.Object({
      operation: Type.Union([Type.Literal('add'), Type.Literal('multiply')]),
      a: Type.Integer({ minimum: -1_000_000, maximum: 1_000_000 }),
      b: Type.Integer({ minimum: -1_000_000, maximum: 1_000_000 }),
```

- `name`：调用时使用的工具名。
- `description`：告诉模型什么时候适合调用。
- `parameters`：告诉模型参数名称、类型与合法值。`operation` 只能是加法或乘法，`a`、`b` 是有范围限制的整数。

继续看真正执行的几行：

```16:19:agent/src/calculator.mjs
    execute: async (args) => {
      const value = args.operation === 'add' ? args.a + args.b : args.a * args.b;
      trace(`[工具执行] calculate(${JSON.stringify(args)}) → ${value}`);
      return { output: [{ type: 'text', text: JSON.stringify({ value }) }] };
```

模型给出乘法、18、7；框架检查调用并进入 `execute()`；第 17 行才实际计算。第 19 行把结果包装成工具返回值，供后续模型调用读取。

## 为什么既要注册，又要配置 tools？

打开 [session.mjs](../../src/session.mjs)：

- 第 26～28 行：创建工具对象并安装到注册表，相当于让运行程序知道这个工具如何执行。
- 第 41 行：把同一个工具对象放入当前 Agent 的 `tools`，允许这段对话使用。

**程序注册了十个工具，可以只允许某段对话使用其中两个。** 注册不是无条件授予所有对话权限。

## MindPad 中对应哪里

打开 [wp-tools.ts](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/runtime/wp-tools.ts)，只看 `makeAskHumanTool()` 的 `name`、`description`、`parameters` 和 `execute` 四个位置。

它与计算工具的定义形式相同，只是用途变成了向用户提问。等待状态怎样处理留到第 6 部分。

再打开 [server.ts](/Users/smzdm/IdeaProjects/zhidemai/mind-pad/apps/work-partner-host/src/api/server.ts)，只定位 `nativeTools` 与 `registry.install()`。这是注册文件、成果等工具的位置。具体任务允许使用哪些工具，还由 `Kernel` 的会话配置选择。

当前计算演示的工具选择来自预设模型输出；换成真实模型后，工具选择才是模型根据请求作出的决定。框架负责按合法调用执行，不保证模型每次都选得正确。

## 读懂的标准

1. 计算 `18 × 7` 的是 `description`，还是 `execute()`？
2. 只注册工具，就代表所有伙伴都能使用吗？
3. 一个工具需要整数参数，模型给字符串时，应该直接执行吗？

答案要点：`execute()`；注册和授权分开；先按参数定义校验，非法参数不能直接执行。

## 本节先不学

动态工具发现、外部服务连接、脚本沙箱和工具重放策略。先把定义、注册、允许使用、实际执行四件事分清。
