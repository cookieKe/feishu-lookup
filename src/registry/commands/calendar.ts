import { registerCommand } from '../index';

// ===== calendar.today-agenda =====
registerCommand('calendar.today-agenda', {
  description: '获取当前用户今日日程摘要',
  params: {},
  steps: [
    {
      command: ['calendar', '+agenda'],
      args: ['--format', 'json', '--as', 'user'],
    },
  ],
});

// ===== calendar.events =====
registerCommand('calendar.events', {
  description: '查询指定用户和时间范围内的日程事件',
  params: {
    user_id: { type: 'string', required: true, description: '用户 open_id' },
    start_time: { type: 'string', required: false, description: '开始时间（YYYY-MM-DD HH:mm 或 ISO 8601）' },
    end_time: { type: 'string', required: false, description: '结束时间（YYYY-MM-DD HH:mm 或 ISO 8601）' },
  },
  steps: [
    {
      command: ['calendar', 'events', 'instance_view', 'primary'],
      args: [
        '--params',
        '{"user_id":"{{user_id}}","start_time":"{{start_time:iso8601}}","end_time":"{{end_time:iso8601}}"}',
        '--format', 'json',
        '--as', 'user',
      ],
    },
  ],
});

// ===== calendar.list =====
registerCommand('calendar.list', {
  description: '列出当前用户的日历列表',
  params: {},
  steps: [
    {
      command: ['calendar', 'calendars', 'list'],
      args: ['--format', 'json', '--as', 'user'],
    },
  ],
});

// ===== calendar.free-busy =====
registerCommand('calendar.free-busy', {
  description: '查询用户忙闲状态',
  params: {
    user_id: { type: 'string', required: true, description: '用户 open_id' },
    start_time: { type: 'string', required: true, description: '开始时间（YYYY-MM-DD HH:mm 或 ISO 8601）' },
    end_time: { type: 'string', required: true, description: '结束时间（YYYY-MM-DD HH:mm 或 ISO 8601）' },
  },
  steps: [
    {
      command: ['calendar', '+free-busy'],
      args: [
        '--params',
        '{"user_id":"{{user_id}}","start_time":"{{start_time:iso8601}}","end_time":"{{end_time:iso8601}}"}',
        '--format', 'json',
        '--as', 'user',
      ],
    },
  ],
});
