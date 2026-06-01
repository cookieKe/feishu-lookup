import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ErrorCode } from '../types';

/**
 * 统一错误处理中间件。
 * 将所有错误格式化为 { code, message, details? } 的 JSON 响应。
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // 业务错误（ExecutorError 等自带 code 的错误）
  if (err && 'code' in err && typeof (err as Record<string, unknown>).code === 'number') {
    const e = err as unknown as { code: number; message: string; details?: unknown };
    const code = e.code;
    const status =
      code >= 5000 ? 429 :      // 限流
      code >= 4000 ? 502 :      // CLI 上游错误
      code >= 3000 ? 404 :      // 数据未找到
      code >= 2000 ? 401 :      // 认证错误
      code >= 1000 ? 400 :      // 参数错误
      500;                       // 未知错误

    res.status(status).json({
      code: e.code,
      message: e.message,
      ...(e.details ? { details: e.details } : {}),
    });
    return;
  }

  // 未预期的内部错误——不泄露内部细节
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    code: ErrorCode.INTERNAL_ERROR,
    message: '服务内部错误',
  });
}
