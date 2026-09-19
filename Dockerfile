FROM node:20-alpine

WORKDIR /app

# 拷贝核心文件（无需第三方依赖，使用 Node 原生 HTTP）
COPY server.js ./
COPY pages.js ./
COPY index.html ./
COPY book-bg.jpg ./

ENV PORT=3900
ENV NODE_ENV=production

EXPOSE 3900

CMD ["node", "server.js"]
