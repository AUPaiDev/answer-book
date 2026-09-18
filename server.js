const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 优先从环境读取，也可以从 .env 文件自动解析
function loadEnv() {
    const envPaths = [
        path.join(__dirname, '.env'),
        path.join(__dirname, '../.env')
    ];
    for (const p of envPaths) {
        if (fs.existsSync(p)) {
            try {
                const content = fs.readFileSync(p, 'utf-8');
                content.split('\n').forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                        const [k, ...v] = trimmed.split('=');
                        const key = k.trim();
                        const val = v.join('=').trim().replace(/^['"]|['"]$/g, '');
                        if (!process.env[key]) {
                            process.env[key] = val;
                        }
                    }
                });
            } catch (e) {}
        }
    }
}
loadEnv();

const PORT = parseInt(process.env.PORT || '3900', 10);
const getApiKey = () => process.env.MINIMAX_API_KEY || '';

// 导入完整365页书库及关联检索引擎
const { BOOK_PAGES, findRelevantPages, sanitizeOracle, sanitizeReading } = require('./pages.js');

// 请求 MiniMax API
async function callMiniMaxAPI(question, apiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    // 基于求问者的问题，智能匹配关联度最高且具哲思机锋的候选固定书页
    const candidatePages = findRelevantPages(question, 15);
    const candidateText = candidatePages.map(p => `【第${p.page}页】「${p.oracle}」`).join('\n');

    const systemPrompt = `你是《答案之书》（The Book of Answers）的神谕之灵。
《答案之书》是一本在求问者翻开前就已经印刷成册、拥有固定页码与固定神谕的实体古籍（全书共365页）。

【核心铁律 1 - 绝对禁止在神谕中随意发挥或出现提问主体】：
神谕（oracle）是早已印在书页上的文字，在提问前就已注定！
神谕【绝对禁止随意发挥】，【绝对严禁出现】求问者提问中提到的任何具体人名、地名、具体物品、食物、行业、公司名或特定词汇！
神谕必须是完全普适、客观、超脱、放之四海而皆准的独立断章（约6-18字）。
你必须直接从下方【候选固定书页】中选出一页最契合其心境的固定神谕，并返回其对应的固定页码（page数字）与神谕原文！

【核心铁律 2 - 右侧解读（reading）丰富与排版规范】：
解读是对该页神谕针对求问者具体问题的深入剖析与点拨！
在解读中，你【完全可以且应当】直接提及求问者的问题背景、具体纠结的人事与生活处境。
字数与深度：解读字数要稍微多一些、剖析透彻深刻（严格控制在 90-130 字之间，绝对不可超过书页容纳极限，不可超过135字）。
深入剖析结构：
1. 深入剖析其当下心理盲区、现实困扰与深层顾虑；
2. 借该页神谕的机锋与意象，剖析困局本质与破局视角；
3. 给出通透、警醒或释怀的行动定力与启示。

【候选固定书页】：
${candidateText}

请输出严格的 JSON 格式，不要包含任何 markdown 代码块或多余字符：
{"page":页码数字,"oracle":"选定的神谕原文","reading":"90-130字的深入剖析解读"}`;

    try {
        const payload = {
            model: "MiniMax-Text-01",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `求问者疑问：「${question}」` }
            ],
            temperature: 0.9
        };

        const res = await fetch("https://api.minimaxi.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`MiniMax API status ${res.status}: ${errText}`);
        }

        const data = await res.json();
        const rawContent = data?.choices?.[0]?.message?.content?.trim() || "";
        
        let parsed = null;
        const start = rawContent.indexOf('{');
        const end = rawContent.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
            try {
                parsed = JSON.parse(rawContent.slice(start, end + 1));
            } catch (e) {}
        }

        if (!parsed) {
            const om = rawContent.match(/"oracle"\s*:\s*"([^"]+)"/);
            const rm = rawContent.match(/"reading"\s*:\s*"([^"]+)"/);
            const pm = rawContent.match(/"page"\s*:\s*(\d+)/);
            if (om && rm) {
                parsed = {
                    oracle: om[1].trim(),
                    reading: rm[1].trim(),
                    page: pm ? parseInt(pm[1], 10) : candidatePages[0].page
                };
            }
        }

        if (parsed && parsed.oracle && parsed.reading) {
            const sanitized = sanitizeOracle(parsed.oracle, parsed.page, question, candidatePages);
            const finalReading = sanitizeReading(parsed.reading);
            return {
                page: sanitized.page,
                oracle: sanitized.oracle,
                reading: finalReading
            };
        }

        throw new Error(`无法解析模型响应: ${rawContent}`);
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

// 静态文件 MIME 映射与白名单安全控制
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const ALLOWED_STATIC_FILES = new Set([
    '/',
    '/index.html',
    '/pages.js',
    '/book-bg.jpg',
    '/favicon.ico',
    '/robots.txt'
]);

// 简易内存速率限制
const ipRateMap = new Map();
function checkRateLimit(ip) {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxRequests = 15;

    let record = ipRateMap.get(ip);
    if (!record || now - record.resetTime > windowMs) {
        record = { count: 1, resetTime: now };
        ipRateMap.set(ip, record);
        return true;
    }
    if (record.count >= maxRequests) {
        return false;
    }
    record.count++;
    return true;
}
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipRateMap.entries()) {
        if (now - record.resetTime > 120000) {
            ipRateMap.delete(ip);
        }
    }
}, 60000);

const server = http.createServer(async (req, res) => {
    // 安全响应头
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // 1. 健康检查
    if (pathname === '/api/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            status: 'ok',
            port: PORT,
            hasEnvKey: !!process.env.MINIMAX_API_KEY
        }));
        return;
    }

    // 2. 答案问询接口 POST /api/ask
    if (pathname === '/api/ask' && req.method === 'POST') {
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
        if (!checkRateLimit(clientIp)) {
            res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                success: false,
                error: '提问过于频繁，请静心片刻再试'
            }));
            return;
        }

        let body = '';
        let bodyTooLarge = false;
        const MAX_BODY = 10 * 1024;

        req.on('data', chunk => {
            body += chunk;
            if (body.length > MAX_BODY) {
                bodyTooLarge = true;
                req.destroy();
            }
        });

        req.on('end', async () => {
            if (bodyTooLarge) {
                res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, error: '请求数据过大' }));
                return;
            }

            try {
                let question = '';
                if (body) {
                    try {
                        const parsed = JSON.parse(body);
                        question = (parsed.question || '').trim();
                    } catch (e) {
                        question = body.trim();
                    }
                }
                if (!question) {
                    question = '我未来的路该怎么走？';
                }
                if (question.length > 100) {
                    question = question.slice(0, 100);
                }

                const apiKey = getApiKey();
                if (!apiKey) {
                    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({
                        success: false,
                        error: '未配置 MINIMAX_API_KEY 环境变量'
                    }));
                    return;
                }

                console.log(`[Ask] 收到提问: "${question}"`);
                const result = await callMiniMaxAPI(question, apiKey);
                console.log(`[Ask] 第${result.page}页 神谕:[${result.oracle}] - ${result.reading}`);

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    data: result
                }));
            } catch (err) {
                console.error('[Ask] 接口调用异常:', err.message);
                const fallbackPage = findRelevantPages(question, 1)[0] || BOOK_PAGES[0];
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    fallback: true,
                    data: {
                        page: fallbackPage.page,
                        oracle: fallbackPage.oracle,
                        reading: "你在意的是眼前的迷雾，还是心中的去向？命运的经纬早已在此翻开，顺应内心的真实潮汐，答案自会在前路坦然浮现。"
                    }
                }));
            }
        });
        return;
    }

    // 3. 静态页面与素材分发（白名单保护）
    if (!ALLOWED_STATIC_FILES.has(pathname)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
    }

    const safeFilename = pathname === '/' ? 'index.html' : pathname.slice(1);
    const filePath = path.join(__dirname, safeFilename);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (readErr, content) => {
            if (readErr) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Internal Server Error');
                return;
            }
            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
            });
            res.end(content);
        });
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`========================================`);
    console.log(`  📖 《答案之书》服务端启动成功 (机锋随机性与多维留白已生效)`);
    console.log(`  🌐 本地访问: http://localhost:${PORT}`);
    console.log(`  🔑 环境变量 MINIMAX_API_KEY: ${process.env.MINIMAX_API_KEY ? '已配置 (读取自环境变量)' : '未配置 (请在 .env 或环境变量中配置)'}`);
    console.log(`========================================`);
});
