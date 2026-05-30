import dotenv from 'dotenv';
import path from 'path';

// 加载 .env（开发环境），生产环境通过系统环境变量注入
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  apiKeys: (process.env.API_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean),
  cliTimeoutMs: parseInt(process.env.CLI_TIMEOUT_MS || '30000', 10),
  rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '30', 10),
  /**
   * 飞书 CLI 可执行文件路径。
   * 默认使用 PATH 中的 lark-cli，也可通过环境变量覆盖。
   */
  cliPath: process.env.LARK_CLI_PATH || 'lark-cli',
};
