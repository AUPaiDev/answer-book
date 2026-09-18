# 📖 答案之书 (The Book of Answers)

沉浸式翻页、深色复古美学的《答案之书》Web 应用。集成 MiniMax 开放平台大模型，融合 200 条经典神谕与 AI 智能解读，支持问题记录、灵感翻页与金句海报生成。

---

## ✨ 核心特性

- 📜 **古籍装帧质感**：精雕细琢的古典皮质封面、金色压纹与羊皮纸质感内页。
- 🔮 **AI 双模驱动**：
  - **服务端中继模式**：安全调用 MiniMax 大模型（`MiniMax-Text-01`），API Key 严密保护在服务端，不向前端暴露。
  - **离线/直连兜底**：网络异常或未配置 Key 时自动启用 200 条经典神谕库与降级占卜。
- 🎨 **神谕海报导出**：基于 Canvas 动态绘制典雅羊皮纸卡片，一键保存分享。
- 🐳 **全自动化运维**：原生支持 Docker、Docker Compose 与 GitHub Actions (CI/CD) 自动部署至云服务器。

---

## 🚀 本地快速启动

### 1. 克隆项目与配置环境变量

```bash
git clone git@github.com:AUPaiDev/answer-book.git
cd answer-book

# 复制环境变量模板
cp .env.example .env
```

在 `.env` 中填入你的 MiniMax API Key：
```ini
PORT=3900
MINIMAX_API_KEY=sk-cp-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. 本地直接运行

```bash
# 语法检查与启动
node --check server.js
node server.js
```

访问浏览器: [http://localhost:3900](http://localhost:3900)

### 3. Docker 本地容器化运行

```bash
docker compose up -d --build
```

访问宿主机端口: [http://localhost:3003](http://localhost:3003)

---

## 🛠️ GitHub Actions 自动化部署 (CI/CD)

本项目配备了与 GitHub Actions 深度整合的自动化工作流（`.github/workflows/deploy.yml`）：
1. **代码推送**: 代码 push 到 `main` 分支触发流程。
2. **校验与构建**: 在 GitHub Actions Runner 中执行语法检测，并使用 Docker Buildx 构建镜像。
3. **镜像分发**: 将构建好的镜像推送到 GitHub 官方容器镜像库 `ghcr.io`。
4. **远端部署**: 自动通过 SSH 登录 AWS EC2 服务器，拉取最新镜像并平滑重启容器，最后进行健康检查。

### 🔐 需在 GitHub 仓库配置的 Secrets (Repository Secrets)

进入 GitHub 仓库：**Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**：

| Secret 键名 | 说明 | 示例值 |
| :--- | :--- | :--- |
| `SERVER_HOST` | 服务器公网 IP 地址 | `your_server_ip` |
| `SERVER_USER` | SSH 登录用户名 | `ubuntu` |
| `SERVER_PORT` | SSH 端口（默认 22） | `22` |
| `SERVER_SSH_KEY` | 用于登录服务器的私钥（如 `tau_ec2.pem` 文本内容） | `-----BEGIN RSA PRIVATE KEY-----...` |
| `MINIMAX_API_KEY` | MiniMax 开放平台接口秘钥 | `sk-cp-xxxxxxxxxxxxxxxx` |

> 💡 提示：GitHub Container Registry (`ghcr.io`) 登录使用工作流内置的 `GITHUB_TOKEN`，无需额外手动配置 Docker 密钥。

---

## 🔒 安全规范说明

- 本仓库所有公域代码已完全移除硬编码密钥与敏感凭证。
- 本地调试私钥（`*.pem`）、运行时密钥（`.env`）以及运行日志均已加入 `.gitignore` 与 `.dockerignore`，杜绝敏感泄露风险。
