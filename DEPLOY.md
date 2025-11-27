
# 部署指南 (AutoAPI Tester)

## 1. 准备环境

服务器需要安装 Nginx 和 Node.js (用于运行代理服务)。

```bash
# 安装 Node.js (如果未安装)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 PM2 (用于后台运行 Node 服务)
sudo npm install -g pm2
```

## 2. 部署代码

1. 上传本地构建好的 `dist` 文件夹到 `/var/www/temeng.chat`
2. 上传 `server.js` 到同级目录 (例如 `/var/www/temeng.chat/server.js`)
3. 在该目录下初始化并安装依赖：

```bash
cd /var/www/temeng.chat
npm init -y
npm install express cors axios body-parser
```

## 3. 启动代理服务

使用 PM2 启动代理服务，它会监听 3001 端口。

```bash
pm2 start server.js --name "api-proxy"
pm2 save
pm2 startup
```

## 4. Nginx 配置 (终极版)

编辑 `sudo nano /etc/nginx/sites-available/temeng.chat`：

```nginx
server {
    listen 80;
    server_name temeng.chat www.temeng.chat liu.temeng.chat;

    # 静态文件目录
    root /var/www/temeng.chat;
    index index.html;

    gzip on;
    gzip_types text/plain application/json application/javascript text/css;

    # 1. 托管前端页面
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 2. 转发到本地 Node.js 代理服务 (解决 CORS)
    # 前端发起的 /api/proxy 请求会被转发给 127.0.0.1:3001
    location /api/proxy/ {
        # 注意: 这里转发给本地运行的 server.js 的 /proxy 接口
        proxy_pass http://127.0.0.1:3001/proxy;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # 增加超时时间，防止接口响应慢导致 504
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

## 5. 重启 Nginx

```bash
sudo nginx -t
sudo systemctl restart nginx
```

## 6. 用户内网测试方案 (提供 EXE 下载)

为了让不懂技术的用户也能测试内网接口，您可以将 `local-agent.js` 打包成 `.exe` 文件并托管在您的网站上。

### 步骤 A: 打包 EXE (在开发者电脑上执行)

1. **新建文件夹并初始化**:
   ```bash
   mkdir agent-build && cd agent-build
   npm init -y
   npm install pkg express cors axios body-parser
   ```
2. **复制脚本**: 将项目中的 `local-agent.js` (或 `server.js`) 复制到该目录。

3. **打包**:
   ```bash
   npx pkg local-agent.js --targets node18-win-x64 --output local-agent
   ```
   这会生成 `local-agent.exe`。

### 步骤 B: 上传并部署

1. **上传文件**: 将生成的 `local-agent.exe` 复制到您 React 项目的 `public` 文件夹中。
   * 如果是已经部署的服务器，直接上传到 `/var/www/temeng.chat/` (与 index.html 同级)。
2. **重新构建/部署**:
   如果您是放入源码的 `public` 文件夹，请重新运行 `npm run build` 并上传新的 dist。

现在，网页上的 **"下载 Windows 客户端 (.exe)"** 按钮就能正常工作了。
