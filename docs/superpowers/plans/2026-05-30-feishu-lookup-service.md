# 飞书用户信息查询服务 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个通过电话号码查询飞书用户日程、会议、联系人等信息的 API 服务，部署于云服务器，对外提供 HTTPS API。

**Architecture:** Express.js + TypeScript API 服务，通过 `child_process.execFile` 调用飞书 CLI (`lark-cli`) 获取数据。包含 Auth 中间件（API Key 校验）、参数校验、CLI 调用层、结果聚合层。测试分三层：Vitest 单元测试 (Mock CLI)、集成测试 (Mock execFile)、E2E 测试 (真实飞书调用)。

**Tech Stack:** Node.js 18+, TypeScript 5.x, Express.js, Vitest, Docker, 飞书 CLI (`@larksuite/cli`)

---

### Task 1: 项目骨架初始化

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: 初始化 package.json**

```bash
cd C:/Users/cyneuzk/develop/feishu_cli
npm init -y
```

- [ ] **Step 2: 安装依赖**

```bash
npm install express cors dotenv
npm install -D typescript @types/node @types/express @types/cors vitest tsx
```

- [ ] **Step 3: 写入 package.json scripts 部分**

在 `package.json` 中确保包含以下 scripts：

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration"
  }
}
```

- [ ] **Step 4: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 5: 创建 vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
    },
  },
});
```

- [ ] **Step 6: 创建 .env.example**

```
PORT=3000
API_KEYS=your-api-key-here
CLI_TIMEOUT_MS=30000
RATE_LIMIT_PER_MINUTE=30
```

- [ ] **Step 7: 创建 .gitignore**

```
node_modules/
dist/
.env
*.log
```

- [ ] **Step 8: 创建目录结构**

```bash
mkdir -p src/middleware src/routes src/services src/types src/utils
mkdir -p tests/unit tests/integration tests/e2e
```

- [ ] **Step 9: 验证项目能编译**

```bash
npx tsc --noEmit
```

Expected: No errors (需要先创建至少一个 ts 文件，可先创建空的 `src/index.ts`)

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "chore: initialize project with TypeScript, Express, Vitest"
```

---

### Task 2: 类型定义

**Files:**
- Create: `src/types/index.ts`

类型定义是所有模块的基础，先定义好再写其他代码。

- [ ] **Step 1: 创建 `src/types/index.ts`**

```typescript
// ===== 请求类型 =====

export interface LookupRequest {
  phone: string;
  time_from?: string;
  time_to?: string;
}

// ===== 响应类型 =====

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

export interface UserInfo {
  name: string;
  department: string;
  title: string;
  email: string;
  mobile: string;
}

export interface CalendarEvent {
  title: string;
  start_time: string;
  end_time: string;
}

export interface CalendarData {
  summary: string;
  events?: CalendarEvent[];
}

export interface MeetingRecord {
  title: string;
  meeting_date: string;
  duration_minutes: number;
  has_recording: boolean;
}

export interface LookupData {
  user: UserInfo;
  calendar: CalendarData;
  meetings: MeetingRecord[];
}

// ===== CLI 相关类型 =====

export interface CliResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CliOptions {
  timeout?: number;
  encoding?: BufferEncoding;
}

// ===== 错误码 =====

export enum ErrorCode {
  // 400 - 参数错误
  MISSING_PHONE = 1001,
  INVALID_PHONE = 1002,
  INVALID_TIME_FORMAT = 1003,
  MISSING_TIME_TO = 1004,
  TIME_RANGE_INVALID = 1005,
  // 401 - 认证错误
  MISSING_AUTH = 2001,
  INVALID_API_KEY = 2002,
  // 404 - 数据未找到
  USER_NOT_FOUND = 3001,
  // 502/504 - 上游错误
  CLI_FAILED = 4001,
  CLI_TIMEOUT = 4002,
  // 429 - 限流
  RATE_LIMITED = 5001,
  // 500
  INTERNAL_ERROR = 9999,
}
```

---

### Task 3: 配置模块 (config.ts)

**Files:**
- Create: `src/config.ts`

- [ ] **Step 1: 创建 `src/config.ts`**

```typescript
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
```

---

### Task 4: 日志工具 (logger.ts)

**Files:**
- Create: `src/utils/logger.ts`

- [ ] **Step 1: 创建 `src/utils/logger.ts`**

```typescript
type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

function formatLog(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function log(level: LogLevel, message: string, extra?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...extra,
  };
  const output = formatLog(entry);
  if (level === 'error') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

export const logger = {
  info: (message: string, extra?: Record<string, unknown>) => log('info', message, extra),
  warn: (message: string, extra?: Record<string, unknown>) => log('warn', message, extra),
  error: (message: string, extra?: Record<string, unknown>) => log('error', message, extra),
};

/** 脱敏：只保留前4位 */
export function maskSensitive(value: string, showChars = 4): string {
  if (!value || value.length <= showChars) return '****';
  return value.slice(0, showChars) + '****';
}
```

---

### Task 5: 参数校验模块 (validate.ts) — TDD

**Files:**
- Create: `tests/unit/validate.test.ts`
- Create: `src/utils/validate.ts`

- [ ] **Step 1: 创建测试文件 `tests/unit/validate.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { validateLookupRequest, ValidationError } from '../../src/utils/validate';

describe('validateLookupRequest', () => {
  // 缺少 phone
  it('should return error when phone is missing', () => {
    const result = validateLookupRequest({ phone: '' } as any);
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1001);
  });

  it('should return error when phone is undefined', () => {
    const result = validateLookupRequest({} as any);
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1001);
  });

  // phone 格式非法
  it('should return error when phone is only letters', () => {
    const result = validateLookupRequest({ phone: 'abcdef' });
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1002);
  });

  it('should return error when phone is empty string', () => {
    const result = validateLookupRequest({ phone: '' });
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1002);
  });

  // 合法的 phone
  it('should accept phone with +86 prefix', () => {
    const result = validateLookupRequest({ phone: '+8613800000000' });
    expect(result).toEqual({ phone: '+8613800000000' });
  });

  it('should accept phone without prefix (auto-add +86)', () => {
    const result = validateLookupRequest({ phone: '13800000000' });
    expect(result).toEqual({ phone: '+8613800000000' });
  });

  it('should accept international phone with + prefix', () => {
    const result = validateLookupRequest({ phone: '+14165551234' });
    expect(result).toEqual({ phone: '+14165551234' });
  });

  // time_from / time_to 格式错误
  it('should return error when time_from format is invalid', () => {
    const result = validateLookupRequest({
      phone: '+8613800000000',
      time_from: '2026-05-01',
    });
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1003);
  });

  it('should return error when time_to format is invalid', () => {
    const result = validateLookupRequest({
      phone: '+8613800000000',
      time_to: 'not-a-date',
    });
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1003);
  });

  // 只有 time_from 没有 time_to
  it('should return error when time_from provided without time_to', () => {
    const result = validateLookupRequest({
      phone: '+8613800000000',
      time_from: '2026-05-01 09:00',
    });
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1004);
  });

  it('should return error when time_to provided without time_from', () => {
    const result = validateLookupRequest({
      phone: '+8613800000000',
      time_to: '2026-05-01 09:00',
    });
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1004);
  });

  // 时间范围无效
  it('should return error when time_to is before time_from', () => {
    const result = validateLookupRequest({
      phone: '+8613800000000',
      time_from: '2026-05-30 18:00',
      time_to: '2026-05-01 09:00',
    });
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1005);
  });

  it('should return error when time_from equals time_to', () => {
    const result = validateLookupRequest({
      phone: '+8613800000000',
      time_from: '2026-05-01 09:00',
      time_to: '2026-05-01 09:00',
    });
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1005);
  });

  // 合法请求（带时间段）
  it('should accept valid request with time range', () => {
    const result = validateLookupRequest({
      phone: '13800000000',
      time_from: '2026-05-01 09:00',
      time_to: '2026-05-30 18:00',
    });
    expect(result).toEqual({
      phone: '+8613800000000',
      time_from: '2026-05-01 09:00',
      time_to: '2026-05-30 18:00',
    });
  });
});
```

- [ ] **Step 2: 运行测试，确认全部失败**

```bash
npx vitest run tests/unit/validate.test.ts
```

Expected: All tests FAIL (module not found)

- [ ] **Step 3: 实现 `src/utils/validate.ts`**

```typescript
export class ValidationError extends Error {
  public code: number;
  public httpStatus: number;

  constructor(code: number, message: string, httpStatus = 400) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

interface ValidatedRequest {
  phone: string;
  time_from?: string;
  time_to?: string;
}

const TIME_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
// 手机号：可选 + 开头 + 数字，长度 7-15
const PHONE_REGEX = /^\+?\d{7,15}$/;

function normalizePhone(phone: string): string {
  // 如果没有 + 前缀且不是 0 开头（国际号），默认加 +86
  if (!phone.startsWith('+')) {
    if (phone.startsWith('0')) {
      // 国内固话格式如 010-xxxx，暂时不支持，保留原始
      return phone;
    }
    return '+86' + phone;
  }
  return phone;
}

export function validateLookupRequest(
  body: Record<string, unknown>
): ValidatedRequest | ValidationError {
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

  // 1001: 缺少 phone
  if (!phone) {
    return new ValidationError(1001, '缺少 phone 参数');
  }

  // 1002: phone 格式非法
  if (!PHONE_REGEX.test(phone)) {
    return new ValidationError(1002, 'phone 格式非法，应为数字，可选 + 前缀');
  }

  const time_from = typeof body.time_from === 'string' ? body.time_from.trim() : undefined;
  const time_to = typeof body.time_to === 'string' ? body.time_to.trim() : undefined;

  // 1003: 时间格式错误
  if (time_from && !TIME_FORMAT_REGEX.test(time_from)) {
    return new ValidationError(1003, 'time_from 格式错误，应为 YYYY-MM-DD HH:mm');
  }
  if (time_to && !TIME_FORMAT_REGEX.test(time_to)) {
    return new ValidationError(1003, 'time_to 格式错误，应为 YYYY-MM-DD HH:mm');
  }

  // 1004: 不成对
  if (time_from && !time_to) {
    return new ValidationError(1004, 'time_from 与 time_to 必须成对出现');
  }
  if (time_to && !time_from) {
    return new ValidationError(1004, 'time_from 与 time_to 必须成对出现');
  }

  // 1005: 时间范围无效
  if (time_from && time_to) {
    if (new Date(time_to) <= new Date(time_from)) {
      return new ValidationError(1005, 'time_to 必须晚于 time_from');
    }
  }

  return {
    phone: normalizePhone(phone),
    ...(time_from && { time_from }),
    ...(time_to && { time_to }),
  };
}
```

- [ ] **Step 4: 运行测试，确认全部通过**

```bash
npx vitest run tests/unit/validate.test.ts
```

Expected: All 17 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/utils/validate.ts tests/unit/validate.test.ts
git commit -m "feat: add types and request validation"
```

---

### Task 6: CLI 调用封装 (cli.ts)

**Files:**
- Create: `src/services/cli.ts`

- [ ] **Step 1: 创建 `src/services/cli.ts`**

```typescript
import { execFile, ExecFileException } from 'child_process';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { CliResult, CliOptions } from '../types';

/**
 * 执行飞书 CLI 命令。
 * 封装 child_process.execFile，提供超时控制和结构化输出。
 */
export function runLarkCli(
  args: string[],
  options: CliOptions = {}
): Promise<CliResult> {
  const timeout = options.timeout ?? config.cliTimeoutMs;
  const encoding = options.encoding ?? 'utf8';

  return new Promise((resolve) => {
    const child = execFile(
      config.cliPath,
      args,
      {
        encoding,
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
        windowsHide: true,
      },
      (error: ExecFileException | null, stdout: string, stderr: string) => {
        if (error) {
          if ((error as NodeJS.ErrnoException).code === 'ETIMEDOUT' || error.killed) {
            resolve({
              success: false,
              stdout: stdout || '',
              stderr: 'CLI command timed out',
              exitCode: -1,
            });
            return;
          }
          resolve({
            success: false,
            stdout: stdout || '',
            stderr: stderr || error.message,
            exitCode: error.code ?? -1,
          });
          return;
        }

        resolve({
          success: true,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: 0,
        });
      }
    );

    // 超时处理（双重保险，execFile 的 timeout 选项有时不触发 ETIMEDOUT）
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, timeout + 2000);

    child.on('close', () => {
      clearTimeout(timer);
    });
  });
}

/**
 * 执行 CLI 命令并解析 JSON 输出。
 * 返回解析后的对象或错误信息。
 */
export async function runLarkCliJson<T = unknown>(
  args: string[],
  options?: CliOptions
): Promise<{ success: true; data: T } | { success: false; error: string; exitCode: number }> {
  const result = await runLarkCli(args, options);

  if (!result.success) {
    if (result.exitCode === -1) {
      return { success: false, error: 'CLI 调用超时', exitCode: -1 };
    }
    logger.error('CLI command failed', {
      args: args.join(' '),
      stderr: result.stderr,
      exitCode: result.exitCode,
    });
    return {
      success: false,
      error: result.stderr || 'CLI 调用失败',
      exitCode: result.exitCode,
    };
  }

  if (!result.stdout) {
    return { success: true, data: [] as unknown as T };
  }

  try {
    const parsed = JSON.parse(result.stdout) as T;
    return { success: true, data: parsed };
  } catch {
    logger.error('CLI returned non-JSON output', {
      args: args.join(' '),
      stdout: result.stdout.slice(0, 500),
    });
    return {
      success: false,
      error: 'CLI 返回非 JSON 格式数据',
      exitCode: result.exitCode,
    };
  }
}
```

---

### Task 7: Auth 中间件 — TDD

**Files:**
- Create: `tests/unit/auth.test.ts`
- Create: `src/middleware/auth.ts`

- [ ] **Step 1: 创建测试文件 `tests/unit/auth.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock config before importing auth
vi.mock('../../src/config', () => ({
  config: {
    apiKeys: ['key-one', 'key-two'],
    port: 3000,
    cliTimeoutMs: 30000,
    rateLimitPerMinute: 30,
    cliPath: 'lark-cli',
  },
}));

import { authMiddleware } from '../../src/middleware/auth';

function mockReq(authHeader?: string): Request {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    ip: '127.0.0.1',
    method: 'POST',
    path: '/api/v1/lookup',
  } as unknown as Request;
}

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('authMiddleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('should return 401 when Authorization header is missing', () => {
    const req = mockReq(undefined);
    const res = mockRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 2001 })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header is empty', () => {
    const req = mockReq('');
    const res = mockRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 2001 })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header does not start with Bearer', () => {
    const req = mockReq('Basic key-one');
    const res = mockRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 2001 })
    );
  });

  it('should return 401 for an invalid API key', () => {
    const req = mockReq('Bearer wrong-key');
    const res = mockRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 2002 })
    );
  });

  it('should call next() for a valid API key (first key)', () => {
    const req = mockReq('Bearer key-one');
    const res = mockRes();
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next() for a valid API key (second key)', () => {
    const req = mockReq('Bearer key-two');
    const res = mockRes();
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should trim extra whitespace in Authorization header', () => {
    const req = mockReq('  Bearer   key-one  ');
    const res = mockRes();
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run tests/unit/auth.test.ts
```

Expected: All tests FAIL

- [ ] **Step 3: 实现 `src/middleware/auth.ts`**

```typescript
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
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run tests/unit/auth.test.ts
```

Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/middleware/auth.ts tests/unit/auth.test.ts
git commit -m "feat: add API key authentication middleware"
```

---

### Task 8: 速率限制中间件 (rateLimit.ts)

**Files:**
- Create: `src/middleware/rateLimit.ts`

- [ ] **Step 1: 创建 `src/middleware/rateLimit.ts`**

```typescript
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
```

---

### Task 9: 通讯录查询服务 (contact.ts)

**Files:**
- Create: `src/services/contact.ts`

- [ ] **Step 1: 创建 `src/services/contact.ts`**

```typescript
import { runLarkCliJson } from './cli';
import type { UserInfo } from '../types';

/**
 * 通过手机号搜索飞书用户 ID
 */
async function searchUserByMobile(phone: string): Promise<string | null> {
  const result = await runLarkCliJson<Array<{ user_id?: string; open_id?: string }>>([
    'contact', '+search-user',
    '--mobile', phone,
    '--json',
  ]);

  if (!result.success) {
    throw new Error(`搜索用户失败: ${result.error}`);
  }

  const data = result.data;
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  // 取第一个匹配的 user_id
  return data[0]?.user_id || data[0]?.open_id || null;
}

/**
 * 通过 user_id 获取用户详细信息
 */
async function getUserInfo(userId: string): Promise<UserInfo | null> {
  const result = await runLarkCliJson<{
    name?: string;
    department_name?: string;
    title?: string;
    email?: string;
    mobile?: string;
  }>([
    'contact', '+get-user',
    '--user-id', userId,
    '--json',
  ]);

  if (!result.success) {
    throw new Error(`获取用户信息失败: ${result.error}`);
  }

  const data = result.data;
  if (!data || !data.name) {
    return null;
  }

  return {
    name: data.name || '',
    department: data.department_name || '',
    title: data.title || '',
    email: data.email || '',
    mobile: data.mobile || '',
  };
}

/**
 * 通过手机号查询用户完整信息。
 * 返回用户信息，或未找到时返回 null。
 */
export async function lookupUserByPhone(phone: string): Promise<UserInfo | null> {
  const userId = await searchUserByMobile(phone);
  if (!userId) {
    return null;
  }
  return getUserInfo(userId);
}
```

---

### Task 10: 日程查询服务 (calendar.ts)

**Files:**
- Create: `src/services/calendar.ts`

- [ ] **Step 1: 创建 `src/services/calendar.ts`**

```typescript
import { runLarkCliJson } from './cli';
import type { CalendarData, CalendarEvent } from '../types';

/**
 * 查询用户日程。
 * 如果有时间范围，返回日程标题列表；否则只返回摘要。
 */
export async function lookupCalendar(
  userId: string,
  timeFrom?: string,
  timeTo?: string
): Promise<CalendarData> {
  const args: string[] = [
    'calendar', '+agenda',
    '--user-id', userId,
    '--json',
  ];

  if (timeFrom && timeTo) {
    args.push('--start', timeFrom);
    args.push('--end', timeTo);
  }

  const result = await runLarkCliJson<{
    summary?: string;
    events?: Array<{
      summary?: string;
      start_time?: string;
      end_time?: string;
    }>;
  }>(args);

  if (!result.success) {
    // 日程查询失败不应阻断整个请求
    return {
      summary: '日程查询失败',
      ...(timeFrom && timeTo ? { events: [] } : {}),
    };
  }

  const data = result.data;

  const events: CalendarEvent[] | undefined = timeFrom && timeTo
    ? (data?.events || []).map((e) => ({
        title: e.summary || '无标题',
        start_time: e.start_time || '',
        end_time: e.end_time || '',
      }))
    : undefined;

  return {
    summary: data?.summary || '暂无日程',
    ...(events !== undefined ? { events } : {}),
  };
}
```

---

### Task 11: 会议查询服务 (meeting.ts)

**Files:**
- Create: `src/services/meeting.ts`

- [ ] **Step 1: 创建 `src/services/meeting.ts`**

```typescript
import { runLarkCliJson } from './cli';
import type { MeetingRecord } from '../types';

/**
 * 查询用户会议记录。
 * 默认查询最近 30 天。
 */
export async function lookupMeetings(userId: string): Promise<MeetingRecord[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const formatDate = (d: Date) =>
    d.toISOString().slice(0, 10).replace(/-/g, '');

  const result = await runLarkCliJson<
    Array<{
      subject?: string;
      meeting_start_time?: string;
      duration?: number;
      has_recording?: boolean;
    }>
  >([
    'vc', '+search',
    '--user-id', userId,
    '--start', formatDate(thirtyDaysAgo),
    '--end', formatDate(now),
    '--json',
  ]);

  if (!result.success) {
    // 会议查询失败不阻断整个请求
    return [];
  }

  const data = result.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((m) => ({
    title: m.subject || '无标题会议',
    meeting_date: m.meeting_start_time || '',
    duration_minutes: m.duration || 0,
    has_recording: !!m.has_recording,
  }));
}
```

---

### Task 12: 结果聚合层 — TDD

**Files:**
- Create: `tests/unit/aggregator.test.ts`
- Create: `src/services/aggregator.ts`

- [ ] **Step 1: 创建测试文件 `tests/unit/aggregator.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { aggregateResult } from '../../src/services/aggregator';
import type { UserInfo, CalendarData, MeetingRecord, LookupData, ApiResponse } from '../../src/types';

describe('aggregateResult', () => {
  const mockUser: UserInfo = {
    name: '张三',
    department: '技术部',
    title: '工程师',
    email: 'zhangsan@example.com',
    mobile: '+8613800000000',
  };

  const mockCalendar: CalendarData = {
    summary: '今日 3 个日程',
    events: [{ title: '评审会', start_time: '2026-05-30 14:00', end_time: '2026-05-30 15:00' }],
  };

  const mockMeetings: MeetingRecord[] = [
    { title: '周会', meeting_date: '2026-05-29 10:00', duration_minutes: 60, has_recording: true },
  ];

  it('should aggregate all data successfully', () => {
    const result = aggregateResult(mockUser, mockCalendar, mockMeetings);
    expect(result.code).toBe(0);
    expect(result.message).toBe('ok');
    const data = result.data as LookupData;
    expect(data.user.name).toBe('张三');
    expect(data.calendar.events).toHaveLength(1);
    expect(data.meetings).toHaveLength(1);
  });

  it('should handle null user (not found)', () => {
    const result = aggregateResult(null, mockCalendar, mockMeetings);
    expect(result.code).toBe(3001);
    expect(result.message).toContain('未匹配到');
  });

  it('should handle failed calendar (null)', () => {
    const result = aggregateResult(mockUser, null, mockMeetings);
    expect(result.code).toBe(0);
    const data = result.data as LookupData;
    expect(data.calendar.summary).toContain('暂不可用');
    expect(data.calendar.events).toBeUndefined();
  });

  it('should handle failed meetings (null)', () => {
    const result = aggregateResult(mockUser, mockCalendar, null);
    expect(result.code).toBe(0);
    const data = result.data as LookupData;
    expect(data.meetings).toEqual([]);
  });

  it('should handle all services failed (all null)', () => {
    const result = aggregateResult(null, null, null);
    expect(result.code).toBe(3001);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run tests/unit/aggregator.test.ts
```

Expected: All tests FAIL

- [ ] **Step 3: 实现 `src/services/aggregator.ts`**

```typescript
import type { UserInfo, CalendarData, MeetingRecord, LookupData, ApiResponse } from '../types';

/**
 * 聚合各服务返回的数据，生成统一的 API 响应。
 *
 * 部分服务失败时不影响整体——成功部分正常返回，失败字段置默认值。
 * 只有 user 未找到时才返回 404。
 */
export function aggregateResult(
  user: UserInfo | null,
  calendar: CalendarData | null,
  meetings: MeetingRecord[] | null
): ApiResponse<LookupData> {
  // User 是必要字段，未找到返回 404
  if (!user) {
    return {
      code: 3001,
      message: '未匹配到该手机号关联的飞书用户',
    };
  }

  const data: LookupData = {
    user,
    calendar: calendar || {
      summary: '日程暂不可用',
    },
    meetings: meetings || [],
  };

  return {
    code: 0,
    message: 'ok',
    data,
  };
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run tests/unit/aggregator.test.ts
```

Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/aggregator.ts tests/unit/aggregator.test.ts
git commit -m "feat: add result aggregator with unit tests"
```

---

### Task 13: 健康检查路由 (health.ts)

**Files:**
- Create: `src/routes/health.ts`

- [ ] **Step 1: 创建 `src/routes/health.ts`**

```typescript
import { Router, type Request, type Response } from 'express';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
```

---

### Task 14: 查询路由 (lookup.ts)

**Files:**
- Create: `src/routes/lookup.ts`

- [ ] **Step 1: 创建 `src/routes/lookup.ts`**

```typescript
import { Router, type Request, type Response } from 'express';
import { validateLookupRequest, ValidationError } from '../utils/validate';
import { lookupUserByPhone } from '../services/contact';
import { lookupCalendar } from '../services/calendar';
import { lookupMeetings } from '../services/meeting';
import { aggregateResult } from '../services/aggregator';
import { logger, maskSensitive } from '../utils/logger';
import { ErrorCode } from '../types';
import type { LookupRequest } from '../types';

const router = Router();

router.post('/lookup', async (req: Request, res: Response) => {
  const startTime = Date.now();

  // 1. 参数校验
  const validated = validateLookupRequest(req.body as LookupRequest);
  if (validated instanceof ValidationError) {
    res.status(validated.httpStatus).json({
      code: validated.code,
      message: validated.message,
    });
    return;
  }

  const { phone, time_from, time_to } = validated;

  logger.info('Lookup request', {
    ip: req.ip,
    phone: maskSensitive(phone),
    hasTimeRange: !!(time_from && time_to),
  });

  try {
    // 2. 查询用户
    const user = await lookupUserByPhone(phone);

    // 3. 并行查询日程和会议
    const [calendar, meetings] = await Promise.all([
      lookupCalendar(phone, time_from, time_to),
      lookupMeetings(phone),
    ]);

    // 4. 聚合响应
    const response = aggregateResult(user, calendar, meetings);

    const duration = Date.now() - startTime;
    logger.info('Lookup completed', {
      ip: req.ip,
      phone: maskSensitive(phone),
      statusCode: response.code,
      durationMs: duration,
    });

    const httpStatus = response.code === 3001 ? 404 : response.code === 0 ? 200 : 500;
    res.status(httpStatus).json(response);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    logger.error('Lookup error', {
      ip: req.ip,
      phone: maskSensitive(phone),
      error: errMsg,
    });

    res.status(502).json({
      code: ErrorCode.CLI_FAILED,
      message: `飞书 CLI 调用失败: ${errMsg}`,
    });
  }
});

export default router;
```

---

### Task 15: 应用入口 (index.ts)

**Files:**
- Create: `src/index.ts`
- Create: `src/config.ts` (已在 Task 3 创建)

- [ ] **Step 1: 创建 `src/index.ts`**

```typescript
import express from 'express';
import cors from 'cors';
import { config } from './config';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { logger } from './utils/logger';
import healthRouter from './routes/health';
import lookupRouter from './routes/lookup';

const app = express();

// 基础中间件
app.use(cors());
app.use(express.json());

// 健康检查路由（无需认证）
app.use('/api/v1', healthRouter);

// 查询路由（需要认证 + 限流）
app.use('/api/v1', authMiddleware, rateLimitMiddleware, lookupRouter);

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
```

- [ ] **Step 2: 验证编译通过**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/index.ts src/routes/ src/services/ src/middleware/ src/config.ts src/utils/logger.ts
git commit -m "feat: complete Express API server with all routes and services"
```

---

### Task 16: 集成测试 — CLI 调用层

**Files:**
- Create: `tests/integration/cli.test.ts`

- [ ] **Step 1: 创建 `tests/integration/cli.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as child_process from 'child_process';
import { runLarkCli, runLarkCliJson } from '../../src/services/cli';

// Mock child_process.execFile
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

const mockExecFile = child_process.execFile as unknown as ReturnType<typeof vi.fn>;

describe('CLI Service (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return success with parsed stdout', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, '{"items": [{"name": "test"}]}', '');
      }
    );

    const result = await runLarkCli(['contact', '+search-user', '--mobile', '138xx', '--json']);
    expect(result.success).toBe(true);
    expect(JSON.parse(result.stdout)).toEqual({ items: [{ name: 'test' }] });
  });

  it('should return failure on non-zero exit', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        const err = new Error('Command failed') as NodeJS.ErrnoException;
        err.code = 1;
        cb(err, '', 'error output');
      }
    );

    const result = await runLarkCli(['contact', '+search-user', '--mobile', '138xx', '--json']);
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('error output');
  });

  it('should return failure on timeout', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        const err = new Error('ETIMEDOUT') as NodeJS.ErrnoException;
        err.code = 'ETIMEDOUT';
        cb(err, '', '');
      }
    );

    const result = await runLarkCli(['contact', '+search-user', '--mobile', '138xx', '--json']);
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('timed out');
  });

  it('runLarkCliJson should parse JSON correctly', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, '{"data": [1, 2, 3]}', '');
      }
    );

    const result = await runLarkCliJson<{ data: number[] }>([
      'contact', '+search-user', '--mobile', '138xx', '--json',
    ]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ data: [1, 2, 3] });
    }
  });

  it('runLarkCliJson should handle non-JSON output', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, 'this is not json!', '');
      }
    );

    const result = await runLarkCliJson([
      'contact', '+search-user', '--mobile', '138xx', '--json',
    ]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('非 JSON');
    }
  });

  it('runLarkCliJson should handle empty output', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, '', '');
      }
    );

    const result = await runLarkCliJson<string[]>([
      'contact', '+search-user', '--mobile', '138xx', '--json',
    ]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it('should pass correct arguments to execFile', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, args: string[], _opts: unknown, cb: Function) => {
        cb(null, '{}', '');
      }
    );

    await runLarkCli(['contact', '+search-user', '--mobile', '+86138xx', '--json']);

    const callArgs = mockExecFile.mock.calls[0];
    expect(callArgs[0]).toBe('lark-cli');
    expect(callArgs[1]).toEqual(['contact', '+search-user', '--mobile', '+86138xx', '--json']);
  });
});
```

- [ ] **Step 2: 运行测试**

```bash
npx vitest run tests/integration/cli.test.ts
```

Expected: All 7 tests PASS

- [ ] **Step 3: 运行全部单元测试 + 集成测试**

```bash
npx vitest run
```

Expected: All tests PASS (unit + integration = ~29 tests)

- [ ] **Step 4: Commit**

```bash
git add tests/integration/cli.test.ts
git commit -m "test: add CLI service integration tests"
```

---

### Task 17: Docker 部署文件

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 1: 创建 `Dockerfile`**

```dockerfile
FROM node:18-alpine

# 安装飞书 CLI
RUN npm install -g @larksuite/cli

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --omit=dev

# 构建
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: 创建 `docker-compose.yml`**

```yaml
version: '3.8'
services:
  feishu-lookup:
    build: .
    ports:
      - '3000:3000'
    environment:
      - PORT=3000
      - API_KEYS=${API_KEYS}
      - CLI_TIMEOUT_MS=30000
      - RATE_LIMIT_PER_MINUTE=30
    volumes:
      - feishu_cli_config:/root/.feishu-cli
    restart: unless-stopped

volumes:
  feishu_cli_config:
```

- [ ] **Step 3: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat: add Docker deployment files"
```

---

### Task 18: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: 创建 `README.md`**

```markdown
# 飞书用户信息查询服务

通过电话号码查询飞书用户日程、会议、联系人等信息的 API 服务。

## 快速开始

### 前置条件

1. 在 [飞书开放平台](https://open.feishu.cn) 创建自建应用
2. 开通以下权限：`contact:user.id:readonly`、`contact:user.base:readonly`、`calendar:calendar.readonly`、`vc:meeting.readonly`
3. 发布应用

### 安装

```bash
# 安装飞书 CLI
npm install -g @larksuite/cli

# 配置飞书 CLI
lark-cli config init

# 安装依赖并构建
npm ci
npm run build
```

### 配置

复制 `.env.example` 为 `.env` 并填写：

```
PORT=3000
API_KEYS=your-api-key-1,your-api-key-2
```

### 运行

```bash
# 开发模式
npm run dev

# 生产模式
npm run build && npm start
```

### Docker

```bash
docker compose up -d
```

## API 文档

### 认证

```
Authorization: Bearer <api_key>
```

### POST /api/v1/lookup

```json
{
  "phone": "+8613800000000",
  "time_from": "2026-05-01 09:00",
  "time_to": "2026-05-30 18:00"
}
```

### GET /api/v1/health

## 测试

```bash
npm test
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## 验证清单

全部任务完成后，执行以下验证：

```bash
# 1. 编译检查
npx tsc --noEmit

# 2. 全部测试
npx vitest run

# 3. 启动服务
npm run dev
# 另开终端:
curl http://localhost:3000/api/v1/health

# 4. 测试查询接口（需要飞书 CLI 已配置）
curl -X POST http://localhost:3000/api/v1/lookup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-here" \
  -d '{"phone": "+86你的手机号"}'
```
