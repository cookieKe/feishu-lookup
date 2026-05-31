import { runLarkCliJson } from './cli';
import type { UserInfo } from '../types';

/**
 * +search-user 返回的 JSON 结构
 * 参考: https://github.com/larksuite/cli/blob/main/skills/lark-contact/references/lark-contact-search-user.md
 */
interface SearchUserItem {
  open_id: string;
  localized_name: string;
  email?: string;
  enterprise_email?: string;
  department?: string;
  is_activated?: boolean;
}

interface SearchUserResponse {
  data: {
    users: SearchUserItem[];
    has_more: boolean;
  };
}

/**
 * batch_get_id API 返回结构
 * 参考: https://open.feishu.cn/document/server-docs/contact-v3/user/batch_get_id
 */
interface BatchGetIdResponse {
  code: number;
  msg?: string;
  data?: {
    user_list?: Array<{ user_id: string }>;
  };
}

/**
 * 通过手机号搜索飞书用户。
 *
 * 使用飞书专用 API batch_get_id?mobile= 而非 +search-user --query 全文搜索，
 * 因为后者不索引手机号字段（受通讯录隐私设置影响）。
 */
async function searchUserByMobile(phone: string): Promise<string | null> {
  // 飞书 API 的 mobile 参数不需要 + 前缀
  const cleanPhone = phone.replace(/^\+/, '');

  const result = await runLarkCliJson<BatchGetIdResponse>([
    'api', 'GET',
    `/open-apis/contact/v3/users/batch_get_id?mobiles=${cleanPhone}`,
    '--as', 'user',
  ]);

  if (!result.success) {
    throw new Error(`通过手机号查找用户失败: ${result.error}`);
  }

  // batch_get_id 返回 code: 0 表示成功，非 0 可能用户不存在
  if (result.data?.code !== 0 || !result.data?.data?.user_list || result.data.data.user_list.length === 0) {
    return null;
  }

  return result.data.data.user_list[0]?.user_id || null;
}

/**
 * 通过 user_id 获取用户详细信息。
 * user 身份按 ID 取他人用 +search-user --user-ids（官方推荐），
 * 返回字段比 +get-user 多（部门、邮箱、是否激活等）。
 */
async function getUserInfo(userId: string): Promise<UserInfo | null> {
  const result = await runLarkCliJson<SearchUserResponse>([
    'contact', '+search-user',
    '--user-ids', userId,
    '--format', 'json',
    '--as', 'user',
  ]);

  if (!result.success) {
    throw new Error(`获取用户信息失败: ${result.error}`);
  }

  const data = result.data;
  if (!data?.data?.users || data.data.users.length === 0) {
    return null;
  }

  const u = data.data.users[0];
  // localized_name 一定有值（兜底为 open_id），但若连 open_id 都没有则视为无效
  if (!u.localized_name) {
    return null;
  }

  return {
    name: u.localized_name || '',
    department: u.department || '',
    title: '', // +search-user 不返回 title，需要时可通过其他 API 补充
    email: u.enterprise_email || u.email || '',
    mobile: '', // 由调用方补充（已知查询手机号）
  };
}

/**
 * 通过手机号查询用户完整信息。
 * 返回用户信息，或未找到时返回 null。
 */
export async function lookupUserByPhone(phone: string): Promise<UserInfo | null> {
  const userId = await searchUserByMobile(phone);
  if (!userId) {
    return null;
  }

  const userInfo = await getUserInfo(userId);
  if (userInfo) {
    // 用查询时的手机号回填 mobile 字段（+search-user 输出不包含 mobile）
    userInfo.mobile = phone;
  }
  return userInfo;
}
