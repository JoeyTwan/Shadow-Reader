/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用 standalone 输出（Docker 部署用，大幅减小镜像体积）
  output: 'standalone',
  // 书籍文件上传大小限制（200MB）
  experimental: {
    serverActions: {
      bodySizeLimit: '200mb',
    },
  },
  // msedge-tts 使用 ws (WebSocket)，不能被 webpack 打包
  serverExternalPackages: ['msedge-tts'],
};

module.exports = nextConfig;
