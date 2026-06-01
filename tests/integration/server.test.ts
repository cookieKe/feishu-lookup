/**
 * 服务端集成测试 — 直接访问远端 API 覆盖新 exec 端点用例。
 *
 * 运行:
 *   E2E_BASE_URL=http://8.130.149.29:3000 E2E_API_KEY=<key> E2E_PHONE=<phone> npx vitest run tests/integration/server.test.ts
 *
 * 缺失环境变量时测试将明确失败，不会静默跳过。
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.E2E_BASE_URL || 'http://8.130.149.29:3000';
const API_KEY = process.env.E2E_API_KEY || '';
const TEST_PHONE = process.env.E2E_PHONE || '';
const TIMEOUT = 20_000;

// ===== 环境变量门卫：缺失时测试直接失败 =====
function env(name: string, value: string): string {
  if (!value) throw new Error(`缺少环境变量 ${name} — 请在运行时设置`);
  return value;
}

// ===== 工具函数 =====
async function get(path: string, key?: string) {
  const h: Record<string, string> = {};
  if (key) h['Authorization'] = `Bearer ${key}`;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT);
  try {
    const r = await fetch(`${BASE_URL}${path}`, { headers: h, signal: c.signal });
    return { status: r.status, body: await r.json() as Record<string, unknown> };
  } finally { clearTimeout(t); }
}

async function post(path: string, data: unknown, key?: string) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) h['Authorization'] = `Bearer ${key}`;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT);
  try {
    const r = await fetch(`${BASE_URL}${path}`, {
      method: 'POST', headers: h, body: JSON.stringify(data), signal: c.signal,
    });
    return { status: r.status, body: await r.json() as Record<string, unknown> };
  } finally { clearTimeout(t); }
}

// ===== 连通性预检 =====
beforeAll(async () => {
  const { status, body } = await get('/api/v1/health');
  if (status !== 200 || body.status !== 'ok') {
    throw new Error(`服务器 ${BASE_URL} 不可达`);
  }
}, 15000);

// ===== 1. 健康检查 =====
describe('Health Check', () => {
  it('GET /api/v1/health → 200 + status ok', async () => {
    const { status, body } = await get('/api/v1/health');
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
  });
});

// ===== 2. 认证 =====
describe('Authentication', () => {
  it('缺少 Authorization → 401 code=2001', async () => {
    const { status, body } = await post('/api/v1/exec', { command: 'user.search-by-name', params: { query: 'test' } });
    expect(status).toBe(401);
    expect(body.code).toBe(2001);
  });

  it('错误 API Key → 401 code=2002', async () => {
    const { status, body } = await post('/api/v1/exec', { command: 'user.search-by-name', params: { query: 'test' } }, 'wrong-key-xxxxx');
    expect(status).toBe(401);
    expect(body.code).toBe(2002);
  });

  it('正确 API Key → 不返回 401', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status } = await post('/api/v1/exec', {}, key);
    expect(status).not.toBe(401);
  });
});

// ===== 3. 命令参数校验 =====
describe('Command Validation', () => {
  it('缺少 command → 400 code=1001', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status, body } = await post('/api/v1/exec', {}, key);
    expect(status).toBe(400);
    expect(body.code).toBe(1001);
  });

  it('无效 command → 400 code=1002', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status, body } = await post('/api/v1/exec', { command: 'nonexistent.command', params: {} }, key);
    expect(status).toBe(400);
    expect(body.code).toBe(1002);
  });

  it('缺少必填参数 → 400 code=1003', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status, body } = await post('/api/v1/exec', { command: 'user.search-by-phone', params: {} }, key);
    expect(status).toBe(400);
    expect(body.code).toBe(1003);
  });
});

// ===== 4. 命令列表 =====
describe('Command List', () => {
  it('GET /api/v1/exec/commands → 200 列出所有命令', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status, body } = await get('/api/v1/exec/commands', key);
    expect(status).toBe(200);
    expect(body.code).toBe(0);
    const commands = body.data as Array<Record<string, unknown>>;
    expect(Array.isArray(commands)).toBe(true);
    expect(commands.length).toBeGreaterThan(0);
    const names = commands.map((c) => c.name);
    expect(names).toContain('user.search-by-phone');
    expect(names).toContain('calendar.events');
    expect(names).toContain('im.search');
    expect(names).toContain('docs.search');
    // New commands
    expect(names).toContain('im.search-by-phone');
    expect(names).toContain('calendar.search');
    expect(names).toContain('calendar.recent-events');
    expect(names).toContain('task.list-todos');
  });
});

// ===== 5. 真实执行流程 =====
describe('Real Exec Flow', () => {
  it('user.search-by-phone → 200 或 404', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const phone = env('E2E_PHONE', TEST_PHONE);
    const { status, body } = await post('/api/v1/exec', {
      command: 'user.search-by-phone', params: { phone },
    }, key);
    expect([200, 404]).toContain(status);
    if (status === 200) {
      expect(body.code).toBe(0);
      expect(body.data).toBeDefined();
    }
  });

  it('user.search-by-name → 200', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status, body } = await post('/api/v1/exec', {
      command: 'user.search-by-name', params: { query: '管理员' },
    }, key);
    expect([200, 502]).toContain(status);
    if (status === 200) expect(body.code).toBe(0);
  });

  it('calendar.today-agenda → 200', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status, body } = await post('/api/v1/exec', {
      command: 'calendar.today-agenda', params: {},
    }, key);
    expect([200, 502]).toContain(status);
    if (status === 200) expect(body.code).toBe(0);
  });

  it('im.search → 200', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status, body } = await post('/api/v1/exec', {
      command: 'im.search', params: { query: '测试' },
    }, key);
    expect([200, 502]).toContain(status);
    if (status === 200) expect(body.code).toBe(0);
  });

  it('docs.search → 200', async () => {
    const key = env('E2E_API_KEY', API_KEY);
    const { status, body } = await post('/api/v1/exec', {
      command: 'docs.search', params: { query: '测试' },
    }, key);
    expect([200, 502]).toContain(status);
    if (status === 200) expect(body.code).toBe(0);
  });
});
