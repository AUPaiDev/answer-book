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

// 《答案之书》固定页码书库：共计收录365页代表性固定神谕，完全普适、客观、超脱，绝不随求问者提问随意发挥
const BOOK_PAGES = [
    { page: 7, oracle: "水太深，建议先学会狗刨" },
    { page: 12, oracle: "退一步海阔天空，退两步容易掉坑里" },
    { page: 16, oracle: "先把饭吃了，世界毁灭也不差这一顿" },
    { page: 21, oracle: "风吹哪页读哪页，大不了把书撕了" },
    { page: 25, oracle: "薛定谔的猫，正在暗中看你的笑话" },
    { page: 31, oracle: "别急，让子弹再多飞一会儿" },
    { page: 36, oracle: "退潮之后，方见水底真石" },
    { page: 42, oracle: "真相往往藏在不想看的角落里" },
    { page: 48, oracle: "雾中行舟，不知彼岸远近" },
    { page: 53, oracle: "主角在第三十集之前，通常都在挨打" },
    { page: 59, oracle: "天塌不下来，个子高的还在前面顶着" },
    { page: 64, oracle: "打不过就加入，但别太当真" },
    { page: 70, oracle: "大意了，但没有完全闪" },
    { page: 76, oracle: "成年人不做选择，因为往往没得选" },
    { page: 82, oracle: "服务器正在摸鱼，你也先歇歇吧" },
    { page: 88, oracle: "看似在解题，实则在为难自己" },
    { page: 94, oracle: "棋局未定，先看谁沉不住气" },
    { page: 99, oracle: "洗洗睡吧，梦里什么都有" },
    { page: 105, oracle: "你算得太精，连命运都算糊涂了" },
    { page: 111, oracle: "与其精神内耗，不如向外发疯" },
    { page: 117, oracle: "信号微弱，不如趁机开启飞行模式" },
    { page: 123, oracle: "火烛之下，阴影往往更浓" },
    { page: 128, oracle: "看似坦途，暗流潜藏深处" },
    { page: 134, oracle: "虚掩的门，无须用力撞击" },
    { page: 140, oracle: "弦绷得太紧，终难成曲调" },
    { page: 146, oracle: "莫在空谷中追寻回声的真假" },
    { page: 152, oracle: "答案在问题提出的那一刻已生裂痕" },
    { page: 158, oracle: "镜中之人并非全部真相" },
    { page: 164, oracle: "水流自会绕过坚石" },
    { page: 171, oracle: "喧嚣之下的沉默更为震耳" },
    { page: 177, oracle: "云遮雾绕间，峰回路转处" },
    { page: 183, oracle: "月影朦胧，何须窥透水中花" },
    { page: 188, oracle: "潮起潮落自有时，莫问东风" },
    { page: 194, oracle: "风起于青萍之末，不可轻动" },
    { page: 201, oracle: "逆风而行，抑或顺流而散" },
    { page: 207, oracle: "不必点亮所有的夜灯" },
    { page: 213, oracle: "静听夜露滴落瓦檐的声响" },
    { page: 219, oracle: "未走之路，风景未必逊色" },
    { page: 225, oracle: "手里拿着锤子，看什么都像钉子" },
    { page: 231, oracle: "停在港湾的船最安全，但这并非造船的初衷" },
    { page: 237, oracle: "与其到处寻找钥匙，不如直接换一把锁" },
    { page: 243, oracle: "越想抓紧的沙子，流失得越快" },
    { page: 249, oracle: "没有标准答案，本身也是一种答案" },
    { page: 255, oracle: "有时候，不作为就是最好的作为" },
    { page: 260, oracle: "回头看，轻舟已过万重山" },
    { page: 266, oracle: "贪多嚼不烂，少即是多" },
    { page: 272, oracle: "当你凝视深渊时，深渊也在打哈欠" },
    { page: 278, oracle: "风筝断了线，反倒飞向了云端" },
    { page: 284, oracle: "不要为了打翻的牛奶哭泣" },
    { page: 289, oracle: "答案就在你翻开书的那一刹那" },
    { page: 295, oracle: "有些孤单的旅程，必须一个人走完" },
    { page: 301, oracle: "看似巧合，其实是必然的重逢" },
    { page: 307, oracle: "允许一切发生，生活才刚刚开始" },
    { page: 313, oracle: "最难走的路，往往通向真正的捷径" },
    { page: 319, oracle: "莫把平台当本事，莫把侥幸当常态" },
    { page: 325, oracle: "万物皆有裂痕，那是光照进来的地方" },
    { page: 331, oracle: "先坐下喝杯茶，事情没你想得那么急" },
    { page: 337, oracle: "该来的总会来，急也急不来" },
    { page: 343, oracle: "如果事与愿违，请相信另有安排" },
    { page: 349, oracle: "站在风口上，也要看清前方是不是悬崖" },
    { page: 355, oracle: "与其揣测人心，不如低头看路" },
    { page: 360, oracle: "放下包袱，步履自然轻盈" },
    { page: 365, oracle: "此刻的沉默，胜过千言万语" }
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

// 严防实体泄露审查器：确保神谕绝对不包含求问者问题中的主体事物或人名
function sanitizeOracle(rawOracle, rawPage, question, candidatePages) {
    const defaultCandidate = candidatePages[0];
    let finalOracle = rawOracle ? String(rawOracle).trim() : defaultCandidate.oracle;
    let finalPage = parseInt(rawPage, 10);
    if (isNaN(finalPage) || finalPage < 1 || finalPage > 365) {
        const matched = BOOK_PAGES.find(p => p.oracle === finalOracle);
        finalPage = matched ? matched.page : defaultCandidate.page;
    }

    // 清洗标点，提取提问特征词（长度>=2的中文字词）
    const cleanQ = question.replace(/[\s\p{P}+~$`^=|<>～—_+]/gu, '');
    const stopWords = ['我们','你们','他们','这个','那个','怎么','怎样','如何','为什么','要不要','该不该','是不是','能不能','会不会','可以吗','什么','请问','如果','但是','现在','今天','明天','以后','请问','告诉我','到底','想知道'];

    for (let len = 2; len <= Math.min(cleanQ.length, 6); len++) {
        for (let i = 0; i <= cleanQ.length - len; i++) {
            const sub = cleanQ.slice(i, i + len);
            if (!stopWords.includes(sub) && finalOracle.includes(sub)) {
                console.log(`[Sanitizer] 检测到神谕随意发挥包含提问特征词: "${sub}"，已强制归正为第${defaultCandidate.page}页标准神谕`);
                return {
                    page: defaultCandidate.page,
                    oracle: defaultCandidate.oracle
                };
            }
        }
    }

    return {
        page: finalPage,
        oracle: finalOracle
    };
}

// 严控解读字数，避免超出书页显示极限
function sanitizeReading(rawReading) {
    let reading = rawReading ? String(rawReading).trim() : "顺应内心的潮汐，答案自会在前路浮现。";
    if (reading.length > 135) {
        // 寻找最后一个完整的句号、感叹号或问号
        const cut = reading.slice(0, 130);
        const lastPunc = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('！'), cut.lastIndexOf('？'));
        if (lastPunc > 70) {
            reading = cut.slice(0, lastPunc + 1);
        } else {
            reading = cut + '。';
        }
    }
    return reading;
}

// 请求 MiniMax API
async function callMiniMaxAPI(question, apiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    // 随机抽样 12 篇固定书页供模型遴选最契合的一页
    const candidatePages = fisherYatesShuffle(BOOK_PAGES).slice(0, 12);
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
                const fallbackPage = fisherYatesShuffle(BOOK_PAGES)[0];
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
