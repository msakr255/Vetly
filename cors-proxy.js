#!/usr/bin/env node
/* =====================================================================
   cors-proxy.js — بروكسي محلي بسيط (من غير أي مكتبات) بيحل مشكلة الـ CORS
   مع الـ APIs اللي بتقفل نداءات المتصفح (زي NVIDIA و Ollama Cloud):
   المتصفح بيبعت طلب "preflight (OPTIONS)" قبل أي نداء فيه Authorization،
   وهذه الخدمات مبتردش عليه بالهيدر المطلوب (Access-Control-Allow-Origin)
   فالمتصفح بيمنع الطلب نفسه ("Failed to fetch") — والحل إن النداء يمر
   من برنامج محلي على جهازك بيحوله للـ API الحقيقي ويضيف الهيدر بنفسه.

   الاستخدام (من الترمنال — كل بروفايدر بسطر لوحده):
       node cors-proxy.js 8787 https://integrate.api.nvidia.com
       node cors-proxy.js 8788 https://ollama.com

   وبعدين في فيتلي: Settings → Custom Providers → + Add
       Name:    nvidia (proxy)
       Base URL: http://localhost:8787/v1
       Model:   z-ai/glm-5.3        (أو ضيفه من زرار + Add Model)
       API key: نفس مفتاحك
   (وللـ ollama: http://localhost:8788/v1 والموديل gpt-oss:120b)

   الأمان: السيرفر بيتسمع على 127.0.0.1 فقط (جهازك لوحدك) والمفتاح
   بيفضل بين جهازك والـ API مباشرة — مفيش طرف تالت زي البروكسيات العامة.
   ===================================================================== */
const http = require('http');
const https = require('https');
const { URL } = require('url');

const port = Number(process.argv[2] || 8787);
const target = process.argv[3];
if (!target) {
    console.error('Usage: node cors-proxy.js <port> <target-origin>');
    console.error('Example: node cors-proxy.js 8787 https://integrate.api.nvidia.com');
    process.exit(1);
}
const t = new URL(target);
const lib = t.protocol === 'http:' ? http : https;

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access',
    'Access-Control-Max-Age': '86400'
};

const server = http.createServer((req, res) => {
    // الـ preflight بنتجاوب عليه محليًا فورًا — عمرك ما هيوصل للـ API الأصلي
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
        const body = Buffer.concat(chunks);
        const outHeaders = { ...req.headers };
        delete outHeaders.host; delete outHeaders.origin; delete outHeaders.referer;
        delete outHeaders['content-length'];
        if (body.length) outHeaders['content-length'] = String(body.length);
        const upReq = lib.request({
            protocol: t.protocol, hostname: t.hostname,
            port: t.port || (t.protocol === 'https:' ? 443 : 80),
            path: req.url, method: req.method, headers: outHeaders
        }, (upRes) => {
            res.writeHead(upRes.statusCode || 502, { ...upRes.headers, ...CORS });
            upRes.pipe(res); // الرد بيمر زي ما هو (streaming شغال)
        });
        upReq.on('error', (e) => {
            res.writeHead(502, { ...CORS, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: 'proxy → target failed: ' + e.message } }));
        });
        if (body.length) upReq.write(body);
        upReq.end();
    });
});

server.listen(port, '127.0.0.1', () => {
    console.log('✔ CORS proxy running:  http://localhost:' + port + '  ->  ' + target);
    console.log('  Vetly Base URL: http://localhost:' + port + '/v1');
});
