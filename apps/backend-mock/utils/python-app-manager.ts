import { ChildProcess, execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TMP_DIR = join(__dirname, '../../.tmp');
const REPO_URL = 'https://gitlab.livit.run/chain-patrol/dlis-moinitor';
const BRANCH = ''; // 空字符串表示使用默认分支
const PROJECT_NAME = 'dlis-moinitor';
const PROJECT_PATH = join(TMP_DIR, PROJECT_NAME);

let pythonProcess: ChildProcess | null = null;
let isChecking = false;

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
      // 检查是否有更新
      execSync(`cd ${PROJECT_PATH} && git fetch`, { stdio: 'pipe' });
      const localCommit = execSync(`cd ${PROJECT_PATH} && git rev-parse HEAD`, {
        encoding: 'utf8',
      }).trim();
      const remoteCommit = execSync(
        `cd ${PROJECT_PATH} && git rev-parse @{u}`,
        { encoding: 'utf8' },
      ).trim();
      if (localCommit === remoteCommit) {
        console.log('Repository is up to date');
      } else {
        console.log('Updates found, pulling changes...');
        execSync(`cd ${PROJECT_PATH} && git pull`, { stdio: 'inherit' });
      }
    } catch (error) {
      console.error('Failed to check/update repository:', error.message);
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
    } catch (error) {
      console.error('Failed to clone repository:', error.message);
      throw error;
    }
  }
}

function installDependencies() {
  console.log('Installing dependencies...');
  try {
    execSync(`cd ${PROJECT_PATH} && pip install -r requirements.txt`, {
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('Failed to install dependencies:', error.message);
    throw error;
  }
}

function startPythonApplication() {
  // 如果应用已经在运行，则不重复启动
  if (isPythonAppRunning()) {
    console.log('Python application is already running.');
    return;
  }

  // 如果进程存在但已退出，清理引用
  if (pythonProcess && pythonProcess.exitCode !== null) {
    pythonProcess = null;
  }

  console.log('Starting Python application...');
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
  } catch (error) {
    console.error('Failed to start Python application:', error.message);
    pythonProcess = null;
    throw error;
  }
}

function isPythonAppRunning(): boolean {
  // 检查进程是否存在且正在运行
  return (
    pythonProcess !== null &&
    pythonProcess.exitCode === null &&
    !pythonProcess.killed
  );
}

export function stopPythonApp() {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
}
