// ===== 请求类型 =====

export interface LookupRequest {
  phone: string;
  time_from?: string;
  time_to?: string;
}

// ===== 响应类型 =====

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

export interface UserInfo {
  name: string;
  department: string;
  title: string;
  email: string;
  mobile: string;
}

export interface CalendarEvent {
  title: string;
  start_time: string;
  end_time: string;
}

export interface CalendarData {
  summary: string;
  events?: CalendarEvent[];
}

export interface MeetingRecord {
  title: string;
  meeting_date: string;
  duration_minutes: number;
  has_recording: boolean;
}

export interface LookupData {
  user: UserInfo;
  calendar: CalendarData;
  meetings: MeetingRecord[];
}

// ===== CLI 相关类型 =====

export interface CliResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CliOptions {
  timeout?: number;
  encoding?: BufferEncoding;
}

// ===== 错误码 =====

export enum ErrorCode {
  // 400 - 参数错误
  MISSING_PHONE = 1001,
  INVALID_PHONE = 1002,
  INVALID_TIME_FORMAT = 1003,
  MISSING_TIME_TO = 1004,
  TIME_RANGE_INVALID = 1005,
  // 401 - 认证错误
  MISSING_AUTH = 2001,
  INVALID_API_KEY = 2002,
  // 404 - 数据未找到
  USER_NOT_FOUND = 3001,
  // 502/504 - 上游错误
  CLI_FAILED = 4001,
  CLI_TIMEOUT = 4002,
  // 429 - 限流
  RATE_LIMITED = 5001,
  // 500
  INTERNAL_ERROR = 9999,
}
