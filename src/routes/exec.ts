import { Router, type Request, type Response } from 'express';
import { getCommand, listCommands } from '../registry';
import { executePipeline } from '../services/executor';
import { logger } from '../utils/logger';
import { ErrorCode } from '../types';

const router = Router();

/**
 * POST /api/v1/exec
 * 通用命令执行端点。客户端发送 { command, params }，服务端查注册表后转换为 CLI 命令执行。
 */
router.post('/exec', async (req: Request, res: Response) => {
  const { command, params } = (req.body ?? {}) as Record<string, unknown>;

  // 1. 校验 command 字段
  if (typeof command !== 'string' || !command.trim()) {
    res.status(400).json({
      code: ErrorCode.MISSING_COMMAND,
      message: '缺少 "command" 字段',
    });
    return;
  }

  // 2. 查注册表
  const commandDef = getCommand(command);
  if (!commandDef) {
    res.status(400).json({
      code: ErrorCode.INVALID_COMMAND,
      message: `未知命令: "${command}"。使用 GET /api/v1/exec/commands 查看可用命令列表`,
    });
    return;
  }

  // 3. 清洗参数
  const cleanParams: Record<string, unknown> =
    params && typeof params === 'object' && !Array.isArray(params)
      ? { ...(params as Record<string, unknown>) }
      : {};

  // 4. 校验必填参数 + 填充默认值
  for (const [key, def] of Object.entries(commandDef.params)) {
    const val = cleanParams[key];

    if (def.required && (val === undefined || val === null || val === '')) {
      res.status(400).json({
        code: ErrorCode.MISSING_PARAM,
        message: `缺少必填参数: "${key}"`,
      });
      return;
    }

    if ((val === undefined || val === null) && def.default !== undefined) {
      cleanParams[key] = def.default;
    }
  }

  logger.info('Exec command', {
    ip: req.ip,
    command,
    params: Object.keys(cleanParams),
  });

  // 5. 执行
  const startTime = Date.now();

  try {
    const result = await executePipeline(commandDef, cleanParams);

    const duration = Date.now() - startTime;
    logger.info('Exec completed', { command, durationMs: duration });

    res.json({ code: 0, message: 'ok', data: result });
  } catch (err: unknown) {
    const duration = Date.now() - startTime;
    logger.error('Exec failed', {
      command,
      error: err instanceof Error ? err.message : '未知错误',
      durationMs: duration,
    });

    // 如果是 ExecutorError（自带 code），交给 errorHandler 处理
    if (err && typeof (err as Record<string, unknown>).code === 'number') {
      const e = err as unknown as { code: number; message: string; details?: unknown };
      const status =
        e.code >= 5000 ? 429 :
        e.code >= 4000 ? 502 :
        e.code >= 3000 ? 404 :
        e.code >= 2000 ? 401 :
        500;

      res.status(status).json({
        code: e.code,
        message: e.message,
        ...(e.details ? { details: e.details } : {}),
      });
      return;
    }

    res.status(502).json({
      code: ErrorCode.CLI_FAILED,
      message: `命令执行失败: ${err instanceof Error ? err.message : '未知错误'}`,
    });
  }
});

/**
 * GET /api/v1/exec/commands
 * 列出所有可用命令及其参数。
 */
router.get('/exec/commands', (_req: Request, res: Response) => {
  const commands = listCommands();
  res.json({ code: 0, message: 'ok', data: commands });
});

export default router;
