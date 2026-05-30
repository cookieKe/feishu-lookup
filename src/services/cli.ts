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
            exitCode: typeof error.code === 'number' ? error.code : -1,
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
