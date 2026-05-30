import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// 每分钟清理一次过期条目
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 60_000).unref();

function getApiKey(req: Request): string {
  const auth = req.headers.authorization || '';
  const parts = auth.split(/\s+/);
  return parts[1] || 'anonymous';
}

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = getApiKey(req);
  const now = Date.now();
  const windowMs = 60_000; // 1 分钟窗口
  const maxRequests = config.rateLimitPerMinute;

  let entry = store.get(apiKey);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(apiKey, entry);
  }

  entry.count++;

  if (entry.count > maxRequests) {
    logger.warn('Rate limit exceeded', { apiKey: apiKey.slice(0, 4) + '****', ip: req.ip });
    res.status(429).json({
      code: 5001,
      message: `请求过于频繁，每分钟最多 ${maxRequests} 次请求`,
    });
    return;
  }

  next();
}
