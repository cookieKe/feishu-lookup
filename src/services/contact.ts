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
 * 通过手机号搜索飞书用户。
 * 使用 +search-user --query，支持姓名 / 邮箱 / 手机号关键词。
 */
async function searchUserByMobile(phone: string): Promise<string | null> {
  const result = await runLarkCliJson<SearchUserResponse>([
    'contact', '+search-user',
    '--query', phone,
    '--format', 'json',
  ]);

  if (!result.success) {
    throw new Error(`搜索用户失败: ${result.error}`);
  }

  const data = result.data;
  if (!data?.data?.users || data.data.users.length === 0) {
    return null;
  }

  // 取第一个匹配的 open_id
  return data.data.users[0]?.open_id || null;
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
