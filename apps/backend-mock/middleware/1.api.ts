import { forbiddenResponse, sleep } from '~/utils/response';
import { startScheduler } from '~/utils/scheduler';

let schedulerStarted = false;

export default defineEventHandler(async (event) => {
  // 启动定时任务
  if (!schedulerStarted) {
    startScheduler(10); // 每10分钟检查一次
    schedulerStarted = true;
  }

  event.node.res.setHeader(
    'Access-Control-Allow-Origin',
    event.headers.get('Origin') ?? '*',
  );
  if (event.method === 'OPTIONS') {
    event.node.res.statusCode = 204;
    event.node.res.statusMessage = 'No Content.';
    return 'OK';
  } else if (
    ['DELETE', 'PATCH', 'POST', 'PUT'].includes(event.method) &&
    event.path.startsWith('/api/system/')
  ) {
    await sleep(Math.floor(Math.random() * 2000));
    return forbiddenResponse(event, '演示环境，禁止修改');
  }
});
