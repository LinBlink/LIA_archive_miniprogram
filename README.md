# 閾界档案馆 - 微信小程序

异常事件档案存储与检索系统

---

## 目录结构

```
yuejie-archive/
├── app.js              # 全局入口 + 请求封装
├── app.json            # 全局配置（tabBar、页面路由）
├── app.wxss            # 全局样式（设计 token）
├── utils/
│   └── util.js         # 工具函数（格式化、数据处理）
└── pages/
    ├── index/          # 首页：档案列表
    │   ├── index.wxml
    │   ├── index.wxss
    │   ├── index.js
    │   └── index.json
    ├── detail/         # 详情页：完整档案展示
    │   ├── detail.wxml
    │   ├── detail.wxss
    │   ├── detail.js
    │   └── detail.json
    ├── search/         # 检索页
    │   ├── search.wxml
    │   ├── search.wxss
    │   ├── search.js
    │   └── search.json
    └── profile/        # 个人中心
        ├── profile.wxml
        ├── profile.wxss
        ├── profile.js
        └── profile.json
```

---

## 设计系统

| Token       | 值         | 用途                |
|-------------|------------|---------------------|
| bg-primary  | `#0A0D0F`  | 页面底色            |
| bg-card     | `#0F1318`  | 卡片底色            |
| accent-red  | `#C8392B`  | 警示色、官方档案    |
| accent-green| `#4A7C6F`  | 系统状态、标签      |
| text-main   | `#E8DCC8`  | 主文字（泛黄纸张感）|
| text-muted  | `#6B7888`  | 次要文字            |
| border      | `#1F2832`  | 分割线              |

字体：`'Courier New', monospace`（系统/编号信息）+ 系统默认（正文）

---

## 需要对接的接口

### 1. 获取统计数据
```
GET /archives/stats
Response: { total: 0, ongoing: 0, closed: 0 }
```

### 2. 获取档案列表
```
GET /archives
Params: page, pageSize, status(0/1), type(0/1/2)
Response: { list: [...], total: 0 }
```

### 3. 获取档案详情
```
GET /archives/:id
Response: { ...tb_archive 全字段 }
```

### 4. 搜索档案
```
GET /archives/search
Params: keyword, page, pageSize
Response: { list: [...], total: 0 }
```

---

## 字段映射说明

```js
// tb_archive type 字段
0 → 民间档案（灰蓝色条）
1 → 官方档案（警示红色条）
2 → 第三方档案（警戒橙色条）

// tb_archive status 字段
0 → 更新中（红色脉冲动画）
1 → 已完结（静态灰色）

// characters / timelines / evidence / ref_links
// 后端存 JSON 字段，前端直接 JSON.parse 使用
// 建议后端统一返回 parsed 对象，而非 JSON 字符串
```

### characters 结构示例
```json
[
  { "id": 1, "name": "张某", "role": "证人", "desc": "说明", "color": "#C8392B" }
]
```

### timelines 结构示例
```json
[
  { "time": "2024-01-01 / 02:00", "event": "事件标题", "detail": "详情说明" }
]
```

### evidence 结构示例
```json
[
  { "title": "证据标题", "desc": "说明", "tags": ["标签1"], "credibility": "★★★" }
]
```

### ref_links 结构示例
```json
[
  { "title": "来源标题", "url": "https://..." }
]
```

---

## 开发步骤

1. 将整个目录导入微信开发者工具
2. 在 `app.js` 中将 `baseUrl` 替换为实际后端地址
3. 小程序管理后台配置合法域名
4. 准备 tabBar 所需的 6 张图标（`images/` 目录）
5. 若暂无后端，首页和详情页内置了 mock 数据，可直接预览效果
