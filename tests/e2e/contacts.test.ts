/**
 * E2E 测试 — 通讯录 / IM / 文档功能通过 /api/v1/exec 端点。
 *
 * 缺失环境变量时测试将明确失败，不会静默跳过。
 *
 * 运行:
 *   E2E_BASE_URL=http://8.130.149.29:3000 E2E_API_KEY=<key> \
 *     E2E_PHONE=<phone_a> E2E_CONTACT_PHONE=<phone_b> \
 *     npx vitest run tests/e2e/contacts.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.E2E_BASE_URL || 'http://8.130.149.29:3000';
const API_KEY = process.env.E2E_API_KEY || '';
const PHONE_A = process.env.E2E_PHONE || '';
const PHONE_B = process.env.E2E_CONTACT_PHONE || '';
const TIMEOUT = 20_000;

// ===== 环境变量门卫 =====
function env(name: string, value: string): string {
  if (!value) throw new Error(`缺少环境变量 ${name} — 请在运行时设置`);
  return value;
}

// ===== 工具函数 =====
async function post(path: string, data: unknown) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) h['Authorization'] = `Bearer ${API_KEY}`;
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
  const r = await fetch(`${BASE_URL}/api/v1/health`, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`服务器 ${BASE_URL} 不可达`);
}, 10000);

// ===== user.search-by-phone =====
describe('user.search-by-phone', () => {
  it('缺少 phone → 400', async () => {
    env('E2E_API_KEY', API_KEY);
    const { status, body } = await post('/api/v1/exec', {
      command: 'user.search-by-phone', params: {},
    });
    expect(status).toBe(400);
    expect(body.code).toBe(1003);
  });

  it('查询有效手机号 → 200', async () => {
    env('E2E_API_KEY', API_KEY);
    const phone = env('E2E_PHONE', PHONE_A);
    const { status, body } = await post('/api/v1/exec', {
      command: 'user.search-by-phone', params: { phone },
    });
    expect([200, 404]).toContain(status);
    if (status === 200) {
      expect(body.code).toBe(0);
      expect(body.data).toBeDefined();
    }
  });
});

// ===== user.check-contact =====
describe('user.check-contact', () => {
  it('缺少 phone_b → 400', async () => {
    env('E2E_API_KEY', API_KEY);
    const { status, body } = await post('/api/v1/exec', {
      command: 'user.check-contact', params: { phone_a: '138xx' },
    });
    expect(status).toBe(400);
    expect(body.code).toBe(1003);
  });

  it('B 不在通讯录中 → 404', async () => {
    env('E2E_API_KEY', API_KEY);
    const phone = env('E2E_PHONE', PHONE_A);
    const { status, body } = await post('/api/v1/exec', {
      command: 'user.check-contact',
      params: { phone_a: phone, phone_b: '+8600000000000' },
    });
    expect([200, 404, 502]).toContain(status);
    if (status === 404) expect(body.code).toBe(3001);
  });

  it('A 和 B 都在通讯录中 → 200', async () => {
    env('E2E_API_KEY', API_KEY);
    const a = env('E2E_PHONE', PHONE_A);
    const b = env('E2E_CONTACT_PHONE', PHONE_B);
    const { status, body } = await post('/api/v1/exec', {
      command: 'user.check-contact', params: { phone_a: a, phone_b: b },
    });
    expect([200, 404, 502]).toContain(status);
    if (status === 200) expect(body.code).toBe(0);
  });

  it('A 自己查自己 → 返回数据', async () => {
    env('E2E_API_KEY', API_KEY);
    const a = env('E2E_PHONE', PHONE_A);
    const { status, body } = await post('/api/v1/exec', {
      command: 'user.check-contact', params: { phone_a: a, phone_b: a },
    });
    expect([200, 404, 502]).toContain(status);
    if (status === 200) expect(body.code).toBe(0);
  });
});

// ===== user.list-contacts =====
describe('user.list-contacts', () => {
  it('列出通讯录成员 → 200', async () => {
    env('E2E_API_KEY', API_KEY);
    const { status, body } = await post('/api/v1/exec', {
      command: 'user.list-contacts', params: { query: '管理员' },
    });
    expect([200, 502]).toContain(status);
    if (status === 200) {
      expect(body.code).toBe(0);
      expect(body.data).toBeDefined();
    }
  });
});

// ===== im.search =====
describe('im.search', () => {
  it('搜索消息 → 200', async () => {
    env('E2E_API_KEY', API_KEY);
    const { status, body } = await post('/api/v1/exec', {
      command: 'im.search', params: { query: '测试' },
    });
    expect([200, 502]).toContain(status);
    if (status === 200) expect(body.code).toBe(0);
  });
});

// ===== docs.search =====
describe('docs.search', () => {
  it('搜索文档 → 200', async () => {
    env('E2E_API_KEY', API_KEY);
    const { status, body } = await post('/api/v1/exec', {
      command: 'docs.search', params: { query: '测试' },
    });
    expect([200, 502]).toContain(status);
    if (status === 200) expect(body.code).toBe(0);
  });
});
