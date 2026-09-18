#!/bin/bash
set -e

# ==========================================
# 答案之书 · AWS 本地/手动部署脚本
# ==========================================
# 用法: MINIMAX_API_KEY="xxx" ./deploy.sh
# ==========================================

SERVER="${SERVER:-}"
USER="${USER_NAME:-ubuntu}"
PORT="${PORT:-22}"
PEM_KEY="${PEM_KEY:-}"

# 读取本地 .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

MINIMAX_API_KEY="${MINIMAX_API_KEY:-}"

cd "$(dirname "$0")"

echo "======================================"
echo "  📖 《答案之书》AWS 手动部署"
echo "======================================"

if [ -z "${SERVER}" ]; then
    echo "❌ 错误: 未指定目标服务器 IP。请使用: SERVER=x.x.x.x PEM_KEY=/path/to/key.pem ./deploy.sh"
    exit 1
fi

if [ -z "${PEM_KEY}" ] || [ ! -f "${PEM_KEY}" ]; then
    echo "❌ 错误: 未找到有效 SSH 私钥。请使用: PEM_KEY=/path/to/key.pem ./deploy.sh"
    exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=no -p ${PORT} -i ${PEM_KEY}"
REMOTE_DIR="/home/${USER}/apps/answer-book"

echo ""
echo "1️⃣  检查 SSH 密钥与连通性..."

ssh ${SSH_OPTS} ${USER}@${SERVER} "echo '✅ SSH 连通成功'" || {
    echo "❌ SSH 连接失败。"
    echo "提示：请确认 AWS 安全组是否放行了当前客户端 IP 的 22 端口，或通过 GitHub Actions CI/CD 自动部署。"
    exit 1
}

echo ""
echo "2️⃣  确保远程目录存在..."
ssh ${SSH_OPTS} ${USER}@${SERVER} "mkdir -p ${REMOTE_DIR}"

echo ""
echo "3️⃣  同步服务源码及配置文件到服务器..."
rsync -avz \
  -e "ssh ${SSH_OPTS}" \
  Dockerfile \
  docker-compose.yml \
  docker-compose.prod.yml \
  package.json \
  server.js \
  index.html \
  book-bg.jpg \
  ${USER}@${SERVER}:${REMOTE_DIR}/

echo ""
echo "4️⃣  远端启动 Docker 容器..."
ssh ${SSH_OPTS} ${USER}@${SERVER} << REMOTE_SCRIPT
set -e
cd ${REMOTE_DIR}

if [ -n "${MINIMAX_API_KEY}" ]; then
cat > .env << ENVEOF
MINIMAX_API_KEY=${MINIMAX_API_KEY}
PORT=3900
ENVEOF
fi

# 构建并启动服务
sudo docker compose --project-name answer-book up -d --build

echo ""
echo "📋 容器运行状态:"
sudo docker ps --filter name=answer-book --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🩺 本地健康检查:"
sleep 2
curl -s http://localhost:3003/api/health || echo "服务启动中..."
REMOTE_SCRIPT

echo ""
echo "======================================"
echo "  🎉 部署成功！"
echo "  🌐 访问地址: http://${SERVER}:3003"
echo "======================================"
