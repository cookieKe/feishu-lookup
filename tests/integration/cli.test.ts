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

  it('should return success with parsed stdout (contact +search-user)', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, '{"data":{"users":[{"open_id":"ou_xxx","localized_name":"test"}]},"has_more":false}', '');
      }
    );

    const result = await runLarkCli([
      'contact', '+search-user', '--query', '138xx', '--format', 'json',
    ]);
    expect(result.success).toBe(true);
    expect(JSON.parse(result.stdout)).toEqual({
      data: { users: [{ open_id: 'ou_xxx', localized_name: 'test' }] },
      has_more: false,
    });
  });

  it('should return failure on non-zero exit', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        const err = new Error('Command failed') as NodeJS.ErrnoException;
        err.code = 1;
        cb(err, '', 'error output');
      }
    );

    const result = await runLarkCli([
      'contact', '+search-user', '--query', '138xx', '--format', 'json',
    ]);
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

    const result = await runLarkCli([
      'contact', '+search-user', '--query', '138xx', '--format', 'json',
    ]);
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('timed out');
  });

  it('runLarkCliJson should parse contact response correctly', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, '{"data":{"users":[{"open_id":"ou_1"},{"open_id":"ou_2"}]}}', '');
      }
    );

    const result = await runLarkCliJson<{
      data: { users: Array<{ open_id: string }> };
    }>([
      'contact', '+search-user', '--query', '张三', '--format', 'json',
    ]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data.users).toHaveLength(2);
    }
  });

  it('runLarkCliJson should parse vc +search response correctly', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, '{"items":[{"subject":"周会","meeting_start_time":"2026-01-01"}],"total":1,"has_more":false}', '');
      }
    );

    const result = await runLarkCliJson<{
      items: Array<{ subject: string }>;
      total: number;
      has_more: boolean;
    }>([
      'vc', '+search', '--participant-ids', 'ou_xxx', '--start', '20260501', '--end', '20260601', '--format', 'json',
    ]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].subject).toBe('周会');
    }
  });

  it('runLarkCliJson should handle non-JSON output', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, 'this is not json!', '');
      }
    );

    const result = await runLarkCliJson([
      'contact', '+search-user', '--query', '138xx', '--format', 'json',
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
      'contact', '+search-user', '--query', '138xx', '--format', 'json',
    ]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it('should pass correct arguments to execFile for contact +search-user', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, '{}', '');
      }
    );

    await runLarkCli([
      'contact', '+search-user', '--query', '+86138xx', '--format', 'json',
    ]);

    const callArgs = mockExecFile.mock.calls[0];
    expect(callArgs[0]).toBe('lark-cli');
    expect(callArgs[1]).toEqual([
      'contact', '+search-user', '--query', '+86138xx', '--format', 'json',
    ]);
  });
});

/**
 * 真实 CLI 验证（设置 LARK_CLI_E2E=1 开启）
 *
 * 这些测试不 mock execFile，直接调用系统上的 lark-cli。
 * 运行前需要确保:
 *   1. lark-cli 已安装: npm install -g @larksuite/cli
 *   2. 已完成认证: lark-cli auth login
 *   3. 网络可访问飞书 API
 */
const runRealCli = process.env.LARK_CLI_E2E === '1';

describe('CLI Service (real CLI smoke tests)', { skip: !runRealCli }, () => {
  it('contact +search-user --help should exit 0', async () => {
    const result = await runLarkCli([
      'contact', '+search-user', '--help',
    ]);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('--query');
  });

  it('contact +search-user should accept --query flag', async () => {
    const result = await runLarkCli([
      'contact', '+search-user', '--query', 'test_keyword', '--format', 'json',
    ]);
    expect(result.success).toBe(true);
  });

  it('contact +search-user --user-ids should work', async () => {
    const result = await runLarkCli([
      'contact', '+search-user', '--user-ids', 'me', '--format', 'json',
    ]);
    expect(result.success).toBe(true);
  });

  it('vc +search should accept --participant-ids flag', async () => {
    const result = await runLarkCli([
      'vc', '+search', '--participant-ids', 'ou_nonexistent',
      '--start', '20200101', '--end', '20200101', '--format', 'json',
    ]);
    expect(result.success).toBe(true);
  });

  it('calendar events instance_view primary should work', async () => {
    const result = await runLarkCli([
      'calendar', 'events', 'instance_view', 'primary',
      '--params', '{"user_id":"ou_nonexistent","start_time":"2020-01-01T00:00:00+08:00","end_time":"2020-01-01T23:59:59+08:00"}',
      '--format', 'json',
    ]);
    expect(result.stderr).not.toContain('unknown flag');
    expect(result.stderr).not.toContain('unknown command');
  });

  it('api POST batch_get_id should resolve user by mobile', async () => {
    const result = await runLarkCli([
      'api', 'POST', '/open-apis/contact/v3/users/batch_get_id',
      '--data', '{"mobiles":["13811751328"]}',
      '--as', 'bot',
    ]);
    expect(result.success).toBe(true);
    const body = JSON.parse(result.stdout);
    expect(body.code).toBe(0);
  });
});
