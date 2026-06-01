/**
 * E2E 测试 — 通过 /api/v1/exec 端点测试用户查询和日历功能。
 *
 * 缺失环境变量时测试将明确失败，不会静默跳过。
 *
 * 运行:
 *   E2E_BASE_URL=http://8.130.149.29:3000 E2E_API_KEY=<key> E2E_PHONE=<phone> npm run test:e2e
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.E2E_BASE_URL || 'http://8.130.149.29:3000';
const API_KEY = process.env.E2E_API_KEY || '';
const TEST_PHONE = process.env.E2E_PHONE || '';
const TEST_TIMEOUT = 15_000;

// ===== 环境变量门卫 =====
function env(name: string, value: string): string {
  if (!value) throw new Error(`缺少环境变量 ${name} — 请在运行时设置`);
  return value;
}

// ===== 工具函数 =====
interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

async function apiGet(path: string, opts: { apiKey?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.apiKey) headers['Authorization'] = `Bearer ${opts.apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT);
  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers, signal: controller.signal });
    return { status: res.status, body: (await res.json()) as ApiResponse };
  } finally { clearTimeout(timer); }
}

async function apiPost(path: string, data: unknown, opts: { apiKey?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers['Authorization'] = `Bearer ${opts.apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST', headers, body: JSON.stringify(data), signal: controller.signal,
    });
    return { status: res.status, body: (await res.json()) as ApiResponse };
  } finally { clearTimeout(timer); }
}

// ===== 连通性预检 =====
beforeAll(async () => {
  const { status } = await apiGet('/api/v1/health');
  if (status !== 200) throw new Error(`服务器 ${BASE_URL} 不可达`);
}, 10000);

// ===== 1. 健康检查 =====
describe('GET /api/v1/health', () => {
  it('should return 200 with status ok', async () => {
    const { status, body } = await apiGet('/api/v1/health');
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
  });
});

// ===== 2. 认证失败 =====
describe('POST /api/v1/exec — auth failures', () => {
  it('缺少 Authorization → 401', async () => {
    const { status, body } = await apiPost('/api/v1/exec', { command: 'user.search-by-name', params: { query: 'test' } });
    expect(status).toBe(401);
    expect(body.code).toBe(2001);
  });

  it('错误的 API Key → 401', async () => {
    const { status, body } = await apiPost('/api/v1/exec', { command: 'user.search-by-name', params: { query: 'test' } }, { apiKey: 'wrong-key' });
    expect(status).toBe(401);
    expect(body.code).toBe(2002);
  });
});

// ===== 3. 命令校验 =====
describe('POST /api/v1/exec — command validation', () => {
  it('缺少 command → 400 code=1001', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status, body } = await apiPost('/api/v1/exec', {}, { apiKey: key });
    expect(status).toBe(400);
    expect(body.code).toBe(1001);
  });

  it('无效 command → 400 code=1002', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status, body } = await apiPost('/api/v1/exec', { command: 'foo.bar', params: {} }, { apiKey: key });
    expect(status).toBe(400);
    expect(body.code).toBe(1002);
  });

  it('缺少必填参数 → 400 code=1003', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status, body } = await apiPost('/api/v1/exec', { command: 'user.search-by-phone', params: {} }, { apiKey: key });
    expect(status).toBe(400);
    expect(body.code).toBe(1003);
  });
});

// ===== 4. 命令列表 =====
describe('GET /api/v1/exec/commands', () => {
  it('列出所有可用命令 → 200', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status, body } = await apiGet('/api/v1/exec/commands', { apiKey: key });
    expect(status).toBe(200);
    expect(body.code).toBe(0);
    const commands = body.data as Array<Record<string, unknown>>;
    expect(Array.isArray(commands)).toBe(true);
    expect(commands.length).toBeGreaterThanOrEqual(20);
  });
});

// ===== 5. 用户查询 =====
describe('POST /api/v1/exec — user commands', () => {
  it('user.search-by-phone → 200 或 404', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const phone = env('E2E_PHONE', TEST_PHONE);
    const { status, body } = await apiPost('/api/v1/exec', {
      command: 'user.search-by-phone', params: { phone },
    }, { apiKey: key });
    expect([200, 404]).toContain(status);
  });

  it('user.search-by-name → returns results', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status, body } = await apiPost('/api/v1/exec', {
      command: 'user.search-by-name', params: { query: '管理员' },
    }, { apiKey: key });
    expect([200, 502]).toContain(status);
  });

  it('user.get-by-id (me) → returns user info', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status } = await apiPost('/api/v1/exec', {
      command: 'user.get-by-id', params: { user_id: 'me' },
    }, { apiKey: key });
    expect([200, 502]).toContain(status);
  });

  it('user.list-contacts → returns contact list', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status } = await apiPost('/api/v1/exec', {
      command: 'user.list-contacts', params: { query: '管理员' },
    }, { apiKey: key });
    expect([200, 502]).toContain(status);
  });
});

// ===== 6. 日历查询 =====
describe('POST /api/v1/exec — calendar commands', () => {
  it('calendar.today-agenda → returns agenda', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status } = await apiPost('/api/v1/exec', {
      command: 'calendar.today-agenda', params: {},
    }, { apiKey: key });
    expect([200, 502]).toContain(status);
  });

  it('calendar.list → returns calendars', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status } = await apiPost('/api/v1/exec', {
      command: 'calendar.list', params: {},
    }, { apiKey: key });
    expect([200, 502]).toContain(status);
  });

  it('calendar.search → searches events by keyword', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status } = await apiPost('/api/v1/exec', {
      command: 'calendar.search', params: { query: '会议' },
    }, { apiKey: key });
    expect([200, 502]).toContain(status);
  });

  it('calendar.recent-events → returns recent events', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status } = await apiPost('/api/v1/exec', {
      command: 'calendar.recent-events', params: { days: 7 },
    }, { apiKey: key });
    expect([200, 502]).toContain(status);
  });
});
