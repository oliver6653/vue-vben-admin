import { ChildProcess, execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TMP_DIR = join(__dirname, '../../.tmp');
// const REPO_URL = 'https://gitlab.livit.run/chain-patrol/dlis-moinitor';
const REPO_URL = 'https://gitee.com/justin007/public-doc.git';
const BRANCH = 'feature/main_sync'; // 空字符串表示使用默认分支
const PROJECT_NAME = 'public-doc';
const PROJECT_PATH = join(TMP_DIR, PROJECT_NAME);

let pythonProcess: ChildProcess | null = null;
let isChecking = false;
let hasUpdated = false; // 标记是否有更新

export async function setupAndRunPythonAppAsync() {
  // 异步执行，不阻塞主线程
  setImmediate(() => {
    setupAndRunPythonApp();
  });
}

function setupAndRunPythonApp() {
  if (isChecking) {
    console.log('Python app check is already in progress');
    return;
  }

  isChecking = true;

  try {
    // 创建 .tmp 目录（如果不存在）
    if (!existsSync(TMP_DIR)) {
      mkdirSync(TMP_DIR, { recursive: true });
    }

    // 克隆或更新仓库
    updateRepository();

    // 安装依赖
    installDependencies();

    // 启动 Python 应用
    startPythonApplication();
  } catch (error) {
    console.error('Error in setup and run Python app:', error.message);
  } finally {
    isChecking = false;
  }
}

function updateRepository() {
  if (existsSync(PROJECT_PATH)) {
    console.log('Checking for updates in existing repository...');
    try {
      // 先检查本地和远程提交记录
      const localCommit = execSync(`cd ${PROJECT_PATH} && git rev-parse HEAD`, {
        encoding: 'utf8',
      }).trim();

      let remoteCommit;
      try {
        // 尝试获取远程提交记录
        execSync(`cd ${PROJECT_PATH} && git fetch`, { stdio: 'pipe' });
        remoteCommit = execSync(`cd ${PROJECT_PATH} && git rev-parse @{u}`, {
          encoding: 'utf8',
        }).trim();
      } catch {
        console.log('无法获取远程提交记录，使用本地记录继续');
        remoteCommit = localCommit;
      }

      console.log(`本地提交记录: ${localCommit}`);
      console.log(`远程提交记录: ${remoteCommit}`);

      // 检查本地是否有未提交的更改
      const hasLocalChanges = execSync(
        `cd ${PROJECT_PATH} && git status --porcelain`,
        { encoding: 'utf8' },
      ).trim();

      let shouldUpdate = false;

      if (localCommit !== remoteCommit) {
        console.log('发现远程有更新，需要拉取最新代码');
        shouldUpdate = true;
      } else if (hasLocalChanges) {
        console.log('本地存在未提交的更改');
      } else {
        console.log('代码仓库已是最新版本');
      }

      // 如果需要更新或者有本地更改，则执行更新操作
      if (shouldUpdate) {
        console.log('正在拉取最新更改...');
        execSync(`cd ${PROJECT_PATH} && git pull`, { stdio: 'inherit' });
        hasUpdated = true; // 标记已更新
      }

      // 检查 requirements.txt 是否有变更（仅在有更新时检查）
      if (shouldUpdate) {
        try {
          // 检查 requirements.txt 相对于上一个提交是否有变化
          const requirementsDiff = execSync(
            `cd ${PROJECT_PATH} && git diff HEAD@{1} HEAD --name-only | grep requirements.txt`,
            { encoding: 'utf8', stdio: 'pipe' },
          ).trim();

          if (requirementsDiff) {
            console.log('检测到 requirements.txt 有变更，标记需要重新安装依赖');
            // 创建一个标记文件，表示需要重新安装依赖
            execSync(`cd ${PROJECT_PATH} && touch .reinstall_deps`, {
              stdio: 'pipe',
            });
          }
        } catch {
          // grep 没有匹配结果时会返回非0退出码，这是正常情况
          console.log('requirements.txt 无变更');
        }
      }
    } catch (error) {
      console.error('检查/更新仓库时出错:', error.message);
      throw error;
    }
  } else {
    console.log('Cloning repository...');
    try {
      // 如果没有指定分支，则使用默认分支
      if (BRANCH) {
        execSync(`git clone -b ${BRANCH} ${REPO_URL} ${PROJECT_PATH}`, {
          stdio: 'inherit',
        });
      } else {
        execSync(`git clone ${REPO_URL} ${PROJECT_PATH}`, { stdio: 'inherit' });
      }
      // 新克隆的仓库标记需要安装依赖
      execSync(`cd ${PROJECT_PATH} && touch .reinstall_deps`, {
        stdio: 'pipe',
      });
      hasUpdated = true; // 标记已更新
    } catch (error) {
      console.error('Failed to clone repository:', error.message);
      throw error;
    }
  }
}

function installDependencies() {
  console.log('Checking if dependencies need to be installed...');
  try {
    // 检查是否需要重新安装依赖
    const reinstallFlag = existsSync(join(PROJECT_PATH, '.reinstall_deps'));

    if (reinstallFlag) {
      console.log('发现依赖变更标记，正在安装/更新依赖...');
      execSync(
        `cd ${PROJECT_PATH} && pip3 install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple`,
        {
          stdio: 'inherit',
        },
      );
      // 安装完成后删除标记文件
      execSync(`cd ${PROJECT_PATH} && rm -f .reinstall_deps`, {
        stdio: 'pipe',
      });
    } else {
      console.log('检查现有依赖是否完整...');
      // 检查是否所有必需的包都已经安装
      const missingPackages = [];

      // 读取 requirements.txt 文件
      const requirements = execSync(
        `cd ${PROJECT_PATH} && cat requirements.txt`,
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
        console.log(
          `发现缺失的依赖包: ${missingPackages.join(', ')}，正在安装...`,
        );
        execSync(
          `cd ${PROJECT_PATH} && pip3 install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple`,
          {
            stdio: 'inherit',
          },
        );
      } else {
        console.log('所有依赖包均已安装');
      }
    }
  } catch (error) {
    console.error('检查或安装依赖时出错:', error.message);
    throw error;
  }
}

function startPythonApplication() {
  // 只有在有更新或应用未运行时才启动Python应用
  if (!hasUpdated && isPythonAppRunning()) {
    console.log(
      'Python application is already running and no updates were detected.',
    );
    return;
  }

  // 如果应用已经在运行，先停止它
  if (isPythonAppRunning()) {
    console.log('Stopping existing Python application to apply updates...');
    stopPythonApp();
    // 等待一段时间确保进程完全停止
    try {
      execSync('sleep 2', { stdio: 'pipe' });
    } catch {
      console.log('Sleep interrupted, continuing...');
    }
  }

  console.log('Starting Python application...', pythonProcess?.exitCode);

  try {
    pythonProcess = spawn('python3', ['app.py'], {
      cwd: PROJECT_PATH,
      stdio: 'inherit',
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python application exited with code ${code}`);
      pythonProcess = null;
    });

    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python application:', error.message);
      pythonProcess = null;
    });

    // 重置更新标记
    hasUpdated = false;
  } catch (error) {
    console.error('Failed to start Python application:', error.message);
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
    console.log(`Terminated any processes on port ${port}`);
  } catch {
    console.log('No process was found on port 8890 or failed to terminate');
  }
}
