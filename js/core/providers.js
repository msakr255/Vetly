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

async function callProvider(p, key, prompt, images, model) {
    key = cleanKey(key);
    model = model || p.model;
    if (p.type === 'openai-compat') {
        if (!model) {
            const names = await listModels(p, key);
            if (!names.length) throw new Error(`${p.name}: مفيش موديلات متاحة، حط اسم موديل في Settings`);
            model = names[0];
        }
        const content = [{ type: 'text', text: prompt }];
        images.forEach(img => content.push({ type: 'image_url', image_url: { url: img.dataUrl } }));
        const r = await fetch(p.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({ model, messages: [{ role: 'user', content }], ...(p.jsonMode === false ? {} : { response_format: { type: 'json_object' } }) })
        });
        if (!r.ok) throw await apiError(p, r);
        const j = await r.json();
        return j.choices?.[0]?.message?.content || '';
    }

    if (p.type === 'anthropic') {
        const content = [];
        images.forEach(img => {
            const { mime, b64 } = splitDataUrl(img.dataUrl);
            content.push({ type: 'image', source: { type: 'base64', media_type: mime, data: b64 } });
        });
        content.push({ type: 'text', text: prompt });
        const r = await fetch(p.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({ model, max_tokens: 16000, messages: [{ role: 'user', content }] })
        });
        if (!r.ok) throw await apiError(p, r);
        const j = await r.json();
        return j.content?.[0]?.text || '';
    }

    if (p.type === 'gemini') {
        const parts = [{ text: prompt }];
        images.forEach(img => {
            const { mime, b64 } = splitDataUrl(img.dataUrl);
            parts.push({ inlineData: { mimeType: mime, data: b64 } });
        });
        const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: { responseMimeType: 'application/json' }
                })
            }
        );
        if (!r.ok) throw await apiError(p, r);
        const j = await r.json();
        return j.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    return '';
}

// بيجيب أسماء الموديلات المتاحة من /v1/models (للمزوّدين المتوافقين مع OpenAI)
async function listModels(p, key) {
    if (!p.modelsUrl) return [];
    const r = await fetch(p.modelsUrl, { headers: { 'Authorization': `Bearer ${key}` } });
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
async function runProviders({ keys, models, prompt, images, validate }) {
    const errors = [];
    for (const p of PROVIDERS.filter(x => (keys[x.id] || '').trim())) {
        try {
            const text = await callProvider(p, keys[p.id].trim(), prompt, images, (models[p.id] || '').trim());
            const parsed = await parseLoose(text, p.name);
            const valid = validate(parsed);
            if (!valid) throw new Error(`${p.name}: response has no usable result`);
            return { data: valid, provider: p.name, errors };
        } catch (err) {
            console.warn(err.message);
            errors.push(err.message);
        }
    }
    return { data: null, provider: '', errors };
}
