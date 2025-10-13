import { ChildProcess, execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { logger } from './logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 支持通过环境变量配置目录，如果未配置或目录不存在则使用默认方式
const DEFAULT_TMP_DIR = join(homedir(), '.vben', '.cache');
const TMP_DIR = process.env.BACKEND_MOCK_CACHE_DIR || DEFAULT_TMP_DIR;
const PROJECT_NAME = 'public-doc';

// 确保临时目录存在
function ensureTmpDirectory(): string {
  try {
    // 首先尝试使用配置的目录
    if (existsSync(TMP_DIR)) {
      return TMP_DIR;
    }

    // 如果目录不存在，尝试创建它
    if (!existsSync(TMP_DIR)) {
      mkdirSync(TMP_DIR, { recursive: true });
      return TMP_DIR;
    }
  } catch {
    // 如果配置的目录无法使用，回退到默认目录
    logger.warn(
      `Failed to use configured cache directory: ${TMP_DIR}, falling back to default: ${DEFAULT_TMP_DIR}`,
      'PythonApp',
    );
    if (!existsSync(DEFAULT_TMP_DIR)) {
      mkdirSync(DEFAULT_TMP_DIR, { recursive: true });
    }
    return DEFAULT_TMP_DIR;
  }

  return DEFAULT_TMP_DIR;
}

const actualTmpDir = ensureTmpDirectory();
const actualProjectPath = join(actualTmpDir, PROJECT_NAME);

// const REPO_URL = 'https://gitlab.livit.run/chain-patrol/dlis-moinitor';
const REPO_URL = 'git@gitee.com:justin007/public-doc.git'; // 改为SSH URL
const BRANCH = 'feature/main_sync'; // 空字符串表示使用默认分支

let pythonProcess: ChildProcess | null = null;
let isChecking = false;
let hasUpdated = false; // 标记是否有更新

export async function setupAndRunPythonAppAsync() {
  // 检查环境变量 PYTHON_ENABLE，如果设置为 false 或 0，则不启动 Python 应用
  const PYTHON_ENABLE = process.env.PYTHON_ENABLE?.toLowerCase();
  if (PYTHON_ENABLE === 'false' || PYTHON_ENABLE === '0') {
    logger.info(
      'PYTHON_ENABLE is set to false, skipping Python app setup.',
      'PythonApp',
    );
    return;
  }
  // 异步执行，不阻塞主线程
  setImmediate(() => {
    setupAndRunPythonApp();
  });
}

function setupAndRunPythonApp() {
  if (isChecking) {
    logger.info('Python app check is already in progress', 'PythonApp');
    return;
  }

  isChecking = true;

  try {
    // 克隆或更新仓库
    updateRepository();

    // 安装依赖
    installDependencies();

    // 启动 Python 应用
    startPythonApplication();
  } catch (error) {
    logger.error(
      `Error in setup and run Python app: ${error.message}`,
      'PythonApp',
    );
  } finally {
    isChecking = false;
  }
}

function updateRepository() {
  if (existsSync(actualProjectPath)) {
    logger.info('Checking for updates in existing repository...', 'PythonApp');
    try {
      // 先检查本地和远程提交记录
      const localCommit = execSync(
        `cd ${actualProjectPath} && git rev-parse HEAD`,
        {
          encoding: 'utf8',
        },
      ).trim();

      let remoteCommit;
      try {
        // 尝试获取远程提交记录
        execSync(`cd ${actualProjectPath} && git fetch`, { stdio: 'pipe' });
        remoteCommit = execSync(
          `cd ${actualProjectPath} && git rev-parse @{u}`,
          {
            encoding: 'utf8',
          },
        ).trim();
      } catch {
        logger.info('无法获取远程提交记录，使用本地记录继续', 'PythonApp');
        remoteCommit = localCommit;
      }

      logger.info(`本地提交记录: ${localCommit}`, 'PythonApp');
      logger.info(`远程提交记录: ${remoteCommit}`, 'PythonApp');

      // 检查本地是否有未提交的更改
      const hasLocalChanges = execSync(
        `cd ${actualProjectPath} && git status --porcelain`,
        { encoding: 'utf8' },
      ).trim();

      let shouldUpdate = false;

      if (localCommit !== remoteCommit) {
        logger.info('发现远程有更新，需要拉取最新代码', 'PythonApp');
        shouldUpdate = true;
      } else if (hasLocalChanges) {
        logger.info('本地存在未提交的更改', 'PythonApp');
      } else {
        logger.info('代码仓库已是最新版本', 'PythonApp');
      }

      // 如果需要更新或者有本地更改，则执行更新操作
      if (shouldUpdate) {
        logger.info('正在拉取最新更改...', 'PythonApp');
        execSync(`cd ${actualProjectPath} && git pull`, { stdio: 'inherit' });
        hasUpdated = true; // 标记已更新
      }

      // 检查 requirements.txt 是否有变更（仅在有更新时检查）
      if (shouldUpdate) {
        try {
          // 检查 requirements.txt 相对于上一个提交是否有变化
          const requirementsDiff = execSync(
            `cd ${actualProjectPath} && git diff HEAD@{1} HEAD --name-only | grep requirements.txt`,
            { encoding: 'utf8', stdio: 'pipe' },
          ).trim();

          if (requirementsDiff) {
            logger.info(
              '检测到 requirements.txt 有变更，标记需要重新安装依赖',
              'PythonApp',
            );
            // 创建一个标记文件，表示需要重新安装依赖
            execSync(`cd ${actualProjectPath} && touch .reinstall_deps`, {
              stdio: 'pipe',
            });
          }
        } catch {
          // grep 没有匹配结果时会返回非0退出码，这是正常情况
          logger.info('requirements.txt 无变更', 'PythonApp');
        }
      }
    } catch (error) {
      logger.error(`检查/更新仓库时出错: ${error.message}`, 'PythonApp');
      throw error;
    }
  } else {
    logger.info('Cloning repository...', 'PythonApp');
    try {
      // 如果没有指定分支，则使用默认分支
      if (BRANCH) {
        execSync(`git clone -b ${BRANCH} ${REPO_URL} ${actualProjectPath}`, {
          stdio: 'inherit',
        });
      } else {
        execSync(`git clone ${REPO_URL} ${actualProjectPath}`, {
          stdio: 'inherit',
        });
      }
      // 新克隆的仓库标记需要安装依赖
      execSync(`cd ${actualProjectPath} && touch .reinstall_deps`, {
        stdio: 'pipe',
      });
      hasUpdated = true; // 标记已更新
    } catch (error) {
      logger.error(`Failed to clone repository: ${error.message}`, 'PythonApp');
      throw error;
    }
  }
}

function installDependencies() {
  logger.info('Checking if dependencies need to be installed...', 'PythonApp');
  try {
    // 检查是否需要重新安装依赖
    const reinstallFlag = existsSync(
      join(actualProjectPath, '.reinstall_deps'),
    );

    if (reinstallFlag) {
      logger.info('发现依赖变更标记，正在安装/更新依赖...', 'PythonApp');
      execSync(
        `cd ${actualProjectPath} && pip3 install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple`,
        {
          stdio: 'inherit',
        },
      );
      // 安装完成后删除标记文件
      execSync(`cd ${actualProjectPath} && rm -f .reinstall_deps`, {
        stdio: 'pipe',
      });
    } else {
      logger.info('检查现有依赖是否完整...', 'PythonApp');
      // 检查是否所有必需的包都已经安装
      const missingPackages = [];

      // 读取 requirements.txt 文件
      const requirements = execSync(
        `cd ${actualProjectPath} && cat requirements.txt`,
        {
          encoding: 'utf8',
        },
      );

      const lines = requirements.split('\n');
      for (const line of lines) {
        // 跳过注释和空行
        if (line.startsWith('#') || line.trim() === '') {
          continue;
        }

        // 处理带版本号的包名
        const packageName = line.split(/[=<>!]/)[0].trim();

        if (packageName) {
          try {
            // 检查包是否已安装
            execSync(`pip3 show ${packageName}`, { stdio: 'pipe' });
          } catch {
            missingPackages.push(packageName);
          }
        }
      }

      if (missingPackages.length > 0) {
        logger.info(
          `发现缺失的依赖包: ${missingPackages.join(', ')}，正在安装...`,
          'PythonApp',
        );
        execSync(
          `cd ${actualProjectPath} && pip3 install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple`,
          {
            stdio: 'inherit',
          },
        );
      } else {
        logger.info('所有依赖包均已安装', 'PythonApp');
      }
    }
  } catch (error) {
    logger.error(`检查或安装依赖时出错: ${error.message}`, 'PythonApp');
    throw error;
  }
}

function startPythonApplication() {
  // 只有在有更新或应用未运行时才启动Python应用
  if (!hasUpdated && isPythonAppRunning()) {
    logger.info(
      'Python application is already running and no updates were detected.',
      'PythonApp',
    );
    return;
  }

  // 如果应用已经在运行，先停止它
  if (isPythonAppRunning()) {
    logger.info(
      'Stopping existing Python application to apply updates...',
      'PythonApp',
    );
    stopPythonApp();
    // 等待一段时间确保进程完全停止
    try {
      execSync('sleep 2', { stdio: 'pipe' });
    } catch {
      logger.info('Sleep interrupted, continuing...', 'PythonApp');
    }
  }

  logger.info(
    `Starting Python application... ${pythonProcess?.exitCode}`,
    'PythonApp',
  );

  try {
    pythonProcess = spawn('python3', ['app.py'], {
      cwd: actualProjectPath,
      stdio: ['ignore', 'pipe', 'pipe'], // 修改为不继承stdio，而是通过事件处理
    });

    // 处理Python应用的标准输出
    pythonProcess.stdout?.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        logger.info(message, 'PYTHON');
      }
    });

    // 处理Python应用的错误输出
    pythonProcess.stderr?.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        logger.error(message, 'PYTHON');
      }
    });

    pythonProcess.on('close', (code) => {
      logger.info(`Python application exited with code ${code}`, 'PythonApp');
      pythonProcess = null;
    });

    pythonProcess.on('error', (error) => {
      logger.error(
        `Failed to start Python application: ${error.message}`,
        'PythonApp',
      );
      pythonProcess = null;
    });

    // 重置更新标记
    hasUpdated = false;
  } catch (error) {
    logger.error(
      `Failed to start Python application: ${error.message}`,
      'PythonApp',
    );
    pythonProcess = null;
    throw error;
  }
}

/**
 * 检查Python应用是否正在运行
 * 通过多种方式判断进程状态，提高准确性
 */
function isPythonAppRunning(): boolean {
  // 如果没有进程引用，说明应用未运行
  if (!pythonProcess) {
    // 作为额外检查，查看端口是否被占用
    return isPortInUse(8890);
  }

  // 检查进程是否已被杀死
  if (pythonProcess.killed) {
    return false;
  }

  // 检查进程是否已退出
  if (pythonProcess.exitCode !== null) {
    return false;
  }

  // 使用系统命令进一步确认进程是否仍在运行
  try {
    if (pythonProcess.pid) {
      // 在 Unix/Linux/macOS 系统上使用 kill -0 检查进程是否存在
      execSync(`kill -0 ${pythonProcess.pid}`, { stdio: 'ignore' });
      return true;
    }
  } catch {
    // 如果命令执行失败，说明进程不存在
    return false;
  }

  // 如果进程存在但无法确认状态，默认返回true
  // 这样可以避免在不确定的情况下错误地重复启动进程
  return true;
}

/**
 * 检查指定端口是否被占用
 */
function isPortInUse(port: number): boolean {
  try {
    // 使用 lsof 命令检查端口是否被占用
    execSync(`lsof -i :${port}`, { stdio: 'pipe' });
    return true;
  } catch {
    // 如果命令执行失败（如没有找到进程），说明端口未被占用
    return false;
  }
}

export function stopPythonApp() {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }

  // 通过端口杀死进程作为备用方案
  try {
    // 查找并终止占用 8890 端口的进程
    const port = 8890;
    const cmd = `lsof -ti :${port} | xargs kill -9 2>/dev/null || true`;
    execSync(cmd, { stdio: 'pipe' });
    logger.info(`Terminated any processes on port ${port}`, 'PythonApp');
  } catch {
    logger.info(
      'No process was found on port 8890 or failed to terminate',
      'PythonApp',
    );
  }
}
