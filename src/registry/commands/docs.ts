import { registerCommand } from '../index';

// ===== docs.search =====
registerCommand('docs.search', {
  description: '搜索云文档',
  params: {
    query: { type: 'string', required: true, description: '搜索关键词' },
  },
  steps: [
    {
      command: ['docs', '+search'],
      args: ['--query', '{{query}}', '--format', 'json', '--as', 'user'],
    },
  ],
});

// ===== docs.read =====
registerCommand('docs.read', {
  description: '读取文档内容（转为 Markdown）',
  params: {
    doc_id: { type: 'string', required: true, description: '文档 token 或 URL' },
  },
  steps: [
    {
      command: ['docs', '+read'],
      args: ['--id', '{{doc_id}}', '--format', 'json', '--as', 'user'],
    },
  ],
});

// ===== drive.search =====
registerCommand('drive.search', {
  description: '搜索云盘文件',
  params: {
    query: { type: 'string', required: true, description: '搜索关键词' },
  },
  steps: [
    {
      command: ['drive', '+search'],
      args: ['--query', '{{query}}', '--format', 'json', '--as', 'user'],
    },
  ],
});

// ===== drive.download =====
registerCommand('drive.download', {
  description: '下载云盘文件',
  params: {
    file_token: { type: 'string', required: true, description: '文件 token' },
  },
  steps: [
    {
      command: ['drive', '+download'],
      args: ['--token', '{{file_token}}', '--format', 'json', '--as', 'user'],
    },
  ],
});
