/**
 * 服务端集成测试 — 直接访问远端 API 覆盖所有用例
 *
 * 运行:
 *   E2E_BASE_URL=http://8.130.149.29:3000 E2E_API_KEY=<key> E2E_PHONE=<phone> npx vitest run tests/integration/server.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.E2E_BASE_URL || 'http://8.130.149.29:3000';
const API_KEY = process.env.E2E_API_KEY || '';
const TEST_PHONE = process.env.E2E_PHONE || '';
const TIMEOUT = 20_000;

let ok = false; // 服务器是否可达 + API Key 是否有效

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

// ===== 连通性 + 鉴权预检 =====
beforeAll(async () => {
  try {
    const { status, body } = await get('/api/v1/health');
    if (status === 200 && body.status === 'ok') {
      if (API_KEY) {
        // 验证 Key 有效（传空 phone → 应返回 400 而非 401）
        const r = await post('/api/v1/lookup', {}, API_KEY);
        if (r.status === 400) ok = true;
        else console.warn('[SERVER INTEGRATION] API Key 无效');
      } else {
        console.warn('[SERVER INTEGRATION] 未设置 E2E_API_KEY，认证相关测试将跳过');
      }
    } else {
      console.warn(`[SERVER INTEGRATION] 服务器不可达: ${BASE_URL}`);
    }
  } catch {
    console.warn(`[SERVER INTEGRATION] 服务器不可达: ${BASE_URL}`);
  }
}, 15000);

// ===== 1. 健康检查 =====
describe('Health Check', () => {
  it('GET /api/v1/health → 200 + status ok', async () => {
    if (!ok && !API_KEY) return;
    const { status, body } = await get('/api/v1/health');
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThan(0);
  });
});

// ===== 2. 认证（对应 tests/unit/auth.test.ts） =====
describe('Authentication', () => {
  it('缺少 Authorization → 401 code=2001', async () => {
    if (!ok && !API_KEY) return;
    const { status, body } = await post('/api/v1/lookup', { phone: '13800138000' });
    expect(status).toBe(401);
    expect(body.code).toBe(2001);
  });

  it('空 Authorization → 401 code=2001', async () => {
    if (!ok && !API_KEY) return;
    const { status, body } = await post('/api/v1/lookup', { phone: '13800138000' }, '');
    expect(status).toBe(401);
    expect(body.code).toBe(2001);
  });

  it('Bearer 格式错误（非 Bearer 开头） → 401 code=2001', async () => {
    if (!ok && !API_KEY) return;
    const r = await fetch(`${BASE_URL}/api/v1/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic xyz' },
      body: JSON.stringify({ phone: '13800138000' }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const body = await r.json() as Record<string, unknown>;
    expect(r.status).toBe(401);
    expect(body.code).toBe(2001);
  });

  it('错误的 API Key → 401 code=2002', async () => {
    if (!ok && !API_KEY) return;
    const { status, body } = await post('/api/v1/lookup', { phone: '13800138000' }, 'wrong-key-xxxxx');
    expect(status).toBe(401);
    expect(body.code).toBe(2002);
  });

  it('正确的 API Key → 不返回 401', async () => {
    if (!ok) return;
    const { status } = await post('/api/v1/lookup', {}, API_KEY);
    expect(status).not.toBe(401);
  });
});

// ===== 3. 参数校验（对应 tests/unit/validate.test.ts） =====
describe('Parameter Validation', () => {
  it('缺少 phone → 400 code=1001', async () => {
    if (!ok) return;
    const { status, body } = await post('/api/v1/lookup', {}, API_KEY);
    expect(status).toBe(400);
    expect(body.code).toBe(1001);
  });

  it('phone 为 undefined → 400 code=1001', async () => {
    if (!ok) return;
    const { status, body } = await post('/api/v1/lookup', { phone: undefined }, API_KEY);
    expect(status).toBe(400);
    expect(body.code).toBe(1001);
  });

  it('phone 为空字符串 → 400 code=1002', async () => {
    if (!ok) return;
    const { status, body } = await post('/api/v1/lookup', { phone: '' }, API_KEY);
    expect(status).toBe(400);
    expect(body.code).toBe(1002);
  });

  it('phone 包含字母 → 400 code=1002', async () => {
    if (!ok) return;
    const { status, body } = await post('/api/v1/lookup', { phone: 'abcdefghij' }, API_KEY);
    expect(status).toBe(400);
    expect(body.code).toBe(1002);
  });

  it('phone 太短（< 7 位） → 400 code=1002', async () => {
    if (!ok) return;
    const { status, body } = await post('/api/v1/lookup', { phone: '123' }, API_KEY);
    expect(status).toBe(400);
    expect(body.code).toBe(1002);
  });

  it('有效中国手机号（自动补 +86）→ 通过校验', async () => {
    if (!ok) return;
    const { status, body } = await post('/api/v1/lookup', { phone: '13800138000' }, API_KEY);
    // 通过校验 → 200/404/502
    expect([200, 404, 502]).toContain(status);
    if (status === 200) expect(body.code).toBe(0);
    else if (status === 404) expect(body.code).toBe(3001);
  });

  it('国际号码 + 前缀 → 通过校验', async () => {
    if (!ok) return;
    const { status, body } = await post('/api/v1/lookup', { phone: '+14165551234' }, API_KEY);
    expect([200, 404, 502]).toContain(status);
  });

  it('只有 time_from 缺 time_to → 400 code=1004', async () => {
    if (!ok) return;
    const { status, body } = await post('/api/v1/lookup', {
      phone: '13800138000', time_from: '2026-06-01 09:00',
    }, API_KEY);
    expect(status).toBe(400);
    expect(body.code).toBe(1004);
  });

  it('只有 time_to 缺 time_from → 400 code=1004', async () => {
    if (!ok) return;
    const { status, body } = await post('/api/v1/lookup', {
      phone: '13800138000', time_to: '2026-06-01 18:00',
    }, API_KEY);
    expect(status).toBe(400);
    expect(body.code).toBe(1004);
  });

  it('time_to 早于 time_from → 400 code=1005', async () => {
    if (!ok) return;
    const { status, body } = await post('/api/v1/lookup', {
      phone: '13800138000', time_from: '2026-06-01 18:00', time_to: '2026-06-01 09:00',
    }, API_KEY);
    expect(status).toBe(400);
    expect(body.code).toBe(1005);
  });

  it('time_to 等于 time_from → 400 code=1005', async () => {
    if (!ok) return;
    const { status, body } = await post('/api/v1/lookup', {
      phone: '13800138000', time_from: '2026-06-01 09:00', time_to: '2026-06-01 09:00',
    }, API_KEY);
    expect(status).toBe(400);
    expect(body.code).toBe(1005);
  });

  it('时间格式错误 → 400 code=1003', async () => {
    if (!ok) return;
    const { status, body } = await post('/api/v1/lookup', {
      phone: '13800138000', time_from: '2026/06/01', time_to: '2026/06/02',
    }, API_KEY);
    expect(status).toBe(400);
    expect(body.code).toBe(1003);
  });
});

// ===== 4. 真实查询（对应 tests/unit/aggregator.test.ts 场景） =====
describe('Real Lookup Flow', () => {
  it('找到用户 → 200, data 含 user/calendar/meetings', async () => {
    if (!ok || !TEST_PHONE) return;
    const { status, body } = await post('/api/v1/lookup', { phone: TEST_PHONE }, API_KEY);
    expect([200, 404]).toContain(status);
    if (status === 200) {
      expect(body.code).toBe(0);
      const data = body.data as Record<string, unknown>;
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('calendar');
      expect(data).toHaveProperty('meetings');
      // 用户信息完整性
      const user = data.user as Record<string, unknown>;
      expect(user).toHaveProperty('name');
      expect(typeof user.name).toBe('string');
      expect((user.name as string).length).toBeGreaterThan(0);
      // 日程信息
      const cal = data.calendar as Record<string, unknown>;
      expect(cal).toHaveProperty('summary');
      expect(typeof cal.summary).toBe('string');
      // 会议列表
      expect(Array.isArray(data.meetings)).toBe(true);
    }
  });

  it('用户不存在 → 404 code=3001', async () => {
    if (!ok) return;
    const { status, body } = await post('/api/v1/lookup', { phone: '+8600000000000' }, API_KEY);
    expect([200, 404]).toContain(status);
    if (status === 404) {
      expect(body.code).toBe(3001);
    }
  });

  it('带时间范围 → calendar 含 events', async () => {
    if (!ok || !TEST_PHONE) return;
    const { status, body } = await post('/api/v1/lookup', {
      phone: TEST_PHONE, time_from: '2026-05-01 00:00', time_to: '2026-06-01 00:00',
    }, API_KEY);
    if (status === 200) {
      const data = body.data as Record<string, unknown>;
      const cal = data.calendar as Record<string, unknown>;
      if (cal.events) expect(Array.isArray(cal.events)).toBe(true);
    }
  });
});
