# 閾界档案室 — 微信小程序

异常事件档案平台。用户可浏览、投稿、收藏未经官方完整解释的异常事件档案。

**后端地址**: `http://localhost:10888`（`app.js` → `globalData.baseUrl`）
**API 文档**: `BACKEND_API.md`

---

## 页面结构

| 页面 | 路径 | Tab | 说明 |
|------|------|-----|------|
| 档案库 | `pages/index/index` | ✅ | 首页，档案列表 + 筛选 |
| 检索 | `pages/search/search` | ✅ | 全文搜索 |
| 我的 | `pages/profile/profile` | ✅ | 用户资料、设置、登出 |
| 档案详情 | `pages/detail/detail` | - | 收藏、评论、举报 |
| 登录 | `pages/login/login` | - | 手机号/微信 两种登录方式 |
| 发布档案 | `pages/create/create` | - | 需登录 |
| 我的档案 | `pages/my-archives/my-archives` | - | 需登录 |
| 我的收藏 | `pages/my-collects/my-collects` | - | 需登录 |

---

## 全局入口 `app.js`

### globalData

```js
{
  userInfo: null,      // 登录后的用户对象
  baseUrl: 'http://localhost:10888',
  token: '',           // JWT，存 wx.storage lia_token
  langFilter: -1,      // -1=全部, 0=中文, 1=English
}
```

### 核心方法

| 方法 | 说明 |
|------|------|
| `request(options)` | 全局请求封装，自动带 Bearer token，HTTP 非 200/201 时弹 toast，401 时跳登录页 |
| `phoneLogin(phone, password, cb)` | 手机号登录：POST `/auth/user/login` → 存 token → GET `/user/auth/{phone}` → 存 userInfo |
| `phoneRegister(phone, password, nickName, cb)` | 手机号注册：POST `/auth/user/register` → 自动调 `phoneLogin` |
| `wxLogin(cb)` | 微信登录：getUserProfile + wx.login → POST `/auth/wx-login` → 存 token+userInfo |
| `logout()` | 清空 globalData 和 wx.storage |
| `isLoggedIn()` | 返回 `!!(token && userInfo)` |
| `requireLogin()` | 未登录则跳转登录页并返回 false |
| `setLangFilter(lang)` | 保存语言偏好到 globalData + wx.storage |

### 请求回调约定

`app.request` 将整个响应体 `{code, message, data}` 传给 `success` 回调。因此：
- `res.data` → 业务 payload
- `res.code` / `res.message` → 状态码和消息

---

## 工具函数 `utils/util.js`

| 函数/常量 | 说明 |
|-----------|------|
| `processArchive(item)` | 档案对象标准化：归一化时间字段（兼容 snake_case 和 camelCase）、生成 `archiveNo`、`typeInfo`、`statusInfo`、`contentPreview` 等展示字段 |
| `normalizeArchive(item)` | 字段命名归一化（`occurred_at` → `occurredAt` 等） |
| `formatTime(dateStr)` | ISO 字符串 → `YYYY.MM.DD`（上海时区） |
| `ARCHIVE_TYPES` | `{0: {label, className, code}, 1: ..., 2: ...}` |
| `ARCHIVE_STATUS` | `{0: {label, className, dot}, 1: ...}` |
| `ARCHIVE_LANG` | `{0: '中', 1: 'EN'}` |
| `generateArchiveNo(id, occurredAt)` | 生成 `CASE-YYYY-00000001` 格式档案编号 |
| `truncate(str, len)` | 截断并加省略号 |

**待更新**：后端枚举字段已改为字符串（`FOLK`/`UPDATING`/`SCHINESE`/`PUBLIC`），映射表键值需同步更新。时间字段也从 ISO 字符串改为 OffsetDateTime 对象 `{dateTime, offset}`，`formatTime` 需提取 `.dateTime`。

---

## 认证流程

### 手机号（当前主要方式）

1. 用户在 `pages/login/login` 填写手机号 + 密码（≥6位，任意字符）
2. 登录：`app.phoneLogin` → POST `/auth/user/login` → 获取 JWT
3. 登录后拉取基础用户信息：GET `/user/auth/{phone}` → 存入 `globalData.userInfo`
4. `profile.js` 在 `onShow` 时额外调用 `/user/profile` 刷新完整资料（archiveCount / level 等）

### 微信

1. `app.wxLogin` 调用 `wx.getUserProfile` + `wx.login`
2. 向 `/auth/wx-login`（旧路径）发 code + 用户信息
3. 后端返回 `{token, user}` 对象

### 登录页 UI

- 默认展示**手机号 tab**，支持切换到**微信 tab**
- 手机号 tab 内可切换**登录 / 注册**模式
- 注册时可填可选昵称

---

## 设计系统

所有 CSS 变量定义在 `app.wxss` 的 `page {}` 块中。

| 类别 | 关键变量 |
|------|---------|
| 背景层级 | `--bg-base` `--bg-card` `--bg-elevated` `--bg-sunken` |
| 强调色 | `--accent-red` `--accent-green` `--accent-orange` |
| 文字层级 | `--text-primary` `--text-secondary` `--text-muted` `--text-ghost` `--text-phantom` |
| 边框 | `--border` `--border-faint` |
| 类型色 | `--folk-*` `--official-*` `--third-*` |
| 字体 | `--font-mono` (Courier New) `--font-ui` (系统字体) |

视觉风格：机密档案 / 调查局内部文件。深色背景，绿色系统状态，红色警示/主按钮。

通用类：`.page-container` `.archive-card` `.badge` `.badge-type-folk/official/third` `.badge-status-ongoing/closed` `.btn-primary` `.btn-outline` `.empty-state`

---

## 离线降级

`index.js` 和 `detail.js` 内置 mock 数据，当 `app.request` 失败时自动降级显示，适合无后端时开发调试。

---

## 已知问题 / 待对接

- `util.js` 枚举映射表（TYPES/STATUS/LANG）仍用整数键，后端返回字符串枚举后会 fallback 到默认值
- `util.js` `formatTime` 不处理 OffsetDateTime 对象，需提取 `.dateTime` 字段
- `/user/profile` 端点尚未在 OpenAPI 中收录
- `app.wxLogin` 使用旧路径 `/auth/wx-login`，与新规范路径 `/auth/user/wechat-login` 不同
