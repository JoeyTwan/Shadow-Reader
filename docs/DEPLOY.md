# Shadow Reader 服务器操作指南

> 部署地址：**http://8.137.36.221:8080**
> 服务器：阿里云 Ubuntu 24.04（8.137.36.221，root）
> 部署方式：Docker Compose（与服务器上现有项目完全隔离，互不影响）

---

## 一、日常使用（手机 / 电脑）

1. 打开浏览器访问 **http://8.137.36.221:8080**
2. 书架页右上角「上传新书」导入 PDF / EPUB（单文件 ≤ 200MB）
3. 点书进入阅读页，右上角「对话」按钮可与作者交流
4. 阅读进度、对话记录自动保存在服务器，换设备也不丢

> ⚠️ 手机语音输入暂时不可用（语音需要 HTTPS，而 HTTPS 需要域名）。
> 文字阅读和对话完全正常。后续申请域名后，可升级 HTTPS 解锁语音。

---

## 二、服务管理（需要 SSH 登录服务器）

```bash
ssh root@8.137.36.221
cd /opt/shadow-reader

# 查看服务状态（两个容器：app 和 nginx 都应 Up）
docker compose ps

# 查看日志（排查问题用）
docker compose logs -f --tail=100 app

# 停止服务
docker compose down

# 启动服务
docker compose up -d

# 重启服务（改配置后常用）
docker compose restart

# 重新构建 + 启动（代码更新后常用，见下节「更新版本」）
docker compose up -d --build
```

---

## 三、更新版本（从 GitHub 拉新代码）

```bash
cd /opt/shadow-reader
git pull
docker compose up -d --build
```

> 更新不会丢书：所有书籍数据在 `/opt/shadow-reader/uploads/` 目录，容器重启/重建都不受影响。

---

## 四、备份与恢复

所有用户数据都在 `/opt/shadow-reader/uploads/`（书、进度、对话记录）。

**备份**（复制整个目录即可）：

```bash
cp -r /opt/shadow-reader/uploads /root/backup-$(date +%Y%m%d)/
```

**恢复**：把备份目录放回 `/opt/shadow-reader/uploads` 后 `docker compose restart app`。

> 建议每周备份一次。如果做服务器迁移，备份整个 `/opt/shadow-reader` 目录即可。

---

## 五、AI 模型配置

- API Key 在 `/opt/shadow-reader/.env` 的 `DEEPSEEK_API_KEY`
- 模型默认 `deepseek-v4-flash`（性价比高），可改 `.env` 里的 `DEEPSEEK_MODEL`
- 修改后执行 `docker compose up -d` 生效

---

## 六、端口与安全说明

- Shadow Reader 使用 **8080** 端口（服务器 80 端口被另一个项目占用，刻意避开）
- 阿里云安全组需放行 **8080** 端口（TCP），否则外网无法访问
- 当前为 HTTP；有域名后可升级 HTTPS（届时开放 443，同时解锁手机语音）

---

## 七、常见问题

| 问题 | 处理 |
|---|---|
| 外网打不开页面 | 检查阿里云安全组是否放行 8080 端口 |
| 上传书失败 | 检查文件格式（PDF/EPUB）和大小（≤200MB）；看日志 `docker compose logs app` |
| AI 不回复 | 检查 `.env` 里 API Key 是否有效；看日志确认报错 |
| 服务器重启后服务没了 | 已配置 `restart: always`，Docker 随系统自启，一般不会发生 |
