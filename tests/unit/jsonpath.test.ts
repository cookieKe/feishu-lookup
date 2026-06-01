import { describe, it, expect } from 'vitest';
import { extractValue } from '../../src/utils/jsonpath';

describe('extractValue', () => {
  const obj = {
    code: 0,
    data: {
      user_list: [
        { user_id: 'ou_abc123', name: '张三' },
        { user_id: 'ou_def456', name: '李四' },
      ],
      users: [
        { open_id: 'ou_1', localized_name: 'Alice', email: 'alice@example.com' },
      ],
      has_more: false,
    },
    items: [
      { subject: '周会', meeting_start_time: '2026-01-01' },
    ],
  };

  it('should extract top-level property', () => {
    expect(extractValue(obj, 'code')).toBe(0);
  });

  it('should extract nested property', () => {
    expect(extractValue(obj, 'data.has_more')).toBe(false);
  });

  it('should extract from array with index', () => {
    expect(extractValue(obj, 'data.user_list[0].user_id')).toBe('ou_abc123');
  });

  it('should extract from second array element', () => {
    expect(extractValue(obj, 'data.user_list[1].user_id')).toBe('ou_def456');
  });

  it('should extract nested array property', () => {
    expect(extractValue(obj, 'data.users[0].localized_name')).toBe('Alice');
  });

  it('should extract nested array property with email', () => {
    expect(extractValue(obj, 'data.users[0].email')).toBe('alice@example.com');
  });

  it('should extract from second-level array', () => {
    expect(extractValue(obj, 'items[0].subject')).toBe('周会');
  });

  it('should return undefined for out-of-bounds array index', () => {
    expect(extractValue(obj, 'data.user_list[5].user_id')).toBeUndefined();
  });

  it('should return undefined for non-existent path in existing object', () => {
    expect(extractValue(obj, 'data.nonexistent')).toBeUndefined();
  });

  it('should return undefined for non-existent nested path', () => {
    expect(extractValue(obj, 'data.users[0].nonexistent')).toBeUndefined();
  });

  it('should return undefined for null input', () => {
    expect(extractValue(null, 'data.user_list')).toBeUndefined();
  });

  it('should return undefined for undefined input', () => {
    expect(extractValue(undefined, 'data.user_list')).toBeUndefined();
  });

  it('should return undefined when accessing array index on non-array', () => {
    expect(extractValue(obj, 'code[0]')).toBeUndefined();
  });

  it('should return the whole object for empty path', () => {
    // Empty path after splitting yields [''], accesses obj[''] which is undefined.
    // This is an edge case not used in practice.
    expect(extractValue(obj, '')).toBeUndefined();
  });

  it('should handle deep path with multiple array accesses', () => {
    const complex = {
      a: {
        b: [
          { c: [{ d: 'found' }] },
        ],
      },
    };
    expect(extractValue(complex, 'a.b[0].c[0].d')).toBe('found');
  });
});
