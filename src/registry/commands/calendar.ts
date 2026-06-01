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

// ===== calendar.search =====
// 2 步管线：获取主日历 ID → 按关键字搜索日程
registerCommand('calendar.search', {
  description: '根据关键字搜索日程',
  params: {
    query: { type: 'string', required: true, description: '搜索关键字（模糊匹配日程标题）' },
  },
  steps: [
    {
      command: ['calendar', 'calendars', 'list'],
      args: ['--format', 'json', '--as', 'user'],
      extract: { calendarId: 'data.calendars[0].calendar_id' },
    },
    {
      command: ['calendar', 'events', 'search_event'],
      args: [
        '--params', '{"calendar_id":"{{$0.calendarId}}"}',
        '--data', '{"query":"{{query}}"}',
        '--format', 'json',
        '--as', 'user',
      ],
    },
  ],
  outputStep: 1,
});

// ===== calendar.recent-events =====
// 使用 nowISO / endISO 变换自动计算时间范围
registerCommand('calendar.recent-events', {
  description: '查询最近 x 天的日程',
  params: {
    days: { type: 'number', required: false, default: 7, description: '查询未来多少天' },
    user_id: { type: 'string', required: false, default: 'me', description: '用户标识（默认 me）' },
  },
  steps: [
    {
      command: ['calendar', 'events', 'instance_view', 'primary'],
      args: [
        '--params',
        '{"user_id":"{{user_id}}","start_time":"{{days:nowISO}}","end_time":"{{days:endISO}}"}',
        '--format', 'json',
        '--as', 'user',
      ],
    },
  ],
});
