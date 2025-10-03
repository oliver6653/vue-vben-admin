#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 创建更新目录
const updateDir = '/tmp/electron-update-server/latest';
if (!fs.existsSync(updateDir)) {
  fs.mkdirSync(updateDir, { recursive: true });
  console.warn(`创建目录: ${updateDir}`);
}

// 生成示例 latest.yml 文件
const latestYml = `
version: 1.0.1
files:
  - url: VbenAdminPlayground-v1.0.1-darwin-arm64.zip
    sha512: "sha512-hash-here"
    size: 123456789
path: VbenAdminPlayground-v1.0.1-darwin-arm64.zip
sha512: "sha512-hash-here"
releaseDate: "${new Date().toISOString()}"
`;

const ymlPath = path.join(updateDir, 'latest.yml');
fs.writeFileSync(ymlPath, latestYml.trim());
console.warn(`创建文件: ${ymlPath}`);

// 生成示例更新包文件（仅用于测试）
const zipPath = path.join(updateDir, 'VbenAdminPlayground-v1.0.1-darwin-arm64.zip');
if (!fs.existsSync(zipPath)) {
  fs.writeFileSync(zipPath, 'This is a sample update file for testing purposes.');
  console.warn(`创建示例更新包: ${zipPath}`);
}

console.warn('更新文件创建完成！');
console.warn('请确保在 Electron 应用中正确配置了更新地址。');
