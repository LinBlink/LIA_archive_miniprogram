# 閾界档案室 — 后端接口文档

> **版本**: v0.8（以前端代码实际调用为准）
> **基础路径**: `http://localhost:10891`（`app.js` → `globalData.baseUrl`）
> **数据格式**: 所有请求/响应均为 JSON
> **鉴权**: `Authorization: Bearer <JWT>`（无 skipAuth 的请求均自动携带）

---

## 统一响应格式

```json
{
  "code":    200,
  "message": "ok",
  "data":    <payload>
}
```

`app.js` 的 `request` 封装将整个响应体透传给回调：

- `res.data` → 业务 payload（如列表、对象、字符串）
- `res.code` / `res.message` → 状态码和说明
- HTTP 200 / 201 均视为成功；401 自动跳转登录页；其他弹 toast

---

## 一、认证模块 `/auth`

### 1.1 手机号注册

```
POST /auth/user/register
```

**Request Body**
```json
{
  "phone":    "13800138000",
  "password": "任意字符，≥6位",
  "nick_name": "档案员昵称（可选，缺省'匿名调查员'）"
}
```

**Response `data`**: 任意字符串，如 `"注册成功"`

> 前端注册成功后自动调用 1.2 完成登录，无需手动跳转。

---

### 1.2 手机号登录

```
POST /auth/user/login
```

**Request Body**
```json
{
  "phone":    "13800138000",
  "password": "密码"
}
```

**Response `data`**: JWT 字符串（前端直接存储）

```json
"eyJhbGci..."
```

> 前端拿到 token 后立即调 `GET /user/auth/{phone}` 获取基础用户信息存缓存。

---

### 1.3 微信登录

```
POST /auth/user/wechat-login
```

**Request Body**
```json
{
  "code":      "021Abc000xxxxxx",
  "nick_name":  "档案员",
  "avatar_url": "https://thirdwx.qlogo.cn/...",
  "gender":    1
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| code | string | `wx.login()` 临时凭证，有效期 5 分钟 |
| nick_name | string | 微信昵称 |
| avatar_url | string | 微信头像 URL |
| gender | int | 0=未知 1=男 2=女 |

**Response `data`**
```json
{
  "token": "eyJhbGci...",
  "user": {
    "id":           42,
    "nick_name":     "档案员",
    "avatar_url":    "https://thirdwx.qlogo.cn/...",
    "level":        1,
    "archive_count": 0,
    "collect_count": 0,
    "total_views":   0
  }
}
```

前端解构 `res.data` 为 `{ token, user }`，`user` 直接存入 `globalData.userInfo`，结构需与 `GET /user/profile` 保持一致。**不要返回 `password` 和 `openid`。**

**后端处理逻辑**
1. 用 `code` 调微信 `GET https://api.weixin.qq.com/sns/jscode2session` 换取 `openid`
2. 以 `openid` 查 `tb_user`；不存在则创建（`phone` 可为空）
3. 生成 JWT，返回 `{token, user}`；`session_key` 仅后端使用，不下发

---

## 二、用户模块 `/user`

### 数据库表：`tb_user`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | 自增主键 |
| phone | VARCHAR(20) | 手机号，唯一，手机号用户非空 |
| openid | VARCHAR(64) | 微信 openid，唯一，微信用户非空 |
| nick_name | VARCHAR(100) | 昵称，默认 `匿名调查员` |
| avatar_url | TEXT | 头像 URL |
| gender | SMALLINT | 0=未知 1=男 2=女 |
| level | SMALLINT | 等级，默认 1 |
| archive_count | INT | 发布档案数 |
| collect_count | INT | 收藏档案数 |
| total_views | INT | 档案累计浏览量 |
| password | VARCHAR(255) | bcrypt 哈希，微信用户可为空 |
| created_at | TIMESTAMPTZ | 注册时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

**用户等级**

| level | 称号 |
|-------|------|
| 1 | 档案研究员 |
| 2 | 高级研究员 |
| 3 | 首席调查官 |
| 4 | 档案室长 |

---

### 2.1 获取认证用户基础信息

```
GET /user/auth/{phone}
Authorization: Bearer <token>
```

手机号登录后前端立即调用，获取基础用户信息存入缓存。

**Response `data`**
```json
{
  "id":       1,
  "phone":    "13800138000",
  "nick_name": "匿名调查员"
}
```

> 只需返回 `id`、`phone`、`nick_name`，**不要返回 `password` 和 `openid`**。完整资料（level、统计数字等）由 `/user/profile` 提供。

---

### 2.2 获取当前用户完整资料

```
GET /user/profile
Authorization: Bearer <token>
```

`profile.js` 在 `onShow` 时调用，用于刷新等级、统计等完整数据。

**Response `data`**
```json
{
  "id":           1,
  "phone":        "13800138000",
  "nick_name":     "档案员",
  "avatar_url":    "https://...",
  "level":        1,
  "archive_count": 3,
  "collect_count": 12,
  "total_views":   840
}
```

---

### 2.3 修改用户资料

```
PATCH /user/profile
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**（字段均可选，只更新传入的字段）
```json
{
  "nick_name": "新昵称"
}
```

**Validation**
- `nick_name`：非空，长度 1–20 字符

**Response `data`**: 更新后的完整用户对象（同 `GET /user/profile`）

> 从 JWT 中提取用户 id，禁止修改 `phone`、`open_id`、`level` 等敏感字段。

---

### 2.4 我的档案列表

```
GET /user/archives?page=1&pageSize=15
Authorization: Bearer <token>
```

只返回当前登录用户发布的档案（含私密档案）。

**Response `data`**
```json
{ "list": [ <Archive 对象> ], "total": 3 }
```

---

### 2.4 我的收藏列表

```
GET /user/collects?page=1&pageSize=15
Authorization: Bearer <token>
```

**Response `data`**
```json
{ "list": [ <Archive 对象> ], "total": 12 }
```

---

## 三、档案模块 `/archives`

### 字段编码约定

| 字段 | 类型 | 值 |
|------|------|----|
| type | int | 0=民间档案 1=官方档案 2=第三方档案 |
| status | int | 0=未结案 1=已结案 |
| lang | int | 0=中文 1=English |
| is_private | int | 0=公开 1=私密 |

> `util.js` 用整数键映射展示信息，**响应中请使用整数**，不使用字符串枚举。

---

### Archive 对象结构

`processArchive`（`util.js`）读取以下字段，时间字段同时兼容 `camelCase` 和 `snake_case`：

```json
{
  "id":           1,
  "title":        "广州某居民楼的集体失忆事件",
  "type":         0,
  "status":       0,
  "lang":         0,
  "is_private":   0,
  "content":      "## 事件概述\n\n...",
  "location_desc": "广东省广州市荔湾区",
  "view_count":   1024,
  "author_id":    42,
  "tags":         ["丢失失踪", "极低概率事件"],
  "occurred_at":  "2019-03-14T02:00:00+08:00",
  "closed_at":    null,
  "created_at":   "2023-01-01T00:00:00+08:00",
  "updated_at":   "2024-03-01T00:00:00+08:00",

  "characters": {
    "nodes": [
      { "id": "u1", "name": "张女士", "role": "主要证人", "description": "说明", "tags": [] }
    ],
    "edges": [
      {
        "source": "u1",
        "target": "u2",
        "base_relation": "同楼居民",
        "interactions": [
          { "action": "核实事件", "timestamp": null, "detail": "两人陈述高度吻合" }
        ]
      }
    ]
  },

  "timelines": [
    {
      "id":          "t1",
      "time_type":   "precise",
      "time_display": "2019-03-14 01:58",
      "timestamp":   null,
      "title":       "监控系统画面冻结",
      "content":     "楼栋全部监控摄像头同时停止记录",
      "importance":  "critical",
      "tags":        ["监控异常"]
    }
  ],

  "evidence": {
    "nodes": [
      {
        "id":          "e1",
        "name":        "监控时间戳异常截图",
        "type":        "video",
        "reliability": "high",
        "description": "显示冻结时间与恢复时间",
        "source":      "楼栋监控系统"
      }
    ],
    "edges": [
      {
        "source":        "e1",
        "target":        "e2",
        "relation_type": "corroborates",
        "description":   "监控冻结时段与居民失忆时段完全吻合"
      }
    ]
  },

  "ref_links": [
    { "title": "南方都市报相关报道", "url": "https://example.com/..." }
  ]
}
```

**字段说明**

| 字段 | 必填 | 说明 |
|------|------|------|
| `location_desc` | 否 | 蛇形命名，WXML 直接用此字段 |
| `view_count` | 是 | 蛇形命名，WXML 直接用此字段 |
| `tags` | 否 | 字符串数组；可为 null 或 `[]` |
| `characters` | 否 | `{nodes, edges}` 图结构，详见下表 |
| `timelines` | 否 | 对象数组，详见下表 |
| `evidence` | 否 | `{nodes, edges}` 图结构，详见下表 |
| `ref_links` | 否 | `[{title, url}]` |

**时间字段**：ISO 8601 字符串（`+08:00` 或 `Z` 均可），`util.js` 同时支持 `camelCase`（`occurredAt`）和 `snake_case`（`occurred_at`）。推荐返回 `snake_case` 与其他字段保持一致。

**`characters.nodes[]` 字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 节点 ID，如 `"u1"` |
| name | string | 姓名 / 化名 |
| role | string | 角色 / 身份 |
| description | string | 人物描述（可选）|
| tags | string[] | 标签（可为 `[]`）|

**`characters.edges[]` 字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| source | string | 来源节点 ID |
| target | string | 目标节点 ID |
| base_relation | string | 基础关系描述 |
| interactions | object[] | 交互记录，每条含 `action`、`detail`、`timestamp`（可为 null）|

**`timelines[]` 字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 节点 ID，如 `"t1"` |
| time_type | string | `"precise"` 或 `"fuzzy"` |
| time_display | string | 显示用时间文本 |
| timestamp | string\|null | ISO 时间戳（可为 null）|
| title | string | 事件标题 |
| content | string | 事件详情（可选）|
| importance | string | `"normal"` / `"high"` / `"critical"` |
| tags | string[] | 标签（可为 `[]`）|

**`evidence.nodes[]` 字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 节点 ID，如 `"e1"` |
| name | string | 证据名称 |
| type | string | `physical` / `documentary` / `testimonial` / `video` / `audio` |
| reliability | string | `"high"` / `"medium"` / `"low"` |
| description | string | 描述（可选）|
| source | string | 来源（可选）|

**`evidence.edges[]` 字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| source | string | 来源节点 ID |
| target | string | 目标节点 ID |
| relation_type | string | `corroborates` / `leads_to` / `derived_from` / `contradicts` / `supports` |
| description | string | 关联说明（可选）|

> **响应**：`characters`、`timelines`、`evidence`、`ref_links`、`tags` 直接返回对象/数组。前端 `detail.js` 的 `_parseJsonFields` 同时兼容 JSON 字符串格式（如后端以字符串存储则也可直接返回字符串，前端会自动解析）。

---

### 3.1 档案统计

```
GET /archives/stats
```

**Response `data`**
```json
{ "total": 142, "ongoing": 98, "closed": 44 }
```

---

### 3.2 档案列表（分页）

```
GET /archives
```

**Query Params**

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| page | int | 1 | 页码，从 1 开始 |
| pageSize | int | 10 | 每页条数 |
| status | int | - | 0=未结案 1=已结案 |
| type | int | - | 0=民间 1=官方 2=第三方 |
| lang | int | - | 0=中文 1=English（不传=全部）|
| sortBy | string | - | 排序字段 |
| isAsc | boolean | - | true=升序 |

> 只返回 `is_private=0` 的公开档案；默认按 `updated_at DESC` 排序。列表场景可以省略 `characters`/`timelines`/`evidence` 等富字段以减小响应体积。

**Response `data`**
```json
{ "list": [ <Archive 对象> ], "total": 142 }
```

---

### 3.3 档案详情

```
GET /archives/{id}
```

**Response `data`**: 完整 Archive 对象，**必须包含** `characters`、`timelines`、`evidence`、`ref_links`，以及 `author` 子对象（列表接口可省略以减小体积）。

`author` 子对象结构：

```json
"author": {
  "id":        42,
  "nick_name":  "档案员",
  "avatar_url": "https://thirdwx.qlogo.cn/...",
  "level":     2
}
```

> `author_id` 字段保留不变，`author` 仅为展示用冗余，**不要包含 `phone`、`openid`、`password`**。

---

### 3.4 编辑档案（仅作者）

```
PATCH /archives/{id}
Authorization: Bearer <token>
```

> 校验 `author_id === 当前用户 id`，否则返回 403。字段均为可选，只更新传入的字段。

**Request Body**（与 3.5 发布档案字段相同，但全部可选）

```json
{
  "title":        "更新后的标题",
  "content":      "## 事件概述\n\n更新后正文...",
  "type":         0,
  "status":       1,
  "lang":         0,
  "location_desc": "广东省广州市",
  "occurred_at":  "2024-01-01T14:30:00+08:00",
  "is_private":   0,
  "tags":         ["集体失忆"],
  "characters":   null,
  "timelines":    null,
  "ref_links":    null,
  "evidence":     null
}
```

**Response `data`**: 任意（前端不读取）

---

### 3.5 搜索档案

```
GET /archives/search
```

**Query Params**

| 参数 | 类型 | 说明 |
|------|------|------|
| keyword | string | 搜索关键词（必填）|
| page | int | 页码 |
| pageSize | int | 每页条数（前端传 20）|

> 搜索范围：`title`、`content`、`location_desc`。

**Response `data`**
```json
{ "list": [ <Archive 对象> ], "total": 5 }
```

---

### 3.5 发布档案

```
POST /archives
Authorization: Bearer <token>
```

**Request Body**（`create.js` `onSubmit` 实际发送）

```json
{
  "title":        "档案标题",
  "content":      "## 事件概述\n\n正文 Markdown 内容...",
  "type":         0,
  "lang":         0,
  "location_desc": "广东省广州市",
  "occurred_at":  "2024-01-01",
  "is_private":   0,

  "tags": ["丢失失踪", "极低概率事件"],

  "characters": {
    "nodes": [
      { "id": "u1", "name": "张女士", "role": "主要证人", "description": "说明", "tags": [] }
    ],
    "edges": [
      {
        "source": "u1", "target": "u2",
        "base_relation": "同楼居民",
        "interactions": [
          { "action": "核实事件", "timestamp": null, "detail": "两人陈述吻合" }
        ]
      }
    ]
  },

  "timelines": [
    {
      "id": "t1", "time_type": "precise", "time_display": "2019-03-14 01:58",
      "timestamp": null, "title": "监控画面冻结",
      "content": "全部摄像头同时停止记录",
      "importance": "critical", "related_characters": [], "tags": ["监控异常"]
    }
  ],

  "ref_links": [{ "title": "南方都市报相关报道", "url": "https://example.com/..." }],

  "evidence": {
    "nodes": [
      {
        "id": "e1", "name": "监控时间戳截图", "type": "video",
        "reliability": "high", "description": "说明", "source": "楼栋监控系统",
        "related_characters": [], "related_timelines": []
      }
    ],
    "edges": []
  }
}
```

**必填字段**：`title`、`content`
**可为 null**：`location_desc`、`occurred_at`、`tags`、`characters`、`timelines`、`ref_links`、`evidence`

> `author_id` 从 JWT 中提取，不由前端传递。
>
> 当 `characters` / `timelines` / `evidence` 均为 null 时，前端 UI 提示"系统会在后台 AI 生成仅一次"，后端可据此触发 AI 补全流程。

**Response `data`**: `{ "id": 143 }` 或成功消息字符串

---

### 3.6 删除档案（仅作者）

```
DELETE /archives/{id}
Authorization: Bearer <token>
```

> 校验 `author_id === 当前用户 id`，否则返回 403。

**Response `data`**: 任意（前端不读取）

---

### 3.7 收藏状态查询

```
GET /user/collects/{archiveId}/status
Authorization: Bearer <token>
```

**Response `data`**
```json
{ "collected": true }
```

---

### 3.8 收藏 / 取消收藏

```
POST   /user/collects/{archiveId}    → 收藏
DELETE /user/collects/{archiveId}    → 取消收藏
Authorization: Bearer <token>
```

**Response `data`**: 任意（前端不读取）

---

### 3.9 评论列表

```
GET /archives/{id}/comments?page=1&pageSize=10
```

**Response `data`**
```json
{
  "list": [
    {
      "id":        1,
      "content":   "评论内容...",
      "created_at": "2024-06-01T10:00:00+08:00",
      "user": {
        "id":        42,
        "nick_name":  "档案员",
        "avatar_url": "https://..."
      }
    }
  ],
  "total": 5
}
```

> 前端用 `c.createdAt || c.created_at` 取时间，两种命名均兼容。

---

### 3.10 发布评论

```
POST /archives/{id}/comments
Authorization: Bearer <token>
```

**Request Body**
```json
{ "content": "评论内容，1~500字" }
```

**Response `data`**: 任意（前端不读取）

---

### 3.11 举报档案

```
POST /archives/{id}/report
Authorization: Bearer <token>
```

**Request Body**
```json
{ "reason": "信息不实" }
```

`reason` 枚举：`信息不实` | `内容违规` | `重复档案` | `其他`

**Response `data`**: 任意（前端不读取）

---

### 3.12 记录浏览量

```
POST /archives/{id}/view
Authorization: Bearer <token>（可选）
```

用户打开档案详情页时前端自动调用。`app.request` 已在登录态下自动携带 Bearer token，后端按以下逻辑处理：

**后端处理逻辑**

1. 从 JWT 提取 `user_id`；未登录（无 token）时 `user_id = 0`
2. 向 `tb_user_archive_view` 插入一条浏览记录（同一用户重复打开同一档案会产生多条记录）
3. `UPDATE tb_archive SET view_count = view_count + 1 WHERE id = {id}`
4. `UPDATE tb_user SET total_views = total_views + 1 WHERE id = <archive 的 author_id>`

**数据库表：`tb_user_archive_view`**（用户微服务下）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 自增主键 |
| user_id | INT | 浏览者 id；未登录记为 0 |
| archive_id | INT | 被浏览的档案 id |
| viewed_at | TIMESTAMPTZ | 浏览时间 |

> `view_count` 语义为**总打开次数**（含同一用户的重复打开），非独立访客数。

**Response `data`**: 任意（前端不读取，静默失败）

---

## 四、媒体上传 `/upload`

### 4.1 上传图片

```
POST /upload/image
Content-Type: multipart/form-data
Authorization: Bearer <JWT>
```

**Form 字段**

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `image` | File | 图片文件（JPG / PNG / WEBP，≤ 10 MB）|

后端收到后上传至 Cloudflare R2，返回公网可访问 URL。

**Response `data`**
```
"https://r2.example.com/lia/2024/img_abc123.jpg"
```

> 前端通过 `wx.uploadFile`（非 `wx.request`）调用此接口，`res.data` 为原始字符串需手动 `JSON.parse`。

---

## 五、错误码

| HTTP | 含义 |
|------|------|
| 200 | 成功 |
| 201 | 创建成功（前端 `request` 同样视为成功）|
| 400 | 参数有误（缺必填字段、格式错误）|
| 401 | 未登录或 Token 过期（前端自动跳转登录页）|
| 403 | 无权限（如删除他人档案）|
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 附：接口速查表

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/auth/user/register` | 否 | 手机号注册 |
| POST | `/auth/user/login` | 否 | 手机号登录 → JWT |
| POST | `/auth/user/wechat-login` | 否 | 微信登录 → `{token, user}` |
| GET | `/user/auth/{phone}` | 是 | 登录后获取基础用户信息 |
| GET | `/user/profile` | 是 | 完整用户资料 |
| PATCH | `/user/profile` | 是 | 修改用户昵称 |
| GET | `/user/archives` | 是 | 我的档案列表 |
| GET | `/user/collects` | 是 | 我的收藏列表 |
| GET | `/user/collects/{id}/status` | 是 | 收藏状态查询 |
| POST | `/user/collects/{id}` | 是 | 收藏档案 |
| DELETE | `/user/collects/{id}` | 是 | 取消收藏 |
| GET | `/archives/stats` | 否 | 档案总数统计 |
| GET | `/archives` | 否 | 档案列表（分页+筛选）|
| GET | `/archives/search` | 否 | 全文搜索 |
| GET | `/archives/{id}` | 否 | 档案详情 |
| POST | `/archives` | 是 | 发布档案 |
| PATCH | `/archives/{id}` | 是 | 编辑档案（仅作者）|
| DELETE | `/archives/{id}` | 是 | 删除档案（仅作者）|
| GET | `/archives/{id}/comments` | 否 | 评论列表 |
| POST | `/archives/{id}/comments` | 是 | 发布评论 |
| POST | `/archives/{id}/report` | 是 | 举报档案 |
| POST | `/archives/{id}/view` | 否 | 记录浏览量（未登录 user_id=0）|
| POST | `/upload/image` | 是 | 上传图片 → R2 → 返回公网 URL |
