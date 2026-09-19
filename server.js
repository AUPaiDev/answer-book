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

// 请求 MiniMax API（接收用户维度的翻阅足迹 userRecentPages，实现严格的用户级连抽降权隔离）
async function callMiniMaxAPI(question, apiKey, userRecentPages = []) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    // 基于求问者的问题，多层次抽样候选固定书页（意图共鸣 + 逆向破局 + 全书盲选 + 用户维度连抽降权，精炼12页降低传输延迟）
    const candidatePages = findRelevantPages(question, 12, userRecentPages);
    const candidateText = candidatePages.map(p => `【第${p.page}页】「${p.oracle}」`).join('\n');

    // 随机注入命运机锋视角，确保每一次翻阅都有不同的启发维度
    const lens = SERENDIPITY_LENSES[Math.floor(Math.random() * SERENDIPITY_LENSES.length)];

    const systemPrompt = `你是《答案之书》里那个看穿世俗一切纠结、嘴贫心软、说话又灵又准的“通透赛博神仙”（就像一个懂你所有难处、说话一针见血却极具情绪价值的知心老友）。
全书共365页，神谕早已印在书页之上。求问者带着具体生活纠结翻开古籍，请你为他点破天机！

【核心铁律 1 - 选一页固定神谕】：
神谕是早已印在书上的固定原文，【绝对严禁出现提问中的特定人名/特定物品名词】！
必须从下方候选书页中直接挑选最契合本次机锋的一页，返回其固定页码与神谕原文。切勿只看字面相同词汇，优先挑意料之外、深具隐喻的妙笔！

【核心铁律 2 - 右侧解读：接地气、通透有梗、情绪价值拉满（80-115字）】：
解读是对该页神谕针对求问者问题的神级点拨。
• 告别枯燥说教：绝对禁止写成“第一/第二/心理盲区/本质剖析/行动建议”这种工作汇报式的严肃死板排版！
• 语言风格：像个相识多年、懂你所有小心思的通透好友，说话生动鲜活、接地气、带有恰到好处的人间烟火气和幽默自嘲。
• 前半句：一句神吐槽或犀利机锋，精准戳破求问者内心暗戳戳的执念、虚荣或纠结小九九；
• 后半句：借选定神谕的意象反手给出一个豁达、解气或清醒通透的破局姿态，让人读完忍不住会心一笑、甚至想发圈分享！
• 字数严格控制在 80~115 字，一气呵成。

【本次命运机锋视角】：【${lens.name}】
视角指引：${lens.cue}

【候选固定书页】：
${candidateText}

请输出严格的 JSON 格式，不要包含任何 markdown 代码块或多余字符：
{"page":页码数字,"oracle":"选定的神谕原文","reading":"80-115字生动通透、带点幽默神吐槽与真诚治愈的知心解读"}`;

    try {
        const payload = {
            model: "MiniMax-Text-01",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `求问者疑问：「${question}」` }
            ],
            temperature: 0.95,
            max_tokens: 220
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
                let userRecentPages = [];
                if (body) {
                    try {
                        const parsed = JSON.parse(body);
                        question = (parsed.question || '').trim();
                        if (Array.isArray(parsed.recentPages)) {
                            userRecentPages = parsed.recentPages.map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 365);
                        }
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

                console.log(`[Ask] 收到提问: "${question}" (用户冷却页码数: ${userRecentPages.length})`);
                const result = await callMiniMaxAPI(question, apiKey, userRecentPages);
                console.log(`[Ask] 第${result.page}页 神谕:[${result.oracle}] - ${result.reading}`);
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
