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

// 四大维度结构化神谕大词库（用于兜底降级、抽样与模型灵感注入）
const ORACLE_MATRIX = {
    "经典哲理": [
        "时机尚未成熟，再等等看", "顺其自然，不要强求", "换一个角度，答案显而易见", "退一步，海阔天空",
        "相信你的第一直觉", "命运自有最妥善的安排", "你心中其实早已有了答案", "静待时变，不急于此刻定夺",
        "放下执念，前路豁然开朗", "大道至简，不必思虑过多", "专注眼前，莫问前程凶吉", "每一次转折都是最好的契机",
        "看似弯路，实则是必经之途", "听从内心的召唤，勿随波逐流", "所有的等待都在孕育惊喜", "答案就在你走过的脚步里"
    ],
    "趣味整活": [
        "洗洗睡吧，梦里啥都有", "建议直接躺平，保持神秘", "要不先吃顿好的压压惊", "少管闲事，保住发量要紧",
        "听妈妈的话，准没错", "这把直接重开，问题不大", "你高兴就好，何必为难自己", "与其内耗自己，不如发疯外耗他人",
        "先喝杯奶茶，烦恼减半", "今天宜摸鱼，不宜大动干戈", "反思自己？不如质疑世界", "遇事不决，量子力学"
    ],
    "垂直专属": [
        "老板比你想得更糊涂", "这波稳赚，大胆推进", "建议立刻摸鱼，保存体力", "主动就会有故事，犹豫只会败北",
        "保持距离，美往往产生于神秘", "这局必赢，拿出你的底气", "及时止损，才是顶级自律", "打工人的命也是命，准点下班",
        "勇敢表白，最差不过当兄弟", "拒绝画饼，真金白银才是王道", "多赚钱少动感情，格局瞬间打开", "先专注搞钱，爱情自然会来"
    ],
    "心理疗愈": [
        "你已经做得足够好了", "允许自己偶尔搞砸一次", "休息也是前进必不可少的一部分", "别怕，最难熬的阶段已经过去",
        "你值得世间所有的温柔与善意", "放过自己，今天的你已拼尽全力", "慢慢来，属于你的花期终会绽放", "不必完美，真实鲜活才最动人",
        "爱自己，是一生浪漫的开始", "心若没有栖息的地方，到哪都是流浪", "万物皆有裂痕，那是光照进来的地方", "疲惫时就靠岸，世界随时等你归来"
    ]
};

// 扁平化全部神谕列表（用于通用洗牌采样）
const ALL_ORACLES = Object.entries(ORACLE_MATRIX).flatMap(([cat, list]) =>
    list.map(oracle => ({ category: cat, oracle }))
);

// 标准 Fisher-Yates (Knuth) 洗牌算法
function fisherYatesShuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function sampleOracleInspirations(count = 12) {
    return fisherYatesShuffle(ALL_ORACLES).slice(0, count);
}

// 请求 MiniMax API：深度洞察语境意图，自适应四维风格，显化富有金句感的一句话神谕与两句精辟解读
async function callMiniMaxAPI(question, apiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const samples = sampleOracleInspirations(12);
    const inspirationText = samples.map(s => `[${s.category}] ${s.oracle}`).join(' | ');

    const systemPrompt = `你是风靡全球的《答案之书》（The Book of Answers）的神谕之灵。
《答案之书》的灵魂在于“万能回答与心理映射”，答案库涵盖四大维度：
1. 【经典哲理】：中性留白、玄妙深邃（如：时机尚未成熟，再等等看 / 顺其自然，不要强求 / 换一个角度，答案显而易见）
2. 【趣味整活】：冷幽默、网络网梗、毒舌但透彻（如：洗洗睡吧，梦里啥都有 / 建议直接躺平，保持神秘 / 要不先吃顿好的压压惊）
3. 【垂直专属】：切中职场痛点、情感社交、搞钱现实（如：老板比你想得更糊涂 / 主动就会有故事，犹豫只会败北 / 及时止损才是顶级自律）
4. 【心理疗愈】：温暖托底、缓解内耗、情绪价值（如：你已经做得足够好了 / 允许自己偶尔搞砸一次 / 休息也是前进必不可少的一部分）

面对求问者的心声，请按照以下两步推演：
第一步【洞察意图与语境】：准确捕捉提问背后的心理动因、情绪底色及生活场景（职场打拼/情感纠结/自我怀疑/摆烂整活/人生抉择等）；
第二步【显化神谕与解读】：
1. category（维度）：从【经典哲理、趣味整活、垂直专属、心理疗愈】中选出最贴合该提问语境的一项；
2. oracle（一句话神谕）：必须是一句朗朗上口、金句感极强的一句话短句（约6-16个字，可参考灵感库或灵性自创，不要只有两三个词，切忌千篇一律“时候未到”）；
3. reading（解读）：恰好两句话左右（50-80字），第一句直击此刻心境与现实处境，第二句给出超然、幽默或温暖的行动方向，语言优美，绝不重复神谕原句。

【灵感参考库】：${inspirationText}

严格以JSON格式输出，不要有任何多余文字或markdown代码块：
{"category":"维度标签","intent":"意图心境洞察","oracle":"一句话神谕短句","reading":"恰好两句话的深邃解读"}`;

    try {
        const payload = {
            model: "MiniMax-Text-01",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `求问者心声：「${question}」` }
            ],
            temperature: 0.88
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
        
        // 解析 JSON
        const start = rawContent.indexOf('{');
        const end = rawContent.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
            try {
                const parsed = JSON.parse(rawContent.slice(start, end + 1));
                if (parsed.oracle && parsed.reading) {
                    return {
                        category: parsed.category ? String(parsed.category).trim() : '经典哲理',
                        oracle: String(parsed.oracle).trim(),
                        reading: String(parsed.reading).trim(),
                        intent: parsed.intent ? String(parsed.intent).trim() : ''
                    };
                }
            } catch (e) {}
        }

        const om = rawContent.match(/"oracle"\s*:\s*"([^"]+)"/);
        const rm = rawContent.match(/"reading"\s*:\s*"([^"]+)"/);
        const cm = rawContent.match(/"category"\s*:\s*"([^"]+)"/);
        if (om && rm) {
            return {
                category: cm ? cm[1].trim() : '经典哲理',
                oracle: om[1].trim(),
                reading: rm[1].trim(),
                intent: ''
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
    '/book-bg.jpg',
    '/favicon.ico',
    '/robots.txt'
]);

// 简易内存速率限制（防刷 API，每 IP 每分钟最多 15 次请求）
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
    // 安全响应头 (OWASP 推荐)
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
                console.log(`[Ask] 维度:[${result.category}] 神谕:[${result.oracle}] - ${result.reading}`);

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    data: result
                }));
            } catch (err) {
                console.error('[Ask] 接口调用异常:', err.message);
                // 兜底降级方案：从多维答案库中随机抽取一条金句
                const fallbackItem = fisherYatesShuffle(ALL_ORACLES)[0];
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    fallback: true,
                    data: {
                        category: fallbackItem.category,
                        oracle: fallbackItem.oracle,
                        reading: "命运在薄雾中轻声指引：前路已然在足下延展，静心感悟即可洞见真理。"
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
    console.log(`  📖 《答案之书》服务端启动成功 (四大文案维度支持)`);
    console.log(`  🌐 本地访问: http://localhost:${PORT}`);
    console.log(`  🔑 环境变量 MINIMAX_API_KEY: ${process.env.MINIMAX_API_KEY ? '已配置 (读取自环境变量)' : '未配置 (请在 .env 或环境变量中配置)'}`);
    console.log(`========================================`);
});
