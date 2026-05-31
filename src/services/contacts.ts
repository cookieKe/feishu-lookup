import { runLarkCliJson } from './cli';
import type { UserInfo } from '../types';

interface SearchUserItem {
  open_id: string;
  user_id?: string;
  name: string;
  department_ids?: string[];
}

interface SearchUserResponse {
  code: number;
  msg?: string;
  data?: {
    users: SearchUserItem[];
    has_more: boolean;
    page_token?: string;
  };
}

interface BatchGetIdResponse {
  code: number;
  data?: { user_list?: Array<{ user_id: string }> };
}

interface UserDetailItem {
  open_id: string;
  localized_name: string;
  email?: string;
  enterprise_email?: string;
  department?: string;
}

interface UserDetailResponse {
  data: { users: UserDetailItem[]; has_more: boolean };
}

export interface ContactCheckResult {
  is_contact: boolean;
  contact: UserInfo | null;
}

export interface ContactListItem {
  name: string;
  mobile: string;
  email: string;
  department: string;
}

export interface ContactListResult {
  contacts: ContactListItem[];
  total: number;
  has_more: boolean;
}

/**
 * 列出企业通讯录中的成员（使用 search/v1/user）。
 */
export async function listContacts(_phone: string): Promise<ContactListResult> {
  const all: ContactListItem[] = [];
  let pageToken = '';
  const maxPages = 4;

  for (let i = 0; i < maxPages; i++) {
    const url = pageToken
      ? `/open-apis/search/v1/user?query=*&page_size=50&page_token=${pageToken}`
      : '/open-apis/search/v1/user?query=*&page_size=50';

    const result = await runLarkCliJson<SearchUserResponse>([
      'api', 'GET', url,
      '--as', 'user',
    ]);

    if (!result.success || result.data?.code !== 0) break;

    const users = result.data?.data?.users;
    if (!users?.length) break;

    for (const u of users) {
      all.push({
        name: u.name || '',
        mobile: '', // search/v1/user 不返回手机号
        email: '',
        department: Array.isArray(u.department_ids) ? u.department_ids.join(',') : '',
      });
    }

    if (!result.data?.data?.has_more) break;
    pageToken = result.data?.data?.page_token || '';
    if (!pageToken) break;
  }

  return { contacts: all, total: all.length, has_more: all.length >= 200 };
}

/**
 * 以 A 的身份查通讯录，看 B 是否在其中。
 * 使用 search/v1/user 搜索匹配。
 */
export async function checkContact(
  phoneA: string,
  phoneB: string,
): Promise<ContactCheckResult> {
  const cleanA = phoneA.replace(/^\+/, '');
  const cleanB = phoneB.replace(/^\+/, '');

  // 1. 确认 A 存在
  const aResult = await runLarkCliJson<BatchGetIdResponse>([
    'api', 'POST', '/open-apis/contact/v3/users/batch_get_id',
    '--data', JSON.stringify({ mobiles: [cleanA] }),
    '--as', 'bot',
  ]);
  if (!aResult.success || aResult.data?.code !== 0) {
    throw new Error(`查询用户A失败`);
  }
  if (!aResult.data?.data?.user_list?.[0]?.user_id) {
    throw new Error('未匹配到手机号A关联的飞书用户');
  }

  // 2. 用 search/v1/user 搜 B 的手机号
  const searchResult = await runLarkCliJson<SearchUserResponse>([
    'api', 'GET',
    `/open-apis/search/v1/user?query=${cleanB}&page_size=5`,
    '--as', 'user',
  ]);

  if (!searchResult.success || searchResult.data?.code !== 0) {
    return { is_contact: false, contact: null };
  }

  const users = searchResult.data?.data?.users;
  if (!users?.length) {
    return { is_contact: false, contact: null };
  }

  // 3. 取第一个匹配用户的详情
  const userId = users[0].open_id;
  if (!userId) return { is_contact: false, contact: null };

  const detailResult = await runLarkCliJson<UserDetailResponse>([
    'contact', '+search-user',
    '--user-ids', userId,
    '--format', 'json',
    '--as', 'user',
  ]);

  const u = detailResult.success ? detailResult.data?.data?.users?.[0] : null;
  if (!u) return { is_contact: false, contact: null };

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
