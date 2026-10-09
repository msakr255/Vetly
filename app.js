const { useState, useEffect } = React;

// اسم الأداة (غيّره من هنا بس وهيتغير في كل مكان)
const APP_NAME = 'Vetly';
const APP_TAGLINE = 'QA Workbench';
const APP_DESIGNER = 'Eng. Mohamed Sakr';
const APP_DESIGNER_TITLE = 'Software Testing Engineer';

const AppLogo = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-label={APP_NAME}>
        <defs>
            <linearGradient id="qatchGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#2563eb" />
                <stop offset="1" stopColor="#7c3aed" />
            </linearGradient>
        </defs>
        <rect width="40" height="40" rx="10" fill="url(#qatchGrad)" />
        <circle cx="19" cy="19" r="9" fill="none" stroke="white" strokeWidth="3" />
        <path d="M14.5 19.5l3.2 3.2 6-6.4" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M25.5 25.5L31 31" stroke="white" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
);

/* =====================================================================
   1) HELPERS: تحميل المكتبات + قراءة الملفات (PDF / Word / Image)
   ===================================================================== */

const loadScript = (src) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
});

const readAsDataURL = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
});

const readAsText = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsText(file);
});

const readAsArrayBuffer = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsArrayBuffer(file);
});

async function extractPdfText(file) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await window.pdfjsLib.getDocument({ data: await readAsArrayBuffer(file) }).promise;
    let out = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        let line = '', lastY = null;
        for (const it of content.items) {
            const y = it.transform ? it.transform[5] : 0;
            if (lastY !== null && Math.abs(y - lastY) > 2) { out += line.trim() + '\n'; line = ''; }
            line += it.str + ' ';
            lastY = y;
        }
        out += line.trim() + '\n\n';
    }
    return out;
}

async function extractDocxText(file) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
    const result = await window.mammoth.extractRawText({ arrayBuffer: await readAsArrayBuffer(file) });
    return result.value;
}

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

async function callProvider(p, key, prompt, images, model) {
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
        if (!r.ok) throw new Error(`${p.name} ${r.status}: ${(await r.text()).slice(0, 200)}`);
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
        if (!r.ok) throw new Error(`${p.name} ${r.status}: ${(await r.text()).slice(0, 200)}`);
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
        if (!r.ok) throw new Error(`${p.name} ${r.status}: ${(await r.text()).slice(0, 200)}`);
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

const safeJSON = (key, fallback) => {
    try {
        const v = JSON.parse(localStorage.getItem(key));
        return v ?? fallback;
    } catch (e) {
        return fallback;
    }
};

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

// بيوحّد اسم النوع (لو الموديل كتب "Edge case" أو "Boundary" أو "negative" بأي شكل)
const normalizeType = (t) => {
    const s = String(t || '').toLowerCase();
    if (s.includes('edge') || s.includes('boundary') || s.includes('corner')) return 'Edge Case';
    if (s.includes('neg')) return 'Negative';
    return 'Positive';
};

/* =====================================================================
   3) MAIN APP
   ===================================================================== */

/* =====================================================================
   SANITIZE: بيحوّل أي رد من الموديل لشكل آمن للعرض (عشان مفيش شاشة بيضا)
   ===================================================================== */
const str = (v) => {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map(str).filter(Boolean).join(', ');
    if (typeof v === 'object') return Object.values(v).map(str).filter(Boolean).join(' ');
    return String(v);
};

const toSteps = (v) => {
    if (Array.isArray(v)) return v.map(x => str(x).trim()).filter(Boolean);
    if (typeof v === 'string') return v.split(/\r?\n/).map(x => x.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
    return [];
};

const normPriority = (v) => {
    const s = str(v).toLowerCase();
    if (s.startsWith('crit')) return 'Critical';
    if (s.startsWith('high')) return 'High';
    if (s.startsWith('low')) return 'Low';
    return 'Medium';
};

const normStatus = (v) => {
    const s = str(v).toLowerCase();
    if (s === 'pass') return 'Pass';
    if (s === 'fail') return 'Fail';
    return 'Untested';
};

const pad2 = (n) => String(n).padStart(2, '0');

const sanitizeScenarioList = (list) => (Array.isArray(list) ? list : [])
    .filter(x => x && typeof x === 'object')
    .map((sc, i) => ({
        id: str(sc.id) || `TS-${pad2(i + 1)}`,
        type: normalizeType(sc.type),
        title: str(sc.title),
        priority: normPriority(sc.priority)
    }));

const sanitizeSuite = (d) => ({
    scenarios: (Array.isArray(d?.scenarios) ? d.scenarios : [])
        .filter(x => x && typeof x === 'object')
        .map((sc, i) => ({ id: str(sc.id) || `TS-${pad2(i + 1)}`, title: str(sc.title) })),
    testCases: (Array.isArray(d?.testCases) ? d.testCases : [])
        .filter(x => x && typeof x === 'object')
        .map((tc, i) => ({
            id: str(tc.id) || `TC-${pad2(i + 1)}`,
            scenarioId: str(tc.scenarioId),
            type: normalizeType(tc.type),
            title: str(tc.title),
            technique: str(tc.technique),
            priority: normPriority(tc.priority),
            preCondition: str(tc.preCondition),
            testData: str(tc.testData),
            steps: toSteps(tc.steps),
            expected: str(tc.expected),
            actualResult: str(tc.actualResult),
            status: normStatus(tc.status)
        }))
});

/* لو حصل أي خطأ في العرض، بدل الشاشة البيضا بتظهر رسالة وزرار لمسح الداتا المحفوظة */
class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    render() {
        if (!this.state.error) return this.props.children;
        const resetData = () => {
            ['wakil_ai_data', 'wakil_story', 'wakil_sc_data', 'wakil_sc_story', 'wakil_linked', 'wakil_gap_data', 'wakil_gap_text', 'wakil_bugs']
                .forEach(k => localStorage.removeItem(k));
            location.reload();
        };
        return (
            <div className="p-8 max-w-xl mx-auto mt-16 bg-white border border-red-200 rounded-xl shadow text-sm space-y-3">
                <h2 className="font-bold text-red-700 text-base">حصل خطأ في عرض الصفحة</h2>
                <p className="text-slate-600">{String(this.state.error && this.state.error.message || this.state.error)}</p>
                <div className="flex gap-2">
                    <button onClick={() => location.reload()} className="bg-slate-200 px-3 py-2 rounded font-medium">Reload</button>
                    <button onClick={resetData} className="bg-red-600 text-white px-3 py-2 rounded font-medium">Reset saved data (المفاتيح هتفضل زي ما هي)</button>
                </div>
            </div>
        );
    }
}

/* =====================================================================
   REQUIREMENT GAP ANALYSIS: المرجعية (Knowledge Base) + التحليل + التقرير
   ===================================================================== */

// المرجعية اللي الـ AI بيشتغل بيها (مستخرجة من ملف Session 5: Requirements Deep-Dive)
const GAP_KB = `KNOWLEDGE BASE - REQUIREMENT REVIEW METHODOLOGY (use ONLY this methodology and taxonomy):

A. Requirement document levels
- BRD (Business Requirement Document): high-level "WHY" - business problem, goals, scope, regulations, ROI. Used for scope validation (UAT).
- SRS (Software Requirement Specification): "WHAT" the system must do - functional + non-functional (performance, security, usability). Used for test strategy and scenarios.
- FRS (Functional Requirement Specification): "HOW exactly" - field-level rules, screen flow, system responses. Used for detailed test case design.
- User stories / acceptance criteria are small-scale requirements: judge them mainly for testable Given/When/Then conditions.
- All levels should tell one consistent story; check consistency between them.

B. Components a COMPLETE requirement should contain (check each one):
1. Preconditions - state that must be true before the feature starts.
2. Business Rules - policies, constraints, limits independent of any screen.
3. Field Validations - data type, format, length, range, mandatory/optional, error text per input field.
4. Assumptions - unstated conditions taken for granted.
5. Dependencies - other systems/features/teams the requirement relies on.
6. Acceptance Criteria - specific, testable Given/When/Then pass conditions.
7. Exception Handling - defined behavior for failure and negative paths, not just the happy path.
8. UI / Screen Flow - screen sequence, wireframes, on-screen messages and labels.
9. Data Requirements - what must be stored, logged, or mapped between systems.
10. Out of Scope - what is explicitly excluded.

C. The nine gap types (use EXACTLY these names):
1. Missing requirement - a scenario is not addressed at all.
2. Ambiguous requirement - wording allows multiple interpretations (e.g. "respond quickly" with no threshold).
3. Incomplete requirement - partially defined logic (e.g. a limit is stated but its reset time is not).
4. Conflicting requirement - statements or documents disagree (e.g. one place says limit 10,000, another says 5,000).
5. Assumed / implicit requirement - expected behavior that was never written down.
6. Non-functional gap - missing performance, security, or usability requirement.
7. UI/UX & error-message gap - screen flow or exact error text is not specified.
8. Negative scenario gap - failure paths are not defined.
9. Business rule gap - rules are incomplete for edge cases.

D. How to find gaps:
- Check consistency line by line; look for requirements with no counterpart (traceability).
- Apply test design techniques (Boundary Value Analysis, Equivalence Partitioning, Decision Tables): gaps surface when you try to design test cases.
- Imagine the process as a flowchart: missing branches are gaps.
- Ask deliberate "what if" and negative questions for every step.
- Testability check: if you cannot write a pass/fail test for it, it is a gap.
- SMART filter: Specific, Measurable, Achievable, Relevant, Time-bound.

E. A gap log entry includes: Gap ID, Requirement reference (exact document/section), Description (clear factual statement), Type, Example/scenario (concrete case showing the impact), Question to BA/PO (the exact decision needed), Priority/Impact (High/Medium/Low), Status and Owner.

F. Best practices: be specific and cite the exact section; always attach a concrete example; priority High = affects a core transaction path, money or data integrity, security, legal/regulatory compliance, or blocks test design.

G. Style illustration (NOT part of the input, never copy it): Description "No requirement defines the behavior when the system cannot fulfil the exact requested amount using the available note denominations." Scenario "Customer requests 150 EGP but the machine only holds 100 and 500 notes." Question "Should the transaction be rejected, rounded down, or should the customer choose a fulfillable amount? What message is displayed?"`;

const GAP_TYPES = ['Missing requirement', 'Ambiguous requirement', 'Incomplete requirement', 'Conflicting requirement', 'Assumed / implicit requirement', 'Non-functional gap', 'UI/UX & error-message gap', 'Negative scenario gap', 'Business rule gap'];
const GAP_COMPONENTS = ['Preconditions', 'Business Rules', 'Field Validations', 'Assumptions', 'Dependencies', 'Acceptance Criteria', 'Exception Handling', 'UI / Screen Flow', 'Data Requirements', 'Out of Scope'];

const normalizeGapType = (v) => {
    const t = str(v).toLowerCase().trim();
    const exact = GAP_TYPES.find(x => x.toLowerCase() === t);
    if (exact) return exact;
    if (t.includes('negative')) return 'Negative scenario gap';
    if (t.includes('conflict') || t.includes('contradict')) return 'Conflicting requirement';
    if (t.includes('ambig') || t.includes('vague')) return 'Ambiguous requirement';
    if (t.includes('incomplete') || t.includes('partial')) return 'Incomplete requirement';
    if (t.includes('assum') || t.includes('implicit')) return 'Assumed / implicit requirement';
    if (t.includes('non-func') || t.includes('nonfunc') || t.includes('performance') || t.includes('security') || t.includes('usability')) return 'Non-functional gap';
    if (t.includes('ui') || t.includes('ux') || t.includes('message') || t.includes('screen')) return 'UI/UX & error-message gap';
    if (t.includes('business rule') || t.includes('rule')) return 'Business rule gap';
    return 'Missing requirement';
};

const gapPriority = (v) => { const p = normPriority(v); return p === 'Critical' ? 'High' : (p === 'Low' ? 'Low' : (p === 'High' ? 'High' : 'Medium')); };
const gapStatus = (v) => ['Open', 'Answered', 'Closed'].includes(str(v)) ? str(v) : 'Open';

const sanitizeGap = (g) => ({
    id: '',
    type: normalizeGapType(g.type),
    requirementRef: str(g.requirementRef || g.ref || g.reference),
    description: str(g.description),
    evidence: str(g.evidence),
    scenario: str(g.scenario || g.example),
    question: str(g.question || g.questionToBA),
    priority: gapPriority(g.priority),
    status: 'Open'
});

const sanitizeGapList = (list) => (Array.isArray(list) ? list : [])
    .filter(x => x && typeof x === 'object')
    .map(sanitizeGap)
    .filter(g => g.description);

const normalizeCoverage = (c) => {
    const out = {};
    GAP_COMPONENTS.forEach(k => {
        const v = str(c && typeof c === 'object' ? c[k] : '').toLowerCase();
        out[k] = v.startsWith('pres') ? 'Present' : v.startsWith('part') ? 'Partial' : v.startsWith('miss') ? 'Missing' : 'N/A';
    });
    return out;
};

const sanitizeGapSection = (p) => {
    if (!p || typeof p !== 'object' || !Array.isArray(p.gaps)) return null;
    return {
        sectionType: str(p.sectionType),
        summary: str(p.summary),
        keyPoints: (Array.isArray(p.keyPoints) ? p.keyPoints : []).map(str).filter(Boolean).slice(0, 10),
        coverage: normalizeCoverage(p.componentsCoverage || p.coverage),
        gaps: sanitizeGapList(p.gaps)
    };
};

// بينضّف الداتا المحفوظة في المتصفح (يحافظ على الـ ID والحالة)
const sanitizeGapResult = (d) => {
    if (!d || typeof d !== 'object') return null;
    const keep = (list) => (Array.isArray(list) ? list : [])
        .filter(x => x && typeof x === 'object')
        .map(g => ({ ...sanitizeGap(g), id: str(g.id), status: gapStatus(g.status) }))
        .filter(g => g.description);
    return {
        sections: (Array.isArray(d.sections) ? d.sections : []).filter(x => x && typeof x === 'object').map(sec => ({
            title: str(sec.title), doc: str(sec.doc), sectionType: str(sec.sectionType), summary: str(sec.summary),
            keyPoints: (Array.isArray(sec.keyPoints) ? sec.keyPoints : []).map(str),
            coverage: normalizeCoverage(sec.coverage), gaps: keep(sec.gaps), error: str(sec.error)
        })),
        cross: keep(d.cross),
        createdAt: str(d.createdAt)
    };
};

const assignGapIds = (sections, cross) => {
    let n = 0;
    const next = () => `GAP-${String(++n).padStart(3, '0')}`;
    return {
        sections: sections.map(sec => ({ ...sec, gaps: sec.gaps.map(g => ({ ...g, id: next() })) })),
        cross: cross.map(g => ({ ...g, id: next() }))
    };
};

/* ---------- تقسيم المستند لسكاشن حسب العناوين ---------- */
const GAP_MAX_CHUNK = 9000;
const GAP_MIN_SECTION = 300;

function splitIntoSections(text) {
    const lines = text.replace(/\r/g, '').split('\n');
    const isFileMarker = (t) => /^---\s*Content from .+---$/.test(t);
    const isHeading = (l) => {
        const t = l.trim();
        if (!t || t.length > 110) return false;
        if (isFileMarker(t)) return true;
        if (/^#{1,6}\s+\S/.test(t)) return true;
        const words = t.split(/\s+/).length;
        const noEnd = !/[.!?؟:;,]$/.test(t);
        if (/^\d+(\.\d+){0,4}[.)]?\s+\S/.test(t) && noEnd && words <= 12) return true;
        if (/^(section|chapter|epic|feature|module|user story|story|use case)\b/i.test(t) && noEnd && words <= 14) return true;
        if (/^(US|REQ|FR|NFR|BR|AC|SRS|BRD|FRS)[-_ ]?\d+/i.test(t) && words <= 16) return true;
        if (t === t.toUpperCase() && /[A-Z]{3}/.test(t) && noEnd && words <= 10) return true;
        return false;
    };

    let doc = 'Pasted text';
    let cur = { title: 'Document start', doc, body: [] };
    const raw = [];
    for (const line of lines) {
        const t = line.trim();
        if (isHeading(line)) {
            if (cur.body.join('\n').trim() || raw.length === 0 && cur.title !== 'Document start') raw.push(cur);
            else if (cur.body.join('\n').trim()) raw.push(cur);
            const m = /^---\s*Content from (.+?)\s*---$/.exec(t);
            if (m) { doc = m[1]; cur = { title: 'File: ' + m[1], doc, body: [] }; }
            else cur = { title: t.replace(/^#{1,6}\s+/, ''), doc, body: [] };
        } else {
            cur.body.push(line);
        }
    }
    if (cur.body.join('\n').trim()) raw.push(cur);

    let secs = raw.map(x => ({ title: x.title, doc: x.doc, text: x.body.join('\n').trim() })).filter(x => x.text);
    if (secs.length === 0) return [];

    // دمج الأقسام الصغيرة جداً مع اللي بعدها
    const merged = [];
    let carry = '';
    let carryTitles = [];
    for (let i = 0; i < secs.length; i++) {
        const sec = secs[i];
        const body = (carry ? carry + '\n\n' : '') + sec.text;
        if (body.length < GAP_MIN_SECTION && i < secs.length - 1) {
            carry = (carry ? carry + '\n\n' : '') + `${sec.title}\n${sec.text}`;
            carryTitles.push(sec.title);
            continue;
        }
        let title = [...carryTitles, sec.title].join(' + ');
        if (title.length > 110) title = title.slice(0, 107) + '...';
        merged.push({ title, doc: sec.doc, text: body });
        carry = '';
        carryTitles = [];
    }

    // تقسيم الأقسام الكبيرة جداً حسب الفقرات
    const out = [];
    for (const sec of merged) {
        if (sec.text.length <= GAP_MAX_CHUNK) { out.push(sec); continue; }
        const paras = sec.text.split(/\n\s*\n/);
        const parts = [];
        let buf = '';
        for (const p of paras) {
            if ((buf + '\n\n' + p).length > GAP_MAX_CHUNK && buf) { parts.push(buf); buf = p; }
            else buf = buf ? buf + '\n\n' + p : p;
            while (buf.length > GAP_MAX_CHUNK * 1.5) { parts.push(buf.slice(0, GAP_MAX_CHUNK)); buf = buf.slice(GAP_MAX_CHUNK); }
        }
        if (buf) parts.push(buf);
        parts.forEach((txt, i) => out.push({ title: `${sec.title} (part ${i + 1}/${parts.length})`, doc: sec.doc, text: txt }));
    }
    return out;
}

function buildGapChunks(text, images) {
    let chunks = text.trim() ? splitIntoSections(text) : [];
    if (chunks.length === 0 && text.trim()) chunks = [{ title: 'Requirement text', doc: 'Pasted text', text: text.trim() }];
    if (images.length) chunks.push({ title: 'Uploaded images', doc: 'Images', text: '(The requirements for this section are in the attached image(s).)', images });
    return chunks;
}

const buildSectionPrompt = (chunk, idx, total) => `You are a Senior QA Engineer and Acting QC Lead performing a REQUIREMENT REVIEW. Your only job is to find requirement GAPS in the section below, using the methodology in the KNOWLEDGE BASE.

${GAP_KB}

DOCUMENT: "${chunk.doc}"
SECTION ${idx + 1} of ${total}: "${chunk.title}"

RULES:
1. Base every gap ONLY on what is written (or conspicuously missing) in THIS section. Never invent requirements, numbers or systems that are not in the text.
2. Every gap needs: the exact requirement reference (use the IDs/headings/numbering found in the text), a short verbatim evidence quote of at most 25 words (use "Not stated" when the gap is something missing), a concrete scenario showing the impact, and the exact question the BA/PO must answer.
3. "type" must be EXACTLY one of the nine gap types listed in the knowledge base.
4. "priority" must be "High", "Medium" or "Low".
5. For the 10 components in section B, report "Present", "Partial", "Missing" or "N/A" (N/A only when the component is irrelevant for this kind of section, e.g. field validations in a business-vision paragraph).
6. Do not pad. If the section is clear and testable, return an empty gaps list. Quality over quantity (typically 0-8 gaps per section).
7. "sectionType" is your best judgement of the content level: "BRD", "SRS", "FRS", "User Story", "Acceptance Criteria" or "Other".
8. "keyPoints": up to 8 short statements of the key requirements stated in this section (used later for a cross-section consistency check).
9. Write everything in English, except verbatim evidence quotes which stay in the original language.

Return ONLY a valid JSON object, no markdown and no extra text, exactly in this structure:
{"sectionType":"SRS","summary":"1-2 sentences describing what this section specifies","keyPoints":["..."],"componentsCoverage":{"Preconditions":"Present","Business Rules":"Missing","Field Validations":"Partial","Assumptions":"N/A","Dependencies":"N/A","Acceptance Criteria":"Missing","Exception Handling":"Missing","UI / Screen Flow":"N/A","Data Requirements":"N/A","Out of Scope":"Missing"},"gaps":[{"type":"Missing requirement","requirementRef":"Section 3.2","description":"Clear factual gap statement","evidence":"short quote or Not stated","scenario":"Concrete example showing impact","question":"The exact decision needed from the BA/PO","priority":"High"}]}

SECTION TEXT:
"""
${chunk.text}
"""`;

const buildCrossPrompt = (sections) => `You are a Senior QA Engineer and Acting QC Lead. Below are condensed digests of every section of one requirements document set. Using the KNOWLEDGE BASE, find ONLY CROSS-SECTION gaps: conflicting requirements between sections or documents, inconsistent numbers/limits/terminology, higher-level requirements (e.g. BRD goals) with no matching lower-level requirement (SRS/FRS), and missing traceability. Do NOT repeat gaps that belong to a single section.

${GAP_KB}

RULES:
1. Use only what is in the digests. Do not invent facts.
2. "requirementRef" must name the sections involved (e.g. "Section 2 vs Section 5").
3. "type" must be EXACTLY one of the nine gap types. "priority" is "High", "Medium" or "Low".
4. If there are no cross-section gaps, return an empty list. Write in English.

Return ONLY valid JSON: {"gaps":[{"type":"Conflicting requirement","requirementRef":"...","description":"...","evidence":"short quote or Not stated","scenario":"...","question":"...","priority":"High"}]}

SECTION DIGESTS:
${sections.map((sec, i) => `[${i + 1}] ${sec.title} (${sec.doc}, ${sec.sectionType || 'n/a'}): ${sec.summary}\n   Key points: ${sec.keyPoints.join(' | ') || 'none'}`).join('\n')}`;

/* ---------- التقرير ---------- */
const escHtml = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const flattenGaps = (d) => {
    const out = [];
    (d?.sections || []).forEach(sec => sec.gaps.forEach(g => out.push({ ...g, section: sec.title, doc: sec.doc })));
    (d?.cross || []).forEach(g => out.push({ ...g, section: 'Cross-section', doc: 'All documents' }));
    return out;
};

const downloadBlob = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

function buildGapReportHtml({ gapData, assignee, recipient, project }) {
    const all = flattenGaps(gapData);
    const count = (fn) => all.filter(fn).length;
    const date = new Date().toISOString().slice(0, 10);
    const who = escHtml(assignee) + (recipient.trim() ? ' - ' + escHtml(recipient.trim()) : '');
    const prio = (p) => `<span class="${p}">${p}</span>`;
    const gapTable = (gaps) => `<table><tr><th>Gap ID</th><th>Type</th><th>Priority</th><th>Requirement Ref.</th><th>Description</th><th>Scenario</th><th>Question to ${escHtml(assignee)}</th><th>Status</th></tr>` +
        gaps.map(g => `<tr><td>${escHtml(g.id)}</td><td>${escHtml(g.type)}</td><td>${prio(g.priority)}</td><td>${escHtml(g.requirementRef)}</td><td>${escHtml(g.description)}${g.evidence && g.evidence !== 'Not stated' ? `<br/><i>Evidence: ${escHtml(g.evidence)}</i>` : ''}</td><td>${escHtml(g.scenario)}</td><td>${escHtml(g.question)}</td><td>${escHtml(g.status)}</td></tr>`).join('') + '</table>';

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><title>Requirement Gap Analysis Report</title>
<style>
body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1e293b}
h1{color:#1d4ed8;font-size:22pt;margin-bottom:2pt} h2{color:#1d4ed8;font-size:15pt;border-bottom:1px solid #cbd5e1;padding-bottom:2pt;margin-top:18pt}
h3{font-size:12pt;color:#0f172a;margin-top:12pt}
table{border-collapse:collapse;width:100%;margin:6pt 0}
td,th{border:1px solid #94a3b8;padding:4pt;vertical-align:top;font-size:9.5pt}
th{background:#2563eb;color:#ffffff;text-align:left}
.meta td{border:none;padding:2pt 6pt 2pt 0;font-size:11pt}
.High{color:#b91c1c;font-weight:bold} .Medium{color:#b45309;font-weight:bold} .Low{color:#15803d;font-weight:bold}
.Present{color:#15803d} .Partial{color:#b45309} .Missing{color:#b91c1c;font-weight:bold}
.note{color:#64748b;font-size:9.5pt}
</style></head><body>
<h1>Requirement Gap Analysis Report</h1>
<table class="meta">
<tr><td><b>Project / Feature:</b></td><td>${escHtml(project.trim() || 'N/A')}</td></tr>
<tr><td><b>Prepared for:</b></td><td>${who}</td></tr>
<tr><td><b>Prepared by:</b></td><td>QA Team</td></tr>
<tr><td><b>Date:</b></td><td>${date}</td></tr>
<tr><td><b>Source documents:</b></td><td>${escHtml([...new Set((gapData.sections || []).map(s => s.doc))].join(', '))}</td></tr>
</table>

<h2>1. Executive Summary</h2>
<p>The requirements were reviewed section by section against a structured gap-analysis methodology (completeness of requirement components, testability, consistency, and the standard gap types). A total of <b>${all.length}</b> gaps were identified across <b>${gapData.sections.length}</b> section(s), including cross-section checks.</p>
<table><tr><th>High</th><th>Medium</th><th>Low</th><th>Total</th></tr><tr><td>${count(g => g.priority === 'High')}</td><td>${count(g => g.priority === 'Medium')}</td><td>${count(g => g.priority === 'Low')}</td><td>${all.length}</td></tr></table>
<h3>Gaps by type</h3>
<table><tr><th>Gap type</th><th>Count</th></tr>${GAP_TYPES.map(t => `<tr><td>${escHtml(t)}</td><td>${count(g => g.type === t)}</td></tr>`).join('')}</table>
<p class="note">Please review each item below and provide the requested decisions. Each gap includes the exact requirement reference, a concrete scenario showing the impact, and the specific question that needs an answer.</p>

<h2>2. Findings by Section</h2>`;

    gapData.sections.forEach((sec, i) => {
        html += `<h3>2.${i + 1} ${escHtml(sec.title)}</h3><p class="note">Document: ${escHtml(sec.doc)}${sec.sectionType ? ' | Level: ' + escHtml(sec.sectionType) : ''}</p>`;
        if (sec.error) { html += `<p class="High">This section could not be analyzed: ${escHtml(sec.error)}</p>`; return; }
        if (sec.summary) html += `<p>${escHtml(sec.summary)}</p>`;
        html += `<table><tr><th>Requirement component</th><th>Coverage</th></tr>${GAP_COMPONENTS.map(c => `<tr><td>${c}</td><td class="${sec.coverage[c] === 'N/A' ? '' : sec.coverage[c]}">${sec.coverage[c]}</td></tr>`).join('')}</table>`;
        html += sec.gaps.length ? gapTable(sec.gaps) : '<p>No gaps identified in this section.</p>';
    });

    html += `<h2>3. Cross-Section Findings</h2>`;
    html += (gapData.cross || []).length ? gapTable(gapData.cross) : '<p>No cross-section gaps identified.</p>';

    const byPrio = ['High', 'Medium', 'Low'].map(p => ({ p, items: all.filter(g => g.priority === p && g.question) }));
    html += `<h2>4. Questions Requiring a Decision from the ${escHtml(assignee)}</h2>`;
    byPrio.forEach(({ p, items }) => {
        if (!items.length) return;
        html += `<h3>${p} priority</h3><ol>${items.map(g => `<li><b>${escHtml(g.id)}</b> (${escHtml(g.requirementRef || g.section)}): ${escHtml(g.question)}</li>`).join('')}</ol>`;
    });

    html += `<h2>5. Consolidated Gap Log</h2>` + (all.length ? gapTable(all) : '<p>No gaps identified.</p>');
    html += `<p class="note">Status values: Open / Answered / Closed. Owner: ${escHtml(assignee)}${recipient.trim() ? ' (' + escHtml(recipient.trim()) + ')' : ''}.</p></body></html>`;
    return html;
}

/* =====================================================================
   BUG REPORT: القالب الثابت + الربط (Traceability) + التقرير
   ===================================================================== */
const BUG_STATUSES = ['New', 'Open', 'In Progress', 'Fixed', 'Retest', 'Closed', 'Rejected'];
const LEVELS = ['Critical', 'High', 'Medium', 'Low'];

const nextBugId = (ids) => {
    const max = Math.max(0, ...ids.map(i => parseInt(String(i || '').replace(/\D/g, ''), 10) || 0));
    return `BUG-${String(max + 1).padStart(3, '0')}`;
};

const sanitizeBug = (b) => ({
    id: str(b.id),
    title: str(b.title),
    module: str(b.module),
    severity: normPriority(b.severity),
    priority: normPriority(b.priority),
    environment: str(b.environment),
    steps: Array.isArray(b.steps) ? b.steps.map(str).join('\n') : str(b.steps),
    testData: str(b.testData),
    expected: str(b.expected),
    actual: str(b.actual),
    status: BUG_STATUSES.includes(str(b.status)) ? str(b.status) : 'New',
    testCaseId: str(b.testCaseId),
    testCaseTitle: str(b.testCaseTitle),
    scenarioId: str(b.scenarioId),
    gapId: str(b.gapId)
});

const sanitizeBugs = (list) => (Array.isArray(list) ? list : [])
    .filter(x => x && typeof x === 'object')
    .map(sanitizeBug);

const bugTraceNote = (b) => `This bug traces back to ${b.gapId ? `Gap ${b.gapId} → ` : ''}${b.scenarioId ? `Scenario ${b.scenarioId} → ` : ''}${b.testCaseId ? `Test Case ${b.testCaseId}` : 'a manually reported defect'} — caught during execution.`;

const buildBugPrompt = (tc, moduleGuess) => `You are a Senior QA Engineer writing a defect report. A test case FAILED during execution. Write the bug header fields from the information below.

TEST CASE ${tc.id}: ${tc.title}
Scenario: ${moduleGuess || tc.scenarioId || 'N/A'}
Test priority: ${tc.priority}
Test data: ${tc.testData || 'N/A'}
Steps: ${(tc.steps || []).join(' | ') || 'N/A'}
Expected result: ${tc.expected || 'N/A'}
Actual result (written by the tester): ${tc.actualResult || 'Not provided'}

Rules:
1. "title": ONE concise sentence in bug style describing the faulty behavior that actually occurred (example style: "Balance Inquiry fails silently when the core banking host times out"). Do not start with "Verify", "Check" or "Ensure". If the actual result is not provided, base it on the expected result not being met.
2. "module": the feature/screen area (example style: "ATM - Balance Inquiry").
3. "severity": technical impact of actual vs expected. "priority": urgency considering business impact and the test priority. Both must be exactly one of "Critical", "High", "Medium", "Low".
4. Use only the information given. Do not invent details.

Return ONLY valid JSON with no markdown: {"title":"...","module":"...","severity":"High","priority":"High"}`;

// صفوف الـ Traceability: Scenario ← Test Case ← Bug (+ Gap)
const buildTraceRows = (data, bugs) => {
    const rows = [];
    const cases = data?.testCases || [];
    const scMap = new Map();
    (data?.scenarios || []).forEach(sc => scMap.set(sc.id, sc.title));
    cases.forEach(tc => { if (tc.scenarioId && !scMap.has(tc.scenarioId)) scMap.set(tc.scenarioId, ''); });
    const bugsOf = (tc) => bugs.filter(b => b.testCaseId === tc.id && b.testCaseTitle === tc.title);
    scMap.forEach((title, scId) => {
        const tcs = cases.filter(tc => tc.scenarioId === scId);
        if (!tcs.length) rows.push({ scenarioId: scId, scenarioTitle: title, tc: null, bugs: [] });
        tcs.forEach(tc => rows.push({ scenarioId: scId, scenarioTitle: title, tc, bugs: bugsOf(tc) }));
    });
    const linked = new Set(rows.flatMap(r => r.bugs.map(b => b.id)));
    bugs.filter(b => !linked.has(b.id)).forEach(b => rows.push({ scenarioId: b.scenarioId, scenarioTitle: '', tc: null, bugs: [b], unlinked: true }));
    return rows;
};

function buildBugReportHtml({ bugs, project, env, data }) {
    const date = new Date().toISOString().slice(0, 10);
    const count = (fn) => bugs.filter(fn).length;
    const nl = (t) => escHtml(t).replace(/\n/g, '<br/>');
    const lv = (p) => `<span class="${p}">${p}</span>`;
    const rows = buildTraceRows(data, bugs);

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><title>Bug Report</title>
<style>
body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1e293b}
h1{color:#1d4ed8;font-size:22pt;margin-bottom:2pt} h2{color:#1d4ed8;font-size:15pt;border-bottom:1px solid #cbd5e1;padding-bottom:2pt;margin-top:18pt}
table{border-collapse:collapse;width:100%;margin:6pt 0}
td,th{border:1px solid #cbd5e1;padding:5pt;vertical-align:top;font-size:10pt}
th.l{background:#1e293b;color:#ffffff;text-align:left;width:22%}
th.h{background:#2563eb;color:#ffffff;text-align:left}
.meta td{border:none;padding:2pt 6pt 2pt 0;font-size:11pt}
.Critical{color:#7f1d1d;font-weight:bold} .High{color:#b91c1c;font-weight:bold} .Medium{color:#b45309;font-weight:bold} .Low{color:#15803d;font-weight:bold}
.note{color:#64748b;font-size:9.5pt;font-style:italic}
</style></head><body>
<h1>Bug Report</h1>
<table class="meta">
<tr><td><b>Project / Feature:</b></td><td>${escHtml(project.trim() || 'N/A')}</td></tr>
<tr><td><b>Environment:</b></td><td>${escHtml(env.trim() || 'N/A')}</td></tr>
<tr><td><b>Reported by:</b></td><td>QA Team</td></tr>
<tr><td><b>Date:</b></td><td>${date}</td></tr>
</table>

<h2>1. Summary</h2>
<table><tr><th class="h">Total bugs</th><th class="h">Critical</th><th class="h">High</th><th class="h">Medium</th><th class="h">Low</th></tr>
<tr><td>${bugs.length}</td><td>${count(b => b.severity === 'Critical')}</td><td>${count(b => b.severity === 'High')}</td><td>${count(b => b.severity === 'Medium')}</td><td>${count(b => b.severity === 'Low')}</td></tr></table>
<table><tr>${BUG_STATUSES.map(st => `<th class="h">${st}</th>`).join('')}</tr><tr>${BUG_STATUSES.map(st => `<td>${count(b => b.status === st)}</td>`).join('')}</tr></table>

<h2>2. Bug Details</h2>`;

    bugs.forEach(b => {
        const r = (label, val) => `<tr><th class="l">${label}</th><td>${val}</td></tr>`;
        html += `<p class="note">${escHtml(bugTraceNote(b))}</p><table>` +
            r('Bug ID', escHtml(b.id)) + r('Title', escHtml(b.title)) + r('Module', escHtml(b.module)) +
            r('Severity', lv(b.severity)) + r('Priority', lv(b.priority)) + r('Environment', escHtml(b.environment || env)) +
            r('Steps to Reproduce', nl(b.steps)) + r('Test Data', nl(b.testData)) + r('Expected Result', nl(b.expected)) +
            r('Actual Result', nl(b.actual)) + r('Status', escHtml(b.status)) +
            r('Linked Test Case', escHtml(b.testCaseId ? `${b.testCaseId} - ${b.testCaseTitle}` : 'N/A')) +
            r('Linked Scenario', escHtml(b.scenarioId || 'N/A')) + r('Related Gap', escHtml(b.gapId || 'N/A')) +
            '</table><br/>';
    });
    if (!bugs.length) html += '<p>No bugs reported.</p>';

    html += `<h2>3. Traceability Matrix</h2><table><tr><th class="h">Scenario</th><th class="h">Test Case</th><th class="h">Type</th><th class="h">Status</th><th class="h">Bug(s)</th><th class="h">Related Gap(s)</th></tr>` +
        rows.map(x => `<tr><td>${escHtml(x.scenarioId || '-')}${x.scenarioTitle ? ': ' + escHtml(x.scenarioTitle) : ''}</td><td>${x.tc ? escHtml(x.tc.id + ' - ' + x.tc.title) : '-'}</td><td>${x.tc ? escHtml(x.tc.type) : '-'}</td><td>${x.tc ? escHtml(x.tc.status) : '-'}</td><td>${x.bugs.map(b => escHtml(b.id)).join(', ') || '-'}</td><td>${[...new Set(x.bugs.map(b => b.gapId).filter(Boolean))].map(escHtml).join(', ') || '-'}</td></tr>`).join('') + '</table></body></html>';
    return html;
}

// بيطلّع الرقم التالي (TS-05 أو TC-12) بناءً على أكبر رقم موجود
const nextId = (ids, prefix) => {
    const max = Math.max(0, ...ids.map(i => parseInt(String(i || '').replace(/\D/g, ''), 10) || 0));
    return `${prefix}-${String(max + 1).padStart(2, '0')}`;
};

async function readUploadedFile(file) {
    const name = file.name.toLowerCase();
    if (file.type.startsWith('image/')) return { image: { name: file.name, dataUrl: await readAsDataURL(file) } };
    if (name.endsWith('.pdf')) return { text: await extractPdfText(file) };
    if (name.endsWith('.docx')) return { text: await extractDocxText(file) };
    if (name.endsWith('.doc')) throw new Error('ملفات .doc القديمة مش مدعومة، احفظها كـ .docx وارفعها تاني.');
    if (name.endsWith('.pptx') || name.endsWith('.xlsx')) throw new Error('الصيغة دي مش مدعومة هنا، احفظها PDF أو Word أو انسخ النص.');
    return { text: await readAsText(file) };
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

function App() {
    const [story, setStory] = useState(() => localStorage.getItem('wakil_story') || '');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(() => { const d = safeJSON('wakil_ai_data', null); return d ? sanitizeSuite(d) : null; });
    const [editingIndex, setEditingIndex] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [images, setImages] = useState([]);
    const [uploadStatus, setUploadStatus] = useState('');
    const [lastProvider, setLastProvider] = useState('');
    const [errorsLog, setErrorsLog] = useState([]);
    const [showSettings, setShowSettings] = useState(false);
    const [models, setModels] = useState(() => safeJSON('wakil_models', {}));
    const [testResults, setTestResults] = useState({});
    const [testing, setTesting] = useState(false);

    // صفحة Test Scenarios (منفصلة تماماً عن Test Generation)
    const [page, setPage] = useState('generation');
    const [scStory, setScStory] = useState(() => localStorage.getItem('wakil_sc_story') || '');
    const [scImages, setScImages] = useState([]);
    const [scData, setScData] = useState(() => { const d = safeJSON('wakil_sc_data', null); return d ? sanitizeScenarioList(d) : null; });
    const [scLoading, setScLoading] = useState(false);
    const [scErrors, setScErrors] = useState([]);
    const [scProvider, setScProvider] = useState('');
    const [scUploadStatus, setScUploadStatus] = useState('');
    const [linked, setLinked] = useState(() => sanitizeScenarioList(safeJSON('wakil_linked', [])));

    // Add يدوي (سيناريو / تيست كيس)
    const [showAddSc, setShowAddSc] = useState(false);
    const [addScForm, setAddScForm] = useState({ type: 'Positive', title: '', priority: 'Medium' });
    const [showAddTc, setShowAddTc] = useState(false);
    const emptyTc = { scenarioId: '', type: 'Positive', priority: 'Medium', title: '', technique: '', preCondition: '', testData: '', stepsText: '', expected: '' };
    const [addTcForm, setAddTcForm] = useState(emptyTc);

    // صفحة Requirement Gaps
    const [gapText, setGapText] = useState(() => localStorage.getItem('wakil_gap_text') || '');
    const [gapImages, setGapImages] = useState([]);
    const [gapData, setGapData] = useState(() => sanitizeGapResult(safeJSON('wakil_gap_data', null)));
    const [gapLoading, setGapLoading] = useState(false);
    const [gapProgress, setGapProgress] = useState('');
    const [gapErrors, setGapErrors] = useState([]);
    const [gapUploadStatus, setGapUploadStatus] = useState('');
    const [gapProject, setGapProject] = useState(() => localStorage.getItem('wakil_gap_project') || '');
    const [gapAssignee, setGapAssignee] = useState('Business Analyst');
    const [gapRecipient, setGapRecipient] = useState(() => localStorage.getItem('wakil_gap_recipient') || '');
    const gapCancel = React.useRef(false);

    // صفحة Bug Report
    const [bugs, setBugs] = useState(() => sanitizeBugs(safeJSON('wakil_bugs', [])));
    const [bugTab, setBugTab] = useState('bugs');
    const [bugEnv, setBugEnv] = useState(() => localStorage.getItem('wakil_bug_env') || '');
    const [bugProject, setBugProject] = useState(() => localStorage.getItem('wakil_bug_project') || '');
    const [bugBusy, setBugBusy] = useState(false);
    const [bugNote, setBugNote] = useState('');
    const [keys, setKeys] = useState(() => safeJSON('wakil_keys', { openrouter: '', openai: '', anthropic: '', gemini: '' }));

    useEffect(() => {
        localStorage.setItem('wakil_story', story);
        if (data) localStorage.setItem('wakil_ai_data', JSON.stringify(data));
    }, [story, data]);

    useEffect(() => {
        document.title = `${APP_NAME} - ${APP_TAGLINE}`;
    }, []);

    useEffect(() => {
        localStorage.setItem('wakil_keys', JSON.stringify(keys));
    }, [keys]);

    useEffect(() => {
        localStorage.setItem('wakil_models', JSON.stringify(models));
    }, [models]);

    useEffect(() => {
        localStorage.setItem('wakil_sc_story', scStory);
        if (scData) localStorage.setItem('wakil_sc_data', JSON.stringify(scData));
    }, [scStory, scData]);

    useEffect(() => {
        localStorage.setItem('wakil_linked', JSON.stringify(linked));
    }, [linked]);

    useEffect(() => {
        localStorage.setItem('wakil_bugs', JSON.stringify(bugs));
        localStorage.setItem('wakil_bug_env', bugEnv);
        localStorage.setItem('wakil_bug_project', bugProject);
    }, [bugs, bugEnv, bugProject]);

    useEffect(() => {
        localStorage.setItem('wakil_gap_text', gapText);
        localStorage.setItem('wakil_gap_project', gapProject);
        localStorage.setItem('wakil_gap_recipient', gapRecipient);
        if (gapData) localStorage.setItem('wakil_gap_data', JSON.stringify(gapData));
    }, [gapText, gapData, gapProject, gapRecipient]);

    /* ---------- Test Connections: بيجرب كل مفتاح ويقولك شغال ولا لأ ---------- */
    const testConnections = async () => {
        setTesting(true);
        const results = {};
        for (const p of PROVIDERS) {
            const key = (keys[p.id] || '').trim();
            const model = (models[p.id] || '').trim() || p.model;
            if (!key) { results[p.id] = { ok: false, msg: 'مفيش مفتاح (متخطّى)', model }; continue; }
            const t0 = Date.now();
            try {
                const text = await callProvider(p, key, 'Return exactly this JSON and nothing else: {"status":"ok"}', [], model);
                if (!text) throw new Error('رد فاضي');
                let extra = '';
                if (p.modelsUrl) {
                    try {
                        const names = await listModels(p, key);
                        if (names.length) extra = '\nموديلات متاحة: ' + names.slice(0, 15).join(', ');
                    } catch (e) { /* ignore */ }
                }
                results[p.id] = { ok: true, msg: `شغال ✔ (${((Date.now() - t0) / 1000).toFixed(1)}s)` + extra, model: model || 'auto' };
            } catch (err) {
                let msg = err.message;
                if (p.type === 'gemini') {
                    try {
                        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
                        if (r.ok) {
                            const j = await r.json();
                            const names = (j.models || [])
                                .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
                                .map(m => m.name.replace('models/', ''))
                                .filter(n => n.includes('flash'))
                                .slice(0, 8);
                            if (names.length) msg += '\nموديلات متاحة لمفتاحك: ' + names.join(', ');
                        }
                    } catch (e) { /* ignore */ }
                }
                results[p.id] = { ok: false, msg, model };
            }
            setTestResults({ ...results });
        }
        setTestResults(results);
        setTesting(false);
    };

    /* ---------- Test Scenarios page logic ---------- */
    const handleScFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setScUploadStatus('Reading file...');
        try {
            const r = await readUploadedFile(file);
            if (r.image) {
                setScImages(prev => [...prev, r.image]);
                setScStory(prev => prev + `\n[Uploaded Image: ${r.image.name}]`);
            } else {
                setScStory(prev => prev + `\n--- Content from ${file.name} ---\n` + r.text);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to read file: ' + err.message);
        }
        setScUploadStatus('');
        e.target.value = '';
    };

    const generateScenarios = async () => {
        if (!scStory.trim() && scImages.length === 0) { alert('Please enter requirements or upload a file first!'); return; }
        if (!PROVIDERS.some(p => (keys[p.id] || '').trim())) {
            alert('مفيش ولا API key. افتح Settings وحط مفتاح واحد على الأقل.');
            setShowSettings(true);
            return;
        }
        setScLoading(true);
        setScErrors([]);
        const prompt = `You are an expert Senior QA Engineer. Analyze the requirements below and produce TEST SCENARIOS only (high-level situations to verify, with NO steps and NO test data).
        Return ONLY a valid JSON object with no markdown and no extra text, in exactly this structure:
        {"scenarios":[{"id":"TS-01","type":"Positive" | "Negative" | "Edge Case","title":"One clear sentence describing what is verified","priority":"Critical" | "High" | "Medium" | "Low"}]}
        Rules:
        1. The number of scenarios must be driven ONLY by the size and complexity of the input (it can be 5, 12, 30 or more). Cover every requirement, rule, field, role and flow.
        2. Positive = valid/happy-path behavior. Negative = invalid input, errors, missing data, unauthorized access, failures.
        3. Edge Case = boundary or unusual conditions (limits, empty/very large input, special characters, concurrency, interruptions, etc.). Include Edge Case scenarios ONLY where they genuinely apply to these requirements; if none apply, include none.
        4. "type" must be EXACTLY one of: "Positive", "Negative", "Edge Case".
        Requirements text: "${scStory}"`;

        const { data: res, provider, errors } = await runProviders({
            keys, models, prompt, images: scImages,
            validate: (p) => (Array.isArray(p?.scenarios) && p.scenarios.length)
                ? p.scenarios.map((sc, i) => ({
                    id: `TS-${String(i + 1).padStart(2, '0')}`,
                    type: normalizeType(sc.type),
                    title: str(sc.title),
                    priority: normPriority(sc.priority)
                }))
                : null
        });
        setScLoading(false);
        setScErrors(errors);
        if (res) {
            setScData(res);
            setScProvider(provider);
        } else {
            alert('كل الـ APIs فشلت. التفاصيل ظاهرة تحت زر Generate.');
        }
    };

    const updateScenario = (index, field, value) => {
        setScData(scData.map((sc, i) => i === index ? { ...sc, [field]: value } : sc));
    };

    const deleteScenario = (index) => {
        setScData(scData.filter((_, i) => i !== index));
    };

    const scenariosAsText = () => ['Positive', 'Negative', 'Edge Case']
        .map(cat => {
            const items = (scData || []).filter(sc => sc.type === cat);
            return items.length ? `${cat} Scenarios:\n` + items.map(sc => `${sc.id}: ${sc.title}`).join('\n') : '';
        })
        .filter(Boolean)
        .join('\n\n');

    const copyScenarios = async () => {
        try {
            await navigator.clipboard.writeText(scenariosAsText());
            alert('تم نسخ السيناريوهات ✔');
        } catch (e) {
            window.prompt('انسخ السيناريوهات من هنا:', scenariosAsText());
        }
    };

    const sendToGeneration = () => {
        if (!scData?.length) return;
        setLinked(scData.map(({ id, type, title }) => ({ id, type, title })));
        setPage('generation');
    };

    const clearScenarios = () => {
        setScStory('');
        setScData(null);
        setScImages([]);
        setScErrors([]);
        setScProvider('');
        localStorage.removeItem('wakil_sc_story');
        localStorage.removeItem('wakil_sc_data');
    };

    /* ---------- Add يدوي ---------- */
    const openAddScenario = () => {
        setAddScForm({ type: 'Positive', title: '', priority: 'Medium' });
        setShowAddSc(true);
    };

    const saveNewScenario = () => {
        if (!addScForm.title.trim()) { alert('اكتب عنوان السيناريو الأول.'); return; }
        const list = scData || [];
        setScData([...list, {
            id: nextId(list.map(x => x.id), 'TS'),
            type: addScForm.type,
            title: addScForm.title.trim(),
            priority: addScForm.priority
        }]);
        setShowAddSc(false);
    };

    // كل السيناريوهات المعروفة (للاقتراحات في فورم الكيس)
    const knownScenarios = () => {
        const map = new Map();
        [...(scData || []), ...linked, ...(data?.scenarios || [])].forEach(sc => { if (sc?.id && !map.has(sc.id)) map.set(sc.id, sc); });
        return [...map.values()];
    };

    const openAddTestCase = () => {
        setAddTcForm(emptyTc);
        setShowAddTc(true);
    };

    const saveNewTestCase = () => {
        const f = addTcForm;
        if (!f.title.trim()) { alert('اكتب عنوان التيست كيس الأول.'); return; }
        if (!f.scenarioId.trim()) { alert('اختار أو اكتب رقم السيناريو (مثلاً TS-01).'); return; }
        const base = data || { scenarios: [], testCases: [] };
        const cases = base.testCases || [];
        const scId = f.scenarioId.trim();
        const newCase = {
            id: nextId(cases.map(x => x.id), 'TC'),
            scenarioId: scId,
            type: f.type,
            title: f.title.trim(),
            technique: f.technique.trim(),
            priority: f.priority,
            preCondition: f.preCondition.trim(),
            testData: f.testData.trim(),
            steps: f.stepsText.split('\n').map(x => x.trim()).filter(Boolean),
            expected: f.expected.trim(),
            actualResult: '',
            status: 'Untested'
        };
        let scenarios = base.scenarios || [];
        const known = knownScenarios().find(sc => sc.id === scId);
        if (known && !scenarios.some(sc => sc.id === scId)) scenarios = [...scenarios, { id: known.id, title: known.title }];
        setData({ ...base, scenarios, testCases: [...cases, newCase] });
        setShowAddTc(false);
    };

    /* ---------- Requirement Gaps page logic ---------- */
    const handleGapFileUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setGapUploadStatus('Reading file...');
        for (const file of files) {
            try {
                const r = await readUploadedFile(file);
                if (r.image) setGapImages(prev => [...prev, r.image]);
                else setGapText(prev => prev + `\n--- Content from ${file.name} ---\n` + r.text);
            } catch (err) {
                console.error(err);
                alert(`${file.name}: ${err.message}`);
            }
        }
        setGapUploadStatus('');
        e.target.value = '';
    };

    const analyzeGaps = async () => {
        if (!gapText.trim() && gapImages.length === 0) { alert('Please paste requirements or upload a file first!'); return; }
        if (!PROVIDERS.some(p => (keys[p.id] || '').trim())) {
            alert('مفيش ولا API key. افتح Settings وحط مفتاح واحد على الأقل.');
            setShowSettings(true);
            return;
        }
        gapCancel.current = false;
        setGapLoading(true);
        setGapErrors([]);
        setGapData(null);

        const chunks = buildGapChunks(gapText, gapImages);
        const sections = [];
        const errs = [];
        const show = (secs, cross) => setGapData({ ...assignGapIds(secs, cross), createdAt: new Date().toISOString() });

        for (let i = 0; i < chunks.length; i++) {
            if (gapCancel.current) break;
            const chunk = chunks[i];
            setGapProgress(`Analyzing section ${i + 1} of ${chunks.length}: ${chunk.title}`);
            const r = await runProviders({
                keys, models,
                prompt: buildSectionPrompt(chunk, i, chunks.length),
                images: chunk.images || [],
                validate: sanitizeGapSection
            });
            if (r.data) {
                sections.push({ title: chunk.title, doc: chunk.doc, error: '', ...r.data });
            } else {
                const msg = r.errors.join(' | ') || 'No provider available';
                sections.push({ title: chunk.title, doc: chunk.doc, sectionType: '', summary: '', keyPoints: [], coverage: normalizeCoverage({}), gaps: [], error: msg });
                errs.push(`${chunk.title}: ${msg}`);
            }
            show(sections, []);
        }

        let cross = [];
        const okSections = sections.filter(sec => !sec.error);
        if (!gapCancel.current && okSections.length >= 2) {
            setGapProgress('Cross-checking consistency between sections...');
            const r = await runProviders({
                keys, models,
                prompt: buildCrossPrompt(okSections),
                images: [],
                validate: (p) => (p && Array.isArray(p.gaps)) ? sanitizeGapList(p.gaps) : null
            });
            if (r.data) cross = r.data;
            else errs.push('Cross-section check failed: ' + r.errors.join(' | '));
        }

        show(sections, cross);
        setGapErrors(errs);
        setGapProgress(gapCancel.current ? 'Stopped.' : '');
        setGapLoading(false);
    };

    const updateGap = (si, gi, field, value) => setGapData(d => si === 'cross'
        ? { ...d, cross: d.cross.map((g, i) => i === gi ? { ...g, [field]: value } : g) }
        : { ...d, sections: d.sections.map((sec, i) => i === si ? { ...sec, gaps: sec.gaps.map((g, j) => j === gi ? { ...g, [field]: value } : g) } : sec) });

    const deleteGap = (si, gi) => setGapData(d => si === 'cross'
        ? { ...d, cross: d.cross.filter((_, i) => i !== gi) }
        : { ...d, sections: d.sections.map((sec, i) => i === si ? { ...sec, gaps: sec.gaps.filter((_, j) => j !== gi) } : sec) });

    const clearGaps = () => {
        gapCancel.current = true;
        setGapText('');
        setGapImages([]);
        setGapData(null);
        setGapErrors([]);
        setGapProgress('');
        localStorage.removeItem('wakil_gap_text');
        localStorage.removeItem('wakil_gap_data');
    };

    const downloadGapReport = () => {
        if (!gapData) return;
        const html = buildGapReportHtml({ gapData, assignee: gapAssignee, recipient: gapRecipient, project: gapProject });
        downloadBlob(new Blob(['\uFEFF' + html], { type: 'application/msword;charset=utf-8' }), 'Requirement_Gap_Report.doc');
    };

    const downloadGapLog = async () => {
        if (!gapData) return;
        try {
            await loadScript('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js');
        } catch (e) {
            alert('تعذر تحميل مكتبة Excel. حمّل التقرير (Word) بدلها.');
            return;
        }
        const XLSX = window.XLSX;
        const headers = ['Gap ID', 'Section', 'Requirement Ref.', 'Type', 'Priority', 'Description', 'Evidence', 'Scenario', `Question to ${gapAssignee}`, 'Status', 'Owner'];
        const widths = [10, 28, 24, 26, 10, 50, 36, 40, 44, 11, 22];
        const owner = gapAssignee + (gapRecipient.trim() ? ` - ${gapRecipient.trim()}` : '');
        const rows = flattenGaps(gapData).map(g => [g.id, g.section, g.requirementRef, g.type, g.priority, g.description, g.evidence, g.scenario, g.question, g.status, owner].map(v => String(v ?? '')));
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        ws['!cols'] = widths.map(w => ({ wch: w }));
        ws['!autofilter'] = { ref: ws['!ref'] };
        const thin = { style: 'thin', color: { rgb: 'CBD5E1' } };
        const border = { top: thin, bottom: thin, left: thin, right: thin };
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; R++) {
            for (let C = range.s.c; C <= range.e.c; C++) {
                const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
                if (!cell) continue;
                cell.s = R === 0
                    ? { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2563EB' } }, alignment: { vertical: 'center', horizontal: 'center', wrapText: true }, border }
                    : { alignment: { vertical: 'top', wrapText: true }, border };
            }
        }
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Gap Log');
        XLSX.writeFile(wb, 'Requirement_Gap_Log.xlsx');
    };

    /* ---------- Bug Report page logic ---------- */
    const bugFor = (tc) => bugs.find(b => b.testCaseId === tc.id && b.testCaseTitle === tc.title);
    const failedWithoutBug = () => (data?.testCases || []).filter(tc => tc.status === 'Fail' && !bugFor(tc));

    const baseBugFromTc = (tc, id) => {
        const sc = knownScenarios().find(x => x.id === tc.scenarioId);
        return {
            id,
            title: tc.title,
            module: sc ? sc.title : '',
            severity: normPriority(tc.priority),
            priority: normPriority(tc.priority),
            environment: bugEnv,
            steps: (tc.steps || []).map((st, i) => `${i + 1}. ${st}`).join('\n'),
            testData: tc.testData || '',
            expected: tc.expected || '',
            actual: tc.actualResult || '',
            status: 'New',
            testCaseId: tc.id,
            testCaseTitle: tc.title,
            scenarioId: tc.scenarioId || '',
            gapId: ''
        };
    };

    // بيعمل باج ريبورت تلقائي من التيست كيسز الـ Fail (والـ AI بيصيغ العنوان والـ module والـ severity لو في مفتاح)
    const sendToBugs = async (tcs) => {
        const todo = tcs.filter(tc => !bugFor(tc));
        if (!todo.length) { setPage('bugs'); return; }
        setBugBusy(true);
        const hasKeys = PROVIDERS.some(p => (keys[p.id] || '').trim());
        const ids = bugs.map(b => b.id);
        const created = [];
        for (const tc of todo) {
            const id = nextBugId(ids);
            ids.push(id);
            let bug = baseBugFromTc(tc, id);
            if (hasKeys) {
                setBugNote(`Writing bug report for ${tc.id}...`);
                const r = await runProviders({
                    keys, models,
                    prompt: buildBugPrompt(tc, bug.module),
                    images: [],
                    validate: (p) => (p && typeof p === 'object' && str(p.title)) ? p : null
                });
                if (r.data) {
                    bug = {
                        ...bug,
                        title: str(r.data.title) || bug.title,
                        module: str(r.data.module) || bug.module,
                        severity: normPriority(r.data.severity || bug.severity),
                        priority: normPriority(r.data.priority || bug.priority)
                    };
                }
            }
            created.push(bug);
        }
        setBugs(prev => [...prev, ...created]);
        setBugNote('');
        setBugBusy(false);
        setBugTab('bugs');
        setPage('bugs');
    };

    const updateBug = (id, field, value) => setBugs(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
    const deleteBug = (id) => setBugs(prev => prev.filter(b => b.id !== id));

    const linkBugToTestCase = (id, tcIndex) => {
        if (tcIndex === '') {
            setBugs(prev => prev.map(b => b.id === id ? { ...b, testCaseId: '', testCaseTitle: '', scenarioId: '' } : b));
            return;
        }
        const tc = (data?.testCases || [])[Number(tcIndex)];
        if (!tc) return;
        setBugs(prev => prev.map(b => b.id === id ? { ...b, testCaseId: tc.id, testCaseTitle: tc.title, scenarioId: tc.scenarioId || '' } : b));
    };

    const addManualBug = () => {
        setBugs(prev => [...prev, {
            id: nextBugId(prev.map(b => b.id)), title: '', module: '', severity: 'Medium', priority: 'Medium',
            environment: bugEnv, steps: '', testData: '', expected: '', actual: '', status: 'New',
            testCaseId: '', testCaseTitle: '', scenarioId: '', gapId: ''
        }]);
        setBugTab('bugs');
    };

    const clearBugs = () => {
        if (bugs.length && !window.confirm('تمسح كل الباجز؟')) return;
        setBugs([]);
        localStorage.removeItem('wakil_bugs');
    };

    const downloadBugReport = () => {
        const html = buildBugReportHtml({ bugs, project: bugProject, env: bugEnv, data });
        downloadBlob(new Blob(['\uFEFF' + html], { type: 'application/msword;charset=utf-8' }), 'Bug_Report.doc');
    };

    const downloadBugsXlsx = async () => {
        try {
            await loadScript('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js');
        } catch (e) {
            alert('تعذر تحميل مكتبة Excel. حمّل التقرير (Word) بدلها.');
            return;
        }
        const XLSX = window.XLSX;
        const thin = { style: 'thin', color: { rgb: 'CBD5E1' } };
        const border = { top: thin, bottom: thin, left: thin, right: thin };
        const makeSheet = (headers, rows, widths) => {
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows.map(r => r.map(v => String(v ?? '')))]);
            ws['!cols'] = widths.map(w => ({ wch: w }));
            ws['!autofilter'] = { ref: ws['!ref'] };
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let R = range.s.r; R <= range.e.r; R++) {
                for (let C = range.s.c; C <= range.e.c; C++) {
                    const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
                    if (!cell) continue;
                    cell.s = R === 0
                        ? { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2563EB' } }, alignment: { vertical: 'center', horizontal: 'center', wrapText: true }, border }
                        : { alignment: { vertical: 'top', wrapText: true }, border };
                }
            }
            return ws;
        };
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, makeSheet(
            ['Bug ID', 'Title', 'Module', 'Severity', 'Priority', 'Environment', 'Steps to Reproduce', 'Test Data', 'Expected Result', 'Actual Result', 'Status', 'Test Case', 'Scenario', 'Related Gap'],
            bugs.map(b => [b.id, b.title, b.module, b.severity, b.priority, b.environment || bugEnv, b.steps, b.testData, b.expected, b.actual, b.status, b.testCaseId, b.scenarioId, b.gapId]),
            [10, 40, 26, 10, 10, 22, 44, 28, 32, 32, 12, 12, 12, 12]
        ), 'Bugs');
        XLSX.utils.book_append_sheet(wb, makeSheet(
            ['Scenario', 'Test Case', 'Type', 'Status', 'Bug(s)', 'Related Gap(s)'],
            buildTraceRows(data, bugs).map(x => [
                `${x.scenarioId || '-'}${x.scenarioTitle ? ': ' + x.scenarioTitle : ''}`,
                x.tc ? `${x.tc.id} - ${x.tc.title}` : '-', x.tc ? x.tc.type : '-', x.tc ? x.tc.status : '-',
                x.bugs.map(b => b.id).join(', ') || '-',
                [...new Set(x.bugs.map(b => b.gapId).filter(Boolean))].join(', ') || '-'
            ]),
            [40, 46, 12, 12, 16, 16]
        ), 'Traceability');
        XLSX.writeFile(wb, 'Bug_Report.xlsx');
    };

    /* ---------- Clear ---------- */
    const handleClear = () => {
        setStory('');
        setData(null);
        setImages([]);
        setErrorsLog([]);
        setLastProvider('');
        localStorage.removeItem('wakil_story');
        localStorage.removeItem('wakil_ai_data');
    };

    /* ---------- File upload (txt / PDF / Word / Image) ---------- */
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const name = file.name.toLowerCase();
        setUploadStatus('Reading file...');
        try {
            if (file.type.startsWith('image/')) {
                const dataUrl = await readAsDataURL(file);
                setImages(prev => [...prev, { name: file.name, dataUrl }]);
                setStory(prev => prev + `\n[Uploaded Image: ${file.name}]`);
            } else if (name.endsWith('.pdf')) {
                const text = await extractPdfText(file);
                setStory(prev => prev + `\n--- Content from ${file.name} ---\n` + text);
            } else if (name.endsWith('.docx')) {
                const text = await extractDocxText(file);
                setStory(prev => prev + `\n--- Content from ${file.name} ---\n` + text);
            } else if (name.endsWith('.doc')) {
                alert('ملفات .doc القديمة مش مدعومة، احفظها كـ .docx وارفعها تاني.');
            } else {
                const text = await readAsText(file);
                setStory(prev => prev + `\n--- Content from ${file.name} ---\n` + text);
            }
            setUploadStatus('');
        } catch (err) {
            console.error(err);
            setUploadStatus('');
            alert('Failed to read file: ' + err.message);
        }
        e.target.value = '';
    };

    /* ---------- Generate with AI (fallback بين كل الـ providers) ---------- */
    const generateWithAI = async () => {
        if (!story.trim() && images.length === 0 && linked.length === 0) { alert('Please enter a User Story or upload a file first!'); return; }

        const available = PROVIDERS.filter(p => (keys[p.id] || '').trim());
        if (available.length === 0) {
            alert('مفيش ولا API key. افتح Settings وحط مفتاح واحد على الأقل.');
            setShowSettings(true);
            return;
        }

        setLoading(true);
        setErrorsLog([]);
        let parsedData = null;
        const errors = [];
        let fallback = null, fallbackName = '';

        // لو في سيناريوهات متربطة من صفحة Test Scenarios، بنولّد الكيسز بناءً عليها
        const linkedText = linked.length
            ? `\n\nLINKED TEST SCENARIOS (already reviewed by the user). Generate the test cases for THESE scenarios. Use their exact ids in "scenarioId". Do NOT invent new scenarios and do NOT rename them. Each scenario below shows its own type; create test cases of the matching type for it (you may add extra Negative/Edge Case test cases under the most relevant scenario). Every test case "type" must be exactly "Positive", "Negative" or "Edge Case".\n` + linked.map(sc => `${sc.id} [${sc.type}] ${sc.title}`).join('\n')
            : '';
        const required = linked.length ? [...new Set(linked.map(sc => sc.type))] : ['Positive', 'Negative', 'Edge Case'];

        const prompt = `You are an expert Senior QA Engineer. Analyze the provided requirements thoroughly.
        Generate a comprehensive, robust test suite. You MUST return ONLY a valid JSON object matching this exact structure without any markdown code blocks or extra text:
        {
          "scenarios": [
            {"id": "TS-01", "title": "Comprehensive description for scenario 1"}
          ],
          "testCases": [
            {
              "id": "TC-01",
              "scenarioId": "TS-01",
              "type": "Positive" | "Negative" | "Edge Case",
              "title": "Clear test case title",
              "technique": "Boundary Value Analysis / Equivalence Partitioning / etc.",
              "priority": "Critical" | "High" | "Medium" | "Low",
              "preCondition": "Required pre-conditions",
              "testData": "Specific test data or input values",
              "steps": ["Step 1 description", "Step 2 description"],
              "expected": "Expected result outcome",
              "actualResult": "",
              "status": "Untested"
            }
          ]
        }
        Instructions: 
        1. The JSON above only shows the FORMAT with one sample item. Do NOT limit yourself to one or any fixed number. The number of scenarios and test cases must be driven ONLY by the size and complexity of the input: a small story may need around 5-8 test cases, a large one 20, 30 or more. Cover every requirement, field, rule, validation, role and flow mentioned.
        2. Extract as many distinct Test Scenarios (TS-01, TS-02, ...) as needed to completely cover all requirements.
        3. Create detailed Test Cases (TC-01, TC-02, ...) mapped correctly to their scenarios via 'scenarioId'.
        4. MANDATORY: the output MUST contain all three types: Positive, Negative, AND Edge Case. Every scenario should have at least one Positive and one Negative case, and the suite as a whole MUST include several Edge Case tests (boundary values, min/max length, empty/whitespace, special characters, very large input, unusual sequences, duplicate submissions, timeouts, etc.).
        5. The "type" field must be EXACTLY one of these strings: "Positive", "Negative", "Edge Case".
        6. Use accurate priorities (including Critical where applicable).
        Input text: "${story}"${linkedText}`;

        for (const p of available) {
            try {
                const text = await callProvider(p, keys[p.id].trim(), prompt, images, (models[p.id] || '').trim());
                const parsed = await parseLoose(text, p.name);
                if (!parsed?.testCases?.length) throw new Error(`${p.name}: response has no testCases`);
                Object.assign(parsed, sanitizeSuite(parsed));
                if (linked.length) parsed.scenarios = linked.map(sc => ({ id: sc.id, title: sc.title }));
                const types = new Set(parsed.testCases.map(tc => tc.type));
                if (required.every(t => types.has(t))) {
                    parsedData = parsed;
                    setLastProvider(p.name);
                    break;
                }
                // الرد ناقص (مثلاً مفيش Edge Case): نحتفظ بيه ونجرب الموديل اللي بعده
                if (!fallback) { fallback = parsed; fallbackName = p.name; }
                throw new Error(`${p.name}: response missing some test types, trying next provider...`);
            } catch (err) {
                console.warn(err.message);
                errors.push(err.message);
            }
        }

        if (!parsedData && fallback) {
            parsedData = fallback;
            setLastProvider(fallbackName + ' (ناقص: مفيش كل الأنواع، جرّب Generate تاني)');
        }

        setLoading(false);
        setErrorsLog(errors);
        if (parsedData) {
            setData(parsedData);
        } else {
            alert('كل الـ APIs فشلت. التفاصيل ظاهرة تحت زر Generate.');
        }
    };

    /* ---------- Edit / Delete (بدون mutation) ---------- */
    const updateTestCaseField = (index, field, value) => {
        const updatedCases = data.testCases.map((tc, i) => i === index ? { ...tc, [field]: value } : tc);
        setData({ ...data, testCases: updatedCases });
    };

    const deleteTestCase = (index) => {
        const updatedCases = data.testCases.filter((_, i) => i !== index);
        setData({ ...data, testCases: updatedCases });
    };

    const startEditing = (index, tc) => {
        setEditingIndex(index);
        setEditForm({
            ...tc,
            stepsText: Array.isArray(tc.steps) ? tc.steps.join('\n') : (tc.steps || '')
        });
    };

    const saveEditing = (index) => {
        const formattedSteps = editForm.stepsText
            ? editForm.stepsText.split('\n').map(s => s.trim()).filter(Boolean)
            : [];
        const { stepsText, ...rest } = editForm;
        const updatedCases = data.testCases.map((tc, i) => i === index ? { ...rest, steps: formattedSteps } : tc);
        setData({ ...data, testCases: updatedCases });
        setEditingIndex(null);
    };

    /* ---------- Export CSV (كل حقل في عمود مستقل) ---------- */
    const exportToXLSX = async () => {
        if (!data?.testCases) return;
        try {
            await loadScript('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js');
        } catch (e) {
            alert('تعذر تحميل مكتبة Excel، هيتم التصدير كـ CSV.');
            exportToCSV();
            return;
        }
        const XLSX = window.XLSX;
        const headers = ['ID', 'Scenario ID', 'Category', 'Title', 'Priority', 'Technique', 'Pre-Condition', 'Test Data', 'Steps', 'Expected', 'Actual Result', 'Status'];
        const widths = [9, 11, 12, 38, 10, 22, 30, 28, 50, 38, 25, 11];
        const rows = data.testCases.map(r => [
            r.id,
            r.scenarioId || 'N/A',
            r.type,
            r.title,
            r.priority || 'Medium',
            r.technique,
            r.preCondition,
            r.testData,
            (r.steps || []).map((s, idx) => `${idx + 1}. ${s}`).join('\n'),
            r.expected,
            r.actualResult || '',
            r.status || 'Untested'
        ].map(v => String(v ?? '')));

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        ws['!cols'] = widths.map(w => ({ wch: w }));
        ws['!autofilter'] = { ref: ws['!ref'] };

        const thin = { style: 'thin', color: { rgb: 'CBD5E1' } };
        const border = { top: thin, bottom: thin, left: thin, right: thin };
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; R++) {
            for (let C = range.s.c; C <= range.e.c; C++) {
                const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
                if (!cell) continue;
                cell.s = R === 0
                    ? { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2563EB' } }, alignment: { vertical: 'center', horizontal: 'center', wrapText: true }, border }
                    : { alignment: { vertical: 'top', wrapText: true }, border };
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Test Cases');

        if (data.scenarios?.length) {
            const ws2 = XLSX.utils.aoa_to_sheet([['Scenario ID', 'Title'], ...data.scenarios.map(s => [String(s.id ?? ''), String(s.title ?? '')])]);
            ws2['!cols'] = [{ wch: 12 }, { wch: 90 }];
            XLSX.utils.book_append_sheet(wb, ws2, 'Scenarios');
        }

        XLSX.writeFile(wb, 'Advanced_TestCases_Report.xlsx');
    };

    const exportToCSV = () => {
        if (!data?.testCases) return;
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const headers = ['ID', 'Scenario ID', 'Category', 'Title', 'Priority', 'Technique', 'Pre-Condition', 'Test Data', 'Steps', 'Expected', 'Actual Result', 'Status'];
        const rows = data.testCases.map(r => [
            r.id,
            r.scenarioId || 'N/A',
            r.type,
            r.title,
            r.priority || 'Medium',
            r.technique,
            r.preCondition,
            r.testData,
            (r.steps || []).map((s, idx) => `${idx + 1}. ${s}`).join('\n'),
            r.expected,
            r.actualResult || '',
            r.status || 'Untested'
        ].map(esc).join(','));

        const csv = '\uFEFF' + [headers.map(esc).join(','), ...rows].join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Advanced_TestCases_Report.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const scenariosMain = (
        <main className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
                <h2 className="text-lg font-bold text-slate-800">Test Scenarios</h2>
                <div className="flex gap-2">
                    <button onClick={openAddScenario} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                        + Add
                    </button>
                    <button onClick={() => setShowSettings(true)} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                        ⚙ Settings
                    </button>
                    <button onClick={clearScenarios} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                        Clear Data
                    </button>
                    {scData?.length > 0 && (
                        <button onClick={copyScenarios} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                            Copy
                        </button>
                    )}
                    {scData?.length > 0 && (
                        <button onClick={sendToGeneration} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
                            Send to Test Generation →
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="w-1/3 border-r border-slate-200 p-4 bg-slate-50 overflow-y-auto space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Requirements / User Story</label>
                        <textarea
                            className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                            rows="10"
                            value={scStory}
                            onChange={e => setScStory(e.target.value)}
                            placeholder="Paste requirements or upload file..."
                        ></textarea>

                        <div className="mt-3 space-y-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Or Upload File (PDF/Word/Image/Text)</label>
                            <input
                                type="file"
                                onChange={handleScFileUpload}
                                className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-200 rounded-lg p-1 bg-white"
                            />
                            {scUploadStatus && <p className="text-xs text-blue-600">{scUploadStatus}</p>}
                            {scImages.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {scImages.map((img, i) => (
                                        <span key={i} className="text-[10px] bg-white border border-slate-200 rounded px-2 py-1 flex items-center gap-1">
                                            🖼 {img.name}
                                            <button onClick={() => setScImages(scImages.filter((_, j) => j !== i))} className="text-red-500">✕</button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={generateScenarios}
                            disabled={scLoading}
                            className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm flex justify-center items-center gap-2 disabled:opacity-50"
                        >
                            {scLoading ? 'Analyzing Requirements...' : 'Generate Scenarios'}
                        </button>

                        {scProvider && !scLoading && (
                            <p className="mt-2 text-xs text-emerald-700">✔ Generated using {scProvider}</p>
                        )}
                        {scErrors.length > 0 && (
                            <div className="mt-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded p-2 space-y-1">
                                {scErrors.map((m, i) => <div key={i}>{m}</div>)}
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-2/3 p-6 overflow-y-auto space-y-6">
                    {!scData?.length ? (
                        <div className="h-full flex items-center justify-center text-slate-400">
                            Provide requirements and click Generate Scenarios.
                        </div>
                    ) : (
                        <>
                            {['Positive', 'Negative', 'Edge Case'].map(cat => {
                                const items = scData.map((sc, idx) => ({ ...sc, originalIndex: idx })).filter(sc => sc.type === cat);
                                const catColor = cat === 'Positive' ? 'text-green-700 bg-green-50 border-green-200' :
                                                 cat === 'Negative' ? 'text-red-700 bg-red-50 border-red-200' :
                                                 'text-amber-700 bg-amber-50 border-amber-200';
                                if (items.length === 0) {
                                    return (
                                        <div key={cat} className={`px-3 py-1 rounded border text-xs ${catColor} opacity-70`}>
                                            {cat} Scenarios (0) — مفيش سيناريوهات من النوع ده في المتطلبات
                                        </div>
                                    );
                                }
                                return (
                                    <div key={cat} className="space-y-2">
                                        <div className={`px-3 py-1 rounded border font-bold text-xs uppercase ${catColor}`}>{cat} Scenarios ({items.length})</div>
                                        {items.map(sc => (
                                            <div key={sc.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex items-center gap-2 text-xs">
                                                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2.5 py-1 rounded-md font-semibold">{sc.id}</span>
                                                <input
                                                    className="flex-1 border border-slate-200 rounded p-1.5 text-slate-800"
                                                    value={sc.title}
                                                    onChange={e => updateScenario(sc.originalIndex, 'title', e.target.value)}
                                                />
                                                <select
                                                    className="border border-slate-300 rounded px-1 py-1 text-xs bg-slate-50"
                                                    value={sc.type}
                                                    onChange={e => updateScenario(sc.originalIndex, 'type', e.target.value)}
                                                >
                                                    <option value="Positive">Positive</option>
                                                    <option value="Negative">Negative</option>
                                                    <option value="Edge Case">Edge Case</option>
                                                </select>
                                                <select
                                                    className="border border-slate-300 rounded px-1 py-1 text-xs font-bold bg-slate-50"
                                                    value={sc.priority || 'Medium'}
                                                    onChange={e => updateScenario(sc.originalIndex, 'priority', e.target.value)}
                                                >
                                                    <option value="Critical">Critical</option>
                                                    <option value="High">High</option>
                                                    <option value="Medium">Medium</option>
                                                    <option value="Low">Low</option>
                                                </select>
                                                <button onClick={() => deleteScenario(sc.originalIndex)} className="text-red-600 hover:underline">Delete</button>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            </div>
        </main>
    );

    const allGapsFlat = flattenGaps(gapData);
    const gapCount = (fn) => allGapsFlat.filter(fn).length;
    const covColor = (v) => v === 'Present' ? 'bg-green-50 text-green-700 border-green-200'
        : v === 'Partial' ? 'bg-amber-50 text-amber-700 border-amber-200'
        : v === 'Missing' ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-slate-50 text-slate-400 border-slate-200';

    const renderGap = (g, si, gi) => (
        <div key={`${si}-${gi}-${g.id}`} className="border border-slate-200 rounded-lg p-3 bg-white space-y-1.5 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-0.5 rounded font-semibold">{g.id}</span>
                <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded font-semibold">{g.type}</span>
                <span className="text-slate-500">Ref: {g.requirementRef || 'N/A'}</span>
                <div className="flex-1"></div>
                <select className={`border rounded px-1 py-0.5 font-bold ${g.priority === 'High' ? 'text-red-700 bg-red-50' : g.priority === 'Medium' ? 'text-amber-700 bg-amber-50' : 'text-green-700 bg-green-50'}`} value={g.priority} onChange={e => updateGap(si, gi, 'priority', e.target.value)}>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                </select>
                <select className="border rounded px-1 py-0.5 bg-slate-50" value={g.status} onChange={e => updateGap(si, gi, 'status', e.target.value)}>
                    <option value="Open">Open</option>
                    <option value="Answered">Answered</option>
                    <option value="Closed">Closed</option>
                </select>
                <button onClick={() => deleteGap(si, gi)} className="text-red-600 hover:underline">Delete</button>
            </div>
            <p className="text-slate-800"><strong>Gap:</strong> {g.description}</p>
            {g.evidence && <p className="text-slate-500 italic"><strong className="not-italic">Evidence:</strong> {g.evidence}</p>}
            <p className="text-slate-600"><strong>Scenario:</strong> {g.scenario}</p>
            <p className="text-blue-800 bg-blue-50 border border-blue-100 rounded p-1.5"><strong>Question to {gapAssignee}:</strong> {g.question}</p>
        </div>
    );

    const gapsMain = (
        <main className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
                <h2 className="text-lg font-bold text-slate-800">Requirement Gaps</h2>
                <div className="flex gap-2">
                    <button onClick={() => setShowSettings(true)} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                        ⚙ Settings
                    </button>
                    <button onClick={clearGaps} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                        Clear Data
                    </button>
                    {gapData && (
                        <button onClick={downloadGapLog} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                            Gap Log (.xlsx)
                        </button>
                    )}
                    {gapData && (
                        <button onClick={downloadGapReport} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
                            Download Report (Word)
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="w-1/3 border-r border-slate-200 p-4 bg-slate-50 overflow-y-auto space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Requirements (User Story / AC / BRD / SRS / FRS)</label>
                        <textarea
                            className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                            rows="10"
                            value={gapText}
                            onChange={e => setGapText(e.target.value)}
                            placeholder="Paste requirements or upload file(s)..."
                        ></textarea>

                        <div className="mt-3 space-y-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Or Upload File(s) (PDF/Word/Image/Text)</label>
                            <input
                                type="file"
                                multiple
                                onChange={handleGapFileUpload}
                                className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-200 rounded-lg p-1 bg-white"
                            />
                            {gapUploadStatus && <p className="text-xs text-blue-600">{gapUploadStatus}</p>}
                            {gapImages.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {gapImages.map((img, i) => (
                                        <span key={i} className="text-[10px] bg-white border border-slate-200 rounded px-2 py-1 flex items-center gap-1">
                                            🖼 {img.name}
                                            <button onClick={() => setGapImages(gapImages.filter((_, j) => j !== i))} className="text-red-500">✕</button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-3 bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                            <p className="font-bold text-slate-500 uppercase">Report settings</p>
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Project / Feature name:</label>
                                <input className="w-full border p-1.5 rounded bg-white" value={gapProject} onChange={e => setGapProject(e.target.value)} placeholder="e.g. Cash Withdrawal" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block font-bold text-slate-600 mb-1">Assign to:</label>
                                    <select className="w-full border p-1.5 rounded bg-white" value={gapAssignee} onChange={e => setGapAssignee(e.target.value)}>
                                        <option value="Business Analyst">Business Analyst</option>
                                        <option value="Product Owner">Product Owner</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-600 mb-1">Name (optional):</label>
                                    <input className="w-full border p-1.5 rounded bg-white" value={gapRecipient} onChange={e => setGapRecipient(e.target.value)} placeholder="Recipient name" />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={analyzeGaps}
                            disabled={gapLoading}
                            className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm flex justify-center items-center gap-2 disabled:opacity-50"
                        >
                            {gapLoading ? 'Analyzing...' : 'Analyze Requirements'}
                        </button>
                        {gapLoading && (
                            <button onClick={() => { gapCancel.current = true; }} className="w-full mt-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-2 rounded-lg text-sm">
                                Stop
                            </button>
                        )}
                        {gapProgress && <p className="mt-2 text-xs text-blue-700">{gapProgress}</p>}
                        {gapErrors.length > 0 && (
                            <div className="mt-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded p-2 space-y-1">
                                {gapErrors.map((m, i) => <div key={i}>{m}</div>)}
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-2/3 p-6 overflow-y-auto space-y-5">
                    {!gapData ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-center px-8">
                            Paste or upload the requirements and click Analyze Requirements. Each section is analyzed separately, then a cross-section check runs at the end.
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-5 gap-2 text-center text-xs">
                                <div className="bg-white border border-slate-200 rounded-lg p-2"><div className="text-lg font-bold text-slate-800">{allGapsFlat.length}</div>Total gaps</div>
                                <div className="bg-red-50 border border-red-200 rounded-lg p-2"><div className="text-lg font-bold text-red-700">{gapCount(g => g.priority === 'High')}</div>High</div>
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2"><div className="text-lg font-bold text-amber-700">{gapCount(g => g.priority === 'Medium')}</div>Medium</div>
                                <div className="bg-green-50 border border-green-200 rounded-lg p-2"><div className="text-lg font-bold text-green-700">{gapCount(g => g.priority === 'Low')}</div>Low</div>
                                <div className="bg-white border border-slate-200 rounded-lg p-2"><div className="text-lg font-bold text-slate-800">{gapData.sections.length}</div>Sections</div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {GAP_TYPES.map(t => {
                                    const n = gapCount(g => g.type === t);
                                    return n ? <span key={t} className="text-[11px] bg-white border border-slate-200 rounded-full px-2 py-0.5 text-slate-600">{t}: <b>{n}</b></span> : null;
                                })}
                            </div>

                            {gapData.sections.map((sec, si) => (
                                <div key={si} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-bold text-slate-800 text-sm">{si + 1}. {sec.title}</h3>
                                        {sec.sectionType && <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 font-bold">{sec.sectionType}</span>}
                                        <span className="text-[10px] text-slate-400">{sec.doc}</span>
                                        <div className="flex-1"></div>
                                        <span className="text-xs text-slate-500">{sec.gaps.length} gap(s)</span>
                                    </div>
                                    {sec.error ? (
                                        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2">Analysis failed: {sec.error}</p>
                                    ) : (
                                        <>
                                            {sec.summary && <p className="text-xs text-slate-600">{sec.summary}</p>}
                                            <div className="flex flex-wrap gap-1">
                                                {GAP_COMPONENTS.map(c => (
                                                    <span key={c} className={`text-[10px] border rounded px-1.5 py-0.5 ${covColor(sec.coverage[c])}`}>{c}: {sec.coverage[c]}</span>
                                                ))}
                                            </div>
                                            {sec.gaps.length === 0
                                                ? <p className="text-xs text-green-700">No gaps found in this section.</p>
                                                : <div className="space-y-2">{sec.gaps.map((g, gi) => renderGap(g, si, gi))}</div>}
                                        </>
                                    )}
                                </div>
                            ))}

                            {gapData.cross.length > 0 && (
                                <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-3">
                                    <h3 className="font-bold text-slate-800 text-sm">Cross-section gaps ({gapData.cross.length})</h3>
                                    <div className="space-y-2">{gapData.cross.map((g, gi) => renderGap(g, 'cross', gi))}</div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </main>
    );

    const levelColor = (v) => v === 'Critical' ? 'text-red-900 bg-red-100' : v === 'High' ? 'text-red-700 bg-red-50' : v === 'Medium' ? 'text-amber-700 bg-amber-50' : 'text-green-700 bg-green-50';
    const bugRow = (label, content, i) => (
        <tr key={label} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
            <th className="w-40 bg-slate-800 text-white text-left font-semibold px-3 py-2 align-top text-xs">{label}</th>
            <td className="px-3 py-1.5 text-xs">{content}</td>
        </tr>
    );
    const inp = 'w-full border border-slate-200 rounded p-1.5 bg-white';

    const renderBug = (b) => {
        const gapOptions = flattenGaps(gapData);
        const tcIndex = (data?.testCases || []).findIndex(tc => tc.id === b.testCaseId && tc.title === b.testCaseTitle);
        const rows = [
            ['Bug ID', <span className="font-bold">{b.id}</span>],
            ['Title', <input className={inp + ' font-semibold'} value={b.title} onChange={e => updateBug(b.id, 'title', e.target.value)} placeholder="Bug title" />],
            ['Module', <input className={inp} value={b.module} onChange={e => updateBug(b.id, 'module', e.target.value)} placeholder="Feature / screen" />],
            ['Severity', <select className={`border rounded p-1 font-bold ${levelColor(b.severity)}`} value={b.severity} onChange={e => updateBug(b.id, 'severity', e.target.value)}>{LEVELS.map(l => <option key={l} value={l}>{l}</option>)}</select>],
            ['Priority', <select className={`border rounded p-1 font-bold ${levelColor(b.priority)}`} value={b.priority} onChange={e => updateBug(b.id, 'priority', e.target.value)}>{LEVELS.map(l => <option key={l} value={l}>{l}</option>)}</select>],
            ['Environment', <input className={inp} value={b.environment} onChange={e => updateBug(b.id, 'environment', e.target.value)} placeholder="e.g. Build v2.3.1, Test environment" />],
            ['Steps to Reproduce', <textarea className={inp} rows="4" value={b.steps} onChange={e => updateBug(b.id, 'steps', e.target.value)} placeholder="1. ... 2. ..."></textarea>],
            ['Test Data', <textarea className={inp} rows="2" value={b.testData} onChange={e => updateBug(b.id, 'testData', e.target.value)}></textarea>],
            ['Expected Result', <textarea className={inp} rows="2" value={b.expected} onChange={e => updateBug(b.id, 'expected', e.target.value)}></textarea>],
            ['Actual Result', <div>
                <textarea className={inp} rows="2" value={b.actual} onChange={e => updateBug(b.id, 'actual', e.target.value)}></textarea>
                {!b.actual.trim() && <p className="text-[11px] text-red-600 mt-1">Actual result is missing, please fill it in.</p>}
            </div>],
            ['Status', <select className="border rounded p-1 bg-slate-50 font-semibold" value={b.status} onChange={e => updateBug(b.id, 'status', e.target.value)}>{BUG_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}</select>],
            ['Linked Test Case', <select className={inp} value={tcIndex >= 0 ? String(tcIndex) : ''} onChange={e => linkBugToTestCase(b.id, e.target.value)}>
                <option value="">— none —</option>
                {(data?.testCases || []).map((tc, i) => <option key={i} value={String(i)}>{tc.id} - {tc.title}</option>)}
                {tcIndex < 0 && b.testCaseId && <option value="" disabled>{b.testCaseId} (not in current test cases)</option>}
            </select>],
            ['Linked Scenario', <input className={inp} value={b.scenarioId} onChange={e => updateBug(b.id, 'scenarioId', e.target.value)} placeholder="TS-01" />],
            ['Related Gap', <select className={inp} value={b.gapId} onChange={e => updateBug(b.id, 'gapId', e.target.value)}>
                <option value="">— none —</option>
                {gapOptions.map(g => <option key={g.id} value={g.id}>{g.id} - {g.description.slice(0, 70)}</option>)}
                {b.gapId && !gapOptions.some(g => g.id === b.gapId) && <option value={b.gapId}>{b.gapId}</option>}
            </select>]
        ];
        return (
            <div key={b.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-xs italic text-slate-500">{bugTraceNote(b)}</p>
                    <button onClick={() => deleteBug(b.id)} className="text-xs text-red-600 hover:underline flex-shrink-0">Delete</button>
                </div>
                <table className="w-full border border-slate-200 rounded-lg overflow-hidden">
                    <tbody>{rows.map(([label, content], i) => bugRow(label, content, i))}</tbody>
                </table>
            </div>
        );
    };

    const traceRows = buildTraceRows(data, bugs);
    const pendingFailed = failedWithoutBug();

    const bugsMain = (
        <main className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
                <h2 className="text-lg font-bold text-slate-800">Bug Report</h2>
                <div className="flex gap-2">
                    <button onClick={() => setShowSettings(true)} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                        ⚙ Settings
                    </button>
                    <button onClick={addManualBug} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                        + Add
                    </button>
                    <button onClick={clearBugs} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                        Clear Data
                    </button>
                    {bugs.length > 0 && (
                        <button onClick={downloadBugsXlsx} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                            Excel (.xlsx)
                        </button>
                    )}
                    {bugs.length > 0 && (
                        <button onClick={downloadBugReport} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
                            Download Report (Word)
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="w-1/3 border-r border-slate-200 p-4 bg-slate-50 overflow-y-auto space-y-4">
                    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                        <p className="font-bold text-slate-500 uppercase">Report settings</p>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Project / Feature name:</label>
                            <input className="w-full border p-1.5 rounded bg-white" value={bugProject} onChange={e => setBugProject(e.target.value)} placeholder="e.g. ATM Balance Inquiry" />
                        </div>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Default environment (بيتحط في أي باج جديد):</label>
                            <input className="w-full border p-1.5 rounded bg-white" value={bugEnv} onChange={e => setBugEnv(e.target.value)} placeholder="e.g. ATM Build v2.3.1, Host Test Environment" />
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                        <p className="font-bold text-slate-500 uppercase">Auto-create from failed test cases</p>
                        <p className="text-slate-500">في صفحة Test Generation غيّر حالة أي كيس لـ Fail، وهيظهر عليه زرار Send to Bug Report. تقدر كمان تبعت كل الـ Fail مرة واحدة من هنا.</p>
                        <button
                            onClick={() => sendToBugs(pendingFailed)}
                            disabled={bugBusy || pendingFailed.length === 0}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50"
                        >
                            {bugBusy ? 'Creating bug reports...' : `Create bugs from failed cases (${pendingFailed.length})`}
                        </button>
                        {bugNote && <p className="text-blue-700">{bugNote}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="bg-white border border-slate-200 rounded-lg p-2"><div className="text-lg font-bold text-slate-800">{bugs.length}</div>Total bugs</div>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-2"><div className="text-lg font-bold text-red-700">{bugs.filter(b => b.severity === 'Critical' || b.severity === 'High').length}</div>Critical / High</div>
                    </div>
                </div>

                <div className="w-2/3 p-6 overflow-y-auto space-y-5">
                    <div className="flex gap-2 border-b border-slate-200 pb-2">
                        <button onClick={() => setBugTab('bugs')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${bugTab === 'bugs' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}>🐞 Bugs ({bugs.length})</button>
                        <button onClick={() => setBugTab('trace')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${bugTab === 'trace' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}>🔗 Traceability Matrix</button>
                    </div>

                    {bugTab === 'bugs' ? (
                        bugs.length === 0 ? (
                            <div className="h-64 flex items-center justify-center text-slate-400 text-center px-8">
                                مفيش باجز لسه. اعمل Fail لأي test case في Test Generation وابعته هنا، أو دوس + Add لباج يدوي.
                            </div>
                        ) : (
                            <div className="space-y-8">{bugs.map(renderBug)}</div>
                        )
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border border-slate-200">
                                <thead>
                                    <tr className="bg-blue-600 text-white text-left">
                                        <th className="p-2">Scenario</th><th className="p-2">Test Case</th><th className="p-2">Type</th><th className="p-2">Status</th><th className="p-2">Bug(s)</th><th className="p-2">Related Gap(s)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {traceRows.length === 0 && (
                                        <tr><td colSpan="6" className="p-4 text-center text-slate-400">لسه مفيش test cases أو باجز تتربط.</td></tr>
                                    )}
                                    {traceRows.map((x, i) => (
                                        <tr key={i} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                                            <td className="p-2 border-t border-slate-200 align-top"><b>{x.scenarioId || '-'}</b>{x.scenarioTitle ? ': ' + x.scenarioTitle : ''}</td>
                                            <td className="p-2 border-t border-slate-200 align-top">{x.tc ? `${x.tc.id} - ${x.tc.title}` : '-'}</td>
                                            <td className="p-2 border-t border-slate-200 align-top">{x.tc ? x.tc.type : '-'}</td>
                                            <td className={`p-2 border-t border-slate-200 align-top font-semibold ${x.tc && x.tc.status === 'Fail' ? 'text-red-600' : x.tc && x.tc.status === 'Pass' ? 'text-green-700' : 'text-slate-500'}`}>{x.tc ? x.tc.status : '-'}</td>
                                            <td className="p-2 border-t border-slate-200 align-top">{x.bugs.map(b => b.id).join(', ') || '-'}</td>
                                            <td className="p-2 border-t border-slate-200 align-top">{[...new Set(x.bugs.map(b => b.gapId).filter(Boolean))].join(', ') || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );

    /* =================================================================
       4) UI
       ================================================================= */
    return (
        <div className="flex flex-col flex-1 min-h-0 bg-slate-50 overflow-hidden" dir="ltr">
            {/* ---------- Settings Modal ---------- */}
            {showSettings && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-xl p-5 w-[480px] max-w-[95vw] shadow-xl space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">API Keys Settings</h3>
                            <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-slate-800">✕</button>
                        </div>
                        <p className="text-xs text-slate-500">
                            الأولوية: OpenRouter ← ChatGPT ← Claude ← Gemini. بيتخطى أي واحد مفتاحه فاضي.
                            المفاتيح بتتخزن في متصفحك بس (localStorage).
                        </p>
                        {PROVIDERS.map(p => (
                            <div key={p.id}>
                                <label className="block text-xs font-bold text-slate-600 mb-1">{p.name} key:</label>
                                <input
                                    type="password"
                                    className="w-full border border-slate-300 rounded p-1.5 text-xs"
                                    value={keys[p.id] || ''}
                                    onChange={e => setKeys({ ...keys, [p.id]: e.target.value })}
                                    placeholder={`${p.name} API key`}
                                />
                                <input
                                    type="text"
                                    className="w-full border border-slate-200 rounded p-1.5 text-xs mt-1 text-slate-600"
                                    value={models[p.id] || ''}
                                    onChange={e => setModels({ ...models, [p.id]: e.target.value })}
                                    placeholder={`Model (اختياري، الافتراضي: ${p.model || 'أول موديل متاح'})`}
                                />
                                {testResults[p.id] && (
                                    <p className={`text-[11px] mt-1 whitespace-pre-wrap break-words ${testResults[p.id].ok ? 'text-emerald-700' : 'text-red-600'}`}>
                                        {testResults[p.id].ok ? '✅' : '❌'} {testResults[p.id].model}: {testResults[p.id].msg}
                                    </p>
                                )}
                            </div>
                        ))}
                        <div className="flex justify-between items-center pt-2">
                            <button onClick={testConnections} disabled={testing} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50">
                                {testing ? 'Testing...' : 'Test all keys'}
                            </button>
                            <button onClick={() => setShowSettings(false)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium">Done</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ---------- Add Scenario Modal ---------- */}
            {showAddSc && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-xl p-5 w-[460px] max-w-[95vw] shadow-xl space-y-3 text-xs">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 text-sm">Add Test Scenario</h3>
                            <button onClick={() => setShowAddSc(false)} className="text-slate-500 hover:text-slate-800">✕</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Type (هينزل في أنهي قسم):</label>
                                <select className="w-full border p-1.5 rounded bg-white" value={addScForm.type} onChange={e => setAddScForm({ ...addScForm, type: e.target.value })}>
                                    <option value="Positive">Positive</option>
                                    <option value="Negative">Negative</option>
                                    <option value="Edge Case">Edge Case</option>
                                </select>
                            </div>
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Priority:</label>
                                <select className="w-full border p-1.5 rounded bg-white" value={addScForm.priority} onChange={e => setAddScForm({ ...addScForm, priority: e.target.value })}>
                                    <option value="Critical">Critical</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Title:</label>
                            <input className="w-full border p-1.5 rounded bg-white" value={addScForm.title} onChange={e => setAddScForm({ ...addScForm, title: e.target.value })} placeholder="Scenario title" />
                        </div>
                        <div className="flex gap-2 pt-1 justify-end">
                            <button onClick={() => setShowAddSc(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded font-medium">Cancel</button>
                            <button onClick={saveNewScenario} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded font-medium">Add Scenario</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ---------- Add Test Case Modal ---------- */}
            {showAddTc && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-xl p-5 w-[620px] max-w-[95vw] max-h-[92vh] overflow-y-auto shadow-xl space-y-3 text-xs">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 text-sm">Add Test Case</h3>
                            <button onClick={() => setShowAddTc(false)} className="text-slate-500 hover:text-slate-800">✕</button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Type (هينزل في أنهي قسم):</label>
                                <select className="w-full border p-1.5 rounded bg-white" value={addTcForm.type} onChange={e => setAddTcForm({ ...addTcForm, type: e.target.value })}>
                                    <option value="Positive">Positive</option>
                                    <option value="Negative">Negative</option>
                                    <option value="Edge Case">Edge Case</option>
                                </select>
                            </div>
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Priority:</label>
                                <select className="w-full border p-1.5 rounded bg-white" value={addTcForm.priority} onChange={e => setAddTcForm({ ...addTcForm, priority: e.target.value })}>
                                    <option value="Critical">Critical</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Scenario ID:</label>
                                <input list="known-scenarios" className="w-full border p-1.5 rounded bg-white" value={addTcForm.scenarioId} onChange={e => setAddTcForm({ ...addTcForm, scenarioId: e.target.value })} placeholder="TS-01" />
                                <datalist id="known-scenarios">
                                    {knownScenarios().map(sc => <option key={sc.id} value={sc.id}>{sc.title}</option>)}
                                </datalist>
                            </div>
                        </div>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Title:</label>
                            <input className="w-full border p-1.5 rounded bg-white font-bold" value={addTcForm.title} onChange={e => setAddTcForm({ ...addTcForm, title: e.target.value })} placeholder="Test case title" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Technique:</label>
                                <input className="w-full border p-1.5 rounded bg-white" value={addTcForm.technique} onChange={e => setAddTcForm({ ...addTcForm, technique: e.target.value })} placeholder="e.g. Boundary Value Analysis" />
                            </div>
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Pre-Condition:</label>
                                <input className="w-full border p-1.5 rounded bg-white" value={addTcForm.preCondition} onChange={e => setAddTcForm({ ...addTcForm, preCondition: e.target.value })} placeholder="Pre-condition" />
                            </div>
                        </div>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Test Data:</label>
                            <input className="w-full border p-1.5 rounded bg-white" value={addTcForm.testData} onChange={e => setAddTcForm({ ...addTcForm, testData: e.target.value })} placeholder="Test data" />
                        </div>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Steps (one step per line):</label>
                            <textarea className="w-full border p-1.5 rounded bg-white" rows="4" value={addTcForm.stepsText} onChange={e => setAddTcForm({ ...addTcForm, stepsText: e.target.value })} placeholder="Enter each step on a new line"></textarea>
                        </div>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Expected Result:</label>
                            <input className="w-full border p-1.5 rounded bg-white" value={addTcForm.expected} onChange={e => setAddTcForm({ ...addTcForm, expected: e.target.value })} placeholder="Expected result" />
                        </div>
                        <div className="flex gap-2 pt-1 justify-end">
                            <button onClick={() => setShowAddTc(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded font-medium">Cancel</button>
                            <button onClick={saveNewTestCase} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded font-medium">Add Test Case</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-1 min-h-0 overflow-hidden">
            <aside className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-6 px-2">
                        <AppLogo size={36} />
                        <div>
                            <h1 className="font-bold text-slate-800 text-base leading-tight">{APP_NAME}</h1>
                            <p className="text-xs text-slate-400">{APP_TAGLINE}</p>
                        </div>
                    </div>
                    <div className="space-y-1 px-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Modules</p>
                        <button
                            onClick={() => setPage('gaps')}
                            className={`w-full flex items-center gap-2 p-2 rounded-lg font-medium text-xs text-left ${page === 'gaps' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <span>🔍</span>
                            <span>Requirement Gaps</span>
                        </button>
                        <button
                            onClick={() => setPage('scenarios')}
                            className={`w-full flex items-center gap-2 p-2 rounded-lg font-medium text-xs text-left ${page === 'scenarios' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <span>📋</span>
                            <span>Test Scenarios</span>
                        </button>
                        <button
                            onClick={() => setPage('generation')}
                            className={`w-full flex items-center gap-2 p-2 rounded-lg font-medium text-xs text-left ${page === 'generation' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <span>⚡</span>
                            <span>Test Generation</span>
                        </button>
                        <button
                            onClick={() => setPage('bugs')}
                            className={`w-full flex items-center gap-2 p-2 rounded-lg font-medium text-xs text-left ${page === 'bugs' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            <span>🐞</span>
                            <span>Bug Report</span>
                            {bugs.length > 0 && <span className="ml-auto bg-red-100 text-red-700 rounded-full px-1.5 text-[10px] font-bold">{bugs.length}</span>}
                        </button>
                    </div>
                </div>
                <div className="text-xs text-slate-400 px-2">Full QA Suite</div>
            </aside>

            {page === 'bugs' ? bugsMain : page === 'gaps' ? gapsMain : page === 'scenarios' ? scenariosMain : (
            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
                    <h2 className="text-lg font-bold text-slate-800">Test Case Management Workbench</h2>
                    <div className="flex gap-2">
                        {failedWithoutBug().length > 0 && (
                            <button onClick={() => sendToBugs(failedWithoutBug())} disabled={bugBusy} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                                {bugBusy ? 'Creating bugs...' : `🐞 Send failed to Bugs (${failedWithoutBug().length})`}
                            </button>
                        )}
                        <button onClick={openAddTestCase} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                            + Add
                        </button>
                        <button onClick={() => setShowSettings(true)} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                            ⚙ Settings
                        </button>
                        <button onClick={handleClear} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                            Clear Data
                        </button>
                        {data?.testCases && (
                            <button onClick={exportToXLSX} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
                                Export Excel (.xlsx)
                            </button>
                        )}
                        {data?.testCases && (
                            <button onClick={exportToCSV} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                                CSV
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <div className="w-1/3 border-r border-slate-200 p-4 bg-slate-50 overflow-y-auto space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">User Story / Acceptance Criteria</label>
                            <textarea
                                className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                                rows="10"
                                value={story}
                                onChange={e => setStory(e.target.value)}
                                placeholder="Paste requirements or upload file..."
                            ></textarea>

                            <div className="mt-3 space-y-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Or Upload File (PDF/Word/Image/Text)</label>
                                <input
                                    type="file"
                                    onChange={handleFileUpload}
                                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-200 rounded-lg p-1 bg-white"
                                />
                                {uploadStatus && <p className="text-xs text-blue-600">{uploadStatus}</p>}
                                {images.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {images.map((img, i) => (
                                            <span key={i} className="text-[10px] bg-white border border-slate-200 rounded px-2 py-1 flex items-center gap-1">
                                                🖼 {img.name}
                                                <button onClick={() => setImages(images.filter((_, j) => j !== i))} className="text-red-500">✕</button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={generateWithAI}
                                disabled={loading}
                                className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                {loading ? 'Analyzing Requirements...' : 'Generate Test Cases'}
                            </button>

                            {lastProvider && !loading && (
                                <p className="mt-2 text-xs text-emerald-700">✔ Generated using {lastProvider}</p>
                            )}
                            {errorsLog.length > 0 && (
                                <div className="mt-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded p-2 space-y-1">
                                    {errorsLog.map((m, i) => <div key={i}>{m}</div>)}
                                </div>
                            )}
                        </div>

                        {linked.length > 0 && (
                            <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 shadow-sm">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-xs font-bold text-blue-700 uppercase">Linked Scenarios ({linked.length})</h3>
                                    <button onClick={() => setLinked([])} className="text-[11px] text-red-600 hover:underline">Remove link</button>
                                </div>
                                <p className="text-[11px] text-slate-500 mb-2">Generate Test Cases هيبني الكيسز على السيناريوهات دي.</p>
                                <ul className="space-y-1.5">
                                    {linked.map(sc => (
                                        <li key={sc.id} className="text-xs bg-white p-2 rounded border border-blue-100">
                                            <span className="font-bold text-blue-600">{sc.id}</span>
                                            <span className="text-[10px] text-slate-400"> [{sc.type}] </span>
                                            {sc.title}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {data?.scenarios && (
                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Test Scenarios</h3>
                                <ul className="space-y-1.5">
                                    {data.scenarios.map(sc => (
                                        <li key={sc.id} className="text-xs bg-slate-50 p-2 rounded border border-slate-100">
                                            <span className="font-bold text-blue-600">{sc.id}:</span> {sc.title}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="w-2/3 p-6 overflow-y-auto space-y-6">
                        {!data?.testCases ? (
                            <div className="h-full flex items-center justify-center text-slate-400">
                                Provide inputs and click Generate to start testing.
                            </div>
                        ) : (
                            ['Positive', 'Negative', 'Edge Case'].map(cat => {
                                const items = data.testCases.map((t, idx) => ({ ...t, originalIndex: idx })).filter(t => t.type === cat);
                                if (items.length === 0) return null;
                                let catColor = cat === 'Positive' ? 'text-green-700 bg-green-50 border-green-200' :
                                               cat === 'Negative' ? 'text-red-700 bg-red-50 border-red-200' :
                                               'text-amber-700 bg-amber-50 border-amber-200';
                                return (
                                    <div key={cat} className="space-y-3">
                                        <div className={`px-3 py-1 rounded border font-bold text-xs uppercase ${catColor}`}>{cat} Cases ({items.length})</div>
                                        {items.map((tc) => {
                                            const idx = tc.originalIndex;
                                            const isEditing = editingIndex === idx;
                                            return (
                                                <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3 text-xs">
                                                    {isEditing ? (
                                                        <div className="space-y-3 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                                                            <div className="flex justify-between items-center font-bold text-blue-800">
                                                                <span>Editing Test Case: {editForm.id}</span>
                                                            </div>
                                                            <div>
                                                                <label className="block font-bold text-slate-600 mb-1">Scenario ID:</label>
                                                                <input className="w-full border p-1.5 rounded bg-white" value={editForm.scenarioId || ''} onChange={e => setEditForm({ ...editForm, scenarioId: e.target.value })} placeholder="Scenario ID (e.g. TS-01)" />
                                                            </div>
                                                            <div>
                                                                <label className="block font-bold text-slate-600 mb-1">Title:</label>
                                                                <input className="w-full border p-1.5 rounded font-bold bg-white" value={editForm.title || ''} onChange={e => setEditForm({ ...editForm, title: e.target.value })} placeholder="Title" />
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-2">
                                                                <div>
                                                                    <label className="block font-bold text-slate-600 mb-1">Type:</label>
                                                                    <select className="w-full border p-1.5 rounded bg-white" value={editForm.type || 'Positive'} onChange={e => setEditForm({ ...editForm, type: e.target.value })}>
                                                                        <option value="Positive">Positive</option>
                                                                        <option value="Negative">Negative</option>
                                                                        <option value="Edge Case">Edge Case</option>
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="block font-bold text-slate-600 mb-1">Priority:</label>
                                                                    <select className="w-full border p-1.5 rounded bg-white" value={editForm.priority || 'Medium'} onChange={e => setEditForm({ ...editForm, priority: e.target.value })}>
                                                                        <option value="Critical">Critical</option>
                                                                        <option value="High">High</option>
                                                                        <option value="Medium">Medium</option>
                                                                        <option value="Low">Low</option>
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="block font-bold text-slate-600 mb-1">Technique:</label>
                                                                    <input className="w-full border p-1.5 rounded bg-white" value={editForm.technique || ''} onChange={e => setEditForm({ ...editForm, technique: e.target.value })} placeholder="Technique" />
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <label className="block font-bold text-slate-600 mb-1">Pre-Condition:</label>
                                                                    <input className="w-full border p-1.5 rounded bg-white" value={editForm.preCondition || ''} onChange={e => setEditForm({ ...editForm, preCondition: e.target.value })} placeholder="Pre-condition" />
                                                                </div>
                                                                <div>
                                                                    <label className="block font-bold text-slate-600 mb-1">Test Data:</label>
                                                                    <input className="w-full border p-1.5 rounded bg-white" value={editForm.testData || ''} onChange={e => setEditForm({ ...editForm, testData: e.target.value })} placeholder="Test data" />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block font-bold text-slate-600 mb-1">Steps (one step per line):</label>
                                                                <textarea className="w-full border p-1.5 rounded bg-white" rows="3" value={editForm.stepsText || ''} onChange={e => setEditForm({ ...editForm, stepsText: e.target.value })} placeholder="Enter each step on a new line"></textarea>
                                                            </div>
                                                            <div>
                                                                <label className="block font-bold text-slate-600 mb-1">Expected Result:</label>
                                                                <input className="w-full border p-1.5 rounded bg-white" value={editForm.expected || ''} onChange={e => setEditForm({ ...editForm, expected: e.target.value })} placeholder="Expected result" />
                                                            </div>
                                                            <div className="flex gap-2 pt-2">
                                                                <button onClick={() => saveEditing(idx)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded font-medium">Save Changes</button>
                                                                <button onClick={() => setEditingIndex(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded font-medium">Cancel</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <div className="flex justify-between items-center">
                                                                <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                                    <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2.5 py-1 rounded-md shadow-sm font-semibold tracking-wide flex items-center gap-1">
                                                                        <span className="text-[10px] opacity-75">🔗</span> {tc.scenarioId || 'TS-01'}
                                                                    </span>
                                                                    <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200 font-semibold">
                                                                        {tc.id}
                                                                    </span>
                                                                    <span className="text-slate-800">{tc.title}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <select
                                                                        className="border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-700 bg-slate-50"
                                                                        value={tc.priority || 'Medium'}
                                                                        onChange={(e) => updateTestCaseField(idx, 'priority', e.target.value)}
                                                                    >
                                                                        <option value="Critical">Priority: Critical</option>
                                                                        <option value="High">Priority: High</option>
                                                                        <option value="Medium">Priority: Med</option>
                                                                        <option value="Low">Priority: Low</option>
                                                                    </select>
                                                                    <button onClick={() => startEditing(idx, tc)} className="text-blue-600 hover:underline">Edit</button>
                                                                    <button onClick={() => deleteTestCase(idx)} className="text-red-600 hover:underline">Delete</button>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4 text-slate-600 mt-2">
                                                                <div>
                                                                    <p><strong className="text-slate-700">Pre-Condition:</strong> {tc.preCondition}</p>
                                                                    <p className="mt-1"><strong className="text-slate-700">Test Data:</strong> {tc.testData}</p>
                                                                </div>
                                                                <div>
                                                                    <strong className="text-slate-700">Steps:</strong>
                                                                    <ol className="list-decimal list-inside">{(tc.steps || []).map((s, i) => <li key={i}>{s}</li>)}</ol>
                                                                </div>
                                                            </div>
                                                            <div className="pt-2 border-t border-slate-100 text-emerald-700 font-medium">
                                                                <strong>Expected:</strong> {tc.expected}
                                                            </div>
                                                            <div className="pt-2 mt-2 border-t border-slate-100 flex items-center gap-4 bg-slate-50 p-2 rounded">
                                                                <div className="flex-1">
                                                                    <label className="block font-bold text-slate-500 mb-1">Actual Result:</label>
                                                                    <input
                                                                        type="text"
                                                                        className="w-full border border-slate-300 rounded p-1 text-xs bg-white"
                                                                        value={tc.actualResult || ''}
                                                                        onChange={(e) => updateTestCaseField(idx, 'actualResult', e.target.value)}
                                                                        placeholder="Enter actual result..."
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block font-bold text-slate-500 mb-1">Status:</label>
                                                                    <select
                                                                        className={`border rounded p-1 text-xs font-bold ${tc.status === 'Pass' ? 'bg-green-100 text-green-700' : tc.status === 'Fail' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'}`}
                                                                        value={tc.status || 'Untested'}
                                                                        onChange={(e) => updateTestCaseField(idx, 'status', e.target.value)}
                                                                    >
                                                                        <option value="Untested">Untested</option>
                                                                        <option value="Pass">Pass</option>
                                                                        <option value="Fail">Fail</option>
                                                                    </select>
                                                                </div>
                                                                {(tc.status === 'Fail' || bugFor(tc)) && (
                                                                    <div className="self-end">
                                                                        {bugFor(tc) ? (
                                                                            <button onClick={() => setPage('bugs')} className="bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded font-semibold hover:bg-red-100">🐞 {bugFor(tc).id} · View</button>
                                                                        ) : (
                                                                            <button onClick={() => sendToBugs([tc])} disabled={bugBusy} className="bg-red-600 text-white px-2 py-1 rounded font-semibold hover:bg-red-700 disabled:opacity-50">{bugBusy ? '...' : '🐞 Send to Bug Report'}</button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </main>
            )}
            </div>
        </div>
    );
}

/* =====================================================================
   5) RENDER
   ===================================================================== */
ReactDOM.createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>);