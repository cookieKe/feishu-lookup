import express from 'express';
import cors from 'cors';
import { config } from './config';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { logger } from './utils/logger';
import healthRouter from './routes/health';
import lookupRouter from './routes/lookup';
import contactsRouter from './routes/contacts';

const app = express();

// 基础中间件
app.use(cors());
app.use(express.json());

// 健康检查路由（无需认证）
app.use('/api/v1', healthRouter);

// 查询路由（需要认证 + 限流）
app.use('/api/v1', authMiddleware, rateLimitMiddleware, lookupRouter);
app.use('/api/v1', authMiddleware, rateLimitMiddleware, contactsRouter);

// 全局错误处理
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({
      code: 9999,
      message: '服务内部错误',
    });
  }
);

// 启动服务
if (config.apiKeys.length === 0) {
  logger.warn('No API keys configured. Set API_KEYS environment variable.');
}

app.listen(config.port, () => {
  logger.info(`Feishu Lookup Service started`, { port: config.port });
  logger.info(`Health check: http://localhost:${config.port}/api/v1/health`);
});

export default app;
