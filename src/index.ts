import express from 'express';
import cors from 'cors';
import { config } from './config';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import healthRouter from './routes/health';
import execRouter from './routes/exec';

// 确保所有命令已注册（副作用导入）
import './registry';
import './registry/commands/user';
import './registry/commands/calendar';
import './registry/commands/im';
import './registry/commands/docs';
import './registry/commands/task';

const app = express();

// 基础中间件
app.use(cors());
app.use(express.json());

// 健康检查路由（无需认证）
app.use('/api/v1', healthRouter);

// 命令执行路由（需要认证 + 限流）
app.use('/api/v1', authMiddleware, rateLimitMiddleware, execRouter);

// 全局错误处理
app.use(errorHandler);

// 启动服务
if (config.apiKeys.length === 0) {
  logger.warn('No API keys configured. Set API_KEYS environment variable.');
}

app.listen(config.port, () => {
  logger.info(`Feishu CLI Proxy Service started`, { port: config.port });
  logger.info(`Health check: http://localhost:${config.port}/api/v1/health`);
  logger.info(`Exec endpoint: http://localhost:${config.port}/api/v1/exec`);
  logger.info(`Command list: http://localhost:${config.port}/api/v1/exec/commands`);
});

export default app;
