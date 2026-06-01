import type { CommandDef } from '../types';
import { runLarkCliJson } from './cli';
import { resolveTemplates, hasAllTemplateValues } from '../utils/transforms';
import { extractValue } from '../utils/jsonpath';
import { ErrorCode } from '../types';

/**
 * 执行器抛出的错误，包含业务错误码和可选详情。
 */
export class ExecutorError extends Error {
  public code: number;
  public details?: unknown;

  constructor(code: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ExecutorError';
    this.code = code;
    this.details = details;
  }
}

/**
 * 执行管线上下文。
 * 在步骤间传递提取的变量和步骤输出。
 */
interface StepContext {
  variables: Record<string, unknown>;
}

/**
 * 通用管线执行器。
 *
 * 按顺序执行 CommandDef 中定义的每个步骤：
 * 1. 解析 args 中的 {{placeholder}} 模板
 * 2. 调用 lark-cli 执行命令
 * 3. 从 JSON 输出中提取变量供后续步骤使用
 * 4. 返回指定步骤的输出
 *
 * @param def    命令定义
 * @param params 请求中已清洗的参数
 * @returns 命令最终输出（原始 CLI JSON）
 * @throws ExecutorError 如果必填步骤失败
 */
export async function executePipeline(
  def: CommandDef,
  params: Record<string, unknown>,
): Promise<unknown> {
  const ctx: StepContext = { variables: {} };
  const stepOutputs: (unknown | null)[] = [];

  for (let i = 0; i < def.steps.length; i++) {
    const step = def.steps[i];

    // 1. 检查可选步骤的依赖变量是否满足——如果不满足则跳过
    if (step.optional) {
      const hasAll = step.args.every((arg) =>
        hasAllTemplateValues(arg, params, ctx.variables),
      );
      if (!hasAll) {
        stepOutputs[i] = null;
        // 将 extract 变量设为 null
        if (step.extract) {
          for (const varName of Object.keys(step.extract)) {
            ctx.variables[`$${i}.${varName}`] = null;
          }
        }
        continue;
      }
    }

    // 2. 解析模板
    let resolvedArgs: string[];
    try {
      resolvedArgs = resolveTemplates(step.args, params, ctx.variables);
    } catch (err) {
      throw new ExecutorError(
        ErrorCode.MISSING_PARAM,
        `步骤 ${i} 模板解析失败: ${err instanceof Error ? err.message : '未知错误'}`,
        { step: i, command: step.command.join(' ') },
      );
    }

    // 3. 执行 CLI 命令
    const fullCommand = [...step.command, ...resolvedArgs];
    const result = await runLarkCliJson(fullCommand, { timeout: undefined });

    if (!result.success) {
      if (step.optional) {
        // 可选步骤失败：输出为 null，管线继续
        stepOutputs[i] = null;
        if (step.extract) {
          for (const varName of Object.keys(step.extract)) {
            ctx.variables[`$${i}.${varName}`] = null;
          }
        }
        continue;
      }

      // 必填步骤失败：抛出异常
      if (result.exitCode === -1) {
        throw new ExecutorError(
          ErrorCode.CLI_TIMEOUT,
          `CLI 命令超时: ${step.command.join(' ')}`,
          { step: i, command: fullCommand.join(' ') },
        );
      }
      throw new ExecutorError(
        ErrorCode.CLI_FAILED,
        `CLI 命令失败: ${result.error}`,
        { step: i, command: fullCommand.join(' '), stderr: result.error },
      );
    }

    stepOutputs[i] = result.data;

    // 4. 提取变量
    if (step.extract && result.data !== undefined) {
      for (const [varName, jsonPath] of Object.entries(step.extract)) {
        const value = extractValue(result.data, jsonPath);
        if (value === undefined) {
          // 宽容提取：提取失败不抛异常，设为 null 继续（用于跨租户联系人等）
          if (step.optional || step.lenientExtract) {
            ctx.variables[`$${i}.${varName}`] = null;
            continue;
          }
          // 必填步骤提取失败 → 数据未找到（如用户不存在）
          if (def.steps.length > 1 && i < def.steps.length - 1) {
            throw new ExecutorError(
              ErrorCode.NOT_FOUND,
              `未找到匹配数据: ${jsonPath}`,
              { step: i, path: jsonPath },
            );
          }
        }
        ctx.variables[`$${i}.${varName}`] = value;
      }
    }
  }

  // 5. 返回指定步骤的输出
  const outputStep = def.outputStep ?? def.steps.length - 1;
  return stepOutputs[outputStep];
}
