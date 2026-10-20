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
// ملاحظات مزوّدين اتشالوا بعد تيست حي (Oct 12) — ممكن يترجعوا لو سيرفراتهم اتصلحت:
// - Kilo Code: الدومين نفسه مش بيتحل DNS من شبكة المستخدم (NXDOMAIN من الـ ISP) ⇒ مستحيل بدون VPN
// - LLM7.io: الـ CORS عندهم مش بيسمح بهيدر Authorization، والمفتاح مبيتقروش query param،
//   والحصة المجانية المجهولة يومية صغيرة لكل IP (quota_exceeded بعد تجارب قليلة) ⇒ مستحيل من متصفح
// - Ollama Cloud (ollama.com): رافض الـ preflight (405) ومفيش ACAO خالص ⇒ مستحيل من متصفح
//   (البديل: Ollama محلي من Custom Providers بـ http://localhost:11434/v1)

const splitDataUrl = (dataUrl) => {
    const m = /^data:(.*?);base64,(.*)$/.exec(dataUrl);
    return { mime: m ? m[1] : 'image/png', b64: m ? m[2] : '' };
};

// بيمسح أي مسافات أو علامات اقتباس أو كلمة Bearer اتلزقت مع المفتاح بالغلط
const cleanKey = (k) => String(k || '').trim().replace(/^bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();

// رسالة واضحة لو المفتاح أو الرصيد هو المشكلة (401/402/403)
const apiError = async (p, r) => {
    const body = (await r.text()).slice(0, 200);
    let hint = '';
    if (r.status === 401 || r.status === 403) {
        hint = ' ← ' + tr('The key is invalid or was deleted/disabled. Create a new key for {p} and put it in Settings (or leave the field empty to skip it).', { p: p.name });
    } else if (r.status === 402) {
        hint = ' ← ' + tr('The {p} account has no credit/quota left (billing). Top it up or use another provider.', { p: p.name });
    }
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
    // signal خارجي اختياري (زر Stop في شات Vetly Agent): نلغي الطلب لو المستخدم وقفه أو انتهت المهلة
    const ext = opts && opts.signal;
    const onExt = () => c.abort();
    if (ext) { if (ext.aborted) c.abort(); else ext.addEventListener('abort', onExt); }
    return fetch(url, { ...(opts || {}), signal: c.signal }).finally(() => {
        clearTimeout(t);
        if (ext) ext.removeEventListener('abort', onExt);
    });
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
    // لغة مخرجات الـ AI: تتبع لغة الموقع المختارة (شات Vetly Agent بيلغيها — بيكتب بلغة المستخدم)
    if (!opts.noLangInstr && typeof aiLangInstr === 'function') prompt = prompt + aiLangInstr();
    // قاطع الدائرة: مزوّد فشل بمهلة/عطل مؤخرًا ⇒ نتخطاه فورًا بدل ما نجمد الشاشة
    const cd = providerCooldownUntil(p.id);
    if (cd) throw new Error(`${p.name}: temporarily unreachable (their server timed out recently). Skipping for ~${Math.ceil((cd - Date.now()) / 1000)}s — use another provider or wait.`);

    // إيقاف المستخدم بنفسه (زر Stop في شات Vetly Agent) — مبنحسبش مهلة ولا cooldown على المزوّد
    const userAborted = () => !!(opts.signal && opts.signal.aborted);
    const userAbortErr = () => { const e = new Error('Stopped by user'); e.isUserAbort = true; return e; };
    // سجل محادثة اختياري ({role, content}) للشات متعدد الأدوار — رسالة المستخدم الحالية (بالصور) بتتبني من prompt/images
    const history = Array.isArray(opts.history) ? opts.history : [];

    if (p.type === 'openai-compat') {
        const content = [{ type: 'text', text: prompt }];
        images.forEach(img => content.push({ type: 'image_url', image_url: { url: img.dataUrl } }));
        // json mode بيفعّل response_format عند المزوّدات اللي بتدعمه — ولو رفضته (400)
        // بنرجّع نفس الطلب من غيره تلقائيًا. opts.jsonMode بيطفّيه لطلبات توليد الكود.
        const jsonOn = (opts.jsonMode !== undefined) ? opts.jsonMode : (p.jsonMode !== false);
        const attempt = async (m, ms) => {
            const sys = String(opts.systemPrompt || '').trim();
            const messages = [];
            if (sys) messages.push({ role: 'system', content: sys });
            history.forEach(hm => {
                if (!hm || !hm.content) return;
                messages.push({ role: hm.role === 'assistant' ? 'assistant' : 'user', content: String(hm.content) });
            });
            messages.push({ role: 'user', content });
            // noAuth providers (LLM7): من غير هيدر Authorization — الـ CORS عندهم مش بيسمح بيه
            const headers = { 'Content-Type': 'application/json', ...((p.noAuth || !key) ? {} : { 'Authorization': `Bearer ${key}` }) };
            const doFetch = async (withJson, msgsOverride) => fetchT(p.url, {
                method: 'POST', headers,
                body: JSON.stringify({ model: m, messages: msgsOverride || messages, ...(withJson && jsonOn ? { response_format: { type: 'json_object' } } : {}) })
            }, ms);
            let r;
            try {
                r = await doFetch(true);
            } catch (e) {
                if (userAborted()) throw userAbortErr();
                setProviderCooldown(p.id, 180000);
                throw (e.name === 'AbortError') ? timeoutError(p, ms) : new Error(`${p.name}: browser blocked the request (CORS or network) — ${e.message}`);
            }
            if (!r.ok && r.status === 400) {
                try { r = await doFetch(false); } catch (e) {
                    if (userAborted()) throw userAbortErr();
                    setProviderCooldown(p.id, 180000);
                    throw (e.name === 'AbortError') ? timeoutError(p, ms) : new Error(`${p.name}: browser blocked the request (CORS or network) — ${e.message}`);
                }
            }
            // إندبوينتات صارمة بترفض رسالة system أو سجل المحادثة (موجودين في الأيجنت بس —
            // الفيتشرز بتبعت رسالة مستخدم واحدة) وكمان الكونتكست بيبقى تقيل ⇒ آخر محاولة:
            // رسالة مستخدم واحدة مدموج فيها الـ system — نفس شكل نداء الفيتشرز بالظبط
            if (!r.ok && r.status === 400 && (sys || history.length)) {
                const merged = [{ type: 'text', text: (sys ? sys + '\n\n' : '') + prompt }]
                    .concat((images || []).map(img => ({ type: 'image_url', image_url: { url: img.dataUrl } })));
                try { r = await doFetch(false, merged); } catch (e) {
                    if (userAborted()) throw userAbortErr();
                    setProviderCooldown(p.id, 180000);
                    throw (e.name === 'AbortError') ? timeoutError(p, ms) : new Error(`${p.name}: browser blocked the request (CORS or network) — ${e.message}`);
                }
            }
            if (!r.ok) {
                if (r.status >= 500) setProviderCooldown(p.id, 120000);
                const err = await apiError(p, r);
                // 401/402/403 = مفتاح/رصيد الحساب — نفس الخطأ هيضرب أي موديل تاني، الفولباك ملوش لازمة
                if (r.status === 401 || r.status === 402 || r.status === 403) err.isFatal = true;
                err.message = `${err.message} [model: ${m}]`;
                throw err;
            }
            const j = await r.json();
            clearProviderCooldown(p.id);
            return j.choices?.[0]?.message?.content || '';
        };
        // المرشحون بالترتيب: المحدد في Settings ← المحفوظ الناجح ← الموديلات اللي المستخدم
        // ضافها يدويًا للبروفايدر (Add Model) — دول متدقيقين من المستخدم فبتقدم على أي قايمة عشوائية.
        // وضع الاختبار السريع (opts.noFallback من زرار Test): موديل واحد بس — النتيجة الحقيقية بسرعة
        // من غير ما سلسلة الـ fallback تقعد تجرب 4-5 موديلات بتاخد دقايق
        let candidates = (opts.noFallback)
            ? [model || p.model].filter(Boolean)
            : [...new Set([model, getWorkingModel(p.id)].filter(Boolean))];
        (Array.isArray(p.models) ? p.models : []).forEach(mm => { if (mm && !candidates.includes(mm)) candidates.push(mm); });
        if (!candidates.length) {
            const names = await listModels(p, key);
            if (!names.length) throw new Error(`${p.name}: مفيش موديلات متاحة، حط اسم موديل في Settings`);
            const chat = names.filter(id => /(gpt|claude|gemini|llama|deepseek|qwen|mistral|grok|command)/i.test(id) && !/(embed|whisper|tts|dall|image|moderation|rerank)/i.test(id));
            candidates = (chat.length ? chat : names).slice(0, 3);
        }
        let lastErr = null, timedOut = false;
        const tried = []; // كل الموديلات المجرّبة بالترتيب — بتظهر في رسالة الخطأ النهائية عشان الاسم لا يبقى مفاجأة
        const tryModel = async (m, ms) => {
            tried.push(m);
            try {
                const text = await attempt(m, ms);
                setWorkingModel(p.id, m);
                return text;
            } catch (err) {
                lastErr = err;
                // خطأ مفتاح/رصيد (401/402/403): مش هيتصلح بموديل تاني — نوقف السلسلة فورًا
                if (err.isFatal) throw err;
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
        // كل المرشحين فشلوا ⇒ نجيب القايمة الكاملة ونجرب أقرب موديلات شات (من غيره في وضع noFallback)
        if (!timedOut && !opts.noFallback) {
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
        // آخر خطأ هو بتاع آخر موديل اتجرّب — بنضيف قايمة بكل اللي اتجربوا بالترتيب
        // (الأول فيهم دايمًا الموديل اللي المستخدم اختار)
        if (lastErr && tried.length > 1) lastErr.message += ' — ' + tr('tried: {m}', { m: tried.join(' → ') });
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
        // سجل المحادثة كنصوص + رسالة المستخدم الحالية (صور + نص) — مع دمج الرسايل المتتالية بنفس الدور
        const msgs = [];
        history.forEach(hm => {
            if (!hm || !hm.content) return;
            const role = hm.role === 'assistant' ? 'assistant' : 'user';
            const last = msgs[msgs.length - 1];
            if (last && last.role === role) last.content += '\n\n' + String(hm.content);
            else msgs.push({ role, content: String(hm.content) });
        });
        if (msgs.length && msgs[msgs.length - 1].role === 'user') {
            msgs[msgs.length - 1].content = [{ type: 'text', text: msgs[msgs.length - 1].content }].concat(content);
        } else {
            msgs.push({ role: 'user', content });
        }
        const r = await fetchT(p.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({ model, max_tokens: 16000, ...(sys ? { system: sys } : {}), messages: msgs })
        }, 150000).catch(e => {
            if (userAborted()) throw userAbortErr();
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
            // سجل المحادثة (user/model) + رسالة المستخدم الحالية (بالصور) — مع دمج المتتالي بنفس الدور
            const contents = [];
            history.forEach(hm => {
                if (!hm || !hm.content) return;
                const role = hm.role === 'assistant' ? 'model' : 'user';
                const last = contents[contents.length - 1];
                if (last && last.role === role) last.parts.push({ text: String(hm.content) });
                else contents.push({ role, parts: [{ text: String(hm.content) }] });
            });
            if (contents.length && contents[contents.length - 1].role === 'user') parts.forEach(pt => contents[contents.length - 1].parts.push(pt));
            else contents.push({ role: 'user', parts });
            return fetchT(
                `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents,
                        ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {}),
                        // opts.jsonMode === false (توليد كود / شات حر) ⇒ من غير responseMimeType
                        ...((opts.jsonMode === false) ? {} : { generationConfig: { responseMimeType: 'application/json' } })
                    })
                }, ms).catch(e => {
                    if (userAborted()) throw userAbortErr();
                    if (e.name === 'AbortError') { setProviderCooldown(p.id, 180000); throw timeoutError(p, ms); }
                    throw e;
                });
        };
        // 503/429 = ازدحام أو Rate limit مؤقت من جوجل — بنستنى وننجرب،
        // ولو فضل عريض بننتقل تلقائيًا لموديل flash تاني متاح لنفس المفتاح
        const busy = (r) => r && (r.status === 503 || r.status === 429);
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const wm = getWorkingModel(p.id);
        // المختار الأول زي openai-compat بالظبط — كان المحفوظ الناجح بيتجرّب قبل اختيار
        // المستخدم، فالخطأ كان بيطلع باسم موديل مش اللي اختاره
        let candidates = [...new Set([model, wm].filter(Boolean))];
        let r = null, usedModel = '';
        const triedG = [];
        let first = true;
        for (const m of candidates) {
            usedModel = m;
            triedG.push(m);
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
        // — إلا لو الخطأ مفتاح/رصيد (401/402/403) لأنه بيضرب أي موديل، أو في وضع noFallback (زرار Test)
        if (r && !r.ok && ![401, 402, 403].includes(r.status) && !opts.noFallback) {
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
                        triedG.push(m);
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
            if (triedG.length > 1) err.message += ' — ' + tr('tried: {m}', { m: triedG.join(' → ') });
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
        r = await fetchT(p.modelsUrl, { headers: p.noAuth ? {} : { 'Authorization': `Bearer ${key}` } }, 15000);
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
            const manualModels = (Array.isArray(c.models) ? c.models : []).map(m => String(m || '').trim()).filter(Boolean);
            return {
                id: c.id,
                name: c.name || 'Custom',
                type: 'openai-compat',
                url: base + '/chat/completions',
                modelsUrl: base + '/models',
                model: c.model || manualModels[0] || '',
                // الموديلات اللي المستخدم ضافها يدويًا (Add Model في Settings) — بتظهر في القوايم
                // كلها وبتدخل سلسلة الـ fallback قبل أي جلب عشوائي من /models
                models: manualModels,
                custom: true
            };
        });
}

// القايمة الكاملة: الأساسيين الأول ثم المزوّدات المخصصة
function getAllProviders() {
    return PROVIDERS.concat(getCustomProviders());
}

// المزوّد قابل للاستخدام؟ (عنده مفتاح — أو noAuth زي LLM7 اللي بيشتغل من غير مفتاح)
function providerUsable(p, keys) { return !!((keys[p.id] || '').trim() || p.noAuth); }

// pick (اختياري): { providerId, model } — لما المستخدم يختار model محدد من الـ ModelPicker
// بنجرب المزوّد ده هو بس بالموديل المختار (من غير fallback لمزوّد تاني)
// onStep (اختياري): كولباك بيوصل خطوات التقدم (اتصال / رد / نجاح / فشل) لكل محاولة
// contentKey (اختياري): مفتاح التخزين بتاع المحتوى المولود (wakil_bugs مثلًا) — عشان نظام
// ترجمة المحتوى يسجّل لغة التوليد **للفيتشر ده هو بس** من غير ما يبوّظ باقي الفيتشرز
async function runProviders({ keys, models, prompt, images, validate, pick, onStep, contentKey }) {
    const errors = [];
    const list = (pick && pick.providerId)
        ? getAllProviders().filter(x => x.id === pick.providerId)
        : getAllProviders().filter(x => providerUsable(x, keys));
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
            // لغة المحتوى المولّد بتتسجل **للفيتشر ده بس** عشان نظام الترجمة يعرف يترجم لما اللغة تتغير
            if (contentKey && typeof setKeyLang === 'function') setKeyLang(contentKey, getLang());
            return { data: valid, provider: p.name + (pick && pick.model ? ` (${pick.model})` : ''), errors };
        } catch (err) {
            console.warn(err.message);
            onStep && onStep(`❌ ${err.message}`);
            errors.push(err.message);
        }
    }
    return { data: null, provider: '', errors };
}
