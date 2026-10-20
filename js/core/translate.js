/* =====================================================================
   core/translate.js — v2: كاش ترجمة لكل لغة (Lazy + Cached)
   - wakil_x دايمًا بيحمل محتوى اللغة المعروضة حاليًا (getKeyLang)
   - كل لغة ليها slot خاص: wakil_x__<lang> — الأصل محفوظ في slot لغته
   - تبديل لغة:
       · النسخة موجودة في الكاش ⇒ استبدال فوري (صفر AI — صفر انتظار)
       · النسخة ناقصة ⇒ ترجمة في الخلفية، وكل فيتشر يخلص يظهر لحالة
         على طول عبر onFeature(key, data) — من غير أي reload
   - قبل أي تبديل: المحتوى الحالي بيتوقّع في slot لغته (park) — فالتعديلات
     والأصل محفوظين دايمًا. الحقول الحساسة (IDs/أنواع/أولويات/حالات) مش
     بتتبعت للـ AI أصلًا وبتترجع من الأصل بعد الدمج.
   - مش بيلمس المحتوى اليدوي: نص المتطلبات، نتائج الجولات (Expected/Actual)
   ===================================================================== */

// لغة المحتوى **لكل فيتشر على حدة** (مش عامة): توليد باج مثلًا مبيوّقش ترجمة الكيسز
function getKeyLang(key) { try { return localStorage.getItem(key + '__clang') || 'en'; } catch (e) { return 'en'; } }
function setKeyLang(key, l) { try { localStorage.setItem(key + '__clang', l); } catch (e) { /* ignore */ } }
// إعلان إن المحتوى الموجود كلّه بلغة الموقع الحالية (بيستخدم عند تحميل ستوري/مشروع)
function markAllContentLang(l) { _TR_KEYS.forEach(k => { if (localStorage.getItem(k) != null) setKeyLang(k, l); }); }

function _trLangName(l) { return { en: 'English', ar: 'Arabic', de: 'German' }[l] || 'English'; }
const _tlList = (v) => (Array.isArray(v) ? v : []);

// مفاتيح المحتوى المترجم (المحتوى اليدوي زي wakil_story مش هنا)
const _TR_KEYS = ['wakil_gap_data', 'wakil_sc_data', 'wakil_linked', 'wakil_ai_data', 'wakil_bugs', 'wakil_runs'];
const _trSlot = (key, lang) => key + '__' + lang;

// بصمة إصدار المحتوى: أي تعديل حقيقي بيرفع الإصدار ⇒ كل ترجمات المفتاح ده تبقى قديمة
// وبتتعاد تلقائيًا — ده اللي بيمنع "اختفاء" الجديد أو بقاء ترجمات قديمة
function _trGetVer(key) { try { return localStorage.getItem(key + '__ver') || ''; } catch (e) { return ''; } }
function _trBumpVer(key) { try { localStorage.setItem(key + '__ver', String(Date.now())); } catch (e) { /* ignore */ } }

function _trPrompt(fromName, toName, json) {
    return 'Translate the free-text values in the following JSON from ' + fromName + ' to ' + toName + '.\n' +
        'STRICT RULES:\n' +
        '1. Return ONLY the same JSON with EXACTLY the same structure, keys, nesting, array lengths and order — no comments, no markdown.\n' +
        '2. Never add, remove or rename any key.\n' +
        '3. Translate ONLY the free-text values (titles, descriptions, summaries, steps, questions, evidence, notes...).\n' +
        'JSON TO TRANSLATE:\n' + JSON.stringify(json);
}

async function _trCall(json, keys, fromLang) {
    const usable = getAllProviders().filter(p => providerUsable(p, keys));
    if (!usable.length) { const e = new Error('nokey'); e.noKey = true; throw e; }
    const p = usable[0];
    const text = await callProvider(p, (keys[p.id] || '').trim(), _trPrompt(_trLangName(fromLang || 'en'), _trLangName(getLang()), json), [], '', { jsonMode: true });
    return parseLoose(text, 'Translate');
}

// نسخة احتياطية قبل أي تبديل/ترجمة
function _trBackup() {
    try {
        const bk = {};
        _TR_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v) bk[k] = v; });
        localStorage.setItem('vetly_translate_backup', JSON.stringify({ at: new Date().toISOString(), data: bk }));
    } catch (e) { /* ignore */ }
}

// توقيع المحتوى الحالي في slot لغته — دايمًا (التعديلات بتتحفظ معاه)
// الـ slot مغلف بإصدار المحتوى اللي حمله: { v, d } — الكاش بيبقى صالح لو الإصدار مطابق
function _trPark(fromLang) {
    _TR_KEYS.forEach(k => {
        const v = localStorage.getItem(k);
        if (v == null) return;
        try { localStorage.setItem(_trSlot(k, fromLang), JSON.stringify({ v: _trGetVer(k), d: JSON.parse(v) })); } catch (e) { /* ignore */ }
    });
}

// كتابة نسخة لغة جديدة: slot + المفتاح الحالي + تحديث الواجهة فورًا
// (الإصدار المسجل = إصدار المحتوى المصدر اللي اترجم منه)
function _trCommit(key, data, toLang, onFeature) {
    const s = JSON.stringify({ v: _trGetVer(key), d: data });
    try {
        localStorage.setItem(_trSlot(key, toLang), s);
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) { /* quota */ }
    setKeyLang(key, toLang);
    onFeature && onFeature(key, data);
}

// ---------- الترجمة لكل فيتشر (بتقرا من wakil_x وتكتب نسخة toLang) ----------

async function _trGaps(keys, toLang, onFeature) {
    const gd = safeJSON('wakil_gap_data', null);
    if (!gd || typeof gd !== 'object' || !Array.isArray(gd.sections)) { _trCommit('wakil_gap_data', gd, toLang, onFeature); return true; }
    const secs = gd.sections;
    const fromLang = getKeyLang('wakil_gap_data');
    const newSecs = [];
    for (let i = 0; i < secs.length; i++) {
        const sec = secs[i] || {};
        const gaps0 = Array.isArray(sec.gaps) ? sec.gaps : [];
        const out = await _trCall({
            title: sec.title, summary: sec.summary,
            keyPoints: sec.keyPoints || [],
                    gaps: gaps0.map(g => ({ description: g.description, evidence: g.evidence, scenario: g.scenario, question: g.question }))
                }, keys, getKeyLang('wakil_gap_data'));
        const g2 = _tlList(out.gaps).map((g, gi) => {
            const o = gaps0[gi] || {};
            return { ...o, description: g.description ?? o.description, evidence: g.evidence ?? o.evidence, scenario: g.scenario ?? o.scenario, question: g.question ?? o.question };
        });
        newSecs.push({ ...sec, title: out.title ?? sec.title, summary: out.summary ?? sec.summary, keyPoints: _tlList(out.keyPoints).length ? out.keyPoints : (sec.keyPoints || []), gaps: g2 });
    }
    let cross = Array.isArray(gd.cross) ? gd.cross : [];
    if (cross.length) {
        const outC = await _trCall({ cross: cross.map(g => ({ description: g.description, evidence: g.evidence, scenario: g.scenario, question: g.question })) }, keys);
        cross = _tlList(outC.cross).map((g, gi) => {
            const o = (gd.cross || [])[gi] || {};
            return { ...o, description: g.description ?? o.description, evidence: g.evidence ?? o.evidence, scenario: g.scenario ?? o.scenario, question: g.question ?? o.question };
        });
    }
    const next = sanitizeGapResult({ ...gd, sections: newSecs, cross });
    const okShape = next && next.sections.length === secs.length
        && next.sections.every((s, i) => _tlList(s.gaps).length === _tlList((secs[i] || {}).gaps).length);
    if (!okShape) return false;
    _trCommit('wakil_gap_data', next, toLang, onFeature);
    return true;
}

async function _trScenarioKey(key, keys, toLang, onFeature) {
    const list = safeJSON(key, null);
    if (!Array.isArray(list) || !list.length) { _trCommit(key, list || [], toLang, onFeature); return true; }
    const out = await _trCall({ scenarios: list.map(s => ({ title: s.title })) }, keys);
    const merged = list.map((s, i) => ({ ...s, title: (_tlList(out.scenarios)[i] || {}).title ?? s.title }));
    const checked = sanitizeScenarioList(merged);
    const ok = checked.length === list.length && checked.every((s, i) => s.id === list[i].id);
    if (!ok) return false;
    _trCommit(key, checked, toLang, onFeature);
    return true;
}

async function _trCases(keys, toLang, onFeature) {
    const aid = safeJSON('wakil_ai_data', null);
    if (!aid || typeof aid !== 'object' || !Array.isArray(aid.testCases)) { _trCommit('wakil_ai_data', aid, toLang, onFeature); return true; }
    let newSc = aid.scenarios;
    if (Array.isArray(aid.scenarios) && aid.scenarios.length) {
        const outS = await _trCall({ scenarios: aid.scenarios.map(s => ({ title: s.title })) }, keys, getKeyLang('wakil_ai_data'));
        newSc = aid.scenarios.map((s, i) => ({ ...s, title: (_tlList(outS.scenarios)[i] || {}).title ?? s.title }));
    }
    const tcs = aid.testCases;
    const chunks = [];
    for (let i = 0; i < tcs.length; i += 25) chunks.push(tcs.slice(i, i + 25));
    const newTcs = [];
    for (const ch of chunks) {
        const out = await _trCall({
            testCases: ch.map(tc => ({ title: tc.title, technique: tc.technique, preCondition: tc.preCondition, testData: tc.testData, steps: tc.steps || [], expected: tc.expected }))
        }, keys, getKeyLang('wakil_ai_data'));
        _tlList(out.testCases).forEach((t, i) => {
            const o = ch[i] || {};
            newTcs.push({ ...o, title: t.title ?? o.title, technique: t.technique ?? o.technique, preCondition: t.preCondition ?? o.preCondition, testData: t.testData ?? o.testData, steps: _tlList(t.steps).length ? t.steps : (o.steps || []), expected: t.expected ?? o.expected });
        });
    }
    const next = sanitizeSuite({ scenarios: newSc, testCases: newTcs });
    const okIds = next.testCases.length === tcs.length
        && next.testCases.every((t, i) => t.id === tcs[i].id)
        && next.scenarios.length === _tlList(aid.scenarios).length;
    if (!okIds) return false;
    _trCommit('wakil_ai_data', next, toLang, onFeature);
    return true;
}

async function _trBugs(keys, toLang, onFeature) {
    const bd = safeJSON('wakil_bugs', null);
    if (!Array.isArray(bd)) { _trCommit('wakil_bugs', bd || [], toLang, onFeature); return true; }
    const chunks = [];
    for (let i = 0; i < bd.length; i += 30) chunks.push(bd.slice(i, i + 30));
    const newB = [];
    for (const ch of chunks) {
        const out = await _trCall({
            bugs: ch.map(b => ({ title: b.title, module: b.module, environment: b.environment, steps: b.steps, testData: b.testData, expected: b.expected, actual: b.actual }))
        }, keys, getKeyLang('wakil_bugs'));
        _tlList(out.bugs).forEach((t, i) => {
            const o = ch[i] || {};
            newB.push({ ...o, title: t.title ?? o.title, module: t.module ?? o.module, environment: t.environment ?? o.environment, steps: t.steps ?? o.steps, testData: t.testData ?? o.testData, expected: t.expected ?? o.expected, actual: t.actual ?? o.actual });
        });
    }
    const next = sanitizeBugs(newB);
    const okIds = next.length === bd.length && next.every((b, i) => b.id === bd[i].id);
    if (!okIds) return false;
    _trCommit('wakil_bugs', next, toLang, onFeature);
    return true;
}

// هل فيه فيتشرز محتاجة ترجمة AI للغة دي؟ (عددها — للشاشة المتحركة؛ الكاش الفوري مش محتاج)
function aiPendingTranslation(toLang) {
    let n = 0;
    _TR_KEYS.forEach(k => {
        if (localStorage.getItem(k) == null) return;
        if (getKeyLang(k) === toLang) return;
        const slot = localStorage.getItem(_trSlot(k, toLang));
        let fresh = false;
        if (slot != null) { try { const env = JSON.parse(slot); fresh = !!(env && env.v === _trGetVer(k) && env.d != null); } catch (e) { /* ignore */ } }
        if (!fresh) n++;
    });
    return n;
}

// ---------- Test Runs: اسم/بيئة/ملاحظات الجولة + Expected/Actual لكل كيس ----------
async function _trRuns(keys, toLang, onFeature) {
    const rd = safeJSON('wakil_runs', null);
    if (!Array.isArray(rd)) { _trCommit('wakil_runs', rd || [], toLang, onFeature); return true; }
    const chunks = [];
    for (let i = 0; i < rd.length; i += 8) chunks.push(rd.slice(i, i + 8));
    const newR = [];
    for (const ch of chunks) {
        const out = await _trCall({
            runs: ch.map(r => ({
                name: r.name, environment: r.environment, notes: r.notes,
                outputs: Object.entries(r.outputs || {}).map(([k2, v]) => ({ k: k2, expected: (v && v.expected) || '', actual: (v && v.actual) || '' }))
            }))
        }, keys, getKeyLang('wakil_runs'));
        _tlList(out.runs).forEach((t, i) => {
            const o = ch[i] || {};
            const tOuts = {};
            _tlList(t.outputs).forEach(e => { if (e && e.k != null) tOuts[e.k] = { expected: e.expected ?? ((o.outputs || {})[e.k] || {}).expected ?? '', actual: e.actual ?? ((o.outputs || {})[e.k] || {}).actual ?? '' }; });
            const outputs = Object.keys(o.outputs || {}).length
                ? Object.fromEntries(Object.entries(o.outputs).map(([k2, v]) => [k2, tOuts[k2] || v]))
                : tOuts;
            newR.push({ ...o, name: t.name ?? o.name, environment: t.environment ?? o.environment, notes: t.notes ?? o.notes, outputs });
        });
    }
    const next = sanitizeRuns(newR);
    const okIds = next.length === rd.length && next.every((r, i) => r.id === rd[i].id);
    if (!okIds) return false;
    _trCommit('wakil_runs', next, toLang, onFeature);
    return true;
}

// ---------- التبديل الرئيسي ----------
// handlers: { begin(n) قبل أي AI, step(label) أثناء الترجمة, feature(key, data) تطبيق الحالة فورًا }
// بترجع { done, failed, noKey, noop, busy }
let _trBusy = false; // قفل: مفيش تبان ترجمات متوازية (أي تبديل أثناء الترجمة بيرجع busy من غير ما يلمس حاجة)
async function aiSwapContentLang(toLang, handlers) {
    if (_trBusy) return { busy: true, done: [], failed: [], noop: false };
    _trBusy = true;
    try {
    const onStep = handlers && handlers.step;
    const onFeature = handlers && handlers.feature;
    const res = { done: [], failed: [], noKey: false, noop: true };

    // 1) لكل فيتشر: النسخة الحالية بتتوقّع في slot لغتها الحالية (الأصل + التعديلات محفوظين)
    //    والفيتشر اللي بلغة الهدف أصلًا مبيتلمسش خالص
    _TR_KEYS.forEach(k => {
        const v = localStorage.getItem(k);
        if (v == null) { setKeyLang(k, toLang); return; } // مفيش محتوى — نثبّت اللغة
        const cur = getKeyLang(k);
        if (cur === toLang) return;
        res.noop = false;
        try { localStorage.setItem(_trSlot(k, cur), JSON.stringify({ v: _trGetVer(k), d: JSON.parse(v) })); } catch (e) { /* ignore */ }
    });
    if (res.noop) return res;
    _trBackup();

    // 2) الاستعادة الفورية من الكاش (النسخ الصالحة فقط — اللي إصدارها مطابق للمحتوى الحالي)
    const needsTranslate = [];
    _TR_KEYS.forEach(k => {
        const cur = localStorage.getItem(k);
        if (cur == null) return; // مفيش محتوى للفيتشر ده أصلًا
        if (getKeyLang(k) === toLang) { res.done.push(k); return; }
        let hit = null;
        const slot = localStorage.getItem(_trSlot(k, toLang));
        if (slot != null) {
            try {
                const env = JSON.parse(slot);
                if (env && env.v === _trGetVer(k) && env.d != null) hit = env.d;
            } catch (e) { /* slot تالف ⇒ يتعاد */ }
        }
        if (hit != null) {
            try { localStorage.setItem(k, JSON.stringify(hit)); } catch (e) { /* quota */ }
            setKeyLang(k, toLang);
            onFeature && onFeature(k, hit);
            res.done.push(k);
        } else {
            needsTranslate.push(k);
        }
    });

    // 3) اللي ناقص: ترجمة في الخلفية (أو لو مفيش مفتاح: المحتوى ما بيتلمسش)
    if (needsTranslate.length) {
        const keys = safeJSON('wakil_keys', {});
        const usable = getAllProviders().filter(p => providerUsable(p, keys));
        if (!usable.length) { res.noKey = true; return res; }
        handlers && handlers.begin && handlers.begin(needsTranslate.length);
        for (const k of needsTranslate) {
            const label = { wakil_gap_data: 'Requirement Gaps', wakil_sc_data: 'Test Scenarios', wakil_linked: 'Linked Scenarios', wakil_ai_data: 'Test Cases', wakil_bugs: 'Bugs', wakil_runs: 'Test Runs' }[k] || k;
            try {
                onStep && onStep(label);
                let ok = false;
                if (k === 'wakil_gap_data') ok = await _trGaps(keys, toLang, onFeature);
                else if (k === 'wakil_sc_data') ok = await _trScenarioKey(k, keys, toLang, onFeature);
                else if (k === 'wakil_linked') ok = await _trScenarioKey(k, keys, toLang, onFeature);
                else if (k === 'wakil_ai_data') ok = await _trCases(keys, toLang, onFeature);
                else if (k === 'wakil_bugs') ok = await _trBugs(keys, toLang, onFeature);
                else if (k === 'wakil_runs') ok = await _trRuns(keys, toLang, onFeature);
                if (ok) res.done.push(k); else res.failed.push(label);
            } catch (e) {
                if (e.noKey) { res.noKey = true; return res; }
                res.failed.push(label);
            }
        }
    }

    return res;
    } finally { _trBusy = false; }
}
