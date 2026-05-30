export class ValidationError extends Error {
  public code: number;
  public httpStatus: number;

  constructor(code: number, message: string, httpStatus = 400) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

interface ValidatedRequest {
  phone: string;
  time_from?: string;
  time_to?: string;
}

const TIME_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
// 手机号：可选 + 开头 + 数字，长度 7-15
const PHONE_REGEX = /^\+?\d{7,15}$/;

function normalizePhone(phone: string): string {
  // 如果没有 + 前缀且不是 0 开头（国际号），默认加 +86
  if (!phone.startsWith('+')) {
    if (phone.startsWith('0')) {
      // 国内固话格式如 010-xxxx，暂时不支持，保留原始
      return phone;
    }
    return '+86' + phone;
  }
  return phone;
}

export function validateLookupRequest(
  body: Record<string, unknown>
): ValidatedRequest | ValidationError {
  const rawPhone = body.phone;
  const phone = typeof rawPhone === 'string' ? rawPhone.trim() : '';

  // 1001: 缺少 phone (字段完全不存在或类型非 string)
  if (typeof rawPhone !== 'string') {
    return new ValidationError(1001, '缺少 phone 参数');
  }

  // 1002: phone 格式非法（空字符串或格式不符）
  if (!phone || !PHONE_REGEX.test(phone)) {
    return new ValidationError(1002, 'phone 格式非法，应为数字，可选 + 前缀');
  }

  const time_from = typeof body.time_from === 'string' ? body.time_from.trim() : undefined;
  const time_to = typeof body.time_to === 'string' ? body.time_to.trim() : undefined;

  // 1003: 时间格式错误
  if (time_from && !TIME_FORMAT_REGEX.test(time_from)) {
    return new ValidationError(1003, 'time_from 格式错误，应为 YYYY-MM-DD HH:mm');
  }
  if (time_to && !TIME_FORMAT_REGEX.test(time_to)) {
    return new ValidationError(1003, 'time_to 格式错误，应为 YYYY-MM-DD HH:mm');
  }

  // 1004: 不成对
  if (time_from && !time_to) {
    return new ValidationError(1004, 'time_from 与 time_to 必须成对出现');
  }
  if (time_to && !time_from) {
    return new ValidationError(1004, 'time_from 与 time_to 必须成对出现');
  }

  // 1005: 时间范围无效
  if (time_from && time_to) {
    if (new Date(time_to) <= new Date(time_from)) {
      return new ValidationError(1005, 'time_to 必须晚于 time_from');
    }
  }

  return {
    phone: normalizePhone(phone),
    ...(time_from && { time_from }),
    ...(time_to && { time_to }),
  };
}
