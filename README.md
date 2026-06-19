# 星幕短剧平台

一个可 Docker 部署的短剧平台全栈应用，包含用户前台和运营后台。前台支持短剧浏览、分类筛选、播放详情和收藏；后台支持数据看板、短剧管理、订单与用户查看。

## 核心特点

- 前后台一体化：同一套系统覆盖用户追剧和运营管理。
- 内容运营闭环：短剧列表、播放量、收入、订单和用户信息集中展示。
- 轻量部署：Node.js 原生服务，无需额外数据库，数据默认写入 `data/db.json`。
- Docker 持久化：`docker-compose.yml` 已配置数据卷，重启后数据不丢失。
- 响应式界面：适配桌面和移动端，前台偏内容消费，后台偏运营效率。

## 技术选型

- 前端：HTML、CSS、Vanilla JavaScript SPA
- 后端：Node.js 原生 HTTP Server
- 数据：JSON 文件存储
- 部署：Docker、Docker Compose

## 测试账号

| 角色 | 账号 | 密码 | 用途 |
| --- | --- | --- | --- |
| 管理员 | `admin` | `admin123` | 登录后台管理 |
| 普通用户 | `viewer` | `viewer123` | 前台收藏和观看 |

## 本地运行

```bash
npm start
```

访问：

- 前台：首页 `http://localhost:3000`
- 后台：点击顶部“后台管理”，使用管理员账号登录

## Docker 部署

```bash
docker compose up -d --build
```

访问 `http://localhost:3000`。

停止服务：

```bash
docker compose down
```

如需同时删除持久化数据卷：

```bash
docker compose down -v
```

## 简单测试

```bash
npm test
```
