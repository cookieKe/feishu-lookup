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
