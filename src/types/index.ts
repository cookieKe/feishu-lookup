// ===== 请求/响应类型 =====

/** POST /api/v1/exec 请求体 */
export interface ExecRequest {
  /** 命令名，格式 "<domain>.<action>"，如 "user.search-by-phone" */
  command: string;
  /** 命令参数 */
  params: Record<string, unknown>;
}

/** 通用 API 响应 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
  details?: unknown;
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

// ===== 命令注册表类型 =====

/** 参数定义 */
export interface ParamDef {
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  default?: unknown;
  description: string;
}

/** 管线步骤定义 */
export interface StepDef {
  /** CLI 子命令 token 数组，如 ["contact", "+search-user"] */
  command: string[];
  /** 参数模板数组（可含 {{placeholder}}），如 ["--query", "{{query}}", "--format", "json"] */
  args: string[];
  /** 步骤失败是否非致命。true 时该步骤输出为 null，管线继续执行 */
  optional?: boolean;
  /** 从步骤 JSON 输出中提取变量。key=变量名, value=JSON 点路径 */
  extract?: Record<string, string>;
}

/** 命令定义（注册表中一个条目） */
export interface CommandDef {
  /** 命令描述 */
  description: string;
  /** 参数 schema */
  params: Record<string, ParamDef>;
  /** 有序管线步骤 */
  steps: StepDef[];
  /** 返回第几步的输出（默认最后一步） */
  outputStep?: number;
}

// ===== 错误码 =====

export enum ErrorCode {
  // 400 - 参数错误
  MISSING_COMMAND = 1001,
  INVALID_COMMAND = 1002,
  MISSING_PARAM = 1003,
  INVALID_PARAM = 1004,
  // 401 - 认证错误
  MISSING_AUTH = 2001,
  INVALID_API_KEY = 2002,
  // 404 - 数据未找到
  NOT_FOUND = 3001,
  // 502 - CLI 上游错误
  CLI_FAILED = 4001,
  CLI_TIMEOUT = 4002,
  // 429 - 限流
  RATE_LIMITED = 5001,
  // 500
  INTERNAL_ERROR = 9999,
}
