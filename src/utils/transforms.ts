/**
 * 模板解析器：将命令参数中的 {{placeholder}} 占位符替换为实际值。
 *
 * 语法：
 *   {{paramName}}            → 从请求 params 中直接取值
 *   {{paramName:transform}}  → 取值后应用内置转换函数
 *   {{$stepIndex.varName}}   → 从管线前序步骤提取的上下文中取值
 *
 * 内置转换函数：
 *   stripPlus   - 去掉电话号码前缀 +
 *   iso8601     - 将 "YYYY-MM-DD HH:mm" 转为 ISO 8601 格式
 *   dateCompact - 将日期转为 YYYYMMDD 紧凑格式
 *   joinComma   - 将数组用逗号连接为字符串
 *   nowISO      - 忽略输入，返回当前时间的 ISO 8601 格式（含时区）
 *   endISO      - 输入天数 N，返回（当前时间 + N 天）的 ISO 8601 格式（含时区）
 *   raw         - 原样转字符串（默认）
 */

const TEMPLATE_REGEX = /\{\{([^:}]+?)(?::(\w+))?\}\}/g;

type TransformFn = (val: unknown) => string;

/** 将 Date 对象格式化为带时区的 ISO 8601 字符串 */
function toISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const offHours = pad(Math.floor(Math.abs(offset) / 60));
  const offMinutes = pad(Math.abs(offset) % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${offHours}:${offMinutes}`;
}

const TRANSFORMS: Record<string, TransformFn> = {
  raw: (val) => String(val ?? ''),
  stripPlus: (val) => String(val ?? '').replace(/^\+/, ''),
  dateCompact: (val) => {
    if (typeof val === 'string') {
      return val.replace(/[-:\s]/g, '').slice(0, 8);
    }
    return String(val ?? '');
  },
  iso8601: (val) => {
    const str = String(val ?? '');
    // 如果已经是 ISO 8601 格式，直接返回
    if (str.includes('T')) {
      return str;
    }
    // "YYYY-MM-DD HH:mm" → "YYYY-MM-DDTHH:mm:00+08:00"
    return `${str}:00+08:00`;
  },
  joinComma: (val) => (Array.isArray(val) ? val.join(',') : String(val ?? '')),
  nowISO: (_val) => toISO(new Date()),
  endISO: (val) => {
    const days = Number(val ?? 0);
    return toISO(new Date(Date.now() + days * 86400000));
  },
};

/**
 * 解析 args 数组中的模板占位符。
 *
 * @param args       - 参数模板数组，如 ["--query", "{{query}}", "--format", "json"]
 * @param params     - 请求中的 params 对象
 * @param variables  - 管线步骤中提取的上下文变量，如 { "$0.userId": "ou_xxx" }
 * @returns 解析后的参数数组
 * @throws 如果引用的变量未定义
 */
export function resolveTemplates(
  args: string[],
  params: Record<string, unknown>,
  variables: Record<string, unknown>,
): string[] {
  return args.map((arg) => {
    return arg.replace(TEMPLATE_REGEX, (_match: string, key: string, transform?: string) => {
      let value: unknown;

      // 步骤变量（$0.xxx, $1.xxx 等）
      if (key.startsWith('$')) {
        value = variables[key];
      } else {
        value = params[key];
      }

      // 可选值：如果未定义且 key 以 ? 结尾，则返回空字符串
      if (value === undefined || value === null) {
        // 允许 page_token 这类可选参数为空
        // 直接返回空字符串让 CLI 忽略该参数
        return '';
      }

      const fn = TRANSFORMS[transform ?? 'raw'] ?? TRANSFORMS.raw;
      return fn(value);
    });
  });
}

/**
 * 检查模板字符串中引用的变量是否全部可用（都不为 null/undefined）。
 * 用于判断 optional 步骤是否应该跳过。
 */
export function hasAllTemplateValues(
  arg: string,
  params: Record<string, unknown>,
  variables: Record<string, unknown>,
): boolean {
  const matches = arg.matchAll(TEMPLATE_REGEX);
  for (const match of matches) {
    const key = match[1];
    let value: unknown;

    if (key.startsWith('$')) {
      value = variables[key];
    } else {
      value = params[key];
    }

    if (value === undefined || value === null) {
      return false;
    }
  }
  return true;
}
