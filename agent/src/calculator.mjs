import { Type } from '@earendil-works/pi-ai';
import { defineTool } from '@earendil-works/pi-durable';

/** 只有一个纯计算工具。没有 eval、文件写入、联网或命令执行。 */
export function createCalculator(trace = () => {}) {
  return defineTool({
    name: 'calculate',
    description: '计算两个整数的加法或乘法。需要精确计算时调用，不要心算。',
    parameters: Type.Object({
      operation: Type.Union([Type.Literal('add'), Type.Literal('multiply')]),
      a: Type.Integer({ minimum: -1_000_000, maximum: 1_000_000 }),
      b: Type.Integer({ minimum: -1_000_000, maximum: 1_000_000 }),
    }, { additionalProperties: false }),
    // 纯计算可安全重跑。外部付款/发消息不能照抄这个声明。
    replay: 'safe',
    execute: async (args) => {
      const value = args.operation === 'add' ? args.a + args.b : args.a * args.b;
      trace(`[工具执行] calculate(${JSON.stringify(args)}) → ${value}`);
      return { output: [{ type: 'text', text: JSON.stringify({ value }) }] };
    },
  });
}
