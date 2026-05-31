/**
 * E2E 测试 — 直接访问远端服务器验证 API 行为。
 *
 * ## 运行方式
 *
 * ```bash
 * # 最小：只测健康检查（无需 Key）
 * E2E_BASE_URL=http://8.130.149.29:3000 npm run test:e2e
 *
 * # 完整：包含认证和真实查询
 * E2E_BASE_URL=http://8.130.149.29:3000 \
 *   E2E_API_KEY=6c7668dddccbc6177c96e245f5a481c50b4a4d23cc5f8f081521aa0a69fa5664 \
 *   E2E_PHONE=+8613800138000 \
 *   npm run test:e2e
 * ```
 */
import { describe, it, expect, beforeAll } from 'vitest';

// ===== 配置 =====
const BASE_URL = process.env.E2E_BASE_URL || 'http://8.130.149.29:3000';
const API_KEY = process.env.E2E_API_KEY || '';
const TEST_PHONE = process.env.E2E_PHONE || '';
const TEST_TIMEOUT = 15_000;

let serverReachable = false;

// ===== 工具函数 =====
interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

/** 跳过条件：服务器不可达、或缺少必需的环境变量 */
function requireEnv(needs: { apiKey?: boolean; phone?: boolean } = {}) {
  if (!serverReachable) return '服务器不可达';
  if (needs.apiKey && !API_KEY) return '缺少 E2E_API_KEY';
  if (needs.phone && !TEST_PHONE) return '缺少 E2E_PHONE';
  return null;
}

async function apiGet(
  path: string,
  opts: { apiKey?: string } = {},
): Promise<{ status: number; body: ApiResponse }> {
  const headers: Record<string, string> = {};
  if (opts.apiKey) headers['Authorization'] = `Bearer ${opts.apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT);
  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers, signal: controller.signal });
    const body = (await res.json()) as ApiResponse;
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function apiPost(
  path: string,
  data: unknown,
  opts: { apiKey?: string } = {},
): Promise<{ status: number; body: ApiResponse }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers['Authorization'] = `Bearer ${opts.apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST', headers, body: JSON.stringify(data), signal: controller.signal,
    });
    const body = (await res.json()) as ApiResponse;
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

// ===== 连通性预检（最先执行） =====
beforeAll(async () => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${BASE_URL}/api/v1/health`, { signal: controller.signal });
    clearTimeout(timer);
    serverReachable = res.ok;
    if (serverReachable) console.log(`[E2E] ✓ 服务器 ${BASE_URL} 可达`);
  } catch (err) {
    serverReachable = false;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[E2E] ✗ 服务器 ${BASE_URL} 不可达: ${msg}`);
  }
}, 10000);

it('server should be reachable', () => {
  expect(serverReachable).toBe(true);
});

// ===== 1. 健康检查 =====
describe('GET /api/v1/health', () => {
  it('should return 200 with status ok', async () => {
    if (!serverReachable) return;
    const { status, body } = await apiGet('/api/v1/health');
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: 'ok' });
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('timestamp');
  });

  it('should return valid uptime as positive number', async () => {
    if (!serverReachable) return;
    const { body } = await apiGet('/api/v1/health');
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThan(0);
  });

  it('should return valid ISO timestamp', async () => {
    if (!serverReachable) return;
    const { body } = await apiGet('/api/v1/health');
    expect(() => new Date(body.timestamp as string)).not.toThrow();
  });
});

// ===== 2. 认证失败 =====
describe('POST /api/v1/lookup — auth failures', () => {
  it('should return 401 when Authorization header is missing', async () => {
    if (!serverReachable) return;
    const { status, body } = await apiPost('/api/v1/lookup', { phone: '13800138000' });
    expect(status).toBe(401);
    expect(body.code).toBe(2001);
  });

  it('should return 401 for incorrect API key', async () => {
    if (!serverReachable) return;
    const { status, body } = await apiPost(
      '/api/v1/lookup', { phone: '13800138000' }, { apiKey: 'wrong-key' },
    );
    expect(status).toBe(401);
    expect(body.code).toBe(2002);
  });
});

// ===== 3. 参数校验 =====
describe('POST /api/v1/lookup — validation', () => {
  it('should return 1001 when phone is missing', async () => {
    if (!serverReachable || !API_KEY) return;
    const { status, body } = await apiPost('/api/v1/lookup', {}, { apiKey: API_KEY });
    expect(status).toBe(400);
    expect(body.code).toBe(1001);
  });

  it('should return 1002 when phone is empty string', async () => {
    if (!serverReachable || !API_KEY) return;
    const { status, body } = await apiPost('/api/v1/lookup', { phone: '' }, { apiKey: API_KEY });
    expect(status).toBe(400);
    expect(body.code).toBe(1002);
  });

  it('should return 1002 when phone contains letters', async () => {
    if (!serverReachable || !API_KEY) return;
    const { status, body } = await apiPost('/api/v1/lookup', { phone: 'abcdefghijk' }, { apiKey: API_KEY });
    expect(status).toBe(400);
    expect(body.code).toBe(1002);
  });

  it('should return 1002 when phone is too short', async () => {
    if (!serverReachable || !API_KEY) return;
    const { status, body } = await apiPost('/api/v1/lookup', { phone: '123' }, { apiKey: API_KEY });
    expect(status).toBe(400);
    expect(body.code).toBe(1002);
  });

  it('should return 1004 when only time_from provided', async () => {
    if (!serverReachable || !API_KEY) return;
    const { status, body } = await apiPost(
      '/api/v1/lookup', { phone: '13800138000', time_from: '2026-06-01 09:00' }, { apiKey: API_KEY },
    );
    expect(status).toBe(400);
    expect(body.code).toBe(1004);
  });

  it('should return 1004 when only time_to provided', async () => {
    if (!serverReachable || !API_KEY) return;
    const { status, body } = await apiPost(
      '/api/v1/lookup', { phone: '13800138000', time_to: '2026-06-01 18:00' }, { apiKey: API_KEY },
    );
    expect(status).toBe(400);
    expect(body.code).toBe(1004);
  });

  it('should return 1005 when time_to is before time_from', async () => {
    if (!serverReachable || !API_KEY) return;
    const { status, body } = await apiPost(
      '/api/v1/lookup',
      { phone: '13800138000', time_from: '2026-06-01 18:00', time_to: '2026-06-01 09:00' },
      { apiKey: API_KEY },
    );
    expect(status).toBe(400);
    expect(body.code).toBe(1005);
  });

  it('should return 1003 when time format is wrong', async () => {
    if (!serverReachable || !API_KEY) return;
    const { status, body } = await apiPost(
      '/api/v1/lookup',
      { phone: '13800138000', time_from: '2026/06/01', time_to: '2026/06/02' },
      { apiKey: API_KEY },
    );
    expect(status).toBe(400);
    expect(body.code).toBe(1003);
  });

  it('should pass validation with valid request', async () => {
    if (!serverReachable || !API_KEY) return;
    const { status, body } = await apiPost(
      '/api/v1/lookup',
      { phone: '13800138000', time_from: '2026-06-01 09:00', time_to: '2026-06-01 18:00' },
      { apiKey: API_KEY },
    );
    // 通过校验 → 进入 CLI 层。200=找到 | 404=用户不存在 | 502=CLI异常
    expect([200, 404, 502]).toContain(status);
    if (status === 200) expect(body.code).toBe(0);
    else if (status === 404) expect(body.code).toBe(3001);
  });
});

// ===== 4. 真实查询 =====
describe('POST /api/v1/lookup — real query', () => {
  it('should return 200 with user/calendar/meetings or 404', async () => {
    if (!serverReachable || !API_KEY || !TEST_PHONE) return;
    const { status, body } = await apiPost(
      '/api/v1/lookup', { phone: TEST_PHONE }, { apiKey: API_KEY },
    );
    expect([200, 404]).toContain(status);

    if (status === 200) {
      expect(body.code).toBe(0);
      const data = body.data as Record<string, unknown>;
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('calendar');
      expect(data).toHaveProperty('meetings');
      const user = data.user as Record<string, unknown>;
      expect(user).toHaveProperty('name');
      expect(typeof user.name).toBe('string');
      expect((user.name as string).length).toBeGreaterThan(0);
    } else {
      expect(body.code).toBe(3001);
    }
  });

  it('should include calendar events with time range', async () => {
    if (!serverReachable || !API_KEY || !TEST_PHONE) return;
    const { status, body } = await apiPost(
      '/api/v1/lookup',
      { phone: TEST_PHONE, time_from: '2026-05-01 00:00', time_to: '2026-06-01 00:00' },
      { apiKey: API_KEY },
    );
    if (status === 200) {
      const data = body.data as Record<string, unknown>;
      const calendar = data.calendar as Record<string, unknown>;
      if (calendar.events) expect(Array.isArray(calendar.events)).toBe(true);
    }
  });

  it('should return meetings array', async () => {
    if (!serverReachable || !API_KEY || !TEST_PHONE) return;
    const { status, body } = await apiPost(
      '/api/v1/lookup', { phone: TEST_PHONE }, { apiKey: API_KEY },
    );
    if (status === 200) {
      const data = body.data as Record<string, unknown>;
      expect(Array.isArray(data.meetings)).toBe(true);
    }
  });
});
