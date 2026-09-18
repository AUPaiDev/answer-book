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

// 多样态灵感神谕池：涵盖诙谐网络语、冷幽默、自嘲反讽、警醒提醒与深邃留白（保持含蓄、多义与机锋，绝不直白）
const ORACLE_INSPIRATIONS = [
    // 诙谐网感与轻巧幽默类（含蓄有趣，不给直白答案）
    "水太深，建议先学会狗刨",
    "先把饭吃了，世界毁灭也不差这一顿",
    "薛定谔的猫，正在暗中看你的笑话",
    "服务器正在摸鱼，你也先歇歇吧",
    "退一步海阔天空，但退两步容易掉坑里",
    "风吹哪页读哪页，大不了把书撕了",
    "主角在第三十集之前，通常都在挨打",
    "打不过就加入，但别太当真",
    "天塌不下来，个子高的还在前面顶着",
    "信号微弱，不如趁机开启飞行模式",
    "大意了，但没有完全闪",
    "成年人不做选择，因为往往没得选",
    "别急，让子弹再多飞一会儿",
    "真相往往藏在不想看的角落里",
    "看似在解题，实则在为难自己",
    "棋局未定，先看谁沉不住气",
    "洗洗睡吧，梦里什么都有",
    "你算得太精，连命运都算糊涂了",
    "与其精神内耗，不如向外发疯",
    // 警诫提醒与冷静反思类
    "火烛之下，阴影往往更浓",
    "看似坦途，暗流潜藏深处",
    "虚掩的门，无须用力撞击",
    "弦绷得太紧，终难成曲调",
    "莫在空谷中追寻回声的真假",
    "答案在问题提出的那一刻已生裂痕",
    // 经典哲理与自然留白类
    "雾中行舟，不知彼岸远近",
    "退潮之后，方见水底真石",
    "镜中之人并非全部真相",
    "水流自会绕过坚石",
    "喧嚣之下的沉默更为震耳",
    "云遮雾绕间，峰回路转处",
    "月影朦胧，何须窥透水中花",
    "潮起潮落自有时，莫问东风",
    "风起于青萍之末，不可轻动",
    "逆风而行，抑或顺流而散",
    "不必点亮所有的夜灯",
    "静听夜露滴落瓦檐的声响",
    "未走之路，风景未必逊色"
];

// 标准 Fisher-Yates (Knuth) 洗牌算法
function fisherYatesShuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// 随机推演视角生成器（避免千篇一律的严肃或鸡汤，赋予答案之书不可预测的多元机锋）
const STOCHASTIC_ANGLES = [
    "【诙谐解构与网络机锋】：带着现代冷幽默、自嘲或轻巧反讽（如：薛定谔的猫正在看戏、水太深先学狗刨、先把饭吃了世界毁灭不差这一顿），戏谑却暗含人生通透",
    "【警醒与冷峻审慎】：提醒求问者注意盲区、沉没成本与现实代价，莫被冲动、焦虑或盲目乐观冲昏头脑",
    "【留白与顺其自然】：机缘未定，不必强求定论，此刻让子弹飞一会儿就是最好的解答",
    "【逆向反思与跳脱】：跳出提问本身的二元非此即彼，从荒谬性或第三人视角审视困局",
    "【超然隐喻与禅意】：以自然造化或生活琐屑为喻，言有尽而意无穷",
    "【冷面真实与戳心解惑】：一针见血拆穿求问者内心深处的纠结本源，看似不留情面实则清醒"
];

// 请求 MiniMax API
async function callMiniMaxAPI(question, apiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    // 随机洗牌取样灵感与推演视角
    const sampledInspirations = fisherYatesShuffle(ORACLE_INSPIRATIONS).slice(0, 10);
    const randomAngle = fisherYatesShuffle(STOCHASTIC_ANGLES)[0];

    const systemPrompt = `你是《答案之书》（The Book of Answers）的神谕之灵。
《答案之书》的最高魅力在于【不可捉摸的机锋、朦胧的留白、意料之外的多元视角与心理投射】。
神谕绝非千篇一律的高高在上古雅金句，它可以是深邃哲理、含蓄警醒，也可以是带点诙谐幽默的网络机锋、冷面吐槽或自嘲禅意。

请牢记你的使命与规则：
1. 本次命运推演倾向视角为：${randomAngle}。坚决杜绝千篇一律的心灵鸡汤安慰，必须具备不可预测的随机性与多面性！
2. 【神谕（oracle）】：一句话短句（约6-18字）。可以严肃深邃，也可以诙谐幽默、具网感或自嘲反讽，但【绝不要太直白】（切忌直接给出“去表白吧”、“千万别买”、“明天就辞职”等直白命令）。必须含蓄、具有多重隐喻或戏剧性余味，留出让人回味与脑补的心理空间！
3. 【解读（reading）】：恰好两句话（50-80字）。第一句直戳求问者心底真正的纠结、盲区、荒诞感或执念；第二句承接上方神谕的幽微意象，给出既通透又点到即止的玄妙点化，绝不重复神谕原句。

【断章灵感参考】：${sampledInspirations.join(' ｜ ')}

严格以JSON格式输出，不要有任何多余文字或markdown标记：
{"oracle":"含蓄或诙谐的一句话神谕","reading":"恰好两句点到即止的精辟解读"}`;

    try {
        const payload = {
            model: "MiniMax-Text-01",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `求问者疑问：「${question}」` }
            ],
            temperature: 0.95
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
                        oracle: String(parsed.oracle).trim(),
                        reading: String(parsed.reading).trim()
                    };
                }
            } catch (e) {}
        }

        const om = rawContent.match(/"oracle"\s*:\s*"([^"]+)"/);
        const rm = rawContent.match(/"reading"\s*:\s*"([^"]+)"/);
        if (om && rm) {
            return {
                oracle: om[1].trim(),
                reading: rm[1].trim()
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
                console.log(`[Ask] 神谕:[${result.oracle}] - ${result.reading}`);

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    data: result
                }));
            } catch (err) {
                console.error('[Ask] 接口调用异常:', err.message);
                const fallbackOracle = fisherYatesShuffle(ORACLE_INSPIRATIONS)[0];
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    fallback: true,
                    data: {
                        oracle: fallbackOracle,
                        reading: "你在意的是眼前的迷雾，还是心中的去向？顺应内心的潮汐，前路自会浮现。"
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
