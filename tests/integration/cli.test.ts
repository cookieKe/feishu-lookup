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
