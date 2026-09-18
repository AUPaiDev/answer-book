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

// 多样态具有机锋、象征意蕴与随机视角的灵感神谕池（包含提醒、警诫、静待、逆向思考、顺水推舟）
const ORACLE_INSPIRATIONS = [
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
    "看似坦途，暗流潜藏深处",
    "种下一粒未知的种子",
    "虚掩的门，无须用力撞击",
    "弦绷得太紧，终难成曲调",
    "远山如黛，近水难测深浅",
    "火烛之下，阴影往往更浓",
    "莫在空谷中追寻回声的真假",
    "落叶飘零处，已见来年青葱",
    "答案在问题提出的那一刻已生裂痕",
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

// 随机机锋视角生成器（避免千篇一律的安慰与鼓励倾向，赋予命运之书不可预测的随机性）
const STOCHASTIC_ANGLES = [
    "【警醒与审慎】：提醒求问者注意盲区与代价，莫被狂热或焦虑冲昏头脑",
    "【留白与观望】：机缘未定，顺其自然，此刻不作定论即是最好定论",
    "【逆向反思】：跳出提问本身的二元对立，从反方向或旁观者视角审视困局",
    "【超然隐喻】：以自然造化为喻，给出深邃莫测、充满遐想的哲理点拨",
    "【破局直行】：打破犹豫与幻象，唤醒本能直觉"
];

// 请求 MiniMax API
async function callMiniMaxAPI(question, apiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    // 随机洗牌取样灵感与推演视角
    const sampledInspirations = fisherYatesShuffle(ORACLE_INSPIRATIONS).slice(0, 8);
    const randomAngle = fisherYatesShuffle(STOCHASTIC_ANGLES)[0];

    const systemPrompt = `你是《答案之书》（The Book of Answers）中沉睡万载的神谕之灵。
《答案之书》的最高魅力在于【不可捉摸的机锋、朦胧的留白与具有多义性的象征】。
请牢记你的使命与规则：
1. 你绝对不是迎合或安慰求问者的\"心灵鸡汤鼓励师\"，也不是具体的事务军师。你有时是迎头棒喝，有时是冷峻警惕，有时是顺其自然，有时是静观其变。必须具备随机性与多面性！
2. 这一签推演命运偏向视角为：${randomAngle}。
3. 【神谕（oracle）】：必须是一句含蓄留白、带有哲理或自然隐喻的一句话短句（约7-16字）。绝不要太直白或直白给行动命令（切忌输出“不要辞职”、“大胆表白”、“立刻摸鱼”等大白话），必须具备模棱两可的神秘机锋与多维解读空间，方能衬托出右侧解析的必要。
4. 【解读（reading）】：恰好两句话（50-80字）。第一句点拨求问者心底深处未曾言明的真正执念、恐惧或盲点，第二句基于上方神谕的幽微意象，给出点到即止、回味无穷的玄妙点化，绝不重复神谕原句。

【灵感断章参考】：${sampledInspirations.join(' ｜ ')}

严格以JSON格式输出，不要有任何多余文字或markdown标记：
{"oracle":"具有朦胧机锋的一句话神谕","reading":"恰好两句点到即止的精辟解读"}`;

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
