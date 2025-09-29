// server/api/proxy/[...].ts
export default defineEventHandler(async (event) => {
  // 获取原始请求的路径和查询参数
  const targetPath = event.path.replace('/api/proxy/', '');
  const queryString = getQuery(event);

  // 目标服务器的基础 URL
  const targetBaseUrl = 'http://localhost:8889';

  // 构建目标 URL
  const targetUrl = `${targetBaseUrl}/${targetPath}${
    queryString
      ? `?${new URLSearchParams(queryString as Record<string, string>).toString()}`
      : ''
  }`;

  try {
    // 获取原始请求头
    const headers = getHeaders(event);

    // 处理请求体
    let body;
    if (event.method !== 'GET' && event.method !== 'HEAD') {
      const contentType = headers['content-type'] || '';
      body = contentType.includes('application/json')
        ? await readBody(event) // 自动解析 JSON
        : await readRawBody(event); // 其他格式保持原始数据
    }

    // 转发请求
    const response = await $fetch(targetUrl, {
      method: event.method,
      headers: {
        'Content-Type': headers['content-type'] || 'application/json',
        Accept: headers.accept || 'application/json',
        // 可以添加其他需要的请求头
      },
      body,
    });

    return response;
  } catch (error: any) {
    console.error('Proxy error:', error);

    // 改进的错误处理
    const statusCode = error.response?.status || 500;
    const statusMessage = error.response?.statusText || 'Internal Server Error';

    throw createError({
      statusCode,
      statusMessage,
      data: error.response?.data,
    });
  }
});
