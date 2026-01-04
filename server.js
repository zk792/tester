
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3001;

// 允许跨域
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 增加 JSON Body 大小限制，防止大包报错
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// 托管静态文件 (可选，如果想让这个 Node 服务同时托管前端)
app.use(express.static(path.join(__dirname, 'dist')));

// 健康检查接口 (用于前端测试连接)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: 'server-1.0.0' });
});

// === 核心代理接口 ===
app.post('/proxy', async (req, res) => {
    const { targetUrl, method, headers, body } = req.body;

    console.log(`[Proxy] ${method} -> ${targetUrl}`);

    try {
        // 在服务器端发起真实请求 (无 CORS 限制)
        // 使用 Node 18+ 原生 fetch 或 axios (这里保留 axios 因为服务器环境通常可控)
        const response = await axios({
            url: targetUrl,
            method: method,
            headers: headers,
            data: body,
            // 关键：不要让 axios 因为 4xx/5xx 状态码抛出异常，我们要把它们原样返回给前端
            validateStatus: () => true 
        });

        // 将结果返回给前端
        res.json({
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data
        });

    } catch (error) {
        console.error('[Proxy Error]', error.message);
        
        // 处理网络错误 (如 DNS 解析失败, 连接超时)
        res.status(502).json({
            status: 0,
            statusText: 'Proxy Network Error',
            error: error.message,
            data: error.response?.data || null
        });
    }
});

// 处理 SPA 路由 (返回 index.html)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`✅ API Proxy Server running on port ${PORT}`);
    console.log(`   Local URL: http://localhost:${PORT}`);
    console.log(`=========================================`);
});
