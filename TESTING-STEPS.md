# Electron 自动更新测试步骤

## 准备工作

1. 确保已安装 Node.js 和 npm
2. 确保已安装 pnpm: `npm install -g pnpm`
3. 确保已安装 electron-builder: `npm install -g electron-builder`

## 测试步骤

### 第一步：构建初始版本

1. 修改 [/Users/gao/WebstormProjects/vue-vben-admin/playground/package.json](file:///Users/gao/WebstormProjects/vue-vben-admin/playground/package.json) 中的版本号为 "1.0.0"

   ```json
   {
     "version": "1.0.0"
   }
   ```

2. 构建 Electron 应用

   ```bash
   cd playground
   pnpm build
   ```

3. 安装应用（根据您的操作系统选择安装方式）
   - Windows: 运行 `dist-electron/release/` 目录下的 `.exe` 文件
   - macOS: 将应用拖拽到 Applications 文件夹
   - Linux: 根据生成的包类型进行安装

### 第二步：配置更新服务器

1. 将构建生成的文件复制到更新服务器目录

   ```bash
   # 创建更新服务器目录
   mkdir -p /tmp/electron-update-server/latest

   # 复制构建文件到服务器目录
   cp -r dist-electron/release/* /tmp/electron-update-server/latest/
   ```

2. 启动更新服务器（任选其一）：

   选项A：使用 Express 服务器

   ```bash
   # 安装 express
   npm install express

   # 启动服务器
   node update-server.js
   ```

   选项B：使用 Nginx 服务器

   ```bash
   # 将 nginx 配置文件复制到 nginx 配置目录
   # 注意：需要修改配置文件中的 root 路径
   sudo cp nginx-update-server.conf /etc/nginx/sites-available/electron-update

   # 创建软链接
   sudo ln -s /etc/nginx/sites-available/electron-update /etc/nginx/sites-enabled/

   # 重启 nginx
   sudo systemctl reload nginx
   ```

### 第三步：构建新版本

1. 修改 [/Users/gao/WebstormProjects/vue-vben-admin/playground/package.json](file:///Users/gao/WebstormProjects/vue-vben-admin/playground/package.json) 中的版本号为 "1.0.1"

   ```json
   {
     "version": "1.0.1"
   }
   ```

2. 修改应用中的一些内容，例如在某个页面添加一些文本，以区分版本

3. 重新构建应用

   ```bash
   pnpm build
   ```

4. 将新版本的构建文件复制到更新服务器目录

   ```bash
   # 备份旧版本
   mv /tmp/electron-update-server/latest /tmp/electron-update-server/1.0.0

   # 复制新版本
   mkdir -p /tmp/electron-update-server/latest
   cp -r dist-electron/release/* /tmp/electron-update-server/latest/
   ```

5. 在更新服务器目录中生成 latest.yml 文件（electron-builder 会在构建时自动生成）
   ```bash
   # 确保 latest.yml 文件存在于 /tmp/electron-update-server/latest/ 目录中
   ls /tmp/electron-update-server/latest/*.yml
   ```

### 第四步：测试自动更新

1. 启动之前安装的 1.0.0 版本应用

2. 应用启动后会自动检查更新，如果配置正确，您将看到：

   - "正在检查应用程序更新" 的消息
   - "检测到新版本，正在下载,请稍后" 的消息
   - 下载进度条显示下载进度
   - "下载新版成功" 的消息

3. 点击"重启并安装"按钮，应用将关闭并安装新版本

4. 应用重启后，检查版本号是否已更新为 1.0.1

## 故障排除

1. 如果更新失败，请检查：

   - 确保更新服务器已正确启动并可以访问
   - 检查网络连接是否正常
   - 检查 package.json 中的 publish.url 配置是否正确
   - 查看应用控制台输出的错误信息

2. 常见问题：
   - 跨域问题：确保更新服务器已正确设置 CORS 头
   - 路径问题：确保 latest.yml 文件和安装包在正确的路径下
   - 版本号问题：确保新版本号高于当前安装版本

## 注意事项

1. 在生产环境中，应使用 HTTPS 而不是 HTTP 来提供更新
2. 应确保更新服务器的稳定性和安全性
3. 可以使用 GitHub Releases、S3 或其他云存储服务作为更新服务器
