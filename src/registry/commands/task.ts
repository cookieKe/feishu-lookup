import { registerCommand } from '../index';

// ===== task.list-todos =====
// 查询当前用户的任务列表，默认只返回未完成任务
registerCommand('task.list-todos', {
  description: '查询当前未完成的任务（可搜索、可切换已完成）',
  params: {
    query: { type: 'string', required: false, default: '', description: '按任务标题搜索（留空则不过滤）' },
    complete: { type: 'string', required: false, default: 'false', description: '是否查询已完成任务（false=未完成, true=已完成）' },
    page_size: { type: 'number', required: false, default: 20, description: '每页条数' },
  },
  steps: [
    {
      command: ['task', '+get-my-tasks'],
      args: [
        '--query', '{{query}}',
        '--complete={{complete}}',
        '--page-size', '{{page_size}}',
        '--format', 'json',
        '--as', 'user',
      ],
    },
  ],
});
