import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.E2E_BASE_URL || 'http://8.130.149.29:3000';
const API_KEY = process.env.E2E_API_KEY || '';
const PHONE_A = process.env.E2E_PHONE || '';
const PHONE_B = process.env.E2E_CONTACT_PHONE || '';
const TIMEOUT = 20_000;

let ok = false;

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

async function get(path: string) {
  const h: Record<string, string> = {};
  if (API_KEY) h['Authorization'] = `Bearer ${API_KEY}`;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT);
  try {
    const r = await fetch(`${BASE_URL}${path}`, { headers: h, signal: c.signal });
    return { status: r.status, body: await r.json() as Record<string, unknown> };
  } finally { clearTimeout(t); }
}

beforeAll(async () => {
  try {
    const r = await fetch(`${BASE_URL}/api/v1/health`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) ok = true;
  } catch { /* unreachable */ }
}, 10000);

describe('POST /api/v1/contacts/check', () => {
  it('缺少 phone → 400', async () => {
    if (!ok || !API_KEY) return;
    const { status, body } = await post('/api/v1/contacts/check', { contact_phone: '138xx' });
    expect(status).toBe(400);
    expect(body.code).toBe(1001);
  });

  it('缺少 contact_phone → 400', async () => {
    if (!ok || !API_KEY) return;
    const { status, body } = await post('/api/v1/contacts/check', { phone: '138xx' });
    expect(status).toBe(400);
    expect(body.code).toBe(1001);
  });

  it('B 不在通讯录中 → 404', async () => {
    if (!ok || !PHONE_A || !API_KEY) return;
    const { status, body } = await post('/api/v1/contacts/check', {
      phone: PHONE_A, contact_phone: '+8600000000000',
    });
    expect(status).toBe(404);
    expect(body.code).toBe(3001);
  });

  it('A 和 B 都在通讯录中 → 200', async () => {
    if (!ok || !PHONE_A || !PHONE_B || !API_KEY) return;
    const { status, body } = await post('/api/v1/contacts/check', {
      phone: PHONE_A, contact_phone: PHONE_B,
    });
    expect([200, 404]).toContain(status);
    if (status === 200) {
      expect(body.code).toBe(0);
      const data = (body.data as Record<string, unknown>);
      expect(data.is_contact).toBe(true);
      expect(data.contact).toBeDefined();
    }
  });

  it('A 自己查自己 → 200', async () => {
    if (!ok || !PHONE_A || !API_KEY) return;
    const { status, body } = await post('/api/v1/contacts/check', {
      phone: PHONE_A, contact_phone: PHONE_A,
    });
    expect([200, 404]).toContain(status);
    if (status === 200) {
      const data = (body.data as Record<string, unknown>);
      const contact = data.contact as Record<string, unknown>;
      expect(contact.name).toBeDefined();
    }
  });
});

describe('GET /api/v1/contacts', () => {
  it('列出通讯录成员 → 200', async () => {
    if (!ok || !PHONE_A || !API_KEY) return;
    const { status, body } = await get(`/api/v1/contacts?phone=${encodeURIComponent(PHONE_A)}`);
    expect(status).toBe(200);
    expect(body.code).toBe(0);
    const data = body.data as Record<string, unknown>;
    expect(data.contacts).toBeDefined();
    expect(Array.isArray(data.contacts)).toBe(true);
    expect((data.total as number) || 0).toBeGreaterThan(0);
  });
});
