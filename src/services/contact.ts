import { runLarkCliJson } from './cli';
import type { UserInfo } from '../types';

/**
 * 通过手机号搜索飞书用户 ID
 */
async function searchUserByMobile(phone: string): Promise<string | null> {
  const result = await runLarkCliJson<Array<{ user_id?: string; open_id?: string }>>([
    'contact', '+search-user',
    '--mobile', phone,
    '--json',
  ]);

  if (!result.success) {
    throw new Error(`搜索用户失败: ${result.error}`);
  }

  const data = result.data;
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  // 取第一个匹配的 user_id
  return data[0]?.user_id || data[0]?.open_id || null;
}

/**
 * 通过 user_id 获取用户详细信息
 */
async function getUserInfo(userId: string): Promise<UserInfo | null> {
  const result = await runLarkCliJson<{
    name?: string;
    department_name?: string;
    title?: string;
    email?: string;
    mobile?: string;
  }>([
    'contact', '+get-user',
    '--user-id', userId,
    '--json',
  ]);

  if (!result.success) {
    throw new Error(`获取用户信息失败: ${result.error}`);
  }

  const data = result.data;
  if (!data || !data.name) {
    return null;
  }

  return {
    name: data.name || '',
    department: data.department_name || '',
    title: data.title || '',
    email: data.email || '',
    mobile: data.mobile || '',
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
  return getUserInfo(userId);
}
