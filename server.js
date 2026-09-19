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

// 导入完整365页书库及关联检索引擎（带安全兜底，避免缺失模块导致容器崩溃）
let BOOK_PAGES = [];
let findRelevantPages = (q, n = 18) => BOOK_PAGES.slice(0, n);
let sanitizeOracle = (o, p) => ({ page: p || 1, oracle: o || "顺应内心的真实潮汐" });
let sanitizeReading = (r) => r || "静心感悟，答案自会在前路浮现。";
let SERENDIPITY_LENSES = [
    { name: "冷面警醒·直面代价", cue: "指出求问者容易忽视的深层代价、现实盲区或自我欺骗，给出一记清醒的提醒。" },
    { name: "逆向破局·跳出局限", cue: "打破非此即彼的纠结，换一个反常识或出其不意的破局角度，寻找第三种可能。" },
    { name: "幽默解构·举重若轻", cue: "以诙谐、荒谬或自嘲的松弛感消解沉重，提醒求问者别把事情看得太严重。" },
    { name: "顺应时节·无为留白", cue: "顺水推舟、不争而待，提醒求问者不必急于要答案，给事物自然演进的时间。" },
    { name: "果决出击·斩断犹豫", cue: "直击拖延与焦虑的本质，唤醒内心的勇气与决断力，以果敢行动破除停滞。" },
    { name: "见好就收·守中知止", cue: "提醒知止常止、留有余地，防范过犹不及，守住当下的基本盘与内心安宁。" },
    { name: "天地超然·观照自心", cue: "以诗意、自然隐喻或广阔格局启迪求问者，跳出眼前一城一池的得失。" }
];
let getRandomFallback = (q) => ({
    page: 188,
    oracle: "潮起潮落自有时，莫问东风",
    reading: "顺应内心的真实潮汐，答案自会在前路坦然浮现。"
});

try {
    const pagesModule = require('./pages.js');
    BOOK_PAGES = pagesModule.BOOK_PAGES || [];
    findRelevantPages = pagesModule.findRelevantPages || findRelevantPages;
    sanitizeOracle = pagesModule.sanitizeOracle || sanitizeOracle;
    sanitizeReading = pagesModule.sanitizeReading || sanitizeReading;
    if (pagesModule.SERENDIPITY_LENSES && pagesModule.SERENDIPITY_LENSES.length) {
        SERENDIPITY_LENSES = pagesModule.SERENDIPITY_LENSES;
    }
    if (pagesModule.getRandomFallback) {
        getRandomFallback = pagesModule.getRandomFallback;
    }
} catch (e) {
    console.error('⚠️ [Warning] 加载 pages.js 失败，启动备用模式:', e.message);
    BOOK_PAGES = [
        { page: 1, oracle: "答案在问题提出的那一刻已生裂痕" },
        { page: 188, oracle: "潮起潮落自有时，莫问东风" },
        { page: 365, oracle: "此刻合上书卷，答案早已在你的心里" }
    ];
}

// 请求 MiniMax API
async function callMiniMaxAPI(question, apiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    // 基于求问者的问题，多层次抽样候选固定书页（意图共鸣 + 逆向破局 + 全书盲选）
    const candidatePages = findRelevantPages(question, 18);
    const candidateText = candidatePages.map(p => `【第${p.page}页】「${p.oracle}」`).join('\n');

    // 随机注入命运机锋视角，确保每一次翻阅都有不同的启发维度
    const lens = SERENDIPITY_LENSES[Math.floor(Math.random() * SERENDIPITY_LENSES.length)];

    const systemPrompt = `你是《答案之书》（The Book of Answers）的神谕之灵。
《答案之书》是一本在求问者翻开前就已经印刷成册、拥有固定页码与固定神谕的实体古籍（全书共365页）。
求问者翻阅古籍的过程，具有命运的机缘与相对随机性。绝不能对相似的问题总是机械重复相同的倾向性答案！

【本次命运翻阅的机锋视角】：【${lens.name}】
视角指引：${lens.cue}

【核心铁律 1 - 顺应机锋，自选一页固定神谕】：
神谕（oracle）是早已印在书页上的文字，在提问前就已注定！
神谕【绝对禁止随意发挥】，【绝对严禁出现】求问者提问中提到的任何具体人名、地名、具体物品、食物、行业、公司名或特定词汇！
神谕必须是完全普适、客观、超脱的独立断章（约6-18字）。
请顺应本次【${lens.name}】的机锋视角，从下方【候选固定书页】中敏锐选出一页最契合、最能给求问者带来全新顿悟的固定神谕，返回其对应的固定页码（page数字）与神谕原文！切勿总是挑选第一项或墨守成规。

【核心铁律 2 - 右侧解读（reading）深入剖析与排版规范】：
解读是对该页神谕针对求问者具体问题的深入剖析与点拨！
在解读中，你【完全可以且应当】直接提及求问者的问题背景、具体纠结的人事与生活处境。
字数与深度：严格控制在 90-130 字之间（绝对不可超过书页容纳极限，不可超过135字）。
深入剖析结构：
1. 深入剖析其当下心理盲区、现实困扰与深层顾虑；
2. 借该页神谕的机锋意象与本次【${lens.name}】视角的启发，剖析困局本质与破局思路；
3. 给出通透、警醒、释怀或果断的行动启迪。

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
            temperature: 0.98
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
                const fallbackData = getRandomFallback(question);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    fallback: true,
                    data: fallbackData
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
