import { logger } from './logger';
import { setupAndRunPythonAppAsync } from './python-app-manager';

let intervalId: NodeJS.Timeout | null = null;

export function startScheduler(intervalMinutes: number = 10) {
  if (intervalId) {
    logger.info('Scheduler is already running', 'Scheduler');
    return;
  }

  logger.info(
    `Starting scheduler with interval ${intervalMinutes} minutes`,
    'Scheduler',
  );

  // 立即执行一次
  setupAndRunPythonAppAsync();

  // 设置定时任务
  intervalId = setInterval(
    () => {
      setupAndRunPythonAppAsync();
    },
    intervalMinutes * 60 * 1000,
  );
}

export function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Scheduler stopped', 'Scheduler');
  }
}
