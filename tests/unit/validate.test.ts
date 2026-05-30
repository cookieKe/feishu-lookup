import { describe, it, expect } from 'vitest';
import { validateLookupRequest, ValidationError } from '../../src/utils/validate';

describe('validateLookupRequest', () => {
  // 缺少 phone
  it('should return error when phone is missing', () => {
    const result = validateLookupRequest({ phone: undefined } as any);
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1001);
  });

  it('should return error when phone is undefined', () => {
    const result = validateLookupRequest({} as any);
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1001);
  });

  // phone 格式非法
  it('should return error when phone is only letters', () => {
    const result = validateLookupRequest({ phone: 'abcdef' });
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1002);
  });

  it('should return error when phone is empty string', () => {
    const result = validateLookupRequest({ phone: '' });
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1002);
  });

  // 合法的 phone
  it('should accept phone with +86 prefix', () => {
    const result = validateLookupRequest({ phone: '+8613800000000' });
    expect(result).toEqual({ phone: '+8613800000000' });
  });

  it('should accept phone without prefix (auto-add +86)', () => {
    const result = validateLookupRequest({ phone: '13800000000' });
    expect(result).toEqual({ phone: '+8613800000000' });
  });

  it('should accept international phone with + prefix', () => {
    const result = validateLookupRequest({ phone: '+14165551234' });
    expect(result).toEqual({ phone: '+14165551234' });
  });

  // time_from / time_to 格式错误
  it('should return error when time_from format is invalid', () => {
    const result = validateLookupRequest({
      phone: '+8613800000000',
      time_from: '2026-05-01',
    });
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1003);
  });

  it('should return error when time_to format is invalid', () => {
    const result = validateLookupRequest({
      phone: '+8613800000000',
      time_to: 'not-a-date',
    });
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1003);
  });

  // 只有 time_from 没有 time_to
  it('should return error when time_from provided without time_to', () => {
    const result = validateLookupRequest({
      phone: '+8613800000000',
      time_from: '2026-05-01 09:00',
    });
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1004);
  });

  it('should return error when time_to provided without time_from', () => {
    const result = validateLookupRequest({
      phone: '+8613800000000',
      time_to: '2026-05-01 09:00',
    });
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1004);
  });

  // 时间范围无效
  it('should return error when time_to is before time_from', () => {
    const result = validateLookupRequest({
      phone: '+8613800000000',
      time_from: '2026-05-30 18:00',
      time_to: '2026-05-01 09:00',
    });
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1005);
  });

  it('should return error when time_from equals time_to', () => {
    const result = validateLookupRequest({
      phone: '+8613800000000',
      time_from: '2026-05-01 09:00',
      time_to: '2026-05-01 09:00',
    });
    expect(result).toBeInstanceOf(ValidationError);
    expect((result as ValidationError).code).toBe(1005);
  });

  // 合法请求（带时间段）
  it('should accept valid request with time range', () => {
    const result = validateLookupRequest({
      phone: '13800000000',
      time_from: '2026-05-01 09:00',
      time_to: '2026-05-30 18:00',
    });
    expect(result).toEqual({
      phone: '+8613800000000',
      time_from: '2026-05-01 09:00',
      time_to: '2026-05-30 18:00',
    });
  });
});
