FROM node:18-alpine

# 安装飞书 CLI
RUN npm install -g @larksuite/cli

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --omit=dev

# 构建
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/index.js"]
