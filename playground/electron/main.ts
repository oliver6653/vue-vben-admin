import { readFileSync } from 'node:fs';
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
  if (VITE_DEV_SERVER_URL) {
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
  console.warn('自动更新错误:', error);
  win?.webContents.send('uploadMessage', {
    payload: statusMessage.error,
    output: error.message || error.toString(),
  });
});

autoUpdater.on('checking-for-update', (v) => {
  console.warn('检查中');
  win?.webContents.send('uploadMessage', {
    payload: statusMessage.checking,
    output: v,
  });
});

autoUpdater.on('update-available', (info) => {
  console.warn('发现新版本', info);
  console.warn('更新信息:', JSON.stringify(info, null, 2));
  win?.webContents.send('uploadMessage', {
    payload: statusMessage.updateAva,
    output: info,
  });
});

autoUpdater.on('update-not-available', (info) => {
  console.warn('当前版本为最新版本');
  win?.webContents.send('uploadMessage', {
    payload: statusMessage.updateNotAva,
    output: info,
  });
});

// 更新下载进度事件
autoUpdater.on('download-progress', (progress) => {
  console.warn('下载进度:', progress);
  win?.webContents.send('downloadProgress', progress);
});

// 当下载完更新包后触发
autoUpdater.on('update-downloaded', (info) => {
  console.warn('更新下载完成:', info);
  shell.openPath(info.downloadedFile);
  win?.webContents.send('uploadMessage', {
    payload: statusMessage.downloadSuccess,
    output: info,
  });
  // 注意：这里不自动安装更新，等待用户点击安装按钮
});

// 退出并安装更新
ipcMain.on('quitAndInstall', () => {
  console.warn('准备退出并安装更新...');
  try {
    // 先解除所有窗口的关闭监听，避免更新时出现确认对话框
    if (win) {
      win.removeAllListeners('close');
    }
    // 确保在 quitAndInstall 之前设置正确的参数
    autoUpdater.quitAndInstall(false, true); // isSilent=false, isForceRunAfter=true
  } catch (error) {
    console.error('安装更新失败:', error);
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
    console.warn('开始检查更新...');
    // 从 package.json 获取更新地址
    const packagePath = path.join(
      process.env.APP_ROOT as string,
      'package.json',
    );
    const packageData = readFileSync(packagePath, 'utf8');
    const packInfo = JSON.parse(packageData);
    const [publish] = packInfo.build.publish || [];

    console.warn('Publish config:', publish);

    if (publish && publish.url) {
      autoUpdater.setFeedURL(publish.url);
      console.warn('设置更新地址:', publish.url);
    } else {
      // 使用默认配置
      autoUpdater.setFeedURL('http://127.0.0.1:8080');
      console.warn('使用默认更新地址: http://127.0.0.1:8080');
    }

    autoUpdater.checkForUpdates();
  } catch (error) {
    console.error('检查更新失败:', error);
    // 使用默认配置
    autoUpdater.setFeedURL('http://127.0.0.1:8080');
    autoUpdater.checkForUpdates();

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
  console.warn('开始下载更新...');
  // 使用 .then() 处理 Promise，而不是 .catch()，避免 download-progress 和 update-downloaded 事件无法触发
  autoUpdater
    .downloadUpdate()
    .then(() => {
      console.warn('下载更新成功');
    })
    .catch((error) => {
      console.error('下载更新失败:', error);
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
  .then(() => {
    // 在开发环境中添加开发专用菜单
    if (VITE_DEV_SERVER_URL) {
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
    if (VITE_DEV_SERVER_URL) {
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
  if (process.platform !== 'darwin') app.quit();
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
