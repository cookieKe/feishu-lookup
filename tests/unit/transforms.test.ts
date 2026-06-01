import { describe, it, expect } from 'vitest';
import { resolveTemplates, hasAllTemplateValues } from '../../src/utils/transforms';

describe('resolveTemplates', () => {
  const params = {
    phone: '+8613800138000',
    query: '张三',
    user_id: 'ou_abc123',
    limit: 50,
    start_time: '2026-06-01 09:00',
    end_time: '2026-06-01 18:00',
    items: ['a', 'b', 'c'],
  };

  const variables = {
    '$0.userId': 'ou_step0_123',
    '$1.name': '李四',
  };

  it('should substitute direct param values', () => {
    const result = resolveTemplates(
      ['--query', '{{query}}', '--format', 'json'],
      params,
      variables,
    );
    expect(result).toEqual(['--query', '张三', '--format', 'json']);
  });

  it('should apply stripPlus transform', () => {
    const result = resolveTemplates(
      ['--data', '{"mobiles":["{{phone:stripPlus}}"]}'],
      params,
      variables,
    );
    expect(result).toEqual(['--data', '{"mobiles":["8613800138000"]}']);
  });

  it('should apply iso8601 transform', () => {
    const result = resolveTemplates(
      ['--start', '{{start_time:iso8601}}'],
      params,
      variables,
    );
    expect(result).toEqual(['--start', '2026-06-01 09:00:00+08:00']);
  });

  it('should passthrough already ISO 8601 format', () => {
    const p = { t: '2026-06-01T09:00:00Z' };
    const result = resolveTemplates(['--t', '{{t:iso8601}}'], p, {});
    expect(result).toEqual(['--t', '2026-06-01T09:00:00Z']);
  });

  it('should apply dateCompact transform', () => {
    const p = { date: '2026-06-01' };
    const result = resolveTemplates(['--date', '{{date:dateCompact}}'], p, {});
    expect(result).toEqual(['--date', '20260601']);
  });

  it('should apply joinComma transform on array', () => {
    const result = resolveTemplates(
      ['--ids', '{{items:joinComma}}'],
      params,
      variables,
    );
    expect(result).toEqual(['--ids', 'a,b,c']);
  });

  it('should substitute step variables', () => {
    const result = resolveTemplates(
      ['--user-ids', '{{$0.userId}}'],
      params,
      variables,
    );
    expect(result).toEqual(['--user-ids', 'ou_step0_123']);
  });

  it('should substitute multiple placeholders in one string', () => {
    const result = resolveTemplates(
      ['--params', '{"user_id":"{{user_id}}","name":"{{$1.name}}"}'],
      params,
      variables,
    );
    expect(result).toEqual(['--params', '{"user_id":"ou_abc123","name":"李四"}']);
  });

  it('should return empty string for undefined optional param', () => {
    const result = resolveTemplates(
      ['--page-token', '{{page_token}}'],
      params,
      variables,
    );
    expect(result).toEqual(['--page-token', '']);
  });

  it('should return empty string for null variable', () => {
    const vars = { '$2.userId': null };
    const result = resolveTemplates(
      ['--user-ids', '{{$2.userId}}'],
      params,
      vars,
    );
    expect(result).toEqual(['--user-ids', '']);
  });

  it('should not touch args without templates', () => {
    const result = resolveTemplates(
      ['--format', 'json', '--as', 'user'],
      params,
      variables,
    );
    expect(result).toEqual(['--format', 'json', '--as', 'user']);
  });

  it('should apply default (raw) transform for numbers', () => {
    const result = resolveTemplates(['--limit', '{{limit}}'], params, variables);
    expect(result).toEqual(['--limit', '50']);
  });
});

describe('hasAllTemplateValues', () => {
  const params = { phone: '138', query: 'test' };
  const variables = { '$0.userId': 'ou_123' };

  it('should return true when all values are present', () => {
    expect(hasAllTemplateValues('{{query}}', params, variables)).toBe(true);
  });

  it('should return true for step variable that exists', () => {
    expect(hasAllTemplateValues('{{$0.userId}}', params, variables)).toBe(true);
  });

  it('should return false when param is missing', () => {
    expect(hasAllTemplateValues('{{nonexistent}}', params, variables)).toBe(false);
  });

  it('should return false when step variable is missing', () => {
    expect(hasAllTemplateValues('{{$2.missing}}', params, variables)).toBe(false);
  });

  it('should return true for args with multiple present values', () => {
    expect(hasAllTemplateValues('{{query}} {{$0.userId}}', params, variables)).toBe(true);
  });

  it('should return false when any of multiple values is missing', () => {
    expect(hasAllTemplateValues('{{phone}} {{missing}}', params, variables)).toBe(false);
  });
});

describe('nowISO transform', () => {
  it('should return current time in ISO 8601 format', () => {
    const before = new Date();
    const result = resolveTemplates(['{{_:nowISO}}'], { _: '' }, {});
    const after = new Date();
    const parsed = new Date(result[0]);
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(parsed.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
    expect(result[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });

  it('should ignore the input value', () => {
    const r1 = resolveTemplates(['{{a:nowISO}}'], { a: 'ignored' }, {});
    const r2 = resolveTemplates(['{{b:nowISO}}'], { b: 'also-ignored' }, {});
    expect(r1[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(r2[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('endISO transform', () => {
  it('should return time offset by N days', () => {
    const before = new Date();
    const result = resolveTemplates(['{{days:endISO}}'], { days: 5 }, {});
    const expectedMin = new Date(before.getTime() + 5 * 86400000 - 2000);
    const expectedMax = new Date(before.getTime() + 5 * 86400000 + 2000);
    const parsed = new Date(result[0]);
    expect(parsed.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
    expect(parsed.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    expect(result[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });

  it('should handle 0 days (returns current time)', () => {
    const before = new Date();
    const result = resolveTemplates(['{{days:endISO}}'], { days: 0 }, {});
    const parsed = new Date(result[0]);
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(parsed.getTime()).toBeLessThanOrEqual(before.getTime() + 2000);
  });

  it('should return empty string when input param is missing', () => {
    // When the key is undefined, the resolver returns '' before calling the transform
    const result = resolveTemplates(['{{missing:endISO}}'], {}, {});
    expect(result[0]).toBe('');
  });
});
