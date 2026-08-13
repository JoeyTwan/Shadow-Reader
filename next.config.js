/** @type {import('next').NextConfig} */
const nextConfig = {
  // 书籍文件上传大小限制（200MB）
  experimental: {
    serverActions: {
      bodySizeLimit: '200mb',
    },
  },
};

module.exports = nextConfig;
