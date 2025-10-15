// 引入子进程模块用于启动backend-mock服务
import { ChildProcess, spawn } from 'node:child_process';
// 引入文件系统模块用于日志记录
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  MenuItem,
  shell,
} from 'electron';
// 引入 autoUpdater 模块
import { autoUpdater } from 'electron-updater';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, '../..');

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const VITE_DEVTOOLS = process.env.VITE_DEVTOOLS !== 'false'; // 默认为true，除非明确设置为false

// 创建日志目录和文件路径
const logDir = path.join(os.homedir(), '.vben', '.electron');
const logFile = path.join(logDir, 'app.log');

// 确保日志目录存在
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * 全局日志处理方法
 * @param level 日志级别
 * @param messages 日志消息
 */
function logMessage(level: string, ...messages: any[]) {
  // 使用本地时间并格式化为标准格式
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

  const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  const logEntry = `[${timestamp}] [${level}] ${messages.join(' ')}\n`;

  // 输出到控制台
  switch (level) {
    case 'ERROR': {
      console.error(...messages);
      break;
    }
    case 'WARN': {
      console.warn(...messages);
      break;
    }
    default: {
      console.warn(...messages);
    } // 按照项目规范，只使用 warn 和 error
  }

  // 写入日志文件
  try {
    fs.appendFileSync(logFile, logEntry);
  } catch (error) {
    // 如果写入失败，至少保证控制台能看到错误
    console.error('Failed to write to log file:', error);
  }
}

/**
 * 包装 console 方法以同时输出到文件
 */
const logger = {
  log: (...messages: any[]) => logMessage('INFO', ...messages),
  warn: (...messages: any[]) => logMessage('WARN', ...messages),
  error: (...messages: any[]) => logMessage('ERROR', ...messages),
};

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win: BrowserWindow | null = null;
// 添加backend-mock服务进程变量
let backendMockProcess: ChildProcess | null = null;
const preload = path.join(__dirname, '../preload/preload.mjs');
const indexHtml = path.join(RENDERER_DIST, 'index.html');

// 配置自动更新
autoUpdater.autoDownload = false; // 手动指定下载
autoUpdater.forceDevUpdateConfig = true; // 强制使用开发环境的更新配置
autoUpdater.autoInstallOnAppQuit = false; // 禁用退出时自动安装更新，改为手动安装

// 添加 macOS 特定配置，解决 bundle ID 问题
if (process.platform === 'darwin') {
  app.setAppUserModelId('pro.vben.playground');
}

// 更新状态消息
const statusMessage = {
  error: { status: -1, msg: '检测更新查询异常' },
  checking: { status: 0, msg: '正在检查应用程序更新' },
  updateAva: { status: 1, msg: '检测到新版本，正在下载,请稍后' },
  updateNotAva: { status: 2, msg: '您现在使用的版本为最新版本,无需更新!' },
  downloadSuccess: { status: 3, msg: '下载新版成功' },
};

// 启动backend-mock服务的函数
async function startBackendMock() {
  try {
    // 在生产环境中检查打包后的路径
    const isDev = !!VITE_DEV_SERVER_URL;
    
    // 使用三元表达式确定backend-mock路径
    const actualBackendMockPath = isDev
      ? path.join(process.env.APP_ROOT, '../apps/backend-mock')
      : path.join(process.resourcesPath, 'apps/backend-mock');

    logger.warn('Starting backend-mock server from:', actualBackendMockPath);

    // 检查目录是否存在
    if (!fs.existsSync(actualBackendMockPath)) {
      logger.error('Backend-mock directory not found:', actualBackendMockPath);
      return;
    }

    // 检查 .output 目录是否存在
    const outputDir = path.join(actualBackendMockPath, '.output');
    if (!fs.existsSync(outputDir)) {
      logger.error('Backend-mock .output directory not found:', outputDir);
      return;
    }

    // 检查 server 目录是否存在
    const serverDir = path.join(outputDir, 'server');
    if (!fs.existsSync(serverDir)) {
      logger.error('Backend-mock server directory not found:', serverDir);
      return;
    }

    // 直接使用node执行backend-mock的入口文件
    const entryPath = path.join(serverDir, 'index.mjs');

    // 检查入口文件是否存在
    if (!fs.existsSync(entryPath)) {
      logger.error('Backend-mock entry not found:', entryPath);
      logger.warn('Make sure to build backend-mock before running the app');

      // 列出server目录内容以便调试
      try {
        const files = fs.readdirSync(serverDir);
        logger.warn('Files in server directory:', files);
      } catch (readdirError) {
        logger.error('Error reading server directory:', readdirError);
      }

      return;
    }

    // 使用spawn启动backend-mock服务
    // 在生产环境中优先使用系统node命令而不是Electron可执行文件
    backendMockProcess = spawn('node', [entryPath], {
      cwd: actualBackendMockPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        HOST: '127.0.0.1', // 明确指定监听地址为IPv4本地地址
        PORT: '5320', // 指定端口
      },
    });

    // 监听stdout输出
    backendMockProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      logger.warn('[backend-mock]', output);

      // 检查服务是否启动成功
      if (
        output.includes('Listening') ||
        output.includes('Server started') ||
        output.includes('Local:')
      ) {
        logger.warn('Backend-mock server started successfully on port 5320');
      }
    });

    // 监听stderr输出
    backendMockProcess.stderr?.on('data', (data) => {
      logger.error('[backend-mock] Error:', data.toString());
    });

    // 监听进程关闭事件
    backendMockProcess.on('close', (code) => {
      logger.warn(`[backend-mock] Process exited with code ${code}`);
      backendMockProcess = null;
    });

    // 监听进程错误事件
    backendMockProcess.on('error', (error) => {
      logger.error('[backend-mock] Failed to start process:', error);
    });

    logger.warn(
      'Backend-mock process started with PID:',
      backendMockProcess.pid,
    );
  } catch (error) {
    logger.error('Failed to start backend-mock server:', error);
  }
}

// 关闭backend-mock服务的函数
async function stopBackendMock() {
  if (backendMockProcess) {
    try {
      logger.warn('Stopping backend-mock server...');
      backendMockProcess.kill('SIGTERM');

      // 等待一段时间让进程正常关闭
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 如果进程仍未关闭，强制杀死
      if (backendMockProcess.exitCode === null) {
        backendMockProcess.kill('SIGKILL');
      }

      backendMockProcess = null;
      logger.warn('Backend-mock server stopped');
    } catch (error) {
      logger.error('Error stopping backend-mock server:', error);
      throw error;
    }
  }
}

// 添加一个函数来测试backend-mock服务是否正常运行
async function testBackendMockService() {
  try {
    // 等待一段时间让服务启动
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const response = await fetch('http://localhost:5320/api');
    if (response.ok) {
      logger.warn('Backend-mock service is running properly');
    } else {
      logger.warn(
        'Backend-mock service responded with status:',
        response.status,
      );
    }
  } catch (error) {
    logger.error('Failed to connect to backend-mock service:', error);
  }
}

async function createWindow() {
  win = new BrowserWindow({
    autoHideMenuBar: true,
    frame: false,
    height: 900,
    icon: path.join(process.env.VITE_PUBLIC as string, 'favicon.ico'),
    movable: true,
    show: false,
    title: 'Main window',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload,
      webSecurity: true,
    },
    width: 1440,
  });

  // 监听窗口准备好显示的事件
  win.once('ready-to-show', () => {
    win?.maximize(); // 最大化窗口
    win?.show(); // 显示窗口
  });

  win.on('maximize', () => {
    win?.webContents.send('maximize-changed', true);
  });

  win.on('unmaximize', () => {
    win?.webContents.send('maximize-changed', false);
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(indexHtml);
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString());
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // 为开发环境添加上下文菜单
  if (VITE_DEVTOOLS) {
    win.webContents.on('context-menu', (_event, params) => {
      const { x, y } = params;
      const menu = new Menu();
      menu.append(new MenuItem({ label: '复制', role: 'copy' }));
      menu.append(new MenuItem({ label: '粘贴', role: 'paste' }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(
        new MenuItem({
          label: '检查元素',
          click: () => win?.webContents.inspectElement(x, y),
        }),
      );
      menu.popup();
    });
  }
  // win.webContents.on('will-navigate', (event, url) => { }) #344
}

// 自动更新事件处理
autoUpdater.on('error', (error) => {
  logger.warn('自动更新错误:', error);
  win?.webContents.send('uploadMessage', {
    payload: statusMessage.error,
    output: error.message || error.toString(),
  });
});

autoUpdater.on('checking-for-update', (v) => {
  logger.warn('检查中');
  win?.webContents.send('uploadMessage', {
    payload: statusMessage.checking,
    output: v,
  });
});

autoUpdater.on('update-available', (info) => {
  logger.warn('发现新版本', info);
  logger.warn('更新信息:', JSON.stringify(info, null, 2));
  win?.webContents.send('uploadMessage', {
    payload: statusMessage.updateAva,
    output: info,
  });
});

autoUpdater.on('update-not-available', (info) => {
  logger.warn('当前版本为最新版本');
  win?.webContents.send('uploadMessage', {
    payload: statusMessage.updateNotAva,
    output: info,
  });
});

// 更新下载进度事件
autoUpdater.on('download-progress', (progress) => {
  logger.warn('下载进度:', progress);
  win?.webContents.send('downloadProgress', progress);
});

// 当下载完更新包后触发
autoUpdater.on('update-downloaded', (info) => {
  logger.warn('更新下载完成:', info);
  shell.openPath(info.downloadedFile);
  win?.webContents.send('uploadMessage', {
    payload: statusMessage.downloadSuccess,
    output: info,
  });
  // 注意：这里不自动安装更新，等待用户点击安装按钮
});

// 退出并安装更新
ipcMain.on('quitAndInstall', () => {
  logger.warn('准备退出并安装更新...');
  try {
    // 先解除所有窗口的关闭监听，避免更新时出现确认对话框
    if (win) {
      win.removeAllListeners('close');
    }
    // 确保在 quitAndInstall 之前设置正确的参数
    autoUpdater.quitAndInstall(false, true); // isSilent=false, isForceRunAfter=true
  } catch (error) {
    logger.error('安装更新失败:', error);
    win?.webContents.send('uploadMessage', {
      payload: {
        status: -1,
        msg: `安装更新失败: ${error.message || error.toString()}`,
      },
      output: error.message || error.toString(),
    });
  }
});

// 开始检查更新
ipcMain.on('checkForUpdates', () => {
  try {
    logger.warn('开始检查更新...');
    // 设置更新地址
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: 'http://localhost:5320/api/update',
    });
    logger.warn('设置更新地址: http://localhost:5320/api/update');
    autoUpdater.checkForUpdates();
  } catch (error) {
    logger.error('检查更新失败:', error);
    win?.webContents.send('uploadMessage', {
      payload: {
        status: -1,
        msg: `检查更新失败: ${error.message || error.toString()}`,
      },
      output: error.message || error.toString(),
    });
  }
});

// 开始下载更新
ipcMain.on('downLoadUpdate', () => {
  logger.warn('开始下载更新...');
  // 使用 .then() 处理 Promise，而不是 .catch()，避免 download-progress 和 update-downloaded 事件无法触发
  autoUpdater
    .downloadUpdate()
    .then(() => {
      logger.warn('下载更新成功');
    })
    .catch((error) => {
      logger.error('下载更新失败:', error);
      win?.webContents.send('uploadMessage', {
        payload: {
          status: -1,
          msg: `下载更新失败: ${error.message || error.toString()}`,
        },
        output: error.message || error.toString(),
      });
    });
});

app
  .whenReady()
  .then(createWindow)
  .then(async () => {
    // 启动backend-mock服务
    await startBackendMock();

    // 延迟测试backend-mock服务
    setTimeout(() => {
      testBackendMockService();
    }, 3000);

    // 在开发环境中添加开发专用菜单
    if (VITE_DEVTOOLS) {
      const devMenu = Menu.buildFromTemplate([
        {
          label: '开发工具',
          submenu: [
            {
              label: '切换开发者工具',
              accelerator: 'CmdOrCtrl+Shift+I',
              click: () => {
                BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools();
              },
            },
            {
              label: '刷新',
              accelerator: 'CmdOrCtrl+R',
              click: () => {
                BrowserWindow.getFocusedWindow()?.webContents.reload();
              },
            },
            {
              label: '强制刷新',
              accelerator: 'CmdOrCtrl+Shift+R',
              click: () => {
                BrowserWindow.getFocusedWindow()?.webContents.reloadIgnoringCache();
              },
            },
            { type: 'separator' },
            {
              label: '退出',
              accelerator: 'CmdOrCtrl+Q',
              click: () => {
                app.quit();
              },
            },
          ],
        },
      ]);
      Menu.setApplicationMenu(devMenu);
    } else {
      Menu.setApplicationMenu(null);
    }
    // 禁用了菜单之后，默认的快捷键也会被禁用，这里重新注册部分常用快捷键
    if (VITE_DEVTOOLS) {
      // 开发模式下监听快捷键来打开开发者工具
      globalShortcut.register('CmdOrCtrl+Shift+I', () => {
        BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools();
      });
    }
    // 监听快捷键来刷新页面
    globalShortcut.registerAll(['CmdOrCtrl+R', 'CmdOrCtrl+F5'], () => {
      BrowserWindow.getFocusedWindow()?.webContents.reload();
    });
    // 监听快捷键来强制刷新页面
    globalShortcut.registerAll(
      ['CmdOrCtrl+Shift+R', 'CmdOrCtrl+Shift+F5'],
      () => {
        BrowserWindow.getFocusedWindow()?.webContents.reloadIgnoringCache();
      },
    );
  });

app.on('window-all-closed', () => {
  win = null;
  if (process.platform !== 'darwin') {
    // 应用退出前关闭backend-mock服务
    stopBackendMock().then(() => {
      app.quit();
    });
  }
});

app.on('before-quit', async (event) => {
  // 阻止默认行为，等待backend-mock服务关闭
  event.preventDefault();

  try {
    // 确保关闭backend-mock服务
    await stopBackendMock();
  } catch (error) {
    logger.error('Error stopping backend-mock server:', error);
  } finally {
    // 强制退出应用
    app.exit(0);
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length > 0) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: true,
      preload,
      webviewTag: true,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`);
  } else {
    childWindow.loadFile(indexHtml, { hash: arg });
  }
});

ipcMain.handle('app-minimize', (event) => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  if (browserWindow) {
    browserWindow.minimize();
  }
});

ipcMain.handle('app-maximize', (event) => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  if (browserWindow) {
    if (browserWindow.isMaximized()) {
      browserWindow.restore();
    } else {
      browserWindow.maximize();
    }
  }
});

ipcMain.handle('app-close', (event) => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  if (browserWindow) {
    browserWindow.close();
  }
});

ipcMain.handle('is-maximized', (event) => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  if (browserWindow) {
    return browserWindow.isMaximized();
  }
  return false;
});
