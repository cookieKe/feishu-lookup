import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import type { CommandDef } from '../../src/types';
import { ErrorCode } from '../../src/types';

// Mock the CLI executor module BEFORE importing executePipeline
const mockRunCli = vi.fn();
vi.doMock('../../src/services/cli', () => ({
  runLarkCliJson: mockRunCli,
}));

// Must dynamically import after mock
let executePipeline: typeof import('../../src/services/executor').executePipeline;
let ExecutorError: typeof import('../../src/services/executor').ExecutorError;

beforeAll(async () => {
  const mod = await import('../../src/services/executor');
  executePipeline = mod.executePipeline;
  ExecutorError = mod.ExecutorError;
});

describe('executePipeline', () => {
  beforeEach(() => {
    mockRunCli.mockReset();
  });

  describe('single-step commands', () => {
    const def: CommandDef = {
      description: 'Search user by name',
      params: {
        query: { type: 'string', required: true, description: 'Search keyword' },
      },
      steps: [
        {
          command: ['contact', '+search-user'],
          args: ['--query', '{{query}}', '--format', 'json', '--as', 'user'],
        },
      ],
    };

    it('should execute a single step and return output', async () => {
      mockRunCli.mockResolvedValueOnce({
        success: true,
        data: { data: { users: [{ open_id: 'ou_1', localized_name: '张三' }] } },
      });

      const result = await executePipeline(def, { query: '张三' });
      expect(result).toEqual({
        data: { users: [{ open_id: 'ou_1', localized_name: '张三' }] },
      });
    });

    it('should throw CLI_FAILED when CLI returns error', async () => {
      mockRunCli.mockResolvedValue({
        success: false,
        error: 'Permission denied',
        exitCode: 1,
      });

      await expect(executePipeline(def, { query: '张三' }))
        .rejects.toThrow(ExecutorError);
      await expect(executePipeline(def, { query: '张三' }))
        .rejects.toMatchObject({ code: ErrorCode.CLI_FAILED });
    });

    it('should throw CLI_TIMEOUT when exitCode is -1', async () => {
      mockRunCli.mockResolvedValueOnce({
        success: false,
        error: 'CLI 调用超时',
        exitCode: -1,
      });

      await expect(executePipeline(def, { query: '张三' }))
        .rejects.toMatchObject({ code: ErrorCode.CLI_TIMEOUT });
    });
  });

  describe('multi-step commands with extraction', () => {
    const def: CommandDef = {
      description: 'Search user by phone',
      params: {
        phone: { type: 'string', required: true, description: 'Phone number' },
      },
      steps: [
        {
          command: ['api', 'POST', '/open-apis/contact/v3/users/batch_get_id'],
          args: ['--data', '{"mobiles":["{{phone:stripPlus}}"]}', '--as', 'bot'],
          extract: { userId: 'data.user_list[0].user_id' },
        },
        {
          command: ['contact', '+search-user'],
          args: ['--user-ids', '{{$0.userId}}', '--format', 'json', '--as', 'user'],
        },
      ],
      outputStep: 1,
    };

    it('should execute multi-step pipeline and pass extracted variables', async () => {
      // Step 0: batch_get_id
      mockRunCli.mockResolvedValueOnce({
        success: true,
        data: {
          code: 0,
          data: { user_list: [{ user_id: 'ou_abc123' }] },
        },
      });
      // Step 1: search-user with extracted userId
      mockRunCli.mockResolvedValueOnce({
        success: true,
        data: {
          data: { users: [{ open_id: 'ou_abc123', localized_name: '张三' }] },
        },
      });

      const result = await executePipeline(def, { phone: '+8613800138000' });

      // Verify step 1's fully resolved args contain the extracted variable
      const step1Args = mockRunCli.mock.calls[1][0];
      expect(step1Args).toContain('--user-ids');
      // The resolved args are: ['--user-ids', 'ou_abc123', '--format', 'json', '--as', 'user']
      const userIdIndex = step1Args.indexOf('--user-ids') + 1;
      expect(step1Args[userIdIndex]).toBe('ou_abc123');

      expect(result).toEqual({
        data: { users: [{ open_id: 'ou_abc123', localized_name: '张三' }] },
      });
    });

    it('should throw NOT_FOUND when step 0 extraction fails (user not found)', async () => {
      mockRunCli.mockResolvedValueOnce({
        success: true,
        data: {
          code: 0,
          data: { user_list: [] },  // empty — no user found
        },
      });

      await expect(executePipeline(def, { phone: '+8600000000000' }))
        .rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    });
  });

  describe('optional steps', () => {
    const def: CommandDef = {
      description: 'Check contact — optional B lookup',
      params: {
        phone_a: { type: 'string', required: true, description: 'Phone A' },
        phone_b: { type: 'string', required: true, description: 'Phone B' },
      },
      steps: [
        {
          command: ['api', 'POST', '/open-apis/contact/v3/users/batch_get_id'],
          args: ['--data', '{"mobiles":["{{phone_a:stripPlus}}"]}', '--as', 'bot'],
          extract: { userId: 'data.user_list[0].user_id' },
        },
        {
          command: ['api', 'POST', '/open-apis/contact/v3/users/batch_get_id'],
          args: ['--data', '{"mobiles":["{{phone_b:stripPlus}}"]}', '--as', 'bot'],
          optional: true,
          extract: { userId: 'data.user_list[0].user_id' },
        },
        {
          command: ['contact', '+search-user'],
          args: ['--user-ids', '{{$1.userId}}', '--format', 'json', '--as', 'user'],
          optional: true,
        },
      ],
      outputStep: 2,
    };

    it('should skip optional steps when upstream variable is null', async () => {
      // Step 0: A found
      mockRunCli.mockResolvedValueOnce({
        success: true,
        data: { code: 0, data: { user_list: [{ user_id: 'ou_a' }] } },
      });
      // Step 1: B not found — CLI runs but extraction returns undefined → variable = null
      mockRunCli.mockResolvedValueOnce({
        success: true,
        data: { code: 0, data: { user_list: [] } },
      });

      // Step 2 should be skipped because $1.userId is null
      const result = await executePipeline(def, {
        phone_a: '+8613800138000',
        phone_b: '+8600000000000',
      });

      // Step 2 was skipped, outputStep=2 → stepOutputs[2] is null
      expect(result).toBeNull();
    });
  });

  describe('optional step CLI failure', () => {
    it('should continue pipeline when optional step fails', async () => {
      const def: CommandDef = {
        description: 'Test optional failure',
        params: {
          id: { type: 'string', required: true, description: 'ID' },
        },
        steps: [
          {
            command: ['api', 'GET'],
            args: ['/path', '--as', 'user'],
            extract: { name: 'data.name' },
          },
          {
            command: ['api', 'GET'],
            args: ['/optional', '--as', 'user'],
            optional: true,
          },
        ],
        outputStep: 1,
      };

      mockRunCli.mockResolvedValueOnce({
        success: true,
        data: { data: { name: 'test' } },
      });
      mockRunCli.mockResolvedValueOnce({
        success: false,
        error: 'Not found',
        exitCode: 1,
      });

      const result = await executePipeline(def, { id: '123' });
      // Step 1 failed but is optional → output is null
      expect(result).toBeNull();
    });
  });

  describe('outputStep selection', () => {
    it('should return the specified outputStep', async () => {
      const def: CommandDef = {
        description: 'Multi-step with early output',
        params: {
          phone: { type: 'string', required: true, description: 'Phone' },
        },
        steps: [
          {
            command: ['first'],
            args: [],
            extract: { userId: 'data.user_id' },
          },
          {
            command: ['second'],
            args: ['--id', '{{$0.userId}}'],
          },
        ],
        outputStep: 0,
      };

      mockRunCli.mockResolvedValueOnce({
        success: true,
        data: { data: { user_id: 'ou_xxx' } },
      });
      mockRunCli.mockResolvedValueOnce({
        success: true,
        data: { data: { users: [{ name: 'Alice' }] } },
      });

      const result = await executePipeline(def, { phone: '+86138' });
      expect(result).toEqual({ data: { user_id: 'ou_xxx' } });
    });
  });
});
