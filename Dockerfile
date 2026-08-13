# ---------- 阶段一：安装依赖 ----------
FROM node:22-alpine AS deps
WORKDIR /app
# 使用国内镜像加速
RUN npm config set registry https://registry.npmmirror.com
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 阶段二：构建 ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# 构建时无需 API Key（运行时读取）
RUN npm run build

# ---------- 阶段三：运行 ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# standalone 产物（无需 public 目录，本项目无静态资源）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 书籍数据目录（通过卷持久化）
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
