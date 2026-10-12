/* =====================================================================
   core/providers.js
   مزوّدو الـ AI (OpenRouter / CodeCraft / ChatGPT / Claude / Gemini) + الـ fallback بينهم.
   ===================================================================== */

/* =====================================================================
   2) AI PROVIDERS: الترتيب = OpenRouter ← ChatGPT ← Claude ← Gemini
      المفاتيح بتتدخل من شاشة Settings (مش مكتوبة في الكود)
   ===================================================================== */

const PROVIDERS = [
    { id: 'openrouter', name: 'OpenRouter', type: 'openai-compat',
      url: 'https://openrouter.ai/api/v1/chat/completions', model: 'openai/gpt-4o-mini' },
    { id: 'codecraft', name: 'CodeCraft', type: 'openai-compat',
      url: 'https://codecraftapi.com/v1/chat/completions',
      modelsUrl: 'https://codecraftapi.com/v1/models', model: '', jsonMode: false },
    { id: 'openai', name: 'ChatGPT', type: 'openai-compat',
      url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
    { id: 'anthropic', name: 'Claude', type: 'anthropic',
      url: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-5' },
    { id: 'gemini', name: 'Gemini', type: 'gemini', model: 'gemini-flash-latest' }
];

const splitDataUrl = (dataUrl) => {
    const m = /^data:(.*?);base64,(.*)$/.exec(dataUrl);
    return { mime: m ? m[1] : 'image/png', b64: m ? m[2] : '' };
};

// بيمسح أي مسافات أو علامات اقتباس أو كلمة Bearer اتلزقت مع المفتاح بالغلط
const cleanKey = (k) => String(k || '').trim().replace(/^bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();

// رسالة واضحة لو المفتاح نفسه هو المشكلة (401/403)
const apiError = async (p, r) => {
    const body = (await r.text()).slice(0, 200);
    const hint = (r.status === 401 || r.status === 403)
        ? ' ← ' + tr('The key is invalid or was deleted/disabled. Create a new key for {p} and put it in Settings (or leave the field empty to skip it).', { p: p.name })
        : '';
    return new Error(`${p.name} ${r.status}: ${body}${hint}`);
};

// ---------- ذاكرة الموديل اللي نجح فعليًا لكل مزوّد (على الجهاز) ----------
// بتفك مشكلتين: codecraft بيرجع قايمة موديلات مينفعش نعرف منها الصالح،
// و gemini ممكن الـ alias الافتراضي يبقى مش متاح لمفتاح معين.
function getWorkingModel(pid) {
    try { return localStorage.getItem('wakil_model_working_' + pid) || ''; } catch (e) { return ''; }
}
function setWorkingModel(pid, model) {
    try { if (model) localStorage.setItem('wakil_model_working_' + pid, model); } catch (e) { /* ignore */ }
}
function clearWorkingModel(pid) {
    try { localStorage.removeItem('wakil_model_working_' + pid); } catch (e) { /* ignore */ }
}

// ---------- مهلة الطلبات + قاطع دائرة للمزوّد اللي سيرفروا واقف ----------
// CodeCraft مثلًا بيرجع 524 من Cloudflare بعد دقيقتين صمت — بنقطع بعد مهلة أقصر
// وبنقفل المزوّد المؤقتًا (cooldown) عشان المستخدم ما يقعدش مستني من جديد
function fetchT(url, opts, ms) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    return fetch(url, { ...(opts || {}), signal: c.signal }).finally(() => clearTimeout(t));
}
function providerCooldownUntil(pid) {
    try { const v = Number(localStorage.getItem('wakil_provider_down_' + pid) || 0); return v > Date.now() ? v : 0; } catch (e) { return 0; }
}
function setProviderCooldown(pid, ms) {
    try { localStorage.setItem('wakil_provider_down_' + pid, String(Date.now() + ms)); } catch (e) { /* ignore */ }
}
function clearProviderCooldown(pid) {
    try { localStorage.removeItem('wakil_provider_down_' + pid); } catch (e) { /* ignore */ }
}
const timeoutError = (p, ms) => { const e = new Error(`${p.name}: no response from their server (timed out after ${Math.round(ms / 1000)}s) — their API appears to be down. Try another provider or retry in a few minutes.`); e.isTimeout = true; return e; };

async function callProvider(p, key, prompt, images, model, opts = {}) {
    key = cleanKey(key);
    model = model || p.model;
    // قاطع الدائرة: مزوّد فشل بمهلة/عطل مؤخرًا ⇒ نتخطاه فورًا بدل ما نجمد الشاشة
    const cd = providerCooldownUntil(p.id);
    if (cd) throw new Error(`${p.name}: temporarily unreachable (their server timed out recently). Skipping for ~${Math.ceil((cd - Date.now()) / 1000)}s — use another provider or wait.`);

    if (p.type === 'openai-compat') {
        const content = [{ type: 'text', text: prompt }];
        images.forEach(img => content.push({ type: 'image_url', image_url: { url: img.dataUrl } }));
        // json mode بيفعّل response_format عند المزوّدات اللي بتدعمه — ولو رفضته (400)
        // بنرجّع نفس الطلب من غيره تلقائيًا. opts.jsonMode بيطفّيه لطلبات توليد الكود.
        const jsonOn = (opts.jsonMode !== undefined) ? opts.jsonMode : (p.jsonMode !== false);
        const attempt = async (m, ms) => {
            const sys = String(opts.systemPrompt || '').trim();
            const messages = sys ? [{ role: 'system', content: sys }, { role: 'user', content }] : [{ role: 'user', content }];
            const doFetch = async (withJson) => fetchT(p.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                body: JSON.stringify({ model: m, messages, ...(withJson && jsonOn ? { response_format: { type: 'json_object' } } : {}) })
            }, ms);
            let r;
            try {
                r = await doFetch(true);
            } catch (e) {
                setProviderCooldown(p.id, 180000);
                throw timeoutError(p, ms);
            }
            if (!r.ok && r.status === 400) {
                try { r = await doFetch(false); } catch (e) {
                    setProviderCooldown(p.id, 180000);
                    throw timeoutError(p, ms);
                }
            }
            if (!r.ok) {
                if (r.status >= 500) setProviderCooldown(p.id, 120000);
                const err = await apiError(p, r);
                err.message = `${err.message} [model: ${m}]`;
                throw err;
            }
            const j = await r.json();
            clearProviderCooldown(p.id);
            return j.choices?.[0]?.message?.content || '';
        };
        // المرشحون بالترتيب: المحدد في Settings ← المحفوظ الناجح ← (لو فشلوا) من القايمة
        let candidates = [...new Set([model, getWorkingModel(p.id)].filter(Boolean))];
        if (!candidates.length) {
            const names = await listModels(p, key);
            if (!names.length) throw new Error(`${p.name}: مفيش موديلات متاحة، حط اسم موديل في Settings`);
            const chat = names.filter(id => /(gpt|claude|gemini|llama|deepseek|qwen|mistral|grok|command)/i.test(id) && !/(embed|whisper|tts|dall|image|moderation|rerank)/i.test(id));
            candidates = (chat.length ? chat : names).slice(0, 3);
        }
        let lastErr = null, timedOut = false;
        const tryModel = async (m, ms) => {
            try {
                const text = await attempt(m, ms);
                setWorkingModel(p.id, m);
                return text;
            } catch (err) {
                lastErr = err;
                if (err.isTimeout) { timedOut = true; return null; }
                if (m === getWorkingModel(p.id)) clearWorkingModel(p.id);
                return null;
            }
        };
        let idx = 0;
        for (const m of candidates) {
            const t = await tryModel(m, idx === 0 ? 150000 : 60000);
            idx++;
            if (timedOut) break;
            if (t !== null) return t;
        }
        // كل المرشحين فشلوا ⇒ نجيب القايمة الكاملة ونجرب أقرب موديلات شات
        if (!timedOut) {
            let names = null;
            try { names = await listModels(p, key); } catch (e) { /* ignore */ }
            const pool = (names || []).filter(id => !candidates.includes(id));
            const chat = pool.filter(id => /(gpt|claude|gemini|llama|deepseek|qwen|mistral|grok|command)/i.test(id) && !/(embed|whisper|tts|dall|image|moderation|rerank)/i.test(id));
            const extra = (chat.length ? chat : pool).slice(0, 3);
            for (const m of extra) {
                const t = await tryModel(m, 60000);
                if (timedOut) break;
                if (t !== null) return t;
            }
        }
        throw lastErr || new Error(`${p.name}: مفيش موديلات متاحة، حط اسم موديل في Settings`);
    }

    if (p.type === 'anthropic') {
        const content = [];
        images.forEach(img => {
            const { mime, b64 } = splitDataUrl(img.dataUrl);
            content.push({ type: 'image', source: { type: 'base64', media_type: mime, data: b64 } });
        });
        content.push({ type: 'text', text: prompt });
        const sys = String(opts.systemPrompt || '').trim();
        const r = await fetchT(p.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({ model, max_tokens: 16000, ...(sys ? { system: sys } : {}), messages: [{ role: 'user', content }] })
        }, 150000).catch(e => {
            if (e.name === 'AbortError') { setProviderCooldown(p.id, 180000); throw timeoutError(p, 150000); }
            throw e;
        });
        if (!r.ok) {
            if (r.status >= 500) setProviderCooldown(p.id, 120000);
            if (model === getWorkingModel(p.id)) clearWorkingModel(p.id);
            throw await apiError(p, r);
        }
        const j = await r.json();
        setWorkingModel(p.id, model);
        return j.content?.[0]?.text || '';
    }

    if (p.type === 'gemini') {
        const parts = [{ text: prompt }];
        images.forEach(img => {
            const { mime, b64 } = splitDataUrl(img.dataUrl);
            parts.push({ inlineData: { mimeType: mime, data: b64 } });
        });
        const callGemini = (m, ms) => {
            const sys = String(opts.systemPrompt || '').trim();
            return fetchT(
                `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts }],
                        ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {}),
                        // opts.jsonMode === false (توليد كود) ⇒ من غير responseMimeType
                        ...((opts.jsonMode === false) ? {} : { generationConfig: { responseMimeType: 'application/json' } })
                    })
                }, ms).catch(e => {
                    if (e.name === 'AbortError') { setProviderCooldown(p.id, 180000); throw timeoutError(p, ms); }
                    throw e;
                });
        };
        // 503/429 = ازدحام أو Rate limit مؤقت من جوجل — بنستنى وننجرب،
        // ولو فضل عريض بننتقل تلقائيًا لموديل flash تاني متاح لنفس المفتاح
        const busy = (r) => r && (r.status === 503 || r.status === 429);
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const wm = getWorkingModel(p.id);
        let candidates = [...new Set([wm, model].filter(Boolean))];
        let r = null, usedModel = '';
        let first = true;
        for (const m of candidates) {
            usedModel = m;
            r = await callGemini(m, first ? 150000 : 60000);
            first = false;
            if (r.ok) break;
            if (busy(r)) {
                await sleep(2000);
                r = await callGemini(m, 60000);
                if (r.ok) break;
            }
            if (![404, 400, 503, 429].includes(r.status)) break;
        }
        // لسه فاشل: نجيب كل موديلات flash المتاحة للمفتاح ونجرب فيها (مع مهلة قصيرة بين كل محاولة)
        if (r && !r.ok) {
            try {
                const lr = await fetchT(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=200`, null, 15000);
                if (lr.ok) {
                    const lj = await lr.json();
                    const flashList = (lj.models || [])
                        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
                        .map(m => m.name.replace('models/', ''))
                        .filter(n => /flash/.test(n) && !candidates.includes(n))
                        .slice(0, 3);
                    for (const m of flashList) {
                        await sleep(1500);
                        usedModel = m;
                        r = await callGemini(m, 60000);
                        if (r.ok) break;
                        if (busy(r)) {
                            await sleep(2000);
                            r = await callGemini(m, 60000);
                            if (r.ok) break;
                        }
                        if (![404, 400, 503, 429].includes(r.status)) break;
                    }
                }
            } catch (e) { /* ignore */ }
        }
        if (!r || !r.ok) {
            if (usedModel === getWorkingModel(p.id)) clearWorkingModel(p.id);
            const err = r ? await apiError(p, r) : new Error(`${p.name}: request failed`);
            err.message = `${err.message} [model: ${usedModel || model || '?'}]`;
            throw err;
        }
        const j = await r.json();
        setWorkingModel(p.id, usedModel);
        const cand = j.candidates?.[0];
        return (cand?.content?.parts || []).map(pt => pt.text || '').join('') || '';
    }
    return '';
}

// بيجيب أسماء الموديلات المتاحة من /v1/models (للمزوّدين المتوافقين مع OpenAI) — بمهلة 15 ثانية
async function listModels(p, key) {
    if (!p.modelsUrl) return [];
    let r;
    try {
        r = await fetchT(p.modelsUrl, { headers: { 'Authorization': `Bearer ${key}` } }, 15000);
    } catch (e) {
        setProviderCooldown(p.id, 60000);
        throw timeoutError(p, 15000);
    }
    if (!r.ok) throw new Error(`${p.name} models ${r.status}: ${(await r.text()).slice(0, 150)}`);
    const j = await r.json();
    return (j.data || []).map(m => m.id).filter(Boolean);
}


// بيحاول يقرأ الـ JSON حتى لو الموديل رجّعه بيه غلطة بسيطة (علامة ناقصة، اقتباس، سطر جديد)
async function parseLoose(text, name) {
    const s = text.indexOf('{');
    const e = text.lastIndexOf('}');
    if (s === -1 || e === -1) throw new Error(`${name}: no JSON in response`);
    const raw = text.substring(s, e + 1);
    try {
        return JSON.parse(raw);
    } catch (err1) {
        try {
            await loadScript('https://cdn.jsdelivr.net/npm/jsonrepair@3.8.0/lib/umd/jsonrepair.min.js');
            const fix = window.JSONRepair && window.JSONRepair.jsonrepair;
            if (!fix) throw new Error('repair lib missing');
            return JSON.parse(fix(raw));
        } catch (err2) {
            throw new Error(`${name}: invalid JSON from model (${err1.message})`);
        }
    }
}


// بيجرب المزوّدين بالترتيب لحد ما واحد يرجّع نتيجة صالحة (validate بترجع الداتا أو null)
// ---------- Custom Providers: مزوّدات يضيفها المستخدم من Settings ----------
// التعريف (اسم/رابط/موديل) بيتخزن في wakil_custom_providers والمفتاح في wakil_keys
// تحت نفس الـ id — الاتنين محليين على الجهاز ومش بيترفعوا للسحابة.
function getCustomProviders() {
    const arr = safeJSON('wakil_custom_providers', []);
    return (Array.isArray(arr) ? arr : [])
        .filter(c => c && c.id && c.baseUrl)
        .map(c => {
            const base = String(c.baseUrl).trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
            return {
                id: c.id,
                name: c.name || 'Custom',
                type: 'openai-compat',
                url: base + '/chat/completions',
                modelsUrl: base + '/models',
                model: c.model || '',
                custom: true
            };
        });
}

// القايمة الكاملة: الأساسيين الأول ثم المزوّدات المخصصة
function getAllProviders() {
    return PROVIDERS.concat(getCustomProviders());
}

// pick (اختياري): { providerId, model } — لما المستخدم يختار model محدد من الـ ModelPicker
// بنجرب المزوّد ده هو بس بالموديل المختار (من غير fallback لمزوّد تاني)
// onStep (اختياري): كولباك بيوصل خطوات التقدم (اتصال / رد / نجاح / فشل) لكل محاولة
async function runProviders({ keys, models, prompt, images, validate, pick, onStep }) {
    const errors = [];
    const list = (pick && pick.providerId)
        ? getAllProviders().filter(x => x.id === pick.providerId)
        : getAllProviders().filter(x => (keys[x.id] || '').trim());
    // لو الرد وصل بس الـ JSON فيه غلطة صياغة: بنرجع لنفس الموديل بمطلوب إصلاح (مرة واحدة)
    const REPAIR = '\n\nCRITICAL: Your previous response was INVALID JSON (it had a syntax error). Return the SAME content again as ONE strictly valid JSON object: no comments, no trailing commas, escape every double quote inside string values, and output NOTHING before or after the JSON.';
    for (const p of list) {
        try {
            const forced = (pick && pick.providerId === p.id && pick.model) ? pick.model : (models[p.id] || '').trim();
            const runOnce = async (attemptPrompt, tag) => {
                onStep && onStep(`⏳ ${p.name}${tag}: connecting…`);
                const text = await callProvider(p, keys[p.id].trim(), attemptPrompt, images, forced);
                onStep && onStep(`✔ ${p.name}${tag}: responded — checking output…`);
                const parsed = await parseLoose(text, p.name);
                const valid = validate(parsed);
                if (!valid) throw new Error(`${p.name}: response has no usable result`);
                return valid;
            };
            let valid;
            try {
                valid = await runOnce(prompt, '');
            } catch (err) {
                if (!/invalid JSON from model|no JSON in response/.test(err.message)) throw err;
                onStep && onStep(`⚠️ ${p.name}: invalid JSON — one repair attempt…`);
                valid = await runOnce(prompt + REPAIR, ' (repair)');
            }
            onStep && onStep(`✅ ${p.name}: success`);
            return { data: valid, provider: p.name + (pick && pick.model ? ` (${pick.model})` : ''), errors };
        } catch (err) {
            console.warn(err.message);
            onStep && onStep(`❌ ${err.message}`);
            errors.push(err.message);
        }
    }
    return { data: null, provider: '', errors };
}
