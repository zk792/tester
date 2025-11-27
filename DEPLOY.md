
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

## 6. 用户内网测试方案 (EXE 打包指南)

为了让不懂技术的用户也能测试内网接口，您可以将 `local-agent.js` 打包成 `.exe` 文件。

### 打包步骤 (在开发者电脑上执行)

1. **安装 pkg 工具**:
   ```bash
   npm install -g pkg
   ```

2. **准备 package.json**:
   创建一个文件夹 `local-agent-build`，放入下载好的 `local-agent.js`。
   在该文件夹运行 `npm init -y`，并安装依赖：
   ```bash
   npm install express cors axios body-parser
   ```

3. **打包**:
   ```bash
   # 打包为 Windows, macOS, Linux 可执行文件
   pkg local-agent.js --targets node18-win-x64,node18-macos-x64,node18-linux-x64
   ```

4. **分发**:
   将生成的 `local-agent-win.exe` 发给 Windows 用户。
   用户双击运行该 exe 后，CMD 窗口会显示代理已启动。
   此时用户在网页版中选择 **"本地代理"** 模式即可直接测试内网接口。
