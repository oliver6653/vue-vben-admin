const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// 设置静态文件目录
const updateDir = '/tmp/electron-update-server/latest';
app.use(express.static(updateDir));

// 设置CORS头
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
  res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.header('Content-Type', 'text/plain charset=UTF-8');
    res.status(204).send();
    return;
  }
  next();
});

// 为.yml和.yaml文件设置正确的MIME类型
app.get(/.*\.yml$/, (req, res) => {
  const filePath = path.join(updateDir, path.basename(req.url));
  console.warn('请求YAML文件:', filePath);

  if (fs.existsSync(filePath)) {
    res.header('Content-Type', 'text/yaml; charset=utf-8');
    res.sendFile(filePath);
  } else {
    console.warn('文件不存在:', filePath);
    res.status(404).send('File not found');
  }
});

app.get(/.*\.yaml$/, (req, res) => {
  const filePath = path.join(updateDir, path.basename(req.url));
  console.warn('请求YAML文件:', filePath);

  if (fs.existsSync(filePath)) {
    res.header('Content-Type', 'text/yaml; charset=utf-8');
    res.sendFile(filePath);
  } else {
    console.warn('文件不存在:', filePath);
    res.status(404).send('File not found');
  }
});

// 为.json文件设置正确的MIME类型
app.get(/.*\.json$/, (req, res) => {
  const filePath = path.join(updateDir, path.basename(req.url));
  console.warn('请求JSON文件:', filePath);

  if (fs.existsSync(filePath)) {
    res.header('Content-Type', 'application/json; charset=utf-8');
    res.sendFile(filePath);
  } else {
    console.warn('文件不存在:', filePath);
    res.status(404).send('File not found');
  }
});

// 处理更新包文件
app.get(/.*\.zip$/, (req, res) => {
  const filePath = path.join(updateDir, path.basename(req.url));
  console.warn('请求更新包文件:', filePath);

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    console.warn('更新包文件不存在:', filePath);
    res.status(404).send('Update file not found');
  }
});

app.get(/.*\.dmg$/, (req, res) => {
  const filePath = path.join(updateDir, path.basename(req.url));
  console.warn('请求更新包文件:', filePath);

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    console.warn('更新包文件不存在:', filePath);
    res.status(404).send('Update file not found');
  }
});

app.get(/.*\.exe$/, (req, res) => {
  const filePath = path.join(updateDir, path.basename(req.url));
  console.warn('请求更新包文件:', filePath);

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    console.warn('更新包文件不存在:', filePath);
    res.status(404).send('Update file not found');
  }
});

const PORT = 8080;
app.listen(PORT, () => {
  console.warn(`Electron update server is running on port ${PORT}`);
  console.warn(`Serving files from: ${updateDir}`);

  // 检查目录是否存在
  if (fs.existsSync(updateDir)) {
    console.warn('目录中的文件:');
    const files = fs.readdirSync(updateDir);
    files.forEach(file => {
      console.warn('  -', file);
    });
  } else {
    console.warn('警告: 目录不存在', updateDir);
  }
});
