# 问题记录文档

## 问题 #1：PUT /api/admin/dramas/:id partial update 会清空未提交的 tags

- **发现时间**：2026-06-21
- **严重程度**：高（数据丢失）
- **影响范围**：所有调用 PUT /api/admin/dramas/:id 接口且未在 body 中包含 tags 字段的场景（如只更新 status 上下架、只修改 title 等）

### 现象

当调用 PUT 接口只更新部分字段（例如 `{ "status": "下架" }`）时，原短剧的 tags 字段会被清空为 `[]`，导致标签数据丢失。

### 根因分析

问题出在 [server/index.js](file:///c:/Users/guich/Desktop/title/JZH-7/server/index.js#L382-L401) 第 389 行原代码：

```javascript
db.dramas[index] = {
  ...db.dramas[index],
  ...body,
  rating: Number(body.rating ?? db.dramas[index].rating),
  episodes: Number(body.episodes ?? db.dramas[index].episodes),
  price: Number(body.price ?? db.dramas[index].price),
  views: Number(body.views ?? db.dramas[index].views),
  tags: Array.isArray(body.tags) ? body.tags : String(body.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean)
};
```

tags 字段的处理逻辑 **无条件执行**，没有判断 body 中是否实际提交了 tags：

1. 当 `body.tags` 为 `undefined`（未提交）时，`body.tags || ""` 求值为 `""`
2. `String("").split(",")` 得到 `[""]`
3. `.map(tag => tag.trim())` 仍为 `[""]`
4. `.filter(Boolean)` 过滤掉空字符串，得到 `[]`（空数组）
5. 原有 tags 被空数组覆盖

### 同类问题排查

其他字段也存在类似模式但表现不同：

| 字段 | 原逻辑 | 是否有问题 | 说明 |
|------|--------|-----------|------|
| rating | `Number(body.rating ?? original)` | 有条件保护 | `??` 使 undefined 时回退原值，但 body 为 `null`/`""` 时仍会被转成 0 |
| episodes | 同上 | 同上 | 同上 |
| price | 同上 | 同上 | 同上 |
| views | 同上 | 同上 | 同上 |
| **tags** | `Array.isArray(body.tags) ? ... : String(body.tags \|\| "")...` | **有问题** | 无判断，undefined 也会被处理成 `[]` |

根本问题：**字段更新逻辑与「只校验实际提交字段」的 partial update 语义不一致**。

### 修复方案

将更新逻辑重构为「显式判断字段存在性」的模式，与 `validateDramaUpdate` 的校验逻辑保持一致：

```javascript
const original = db.dramas[index];
const keys = Object.keys(body);
const updated = { ...original };

if (keys.includes("title")) updated.title = String(body.title);
if (keys.includes("genre")) updated.genre = String(body.genre);
if (keys.includes("status")) updated.status = String(body.status);
if (keys.includes("rating")) updated.rating = Number(body.rating);
if (keys.includes("episodes")) updated.episodes = Number(body.episodes);
if (keys.includes("price")) updated.price = Number(body.price);
if (keys.includes("views")) updated.views = Number(body.views);
if (keys.includes("cover")) updated.cover = String(body.cover);
if (keys.includes("synopsis")) updated.synopsis = String(body.synopsis);
if (keys.includes("tags")) {
  updated.tags = Array.isArray(body.tags)
    ? body.tags
    : String(body.tags).split(",").map((tag) => tag.trim()).filter(Boolean);
}

db.dramas[index] = updated;
```

### 修复后的行为保证

| 场景 | body 示例 | 修复前 | 修复后 |
|------|-----------|--------|--------|
| 空 body | `{}` | 无影响 | 无影响 |
| 只更新 status | `{ "status": "下架" }` | tags 被清空为 `[]` | tags 保持原值 |
| 只更新 title | `{ "title": "新标题" }` | tags 被清空为 `[]` | tags 保持原值 |
| 显式传空 tags | `{ "tags": "" }` | tags 为 `[]` | tags 为 `[]`（符合预期） |
| 更新多个字段 | `{ "rating": 8.0, "price": 19 }` | tags 被清空 | tags 保持原值 |

### 验证

- ✅ 9 个 partial update 单元测试全部通过
- ✅ 原有烟雾测试通过（`npm test`）
- ✅ 服务端代码语法检查通过（`node --check`）

---

## 问题 #2：新增与更新校验逻辑混用

- **发现时间**：2026-06-21
- **严重程度**：中（业务限制不一致）
- **影响范围**：PUT /api/admin/dramas/:id 接口

### 现象

更新接口使用与新增接口完全相同的校验函数 `validateDrama`，导致 partial update 时未提交的字段（如 title、cover）也被强制校验非空，无法只更新单一字段。

### 修复方案

拆分为两个独立校验函数：

- `validateDramaCreate(body)`：全量校验，title 和 cover 必填
- `validateDramaUpdate(body)`：只校验 body 中实际存在的字段，使用 `Object.keys(body)` + `keys.includes()` 判断

详见 [server/index.js](file:///c:/Users/guich/Desktop/title/JZH-7/server/index.js#L81-L179)。

---

## 问题 #3：数字字段空字符串隐式转换为 0

- **发现时间**：2026-06-21
- **严重程度**：低（已被校验层拦截，但语义不明确）
- **关联问题**：问题 #1

### 现象

原代码 `Number(body.rating ?? original.rating)` 在 body.rating 为 `""` 时，`??` 不会触发回退（因为空字符串不是 null/undefined），`Number("")` 得到 `0`，rating 会被意外设为 0。

### 修复方案

在 `validateDramaUpdate` 中对数字字段只要字段存在（包括空字符串）就做严格校验，空字符串直接报错，从源头拦截。同时更新逻辑改为显式判断字段存在性。
