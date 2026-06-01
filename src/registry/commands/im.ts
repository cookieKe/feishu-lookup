import { registerCommand } from '../index';

// ===== im.search =====
registerCommand('im.search', {
  description: '搜索消息记录',
  params: {
    query: { type: 'string', required: true, description: '搜索关键词' },
  },
  steps: [
    {
      command: ['im', '+search'],
      args: ['--query', '{{query}}', '--format', 'json', '--as', 'user'],
    },
  ],
});

// ===== im.fetch-history =====
registerCommand('im.fetch-history', {
  description: '获取群聊历史消息',
  params: {
    chat_id: { type: 'string', required: true, description: '群聊 ID（oc_xxx）' },
    limit: { type: 'number', required: false, default: 50, description: '拉取条数' },
  },
  steps: [
    {
      command: ['im', '+fetch'],
      args: ['--chat-id', '{{chat_id}}', '--limit', '{{limit}}', '--format', 'json', '--as', 'user'],
    },
  ],
});

// ===== im.fetch-message =====
registerCommand('im.fetch-message', {
  description: '获取单条消息详情',
  params: {
    message_id: { type: 'string', required: true, description: '消息 ID（om_xxx）' },
  },
  steps: [
    {
      command: ['im', '+fetch'],
      args: ['--message-id', '{{message_id}}', '--format', 'json', '--as', 'user'],
    },
  ],
});

// ===== im.send-message =====
registerCommand('im.send-message', {
  description: '发送文本消息',
  params: {
    receive_id: { type: 'string', required: true, description: '接收者 open_id 或 chat_id' },
    content: { type: 'string', required: true, description: '消息文本内容' },
  },
  steps: [
    {
      command: ['im', '+messages-send'],
      args: ['--receive-id', '{{receive_id}}', '--text', '{{content}}', '--as', 'user'],
    },
  ],
});

// ===== im.list-chats =====
registerCommand('im.list-chats', {
  description: '列出当前用户的群聊列表',
  params: {},
  steps: [
    {
      command: ['im', '+chat-list'],
      args: ['--format', 'json', '--as', 'user'],
    },
  ],
});

// ===== im.search-by-phone =====
// 通过手机号查与该用户的聊天记录。2 步管线：bot 身份拿 user_id → user 身份拉 P2P 消息
registerCommand('im.search-by-phone', {
  description: '根据手机号查询与该用户的聊天记录',
  params: {
    phone: { type: 'string', required: true, description: '手机号（支持 +86 前缀）' },
    limit: { type: 'number', required: false, default: 20, description: '返回条数（1-50）' },
  },
  steps: [
    {
      command: ['api', 'POST', '/open-apis/contact/v3/users/batch_get_id'],
      args: ['--data', '{"mobiles":["{{phone:stripPlus}}"]}', '--as', 'bot'],
      extract: { userId: 'data.user_list[0].user_id' },
    },
    {
      command: ['im', '+chat-messages-list'],
      args: [
        '--user-id', '{{$0.userId}}',
        '--page-size', '{{limit}}',
        '--sort', 'desc',
        '--format', 'json',
        '--as', 'user',
      ],
    },
  ],
  outputStep: 1,
});

// ===== im.get-chat-info =====
registerCommand('im.get-chat-info', {
  description: '获取群聊详细信息',
  params: {
    chat_id: { type: 'string', required: true, description: '群聊 ID（oc_xxx）' },
  },
  steps: [
    {
      command: ['im', '+chat-info'],
      args: ['--chat-id', '{{chat_id}}', '--format', 'json', '--as', 'user'],
    },
  ],
});
