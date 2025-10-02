# @vben/backend-mock

## Description

Vben Admin 数据 mock 服务，没有对接任何的数据库，所有数据都是模拟的，用于前端开发时提供数据支持。线上环境不再提供 mock 集成，可自行部署服务或者对接真实数据，由于 `mock.js` 等工具有一些限制，比如上传文件不行、无法模拟复杂的逻辑等，所以这里使用了真实的后端服务来实现。唯一麻烦的是本地需要同时启动后端服务和前端服务，但是这样可以更好的模拟真实环境。该服务不需要手动启动，已经集成在 vite 插件内，随应用一起启用。

## Running the app

```bash
# development
$ pnpm run start

# production mode
$ pnpm run build

pnpm --filter @vben/backend-mock run start
```

# 实现的功能

1. 下载远程 Git 仓库：

- 将远程仓库 https://gitlab.livit.run/chain-patrol/dlis-moinitor 克隆到同级目录 .tmp 下
- 如果仓库已存在，则检查更新并拉取最新代码

2. 安装依赖：

- 使用 pip install -r requirements.txt 安装 Python 依赖

3. 启动 Python 应用：

- 启动 Python 应用程序（假设入口文件为 app.py）
- 检查应用是否已在运行，避免重复启动

4. 定时任务触发：
   - 每 10 分钟自动检查一次仓库更新
   - 如果有更新则自动拉取并重新安装依赖
5. 异步线程触发：
   - 所有操作都在异步线程中执行，不会阻塞主线程
   - 提供手动触发 API 端点 /api/python-app/trigger

## 创建的文件

1. utils/python-app-manager.ts - 管理 Git 仓库和 Python 应用的核心功能
2. utils/scheduler.ts - 定时任务管理器
3. api/python-app/trigger.post.ts - 手动触发 API 端点
4. 修改了 middleware/1.api.ts - 在应用启动时初始化定时任务
