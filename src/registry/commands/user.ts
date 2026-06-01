import { registerCommand } from '../index';

// ===== user.search-by-phone =====
// 通过手机号查找用户。2 步管线：bot 身份拿 user_id → user 身份拿详情
registerCommand('user.search-by-phone', {
  description: '通过手机号查找飞书用户，返回用户详细信息',
  params: {
    phone: { type: 'string', required: true, description: '手机号（支持 +86 前缀）' },
  },
  steps: [
    {
      command: ['api', 'POST', '/open-apis/contact/v3/users/batch_get_id'],
      args: ['--data', '{"mobiles":["{{phone:stripPlus}}"]}', '--as', 'bot'],
      extract: { userId: 'data.user_list[0].user_id' },
    },
    {
      command: ['contact', '+search-user'],
      args: ['--user-ids', '{{$0.userId}}', '--format', 'json', '--as', 'user'],
    },
  ],
  outputStep: 1,
});

// ===== user.lookup-phone =====
// 仅通过手机号查询是否在通讯录中（单步 batch_get_id）。
// 对同租户用户返回 user_id + mobile，对跨租户外部联系人仅返回 mobile。
// 配合 user.get-by-id 或 user.search-by-name 可进一步获取详情。
registerCommand('user.lookup-phone', {
  description: '通过手机号查用户是否存在（支持跨租户外部联系人）',
  params: {
    phone: { type: 'string', required: true, description: '手机号（支持 +86 前缀）' },
  },
  steps: [
    {
      command: ['api', 'POST', '/open-apis/contact/v3/users/batch_get_id'],
      args: ['--data', '{"mobiles":["{{phone:stripPlus}}"]}', '--as', 'bot'],
    },
  ],
});

// ===== user.search-by-name =====
registerCommand('user.search-by-name', {
  description: '通过姓名搜索飞书用户',
  params: {
    query: { type: 'string', required: true, description: '搜索关键词（姓名）' },
  },
  steps: [
    {
      command: ['contact', '+search-user'],
      args: ['--query', '{{query}}', '--format', 'json', '--as', 'user'],
    },
  ],
});

// ===== user.get-by-id =====
registerCommand('user.get-by-id', {
  description: '通过用户 ID 获取用户详细信息',
  params: {
    user_id: { type: 'string', required: true, description: '飞书用户 open_id 或 user_id' },
  },
  steps: [
    {
      command: ['contact', '+search-user'],
      args: ['--user-ids', '{{user_id}}', '--format', 'json', '--as', 'user'],
    },
  ],
});

// ===== user.list-contacts =====
registerCommand('user.list-contacts', {
  description: '搜索企业通讯录成员',
  params: {
    query: { type: 'string', required: true, description: '搜索关键词' },
    page_size: { type: 'number', required: false, default: 50, description: '每页条数' },
    page_token: { type: 'string', required: false, description: '分页 token' },
  },
  steps: [
    {
      command: ['api', 'GET'],
      args: [
        '/open-apis/search/v1/user?query={{query}}&page_size={{page_size}}&page_token={{page_token}}',
        '--as', 'user',
      ],
    },
  ],
});

// ===== user.check-contact =====
// 检查 B 是否在 A 的通讯录中。5 步管线，其中 B 相关的步骤为可选：
// 第 0 步: A 的手机号 → 获取 A 的 user_id
// 第 1 步: A 的 user_id → 获取 A 的详细信息
// 第 2 步: B 的手机号 → 获取 B 的 user_id（可选）
// 第 3 步: B 的 user_id → 获取 B 的姓名（可选）
// 第 4 步: 用 B 的姓名搜索通讯录（可选）
registerCommand('user.check-contact', {
  description: '检查用户 B 是否在用户 A 的通讯录中',
  params: {
    phone_a: { type: 'string', required: true, description: '用户 A 的手机号' },
    phone_b: { type: 'string', required: true, description: '用户 B 的手机号' },
  },
  steps: [
    {
      command: ['api', 'POST', '/open-apis/contact/v3/users/batch_get_id'],
      args: ['--data', '{"mobiles":["{{phone_a:stripPlus}}"]}', '--as', 'bot'],
      extract: { userId: 'data.user_list[0].user_id' },
    },
    {
      command: ['contact', '+search-user'],
      args: ['--user-ids', '{{$0.userId}}', '--format', 'json', '--as', 'user'],
    },
    {
      command: ['api', 'POST', '/open-apis/contact/v3/users/batch_get_id'],
      args: ['--data', '{"mobiles":["{{phone_b:stripPlus}}"]}', '--as', 'bot'],
      optional: true,
      extract: { userId: 'data.user_list[0].user_id' },
    },
    {
      command: ['contact', '+search-user'],
      args: ['--user-ids', '{{$2.userId}}', '--format', 'json', '--as', 'user'],
      optional: true,
      extract: { name: 'data.users[0].localized_name' },
    },
    {
      command: ['api', 'GET'],
      args: [
        '/open-apis/search/v1/user?query={{$3.name}}&page_size=10',
        '--as', 'user',
      ],
      optional: true,
    },
  ],
  outputStep: 4,
});
