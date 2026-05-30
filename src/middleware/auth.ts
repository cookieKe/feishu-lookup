import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger, maskSensitive } from '../utils/logger';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.trim()) {
    logger.warn('Request missing Authorization header', { ip: req.ip });
    res.status(401).json({
      code: 2001,
      message: '缺少 Authorization 头，请使用 Bearer <api_key>',
    });
    return;
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    logger.warn('Invalid Authorization header format', { ip: req.ip });
    res.status(401).json({
      code: 2001,
      message: 'Authorization 格式错误，请使用 Bearer <api_key>',
    });
    return;
  }

  const apiKey = parts[1];

  if (!config.apiKeys.includes(apiKey)) {
    logger.warn('Invalid API key', {
      ip: req.ip,
      keyPrefix: maskSensitive(apiKey),
    });
    res.status(401).json({
      code: 2002,
      message: 'API Key 无效',
    });
    return;
  }

  next();
}
