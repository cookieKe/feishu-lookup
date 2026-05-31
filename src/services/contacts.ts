import { runLarkCliJson } from './cli';
import type { UserInfo } from '../types';

interface BatchGetIdResponse {
  code: number;
  data?: { user_list?: Array<{ user_id: string }> };
}

interface SearchUserItem {
  open_id: string;
  localized_name: string;
  email?: string;
  enterprise_email?: string;
  department?: string;
}

interface SearchUserResponse {
  data: { users: SearchUserItem[]; has_more: boolean };
}

export interface ContactCheckResult {
  is_contact: boolean;
  contact: UserInfo | null;
}

/**
 * 以 A 的号码查通讯录，看 B 是否在其中。
 * 只做通讯录匹配，不做日历/会议查询。
 */
export async function checkContact(
  phoneA: string,
  phoneB: string,
): Promise<ContactCheckResult> {
  const cleanA = phoneA.replace(/^\+/, '');
  const cleanB = phoneB.replace(/^\+/, '');

  // 1. 查 A 的 open_id（确认 A 存在）
  const aResult = await runLarkCliJson<BatchGetIdResponse>([
    'api', 'POST', '/open-apis/contact/v3/users/batch_get_id',
    '--data', JSON.stringify({ mobiles: [cleanA] }),
    '--as', 'bot',
  ]);
  if (!aResult.success || aResult.data?.code !== 0) {
    throw new Error(`查询用户A失败: ${aResult.success ? aResult.data?.code : aResult.error}`);
  }
  const aUserId = aResult.data?.data?.user_list?.[0]?.user_id;
  if (!aUserId) {
    throw new Error('未匹配到手机号A关联的飞书用户');
  }

  // 2. 以 A 的身份（--as user，当前登录用户即 A）在通讯录中搜 B
  const bResult = await runLarkCliJson<BatchGetIdResponse>([
    'api', 'POST', '/open-apis/contact/v3/users/batch_get_id',
    '--data', JSON.stringify({ mobiles: [cleanB] }),
    '--as', 'bot',
  ]);
  if (!bResult.success || bResult.data?.code !== 0) {
    return { is_contact: false, contact: null };
  }
  const bUserId = bResult.data?.data?.user_list?.[0]?.user_id;
  if (!bUserId) {
    return { is_contact: false, contact: null };
  }

  // 3. 获取 B 的详细信息
  const detailResult = await runLarkCliJson<SearchUserResponse>([
    'contact', '+search-user',
    '--user-ids', bUserId,
    '--format', 'json',
    '--as', 'user',
  ]);

  const u = detailResult.success ? detailResult.data?.data?.users?.[0] : null;
  if (!u) {
    return { is_contact: false, contact: null };
  }

  return {
    is_contact: true,
    contact: {
      name: u.localized_name,
      department: u.department || '',
      title: '',
      email: u.enterprise_email || u.email || '',
      mobile: phoneB,
    },
  };
}
