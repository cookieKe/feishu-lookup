/**
 * 简单的 JSON 点路径提取器。
 * 从嵌套 JSON 对象中按路径取出值，用于管线步骤间变量传递。
 *
 * 支持语法：
 *   "code"              → 顶层属性
 *   "data.users"        → 嵌套属性
 *   "data.user_list[0]" → 数组索引
 *   "data.users[0].localized_name" → 数组索引 + 嵌套属性
 */

export function extractValue(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // 处理数组索引语法: key[index]
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);
      if (typeof current !== 'object' || current === null) {
        return undefined;
      }
      const record = current as Record<string, unknown>;
      if (!(key in record)) {
        return undefined;
      }
      const arr = record[key];
      if (!Array.isArray(arr) || index >= arr.length) {
        return undefined;
      }
      current = arr[index];
    } else {
      if (typeof current !== 'object' || current === null) {
        return undefined;
      }
      const record = current as Record<string, unknown>;
      if (!(part in record)) {
        return undefined;
      }
      current = record[part];
    }
  }

  return current;
}
