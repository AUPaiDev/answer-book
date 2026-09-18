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

// 200 条经典神谕库（与前端保持一致，用于服务端前置筛选）
const ORACLE_LIST = [
    "是的","不是","也许吧","当然可以","绝对不行","再等等","时候未到","马上就会发生","不要犹豫","需要更多耐心",
    "相信你的直觉","换个方向试试","坚持下去","放手吧","顺其自然","这是最好的选择","你需要休息","勇敢一点","不要害怕改变","答案就在你心中",
    "试试看吧","现在不是时候","命运自有安排","你已经知道答案了","再想想","毫无疑问","前方有惊喜","小心行事","大胆去做","保持冷静",
    "这条路是对的","转机即将出现","你需要帮助","独自面对","分享你的想法","沉默是金","说出来","写下来","等到明天","今天就行动",
    "深呼吸","微笑面对","接受现实","创造奇迹","简单就好","复杂的事简单做","听听朋友的建议","相信自己","不要回头","回头看看",
    "这只是开始","终点就在前方","享受过程","专注当下","放眼未来","回忆过去的经验","打破常规","遵循传统","创新是关键","稳中求进",
    "冒险一次","安全第一","倾听内心","理性分析","感性选择","两者都要","两者都不要","选第一个","选最后一个","随机选择",
    "问问长辈","和朋友聊聊","独自思考","出去走走","静下心来","读一本书","看一场电影","听一首歌","画一幅画","写一封信",
    "好事将近","贵人相助","自力更生","团队合作","单打独斗","时间会证明一切","不要浪费时间","慢慢来","加快脚步","停下来想想",
    "你比想象中强大","承认自己的弱点","发挥你的优势","学习新技能","温故知新","改变策略","坚持原来的计划","灵活应变","未雨绸缪","船到桥头自然直",
    "吃一堑长一智","三思而后行","果断决定","推迟决定","现在就决定","值得等待","不值得","非常值得","再给一次机会","到此为止",
    "新的开始","完美的结局","未完待续","翻篇了","重新来过","你做得很好","还可以更好","已经足够了","永远不够","恰到好处",
    "多一点","少一点","刚刚好","过犹不及","适可而止","天时地利人和","万事俱备","欠缺东风","一切就绪","还需准备",
    "心想事成","事与愿违","塞翁失马","因祸得福","否极泰来","柳暗花明","峰回路转","水到渠成","功到自然成","欲速则不达",
    "知足常乐","追求更多","珍惜当下","期待未来","释怀过去","爱自己","爱别人","被爱着","去表达","去感受",
    "你是对的","你错了","没有对错","换个角度","站高一点看","细节决定成败","大局为重","抓大放小","面面俱到","有所取舍",
    "勇往直前","以退为进","迂回前进","原地等待","换条路走","打开心扉","保护自己","拥抱变化","守护初心","随遇而安",
    "一切都会好的","最坏的已经过去","好运正在路上","你值得拥有","相信奇迹"
];

// 请求 MiniMax API
async function callMiniMaxAPI(question, apiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
        const payload = {
            model: "MiniMax-Text-01",
            messages: [
                {
                    role: "system",
                    content: `你是答案之书中沉睡千年的神谕之灵。用户提出问题后，你必须：
1. 从以下神谕列表中，选出与问题最契合的一条（不要自创）；
2. 用1-2句话给出玄妙解读，语气如远古预言、塔罗低语，绝不重复神谕原文。

神谕列表：
${ORACLE_LIST.join('、')}

严格以JSON格式回复（不要输出markdown外的任何多余文字）：
{"oracle":"选中的神谕","reading":"解读内容"}`
                },
                {
                    role: "user",
                    content: `我的问题：「${question}」`
                }
            ],
            temperature: 0.8
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
                    return parsed;
                }
            } catch (e) {}
        }

        const om = rawContent.match(/"oracle"\s*:\s*"([^"]+)"/);
        const rm = rawContent.match(/"reading"\s*:\s*"([^"]+)"/);
        if (om && rm) {
            return { oracle: om[1], reading: rm[1] };
        }

        throw new Error(`无法解析模型响应: ${rawContent}`);
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

// 静态文件 MIME 映射
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

const server = http.createServer(async (req, res) => {
    // 设置通用 CORS 头（方便跨域调试）
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
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
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
                console.log(`[Ask] 返回神谕: [${result.oracle}] - ${result.reading}`);

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    data: result
                }));
            } catch (err) {
                console.error('[Ask] 接口调用异常:', err.message);
                // 兜底降级方案：随机神谕
                const fallbackOracle = ORACLE_LIST[Math.floor(Math.random() * ORACLE_LIST.length)];
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    fallback: true,
                    data: {
                        oracle: fallbackOracle,
                        reading: "命运在薄雾中指引：前路已然在足下延展，静心感悟即可洞见真理。"
                    }
                }));
            }
        });
        return;
    }

    // 3. 静态页面与素材分发
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    
    // 安全限制防止目录穿越
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            // 如果不存在，尝试返回 index.html
            filePath = path.join(__dirname, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (readErr, content) => {
            if (readErr) {
                res.writeHead(500);
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
    console.log(`  📖 《答案之书》服务端启动成功`);
    console.log(`  🌐 本地访问: http://localhost:${PORT}`);
    console.log(`  🔑 环境变量 MINIMAX_API_KEY: ${process.env.MINIMAX_API_KEY ? '已配置 (读取自环境变量)' : '未配置 (请在 .env 或环境变量中配置)'}`);
    console.log(`========================================`);
});
