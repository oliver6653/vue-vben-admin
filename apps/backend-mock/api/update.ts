import fs from 'node:fs';
import path from 'node:path';

import {
  defineEventHandler,
  getMethod,
  getRouterParam,
  setHeaders,
  setResponseStatus,
} from 'h3';
import { logger } from '~/utils/logger';

// 设置更新目录
const updateDir = '/tmp/electron-update-server/latest';

// 确保目录存在
if (!fs.existsSync(updateDir)) {
  try {
    fs.mkdirSync(updateDir, { recursive: true });
  } catch (error) {
    logger.warn(`Failed to create update directory: ${error}`, 'UpdateAPI');
  }
}

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const url = event.path;
  // 使用 getRouterParam 获取文件名参数
  const fileName = getRouterParam(event, 'filename') || path.basename(url);

  // 设置CORS头
  setHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type',
    'Access-Control-Allow-Methods': 'PUT,POST,GET,DELETE,OPTIONS',
  });

  // 处理预检请求
  if (method === 'OPTIONS') {
    setHeaders(event, {
      'Content-Type': 'text/plain; charset=UTF-8',
    });
    setResponseStatus(event, 204);
    return '';
  }

  // 处理不同类型的文件请求
  if (fileName.endsWith('.yml') || fileName.endsWith('.yaml')) {
    const filePath = path.join(updateDir, fileName);
    logger.warn(`请求YAML文件: ${filePath}`, 'UpdateAPI');

    if (fs.existsSync(filePath)) {
      setHeaders(event, {
        'Content-Type': 'text/yaml; charset=utf-8',
      });
      return fs.readFileSync(filePath, 'utf8');
    } else {
      logger.warn(`文件不存在: ${filePath}`, 'UpdateAPI');
      setResponseStatus(event, 404);
      return 'File not found';
    }
  }

  if (fileName.endsWith('.json')) {
    const filePath = path.join(updateDir, fileName);
    logger.warn(`请求JSON文件: ${filePath}`, 'UpdateAPI');

    if (fs.existsSync(filePath)) {
      setHeaders(event, {
        'Content-Type': 'application/json; charset=utf-8',
      });
      return fs.readFileSync(filePath, 'utf8');
    } else {
      logger.warn(`文件不存在: ${filePath}`, 'UpdateAPI');
      setResponseStatus(event, 404);
      return 'File not found';
    }
  }

  // 处理更新包文件
  if (
    fileName.endsWith('.zip') ||
    fileName.endsWith('.dmg') ||
    fileName.endsWith('.exe')
  ) {
    const filePath = path.join(updateDir, fileName);
    logger.warn(`请求更新包文件: ${filePath}`, 'UpdateAPI');

    if (fs.existsSync(filePath)) {
      // 对于文件下载，重定向到文件路径
      setHeaders(event, {
        'Content-Disposition': `attachment; filename="${fileName}"`,
      });
      return fs.readFileSync(filePath);
    } else {
      logger.warn(`更新包文件不存在: ${filePath}`, 'UpdateAPI');
      setResponseStatus(event, 404);
      return 'Update file not found';
    }
  }

  // 默认响应
  setHeaders(event, {
    'Content-Type': 'text/html; charset=utf-8',
  });

  // 检查目录中的文件
  let fileList = [];
  if (fs.existsSync(updateDir)) {
    fileList = fs.readdirSync(updateDir);
  }

  return `
    <h1>Electron Update Server</h1>
    <p>Serving files from: ${updateDir}</p>
    <h2>Available files:</h2>
    <ul>
      ${fileList.map((file) => `<li><a href="/api/update/${file}">${file}</a></li>`).join('')}
    </ul>
  `;
});
