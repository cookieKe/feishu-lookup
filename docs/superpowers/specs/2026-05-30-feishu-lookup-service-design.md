# 飞书用户信息查询服务 — 产品说明书

## 1. 产品概述

### 1.1 产品定位

飞书用户信息查询服务（以下简称"本服务"）是一个部署于云服务器上的后端 API 服务。调用方通过**电话号码**查询关联的飞书用户信息，包括基本资料、日程、会议记录等，供 CRM、工单系统、客服系统等第三方应用集成调用。

### 1.2 核心能力

- 通过电话号码（支持大陆和国际号码）查找飞书用户
- 返回用户基本信息（姓名、部门、职位、邮箱、手机号）
- 返回日程摘要；可选按时间段查询日程标题列表
- 返回会议记录（标题、时间、是否有录屏）
- 对请求方进行 API Key 身份校验，保证安全

### 1.3 技术选型

| 项目 | 选择 | 说明 |
|------|------|------|
| 开发语言 | Node.js + TypeScript | 与飞书 CLI 同生态（npm），集成最自然 |
| Web 框架 | Express.js | 成熟稳定，社区资源丰富 |
| 核心依赖 | `@larksuite/cli`（飞书 CLI） | 通过 `child_process.execFile` 调用 |
| 测试框架 | Vitest | 快，TypeScript 原生支持 |
| 部署方式 | Docker + PM2 | 容器化部署，进程守护 |

---

## 2. 系统架构

```
                     HTTPS + API Key (Header)
┌──────────────┐ ───────────────────────────────→ ┌─────────────────────────────┐
│  CRM / 工单   │                                   │  飞书用户查询服务 (Node.js)    │
│  第三方系统   │ ←─────────────────────────────── │  云服务器 (Docker)            │
└──────────────┘     JSON Response                 │                             │
                                                   │  ┌───────┐ ┌─────────────┐ │
                                                   │  │ Auth   │ │ CLI 调用层   │ │
                                                   │  │ 中间件  │ │ execFile()  │ │
                                                   │  └───────┘ └──────┬──────┘ │
                                                   │                    │ spawn  │
                                                   │  ┌────────────────┐▼──────┐ │
                                                   │  │    结果聚合层          │ │ │
                                                   │  │ 解析CLI JSON → 统一输出 │ │ │
                                                   │  └────────────────────────┘ │
                                                   └─────────────┬───────────────┘
                                                                 │
                                                        ┌────────┴────────┐
                                                        │    lark-cli     │
                                                        │ (npm 全局安装)   │
                                                        └────────┬────────┘
                                                                 │ HTTP
                                                                 ▼
                                                        ┌────────────────┐
                                                        │  飞书 OpenAPI   │
                                                        └────────────────┘
```

### 2.1 请求处理流程

```
1. 接收 POST /api/v1/lookup
2. Auth 中间件校验 Header: Authorization: Bearer <api_key>
3. 参数校验（phone 必填，time_from/time_to 可选且成对）
4. CLI 调用层:
   a. lark-cli contact +search-user --mobile "<phone>" --json
      → 获取 user_id
   b. 并行执行:
      ├ lark-cli contact +get-user --user-id "<user_id>" --json
      ├ lark-cli calendar +agenda [--start "..." --end "..."] --json
      └ lark-cli vc +search --start "..." --end "..." --json
5. 聚合层解析 JSON，组装统一响应体
6. 返回 200 / 错误码
```

### 2.2 CLI 依赖

服务器需预先安装并配置飞书 CLI：

```bash
npm install -g @larksuite/cli
lark-cli config init          # 配置 App ID / App Secret
lark-cli auth login --recommend
```

CLI 自动管理 token 刷新、分页、错误重试，服务无需处理。

---

## 3. API 接口设计

### 3.1 认证

所有请求在 Header 中携带：

```
Authorization: Bearer <api_key>
```

- API Key 在服务端配置文件中管理，支持多枚 Key
- 不支持 Key 轮换，验证失败返回 `401`

### 3.2 查询接口

**`POST /api/v1/lookup`**

**Content-Type:** `application/json`

#### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `phone` | string | 是 | 电话号码，支持 `+86` 前缀大陆号、`+1` 等国际号、或无前缀 |
| `time_from` | string | 否 | 日程查询起始时间，`YYYY-MM-DD HH:mm`，与 `time_to` 成对使用 |
| `time_to` | string | 否 | 日程查询结束时间，`YYYY-MM-DD HH:mm` |

#### 请求示例

```json
{
  "phone": "+8613800000000",
  "time_from": "2026-05-01 09:00",
  "time_to": "2026-05-30 18:00"
}
```

```json
{
  "phone": "+8613800000000"
}
```

#### 响应体

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | number | 0=成功 |
| `message` | string | 状态描述 |
| `data.user.name` | string | 用户姓名 |
| `data.user.department` | string | 所属部门 |
| `data.user.title` | string | 职位 |
| `data.user.email` | string | 邮箱 |
| `data.user.mobile` | string | 手机号 |
| `data.calendar.summary` | string | 日程摘要（始终返回） |
| `data.calendar.events` | array | 日程列表（仅传入时间段时返回） |
| `data.calendar.events[].title` | string | 日程标题 |
| `data.calendar.events[].start_time` | string | 开始时间 |
| `data.calendar.events[].end_time` | string | 结束时间 |
| `data.meetings` | array | 会议记录列表 |
| `data.meetings[].title` | string | 会议标题 |
| `data.meetings[].meeting_date` | string | 会议日期时间 |
| `data.meetings[].duration_minutes` | number | 会议时长（分钟） |
| `data.meetings[].has_recording` | boolean | 是否有录屏 |

#### 成功响应示例

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "user": {
      "name": "张三",
      "department": "技术部",
      "title": "高级工程师",
      "email": "zhangsan@example.com",
      "mobile": "+8613800000000"
    },
    "calendar": {
      "summary": "今日 3 个日程，本周 12 个日程",
      "events": [
        {
          "title": "项目评审会",
          "start_time": "2026-05-30 14:00",
          "end_time": "2026-05-30 15:30"
        }
      ]
    },
    "meetings": [
      {
        "title": "周会",
        "meeting_date": "2026-05-29 10:00",
        "duration_minutes": 60,
        "has_recording": true
      }
    ]
  }
}
```

### 3.3 错误码

| HTTP 状态码 | code | 场景 |
|-------------|------|------|
| 400 | 1001 | 缺少 `phone` 参数 |
| 400 | 1002 | `phone` 格式非法 |
| 400 | 1003 | `time_from` 或 `time_to` 格式错误 |
| 400 | 1004 | 缺少 `time_to`（time_from 未成对） |
| 400 | 1005 | `time_to` 早于 `time_from` |
| 401 | 2001 | 缺少 Authorization 头 |
| 401 | 2002 | API Key 无效 |
| 404 | 3001 | 手机号未匹配到飞书用户 |
| 502 | 4001 | 飞书 CLI 调用失败 |
| 504 | 4002 | 飞书 CLI 调用超时 |
| 500 | 9999 | 服务内部错误 |

---

## 4. 安全设计

### 4.1 API Key 管理

- Key 存储在服务端环境变量或配置文件中，不硬编码
- 支持配置多个有效 Key，用逗号分隔：`API_KEYS=key1,key2,key3`
- Key 由运维手动生成（建议使用 `uuidgen` 或 `openssl rand -hex 32`），分发给调用方
- Key 通过安全渠道（1Password、加密消息等）传达
- 不记录 Key 明文日志，日志中脱敏显示（仅保留前4位）

### 4.2 传输安全

- 强制 HTTPS，云服务器配置 TLS 证书（Let's Encrypt 或云厂商托管证书）
- 不支持 HTTP 明文传输

### 4.3 速率限制

- 同一 API Key 每分钟最多 30 次请求
- 超过限制返回 `429 Too Many Requests`
- 可按需配置

### 4.4 日志与审计

- 记录每次请求：时间戳、请求方 IP、脱敏 Key、查询 phone（脱敏）、响应状态码
- 不记录飞书用户数据详情
- 日志保留 30 天

---

## 5. 错误处理策略

| 场景 | 处理方式 |
|------|----------|
| CLI 进程启动失败 | 返回 502，message 说明飞书服务暂不可用 |
| CLI 某命令超时（30s） | kill 进程，返回 504，不阻塞其他命令 |
| CLI 返回非 JSON | 返回 502，记录原始输出到日志供排查 |
| CLI 返回空结果 | 正常返回，对应字段为空数组 `[]` |
| 部分 CLI 命令失败 | 不阻断整体；成功部分正常返回，失败字段置 `null` |
| 全部 CLI 命令失败 | 返回 502 |
| 手机号查无结果 | 返回 404，message 说明未匹配到用户 |
| 飞书 token 过期 | CLI 自动刷新，服务无感知 |

---

## 6. 部署方案

### 6.1 环境要求

| 项目 | 要求 |
|------|------|
| 操作系统 | Linux (Ubuntu 20.04+ / Debian / CentOS 7+) |
| Node.js | >= 18 LTS |
| npm | >= 9 |
| 飞书 CLI | `@larksuite/cli` 最新版（全局安装） |
| 飞书应用 | 已在飞书开放平台创建自建应用，具备必要权限 |

### 6.2 飞书应用所需权限

| 权限 Key | 用途 |
|----------|------|
| `contact:user.id:readonly` | 通过手机号获取用户 ID |
| `contact:user.base:readonly` | 获取用户基本信息 |
| `calendar:calendar.readonly` | 读取日程信息 |
| `vc:meeting.readonly` | 读取会议记录 |

### 6.3 部署步骤

```bash
# 1. 安装飞书 CLI 并配置
npm install -g @larksuite/cli
lark-cli config init   # 按提示输入 App ID / App Secret

# 2. 克隆服务代码
git clone <repo-url> /opt/feishu-lookup
cd /opt/feishu-lookup

# 3. 安装依赖
npm ci

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env: PORT=3000, API_KEYS=xxx, ...

# 5. 构建 & 启动
npm run build
npm run start        # PM2: pm2 start dist/index.js --name feishu-lookup
```

### 6.4 Docker 部署（推荐）

```dockerfile
FROM node:18-alpine
RUN npm install -g @larksuite/cli
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

启动前挂载 CLI 配置目录：
```bash
docker run -d \
  -p 3000:3000 \
  -v /etc/feishu-cli:/root/.feishu-cli \
  -e API_KEYS=xxx,yyy \
  --name feishu-lookup \
  feishu-lookup:latest
```

### 6.5 健康检查

```
GET /api/v1/health
→ 200 { "status": "ok", "uptime": 12345 }
```

---

## 7. 自动化测试

### 7.1 测试分层

| 层级 | 范围 | 工具 | 执行频率 |
|------|------|------|----------|
| 单元测试 | auth、参数校验、聚合逻辑 | Vitest + Mock | 每次 commit |
| 集成测试 | CLI 进程调用 | Vitest + Mock execFile | 每次 push |
| E2E 测试 | 真实飞书调用 | Vitest / 手动脚本 | 发版前 |

### 7.2 单元测试用例

| # | 用例 | 预期 |
|---|------|------|
| 1 | 无 Authorization 头 | 401, code=2001 |
| 2 | Authorization 头为空 | 401, code=2001 |
| 3 | 错误 API Key | 401, code=2002 |
| 4 | 正确 API Key | 通过，继续处理请求 |
| 5 | 多个配置 Key，任一均可 | 通过 |
| 6 | 缺少 phone 字段 | 400, code=1001 |
| 7 | phone 为空字符串 | 400, code=1002 |
| 8 | phone 为纯字母 | 400, code=1002 |
| 9 | time_from 格式错误 | 400, code=1003 |
| 10 | time_to 格式错误 | 400, code=1003 |
| 11 | 只有 time_from 无 time_to | 400, code=1004 |
| 12 | time_to 早于 time_from | 400, code=1005 |
| 13 | time_from == time_to | 400, code=1005 |
| 14 | 合法请求格式校验通过 | 200 |
| 15 | Mock CLI 返回有效 JSON | 聚合结果正确 |
| 16 | 某个 CLI 命令失败 | 对应字段 null，其余正常 |
| 17 | 全部 CLI 命令失败 | 502, code=4001 |
| 18 | 手机号查无此用户 | 404, code=3001 |

### 7.3 集成测试用例

| # | 用例 | 预期 |
|---|------|------|
| 1 | CLI 正常退出 | CLI 参数映射正确 |
| 2 | CLI 进程超时 (>30s) | kill 进程，返回 504 |
| 3 | CLI 返回非 JSON 内容 | 返回 502，记录原始输出 |
| 4 | CLI 返回空数组 | 正常返回，events 为空 |
| 5 | 验证 contact/calendar/vc 并行调用 | 三个命令都在规定时间内被调用 |

### 7.4 E2E 测试用例

| # | 用例 | 预期 |
|---|------|------|
| 1 | 真实手机号查用户 | 用户名、部门、邮箱正确 |
| 2 | 查今日日程摘要 | summary 非空 |
| 3 | 查指定时间段日程 | events 时间均在范围内 |
| 4 | 查会议记录 | 会议标题和日期正确 |
| 5 | 大陆号无 +86 前缀 | 自动补全 +86 正常查询 |
| 6 | 国际号带 + 前缀 | 保留格式正常查询 |
| 7 | 5 并发请求 | 全部正常返回，无数据窜乱 |

---

## 8. 项目结构

```
feishu-lookup/
├── src/
│   ├── index.ts              # 入口，Express 启动
│   ├── config.ts             # 配置读取（端口、API Keys 等）
│   ├── middleware/
│   │   ├── auth.ts           # API Key 校验中间件
│   │   └── rateLimit.ts      # 速率限制中间件
│   ├── routes/
│   │   ├── lookup.ts         # POST /api/v1/lookup
│   │   └── health.ts         # GET /api/v1/health
│   ├── services/
│   │   ├── cli.ts            # CLI 调用封装（execFile 统一入口）
│   │   ├── contact.ts        # 通讯录查询（手机号→用户ID→用户详情）
│   │   ├── calendar.ts       # 日程查询
│   │   ├── meeting.ts        # 会议查询
│   │   └── aggregator.ts     # 结果聚合
│   ├── types/
│   │   └── index.ts          # 类型定义
│   └── utils/
│       ├── validate.ts       # 参数校验
│       └── logger.ts         # 日志工具
├── tests/
│   ├── unit/
│   │   ├── auth.test.ts
│   │   ├── validate.test.ts
│   │   └── aggregator.test.ts
│   ├── integration/
│   │   └── cli.test.ts
│   └── e2e/
│       └── lookup.test.ts
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
└── README.md
```

---

## 9. 非功能需求

| 类别 | 要求 |
|------|------|
| 可用性 | 99.5% uptime（单机部署） |
| 响应时间 | P95 < 3s（含飞书 API 调用） |
| 并发 | 支持 10 QPS |
| 日志 | JSON 格式输出，支持 stdout 收集 |
| 内存 | 使用不超过 256MB |

---

## 10. Q&A

**Q: 方案一（真用 CLI）和方案二（SDK 直调）的核心差别？**

A: 方案一每个请求 spawn `lark-cli` 子进程执行命令；方案二用 `@larksuiteoapi/node-sdk` 直接调飞书 OpenAPI。我们选用方案一，因为用户希望充分利用 CLI 能力（快捷命令、智能默认值、自动 token 管理等），虽然每次请求有 ~100-300ms 的进程启动开销，但在 10 QPS 的并发目标下完全可接受。

**Q: CLI 本身的 token 过期怎么办？**

A: 飞书 CLI 内部自动管理 `tenant_access_token`（有效期 2 小时，提前续期），服务代码无需关心。

**Q: 为什么 Node.js 而不是其他语言？**

A: 飞书 CLI 是 npm 包，Node.js 生态集成最自然。CLI 通过 `child_process.execFile` 调用，任何语言都能做，但 Node 免去额外的运行时依赖。
