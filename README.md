# 飞书用户信息查询服务

通过电话号码查询飞书用户日程、会议、联系人等信息的 API 服务。

## 快速开始

### 前置条件

1. 在 [飞书开放平台](https://open.feishu.cn) 创建自建应用
2. 开通以下权限：`contact:user.id:readonly`、`contact:user.base:readonly`、`calendar:calendar.readonly`、`vc:meeting.readonly`
3. 发布应用

### 安装

```bash
# 安装飞书 CLI
npm install -g @larksuite/cli

# 配置飞书 CLI
lark-cli config init

# 安装依赖并构建
npm ci
npm run build
```

### 配置

复制 `.env.example` 为 `.env` 并填写：

```
PORT=3000
API_KEYS=your-api-key-1,your-api-key-2
```

### 运行

```bash
# 开发模式
npm run dev

# 生产模式
npm run build && npm start
```

### Docker

```bash
docker compose up -d
```

## API 文档

### 认证

```
Authorization: Bearer <api_key>
```

### POST /api/v1/lookup

```json
{
  "phone": "+8613800000000",
  "time_from": "2026-05-01 09:00",
  "time_to": "2026-05-30 18:00"
}
```

### GET /api/v1/health

## 测试

```bash
npm test
```
