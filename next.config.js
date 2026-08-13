/** @type {import('next').NextConfig} */
const nextConfig = {
  // PDF 文件上传大小限制（50MB）
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

module.exports = nextConfig;
