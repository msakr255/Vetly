/* =====================================================================
   features/agent.js
   Vetly Agent — Full-page AI Chat for Software Testing.
   - Chat area = ONLY messages (export icons under agent response)
   - Provider/Model + file upload in input area (LEFT-aligned, same row)
   - Skills + Prompt tabs in header (single panel)
   - Stop button (AbortController) when busy
   - Markdown-lite response rendering (tables, bold, code, lists)ئئئ
   - Export: Copy (animation) / PDF (print) / Word (formatted)
   - RTL for Arabic + English terms in ""
   - Auto-scroll to latest agent response AND input typing
   ===================================================================== */

var AGENT_SYS_DEFAULT = [
    '# Vetly Agent — Software Testing Assistant',
    'ROLE: You are a comprehensive software testing and Quality Engineering expert and mentor.',
    'IDENTITY: Your name is Vetly \u2014 the personal QA assistant of the Vetly QA Workbench. When asked who you are or for your name, say you are Vetly.',
    'Expertise includes the full software testing field: manual and exploratory testing, test design and techniques, requirements and risk analysis, test planning and strategy, SDLC/STLC, Agile/DevOps, test management, defect lifecycle, automation and frameworks, API/web/mobile testing, performance, security, usability/accessibility, CI/CD, quality engineering, ISTQB certifications and syllabus topics, and software testing interview preparation.',
    '',
    'RULES:',
    '1. Answer questions across the full software testing and Quality Engineering field, including certification study (such as ISTQB) and interview questions. Do not restrict answers to project features or a narrow QA subset.',
    '2. Use explicitly mentioned Skills as helpful guidance or task-specific formats, not as a limit on your testing knowledge. If a Skill does not cover the question, answer it using your broader software testing expertise; never refuse a testing question solely because it is absent from a Skill.',
    '3. For ISTQB or other certification questions, be precise about syllabus/version when relevant and state uncertainty rather than inventing official exam facts.',
    '4. Never invent facts. Mark invented data: // GENERATED DATA',
    '5. Be thorough and well-structured: explain the reasoning, give a concrete EXAMPLE for anything abstract, cover edge considerations, and organize with headings/lists \u2014 never a bare one-liner when depth helps.',
    '6. Use the user\'s language.',
    '',
    'PROJECT CONTEXT: Use the user\'s current project and story data when answering questions about their own work; this context does not limit general software testing answers.'
].join('\n');

// ===== فورمات العناصر الإلزامي: نفس شكل صفحات الموقع حرفيًا =====
// لما المستخدم يطلب "اعمل لي تيست كيس/سيناريو/تحليل متطلبات" أو "هاتهم" — الرد يكون
// العناصر نفسها بس بنفس سطور الموقع بالترتيب، من غير أي إضافة فوق أو تحت، وبالإنجليزي دايمًا.
// ده اللي بيخلي "Send to feature" بعدها ينزل كل حاجة في مكانها الصح.
var AGENT_ITEM_FORMAT = [
    '',
    '# ITEM OUTPUT FORMAT (MANDATORY)',
    'TRIGGER: the user asks you to create/generate/write test case(s), test scenario(s), or requirement-gap analysis \u2014 OR to show/bring existing items.',
    'ON TRIGGER: output ONLY the items themselves in EXACTLY the formats below \u2014 no introduction, no headings, no explanations, no notes, no closing line: nothing above or below the items.',
    'ITEMS ARE ALWAYS WRITTEN IN ENGLISH (their default language), even if the chat is in another language. Keep IDs and field labels exactly as shown.',
    'Separate multiple items with one blank line.',
    '',
    'TEST CASE (include the TS line ONLY when a scenario is linked):',
    'TS-<scenario number>',
    'TC-<number>',
    '<title>',
    'Priority: <Critical|High|Medium|Low>',
    'Pre-Condition: <text or ->',
    'Test Data: <text or ->',
    'Steps:',
    '1) <step>',
    '2) <step>',
    'Expected: <text>',
    'Technique: <technique>',
    '',
    'TEST SCENARIO:',
    'TS-<number>',
    '<title>',
    '<Positive|Negative|Edge Case>',
    '<Critical|High|Medium|Low>',
    '',
    'REQUIREMENT GAP:',
    'GAP-<3-digit number>',
    '<type>',
    'Ref: <requirement reference or ->',
    '<Critical|High|Medium|Low>',
    '<Open|Answered|Closed>',
    'Gap: <description>',
    'Evidence: <text or ->',
    'Scenario: <text or ->',
    'Question to Business Analyst: <text or ->',
    '',
    'The gap <type> line must be EXACTLY one of: ' + GAP_TYPES.join(' / ') + '.',
    'TITLE VERBS: test case and scenario titles MUST start with an action verb \u2014 Verify / Validate / Ensure / Check / Confirm (e.g. "Verify the user cannot log in with an expired password").',
    'NUMBERING: a new item takes the next sequential number after the highest existing ID of its type in the ITEM INDEX (TC-15 after TC-14, TS-15 after TS-14, GAP-016 after GAP-015). If no ITEM INDEX is present, start from 01 / 001.',
    'This format takes precedence over the user-language rule whenever the TRIGGER above matches. For any other question, answer normally in the user\'s language.'
].join('\n');

// ===== Gemini Live API (المكالمة الصوتية الحية) =====
// WebSocket مباشر من المتصفح — مش خاضع لقواعد CORS أصلًا، وبنفس مفتاح جيميناي الموجود في Settings.
// إصدار v1beta: setup (موديل + صوت + systemInstruction) ← realtimeInput (PCM 16k) ← رد صوتي 24k.
// الـ Live API بيتكلم بروتو باينري على السوكت — عشان كده بنستخدم الـ SDK الرسمي بتاع جوجل
// (@google/genai) اللي بيفك التشفير ويدّي رسايل JSON جاهزة (السوكت اليدوي كان بيوصلك باينري وتضيع)
var loadGenaiSdk = function () {
    if (window._vetlyGenai) return Promise.resolve(window._vetlyGenai);
    var urls = ['https://esm.run/@google/genai', 'https://esm.sh/@google/genai'];
    var tryAt = function (i) {
        if (i >= urls.length) return Promise.reject(new Error('could not load the @google/genai SDK from the CDN'));
        return new Function('u', 'return import(u)')(urls[i]).then(function (m) {
            var GAI = m && (m.GoogleGenAI || (m.default && m.default.GoogleGenAI));
            if (!GAI) throw new Error('SDK loaded but GoogleGenAI is missing');
            window._vetlyGenai = { GoogleGenAI: GAI };
            return window._vetlyGenai;
        }).catch(function () { return tryAt(i + 1); });
    };
    return tryAt(0);
};
// قايمة احتياطية لو استعلام ListModels فشل: موديلات الـ bidi الموثقة على v1beta —
// بترتيب طلب المستخدم: gemini-2.0-flash-exp الأول، وبعد كده 2.0-flash-live-001، وgemini-1.5-flash
// (مفيش أي موديل اسمه فيه preview — اتأكدنا إنها مش مدعومة للـ bidi بتجارب حية code 1008)
var LIVE_FALLBACK = [
    { model: 'models/gemini-2.0-flash-exp', v: 'v1beta' },
    { model: 'models/gemini-2.0-flash-live-001', v: 'v1beta' },
    { model: 'models/gemini-1.5-flash', v: 'v1beta' }
];
var LIVE_VOICE = 'Aoede';
// أصوات جيميناي الجاهزة — المستخدم بيختار من الهيدر (بيتحفظ محليًا)
var LIVE_VOICES = [
    { name: 'Aoede', note: 'breezy' },
    { name: 'Puck', note: 'upbeat' },
    { name: 'Charon', note: 'informative' },
    { name: 'Kore', note: 'firm' },
    { name: 'Fenrir', note: 'excitable' },
    { name: 'Leda', note: 'youthful' },
    { name: 'Orus', note: 'resolute' },
    { name: 'Zephyr', note: 'bright' }
];
var liveVoiceName = function () {
    try {
        var v = localStorage.getItem('wakil_live_voice');
        if (v && LIVE_VOICES.some(function (x) { return x.name === v; })) return v;
    } catch (e) { }
    return LIVE_VOICE;
};
// قايمة اللهجات/اللكنات — المستخدم بيختار اللي يريحه (بيتحفظ محليًا)
var LIVE_ACCENTS = [
    { id: 'egy', label: '\u0645\u0635\u0631\u064A (Egyptian)', instr: 'Egyptian Arabic dialect' },
    { id: 'gulf', label: '\u062E\u0644\u064A\u062C\u064A/\u0633\u0639\u0648\u062F\u064A (Gulf)', instr: 'Gulf (Saudi) Arabic dialect' },
    { id: 'lev', label: '\u0634\u0627\u0645\u064A (Levantine)', instr: 'Levantine Arabic dialect' },
    { id: 'msa', label: '\u0641\u0635\u062D\u0649 (MSA)', instr: 'Modern Standard Arabic' },
    { id: 'en-us', label: 'English (US)', instr: 'American English' },
    { id: 'en-uk', label: 'English (UK)', instr: 'British English' },
    { id: 'de', label: 'Deutsch', instr: 'German' }
];
var liveAccentInstr = function () {
    try {
        var v = localStorage.getItem('wakil_live_accent');
        for (var i = 0; i < LIVE_ACCENTS.length; i++) if (LIVE_ACCENTS[i].id === v) return LIVE_ACCENTS[i].instr;
    } catch (e) { }
    return 'Egyptian Arabic dialect';
};
// محلل محلي فوري لصيغة الموقع الرسمية (من غير نداء AI) — بيتاستخدم في الحفظ بالصوت
// عشان يبقى لحظي: الأيجنت بيوصف العنصر بالصيغة وبنقريها هنا على طول
var parseSiteFormatItems = function (text, feat) {
    var lines = String(text || '').split(/\n+/).map(function (l) { return l.replace(/^[-*\u2022\s]+/, '').trim(); }).filter(Boolean);
    var items = [];
    var cur = null;
    var pendingScen = '';
    var push = function () { if (cur && String(cur.title || cur.description || '').trim()) items.push(cur); cur = null; };
    var afterColon = function (l) { var i = l.indexOf(':'); return i === -1 ? '' : l.slice(i + 1).trim(); };
    for (var i = 0; i < lines.length; i++) {
        var l = lines[i];
        if (feat === 'cases') {
            var ts = /^(TS-\d+)/i.exec(l);
            if (ts) { pendingScen = ts[1]; continue; }
            var tc = /^(TC-\d+)/i.exec(l);
            if (tc) { push(); cur = { id: tc[1], title: '', type: '', priority: '', technique: '', preCondition: '', testData: '', steps: [], expected: '', scenarioId: pendingScen }; pendingScen = ''; continue; }
            if (!cur) continue;
            if (/^Priority\s*:/i.test(l)) cur.priority = normPriority(afterColon(l));
            else if (/^Pre-?[Cc]ondition\s*:/i.test(l)) cur.preCondition = afterColon(l);
            else if (/^Test [Dd]ata\s*:/i.test(l)) cur.testData = afterColon(l);
            else if (/^Expected\s*:/i.test(l)) cur.expected = afterColon(l);
            else if (/^Technique\s*:/i.test(l)) cur.technique = afterColon(l);
            else if (/^Steps?\s*:/i.test(l)) { /* بداية الخطوات — المرقمة بتتلقط */ }
            else if (/^\(?\d+[.)]\s*/.test(l)) cur.steps.push(l.replace(/^\(?\d+[.)]\s*/, ''));
            else if (!cur.title) cur.title = l;
        } else if (feat === 'scenarios') {
            var tsm = /^(TS-\d+)/i.exec(l);
            if (tsm) { push(); cur = { id: tsm[1], title: '', type: '', priority: '' }; continue; }
            if (!cur) continue;
            if (/^(Positive|Negative|Edge Case|Edge)$/i.test(l)) cur.type = normalizeType(l);
            else if (/^(Critical|High|Medium|Low)$/i.test(l)) cur.priority = normPriority(l);
            else if (!cur.title) cur.title = l;
        } else {
            var gm = /^(GAP-\d+)/i.exec(l);
            if (gm) { push(); cur = { id: gm[1], type: '', requirementRef: '', description: '', evidence: '', scenario: '', question: '', priority: 'Medium', status: 'Open' }; continue; }
            if (!cur) continue;
            if (/^Ref\s*:/i.test(l)) cur.requirementRef = afterColon(l);
            else if (/^Gap\s*:/i.test(l)) cur.description = afterColon(l);
            else if (/^Evidence\s*:/i.test(l)) cur.evidence = afterColon(l);
            else if (/^Scenario\s*:/i.test(l)) cur.scenario = afterColon(l);
            else if (/^Question/i.test(l)) cur.question = afterColon(l);
            else if (/^(Critical|High|Medium|Low)$/i.test(l)) cur.priority = normPriority(l);
            else if (/^(Open|Answered|Closed)$/i.test(l)) cur.status = l;
            else if (!cur.type) cur.type = (typeof normalizeGapType === 'function') ? normalizeGapType(l) : l;
        }
    }
    push();
    return items;
};

// تنسيق transcript المكالمة: توحيد المسافات + سطر بعد كل جملة + سطر قبل كل حقل/معرف
// — عشان النص المكتوب يبقى مقروء وقابل للتصدير بدل كتلة ملزوقة
var formatLiveTranscript = function (t) {
    var x = String(t || '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
    if (!x) return x;
    x = x.replace(/(^|[^\d])([.?!]) +(?=[A-Z\u0600-\u06FF])/g, '$1$2\n');
    x = x.replace(/ +(Pre-Condition:|Test Data:|Steps:|Expected:|Technique:|Priority:|Ref:|Gap:|Evidence:|Scenario:|Question to Business Analyst:)/gi, '\n$1');
    x = x.replace(/ +(TC-\d+|TS-\d+|GAP-\d+|BUG-\d+|RUN-\d+)\b/g, '\n$1');
    x = x.replace(/ +(?=(?:[-*•]\s+|\d+[.)]\s+))/g, '\n');
    return x.replace(/\n{3,}/g, '\n\n');
};

var b64FromInt16 = function (int16) {
    var u8 = new Uint8Array(int16.buffer);
    var s = '';
    for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s);
};
var floatToInt16 = function (f32) {
    var out = new Int16Array(f32.length);
    for (var i = 0; i < f32.length; i++) {
        var v = Math.max(-1, Math.min(1, f32[i]));
        out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    return out;
};

var int16FromB64 = function (b64) {
    var s = atob(b64);
    var u8 = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return new Int16Array(u8.buffer);
};

// سياق الشاشة الحالية للمكالمة: الشخصية + المشروع/الستوري المفتوحة + أرقام مساحة العمل
// — عشان تجربة "اسأل جيميناي وهو شايف الصفحة" بس من الداتا المنظمة مش من سكرينشوت
// محتوى الستوري المفتوحة كامل (متطلبات/جابز/سيناريوهات/كيسز/باجز/جولات) — عشان الأيجنت الصوتي
// يجيب "هات الريكويرمنت/اليوزر ستوري/السيناريو" من المصدر مباشرة من غير ما المستخدم يلصق حاجة
var liveOpenStoryText = function () {
    var L = [];
    try {
        var d = {};
        ['wakil_req_text', 'wakil_story', 'wakil_ai_data', 'wakil_sc_data', 'wakil_linked', 'wakil_bugs', 'wakil_runs', 'wakil_gap_data'].forEach(function (k) {
            var v = localStorage.getItem(k);
            if (v != null && v !== '') d[k] = v;
        });
        if (typeof sbAccountStoryItems === 'function') {
            var it = sbAccountStoryItems(d);
            if (it.reqText) L.push('REQUIREMENT / STORY TEXT: ' + it.reqText);
            (it.scenarios || []).forEach(function (s) { L.push('SCENARIO ' + s.id + ' [' + (s.type || '-') + '/' + (s.priority || '-') + '] ' + s.title); });
            (it.cases || []).forEach(function (c) {
                L.push('TEST CASE ' + c.id + ' [' + (c.type || '-') + '/' + (c.priority || '-') + ']' + (c.scenarioId ? ' scenario ' + c.scenarioId : '') + ': ' + c.title);
                if (c.preCondition) L.push('  Pre-condition: ' + c.preCondition);
                if (c.testData) L.push('  Test data: ' + c.testData);
                if (c.steps && c.steps.length) L.push('  Steps: ' + c.steps.map(function (s2, i2) { return (i2 + 1) + ') ' + s2; }).join(' '));
                if (c.expected) L.push('  Expected: ' + c.expected);
            });
            (it.gaps || []).forEach(function (g) { L.push('GAP ' + g.id + ' [' + (g.priority || '-') + '/' + (g.status || '-') + '] ' + g.description); });
            (it.bugs || []).forEach(function (b) { L.push('BUG ' + b.id + ' [' + (b.severity || '-') + '/' + (b.status || '-') + ']' + (b.testCaseId ? ' linked ' + b.testCaseId : '') + ': ' + b.title); });
            (it.runs || []).forEach(function (r) { L.push('RUN ' + r.id + ' "' + r.name + '" ' + (r.date || '') + (r.results ? ' \u2014 results: ' + r.results : '')); });
        }
    } catch (e) { /* ignore */ }
    return L.join('\n');
};

// نص ملفات المتطلبات المرفوعة (PDF/Word/نص) — استخراج مرة واحدة لكل ستوري (كاش في الذاكرة)
var liveFileTextCache = { sig: '', text: '' };
var liveReqFilesText = function () {
    return Promise.resolve().then(function () {
        var story = safeJSON('wakil_cloud_story', null);
        var files = safeJSON('wakil_req_files', []);
        var sig = ((story && story.id) || '') + '|' + (files || []).map(function (f) { return f.name; }).join(',');
        if (liveFileTextCache.sig === sig) return liveFileTextCache.text;
        var L = [];
        var chain = Promise.resolve();
        (files || []).slice(0, 5).forEach(function (f) {
            if (f.kind === 'image') return;
            chain = chain.then(function () {
                try {
                    return readUploadedFile(dataUrlToFile(f.data, f.name, f.mime)).then(function (r) {
                        if (r && r.text && String(r.text).trim()) L.push('--- UPLOADED FILE: ' + f.name + ' ---\n' + String(r.text).slice(0, 10000));
                    });
                } catch (e) { return null; }
            });
        });
        return chain.then(function () {
            var out = L.join('\n\n').slice(0, 20000);
            liveFileTextCache = { sig: sig, text: out };
            return out;
        });
    });
};

var liveWorkspaceSummary = function () {
    try {
        var g = safeJSON('wakil_gap_data', null);
        var ai = safeJSON('wakil_ai_data', null);
        var sc = safeJSON('wakil_sc_data', []);
        var bugs = safeJSON('wakil_bugs', []);
        var runs = safeJSON('wakil_runs', []);
        var gaps = 0, openGaps = 0;
        if (g) {
            (g.sections || []).forEach(function (s) { ((s && s.gaps) || []).forEach(function (x) { gaps++; if (x.status === 'Open') openGaps++; }); });
            (g.cross || []).forEach(function (x) { gaps++; if (x.status === 'Open') openGaps++; });
        }
        var cases = ((ai && ai.testCases) || []).length;
        var openBugs = bugs.filter(function (b) { return b.status !== 'Closed' && b.status !== 'Rejected'; }).length;
        return 'Open story data right now: gaps ' + gaps + ' (' + openGaps + ' open), scenarios ' + sc.length +
            ', test cases ' + cases + ', bugs ' + bugs.length + ' (' + openBugs + ' open), runs ' + runs.length +
            '. When the user says "the screen/page/story", answer from this data.';
    } catch (e) { return ''; }
};
var buildLiveSystemPrompt = function (acct, storyFull, filesFull) {
    var L = [AGENT_SYS_DEFAULT];
    // مشاريع الأكونت بالمحتوى الكامل (محصورة بـ RLS): "هات TTS-15 / الريكويرمنت / الباجز"
    // بيتجاب من أصل البيانات — الفهرس لوحده مش كفاية
    // الفهرس لكل المشاريع (خفيف وسريع) + المحتوى الكامل للستوري المفتوحة فقط —
    // الـ 45KB الكاملة لكل المشاريع كانت بتثقل كل رد (سبب "التأخير الغريب اللي ما كانش كده الأول")
    try { var ab = String(buildAccountBlock(acct, '', true) || ''); if (ab) L.push(ab); } catch (e) { /* ignore */ }
    try { L.push('VOICE STYLE: when you speak Arabic, use the ' + liveAccentInstr() + ' accent; when you speak English or German, use a natural native accent for that language.'); } catch (e) { }
    try {
        L.push('LANGUAGE RULES:');
        L.push('1. Reply in the SAME language the user is speaking right now (Arabic \u2192 Arabic, English \u2192 English, German \u2192 German \u2014 follow the user whenever they switch). The user may test you in German: reply in German.');
        L.push('2. TECHNICAL TERMS ALWAYS STAY IN ENGLISH inside any language: say "User Story", "Test Case", "Test Scenario", "Gap", "Bug", "Requirement", "API", "Regression", "Sprint" in ENGLISH \u2014 never translate QA/software terms into Arabic or German. Only the connecting words are in the user\'s language.');
    } catch (e) { }
    try {
        // المحتوى الكامل للستوري المفتوحة + ملفات المتطلبات المرفوعة:
        // "هات الريكويرمنت/اليوزر ستوري/السيناريو" بيتجاب من هنا على طول
        L.push('');
        L.push('OPEN STORY FULL CONTENT (the complete current data \u2014 when the user asks for "the requirements", "the user story", a scenario, a test case, a gap or a bug, quote it from here):');
        if (storyFull) L.push(storyFull);
        if (filesFull) L.push('UPLOADED REQUIREMENT FILES CONTENT: ' + filesFull);
    } catch (e) { /* ignore */ }
    try {
        var proj = safeJSON('wakil_cloud_project', null);
        var story = safeJSON('wakil_cloud_story', null);
        var lastPage = localStorage.getItem('wakil_last_page') || 'agent';
        L.push('');
        L.push('CURRENT SCREEN CONTEXT (the user is looking at this inside Vetly right now):');
        if (proj) L.push('Project: ' + (proj.name || ''));
        if (story) L.push('Open story: ' + (story.name || ''));
        L.push('Last page: ' + lastPage);
        var s = liveWorkspaceSummary();
        if (s) L.push(s);
        // قواعد الرد الصوتي: هيكل واضح في الـ transcript + صيغة الموقع الرسمية للعناصر المُنشأة
        L.push('');
        L.push('LIVE VOICE RESPONSE RULES:');
        L.push('1. Answer promptly and concisely by default (1-3 short spoken sentences). Give more detail or an example only when the user asks or it is needed for clarity.');
        L.push('2. When answering with a list, always say the list title or heading first, in full, then read every item in order. Never skip a heading, list title, or item. Speak Arabic titles in Arabic and English titles and technical terms in English exactly as written; do not omit them or replace them with a summary.');
        L.push('3. Keep the transcript readable: preserve paragraph breaks, use clear sentence breaks, and put each heading and numbered or bulleted item on its own line \u2014 never merge separate paragraphs or list items into one blob.');
        L.push('4. When the user asks you to CREATE a test case, test scenario or requirement gap (for any of the three features): produce it in EXACTLY the site format below \u2014 say each field on its own line, in ENGLISH, and base the content on the OPEN STORY FULL CONTENT above (its scenarios and requirements):');
        L.push('   TEST CASE: [TS-id line only if a scenario is linked] / TC-id / Title / Priority: Critical|High|Medium|Low / Pre-Condition: / Test Data: / Steps: 1) 2) / Expected: / Technique:');
        L.push('   TEST SCENARIO: TS-id / Title / Positive|Negative|Edge Case / priority');
        L.push('   REQUIREMENT GAP: GAP-id / standard gap type / Ref: / priority / status / Gap: / Evidence: / Scenario: / Question to Business Analyst:');
        L.push('5. TITLES: test case and scenario titles MUST start with an action verb (Verify / Validate / Ensure / Check / Confirm).');
        L.push('6. To save items you created into a feature, tell the user to press the "\uD83D\uDCE4 Send to feature" button under your last answer in the chat \u2014 the app saves them automatically (numbering included). You cannot save by yourself, and that is fine.');
        L.push('7. For items in OTHER stories: you know their IDs/titles from the ITEM INDEX only \u2014 for full details, tell the user to open that story first.');
        L.push('8. NUMBERING: new items take the next sequential ID after the highest existing ID in the OPEN STORY FULL CONTENT (TC-15 after TC-14, TS-15 after TS-14, GAP-016 after GAP-015).');
        L.push('9. When the user asks what is inside a feature or for any existing item, quote it from the OPEN STORY FULL CONTENT above \u2014 same depth and structure, not a summary.');
    } catch (e) { /* ignore */ }
    return L.join('\n');
};

function loadASkills() { return safeJSON('wakil_agent_skills', []); }
function saveASkills(l) { try { localStorage.setItem('wakil_agent_skills', JSON.stringify(l)); } catch (e) { } }
function loadASys() { return localStorage.getItem('wakil_agent_system_prompt') || AGENT_SYS_DEFAULT; }
function saveASys(v) { try { localStorage.setItem('wakil_agent_system_prompt', v); } catch (e) { } }

function parseSkillsFile(text) {
    var blocks = text.split(/\n---+\n|\n###+\n/).map(function (b) { return b.trim(); }).filter(Boolean);
    if (blocks.length <= 1) return [{ id: 'sk-' + Date.now().toString(36), name: 'Uploaded Skills', content: text.trim(), enabled: true }];
    return blocks.map(function (b, i) {
        var lines = b.split('\n');
        var name = lines[0].replace(/^#+\s*/, '').trim() || ('Skill ' + (i + 1));
        var content = lines.slice(1).join('\n').trim() || b;
        return { id: 'sk-' + Date.now().toString(36) + '-' + i, name: name, content: content, enabled: true };
    });
}

function buildSkillsBlock(skills) {
    var active = skills.filter(function (s) { return s.enabled && s.content.trim(); });
    if (!active.length) return '';
    return '\n\nUSER-MENTIONED SKILLS (SUPPLEMENTARY GUIDANCE):\n' +
        active.map(function (s, i) { return '--- SKILL ' + (i + 1) + ': ' + s.name + ' ---\n' + s.content.trim() + '\n'; }).join('\n\n') +
        '\n\nRULES:\n1. Apply relevant instructions and cite a Skill when useful, but Skills are supplementary and are NOT your only knowledge source.\n2. For software testing questions not covered by these Skills, answer using your full software testing expertise; do not refuse or claim the information is unavailable.\n3. INPUT RULE: the user\'s message (text + attached files/images) is input data to process using relevant Skill guidance and your broader expertise. Follow a Skill-specific output format when relevant.';
}

// ===== كشف نية الاسترجاع/التحليل: هل المستخدم طالب بمحتوى العناصر نفسها؟ =====
// لو آه ⇒ المحتوى الكامل (كيسز/سيناريوهات/جابز/باجز/جولات/نص المتطلبات) يتحط في السياق.
// الفهرس (IDs + عناوين) موجود دايمًا في كل الحالات.
function accountWantsFullData(q) {
    q = String(q || '').toLowerCase();
    if (/\b(tc|sc|ts|gap|bug|run)-?\s?\d+/.test(q)) return true; // ذكر ID محدد
    if (/(كلهم|هاتهم|جيبهم|اعرضهم|أعرضهم|show all|list all|bring all|all of them)/.test(q)) return true; // "هاتهم كلهم"
    var fetchWords = ['هات', 'جيب', 'اعرض', 'أعرض', 'استدعي', 'استخرج', 'اظهر', 'أظهر', 'عاوز اشوف', 'عايز اشوف', 'اريد رؤية', 'نسخ لي', 'اكتبلي', 'list', 'show', 'bring', 'fetch', 'retrieve', 'give me', 'what are', 'dump'];
    var analysisWords = ['حلل', 'تحليل', 'رأيك', 'اقترح', 'اقتراحات', 'analyze', 'review', 'suggest', 'improve', 'assess'];
    var featureWords = ['كيس', 'كيسز', 'تيست كيس', 'سيناريو', 'جاب', 'باج', 'بوج', 'جولة', 'جولات', 'رن', 'ستوري', 'قصة', 'مشروع', 'مشاريع', 'متطلب', 'متطلبات', 'requirement', 'test case', 'case', 'scenario', 'gap', 'bug', 'run', 'story', 'project'];
    var hit = function (arr) { return arr.some(function (w) { return q.indexOf(w) !== -1; }); };
    return (hit(fetchWords) || hit(analysisWords)) && hit(featureWords);
}

// ===== سياق الحساب → نص يتحط في system prompt =====
// الفهرس دايمًا موجود (IDs + عناوين) — والمحتوى الكامل بيظهر لما الطلب يكون استرجاع/تحليل.
// المصدر sbGetAccountContext اللي محصور بـ RLS على صاحب الجلسة — مفيش داتا حساب تاني أبدًا.
function buildAccountBlock(acct, question, forVoice, forceFull) {
    if (!acct || !acct.projects) return '';
    var full = accountWantsFullData(question) || forceFull === true;
    var L = [];
    L.push('ACCOUNT CONTEXT (the signed-in user\'s own cloud data \u2014 fetched live from Vetly):');
    L.push('User: ' + (acct.email || 'unknown'));
    L.push('Projects (' + acct.projects.length + '):');
    acct.projects.forEach(function (p, i) {
        var t = p.totals;
        var line = (i + 1) + '. "' + p.name + '" \u2014 stories: ' + t.stories;
        if (t.stories) line += ' (' + p.stories.map(function (s) { return '"' + s.name + '"'; }).join(', ') + ')';
        line += ' \u2014 bugs: ' + t.bugs + ' (' + t.bugsOpen + ' open, ' + t.bugsCritical + ' critical)' +
            ' \u2014 scenarios: ' + t.scenarios + ' \u2014 test cases: ' + t.cases +
            ' \u2014 runs: ' + t.runs + ' \u2014 gaps: ' + t.gaps + ' (' + t.gapsOpen + ' open)';
        L.push(line);
        if (p.savedAt) L.push('   last saved: ' + p.savedAt);
    });
    var t2 = acct.totals;
    L.push('TOTALS: projects ' + acct.projects.length + ' \u00B7 stories ' + t2.stories + ' \u00B7 bugs ' + t2.bugs + ' (' + t2.bugsOpen + ' open) \u00B7 scenarios ' + t2.scenarios + ' \u00B7 test cases ' + t2.cases + ' \u00B7 runs ' + t2.runs + ' \u00B7 gaps ' + t2.gaps);

    // الفهرس: دايمًا موجود — الموديل يعرف إن العناصر دي حقيقية ويرجع بيها
    L.push('');
    L.push('ITEM INDEX (IDs and titles \u2014 all of these items EXIST in the account):');
    acct.projects.forEach(function (p) {
        L.push('Project "' + p.name + '":');
        p.stories.forEach(function (st) {
            L.push('  Story "' + st.name + '":');
            var ix = st.index || {};
            if (ix.cases && ix.cases.length) L.push('    Test cases (' + ix.cases.length + '): ' + ix.cases.map(function (c) { return c.id + ' ' + c.title; }).join(' | '));
            if (ix.scenarios && ix.scenarios.length) L.push('    Scenarios (' + ix.scenarios.length + '): ' + ix.scenarios.map(function (s) { return s.id + ' ' + s.title; }).join(' | '));
            if (ix.gaps && ix.gaps.length) L.push('    Gaps (' + ix.gaps.length + '): ' + ix.gaps.map(function (g) { return g.id + ' ' + g.desc; }).join(' | '));
            if (ix.bugs && ix.bugs.length) L.push('    Bugs (' + ix.bugs.length + '): ' + ix.bugs.map(function (b) { return b.id + ' [' + (b.severity || '-') + '/' + (b.status || '-') + '] ' + b.title; }).join(' | '));
            if (ix.runs && ix.runs.length) L.push('    Runs (' + ix.runs.length + '): ' + ix.runs.map(function (r) { return r.id + ' "' + r.name + '"'; }).join(' | '));
            if (!ix.cases || (!ix.cases.length && !ix.scenarios.length && !ix.gaps.length && !ix.bugs.length && !ix.runs.length)) L.push('    (no items yet)');
        });
    });

    // المحتوى الكامل: بس لما الطلب يكون "هات/اعرض/حلل..." — عشان توفير التوكنز في الأسئلة العادية
    if (full) {
        L.push('');
        L.push('FULL ITEM CONTENTS (complete data \u2014 show, quote, list and analyze these items as the user asks):');
        acct.projects.forEach(function (p) {
            p.stories.forEach(function (st) {
                var it = st.items || {};
                L.push('--- Story "' + st.name + '" ---');
                if (it.reqText) L.push('REQUIREMENT TEXT: ' + it.reqText);
                (it.scenarios || []).forEach(function (s) { L.push('SCENARIO ' + s.id + ' [' + (s.type || '-') + '/' + (s.priority || '-') + '] ' + s.title); });
                (it.cases || []).forEach(function (c) {
                    L.push('TEST CASE ' + c.id + ' [' + (c.type || '-') + '/' + (c.priority || '-') + ']' + (c.scenarioId ? ' scenario ' + c.scenarioId : '') + ': ' + c.title);
                    if (c.preCondition) L.push('  Pre-condition: ' + c.preCondition);
                    if (c.testData) L.push('  Test data: ' + c.testData);
                    if (c.technique) L.push('  Technique: ' + c.technique);
                    if (c.steps && c.steps.length) L.push('  Steps: ' + c.steps.map(function (s, si) { return (si + 1) + ') ' + s; }).join(' '));
                    if (c.expected) L.push('  Expected: ' + c.expected);
                });
                (it.gaps || []).forEach(function (g) { L.push('GAP ' + g.id + ' [' + (g.priority || '-') + '/' + (g.status || '-') + '] ' + g.description); });
                (it.bugs || []).forEach(function (b) {
                    L.push('BUG ' + b.id + ' [severity ' + (b.severity || '-') + ', priority ' + (b.priority || '-') + ', status ' + (b.status || '-') + ']' + (b.testCaseId ? ' linked ' + b.testCaseId : '') + ': ' + b.title);
                    if (b.module) L.push('  Module: ' + b.module);
                    if (b.steps) L.push('  Steps: ' + b.steps);
                    if (b.expected) L.push('  Expected: ' + b.expected);
                    if (b.actual) L.push('  Actual: ' + b.actual);
                });
                (it.runs || []).forEach(function (r) {
                    L.push('RUN ' + r.id + ' "' + r.name + '" ' + (r.date || '') + (r.build ? ' build ' + r.build : '') + (r.results ? ' \u2014 results: ' + r.results : ''));
                });
            });
        });
    }

    L.push('');
    L.push('ACCOUNT RULES:');
    L.push('1. The ACCOUNT CONTEXT above is the ONLY account data that exists in this session. It is fetched server-side with row-level security scoped to the signed-in user \u2014 you cannot see or fetch any other account\'s data.');
    L.push('2. Counts/numbers: answer ONLY from the ACCOUNT CONTEXT. Never invent or estimate numbers.');
    L.push('3. Showing, listing, quoting, copying, summarizing and analyzing the user\'s OWN account items (test cases, scenarios, gaps, bugs, runs, requirement text) is ALLOWED and expected \u2014 this is the user\'s data. When the user asks to bring/show/get an item or all items, output them faithfully from the ITEM INDEX and FULL ITEM CONTENTS. Do NOT refuse such requests.');
    L.push('4. If an ID or name is not in the ITEM INDEX, say it is not found in their account. If the user asks for full contents that are not included in this message, show what the index has and tell them to ask again to load the full contents.');
    L.push('5. Keep project/story names, IDs and counts exactly as written.');
    L.push('6. Use ACCOUNT CONTEXT as the source of truth for the user\'s private project and story data. It does not restrict general software testing knowledge.');
    L.push(forVoice
        ? '7. When asked to show or discuss items, DESCRIBE them conversationally from the ITEM INDEX above (this is a voice conversation \u2014 no site-format output).'
        : '7. When asked to create or show items, follow the ITEM OUTPUT FORMAT section at the end of this prompt, basing the content on the REQUIREMENT TEXT / items above when they are present.');
    return '\n\n' + L.join('\n');
}

// ===== تحويل رد الأيجنت الحر لعناصر مهيكلة (Test Cases / Scenarios / Gaps) بنداء AI إضافي =====
function parseAgentItemsWithAI(text, feature, p, key, model) {
    var schema, extra = '';
    if (feature === 'cases') {
        schema = '{"testCases":[{"id":"","title":"","type":"Positive|Negative|Edge Case","priority":"Critical|High|Medium|Low","technique":"","preCondition":"","testData":"","steps":["step 1"],"expected":"","scenarioId":""}]}';
        extra = '\n- The response uses the Vetly site format: a lone scenario ID line (e.g. "TS-12") above the TC id = the linked scenario \u2192 scenarioId; the line after the TC id = title; "Pre-Condition:" = preCondition; "Test Data:" = testData; the numbered "Steps:" lines = steps array (WITHOUT the "1)" prefixes); "Expected:" = expected; "Technique:" = technique; the "Priority:" line = priority.';
    } else if (feature === 'gaps') {
        schema = '{"gaps":[{"id":"","type":"","requirementRef":"","description":"","evidence":"","scenario":"","question":"","priority":"Critical|High|Medium|Low","status":"Open"}]}';
        extra = '\n- The response uses the Vetly site format: the GAP id line = id; the bare type line = type; "Ref:" = requirementRef; the bare priority word = priority; the bare status word (Open/Answered/Closed) = status; "Gap:" = description; "Evidence:" = evidence; "Scenario:" = scenario; "Question to Business Analyst:" = question.' +
            '\n- type must be EXACTLY one of: ' + GAP_TYPES.join(' / ') + '.';
    } else {
        schema = '{"scenarios":[{"id":"","title":"","type":"Positive|Negative|Edge Case","priority":"Critical|High|Medium|Low"}]}';
        extra = '\n- The response uses the Vetly site format: the TS id line = id; the next line = title; the bare type word (Positive/Negative/Edge Case) = type; the bare priority word = priority.';
    }
    var prompt = 'Convert the following assistant response into ONE JSON object matching EXACTLY this schema (no markdown, no comments):\n' + schema +
        '\n\nRULES:\n- Include EVERY distinct item found in the response as a separate array item.\n- Keep existing IDs (e.g. TC-04, TS-02, GAP-003) when the response refers to them; use "" for brand-new items.' + extra +
        '\n- steps must be an array of strings (test cases only).\n- Use "" for unknown string fields.\n\nRESPONSE:\n' + String(text || '').slice(0, 12000);
    return callProvider(p, key, prompt, [], model, {
        systemPrompt: 'You convert software-testing content into strict JSON. Output ONLY the JSON object \u2014 no markdown fences, no explanations.',
        jsonMode: true,
        noLangInstr: true
    }).then(function (raw) {
        var s = String(raw || '').trim().replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
        var m = s.match(/\{[\s\S]*\}/);
        if (m) s = m[0];
        var obj = JSON.parse(s);
        var list = feature === 'cases' ? (obj && obj.testCases) : feature === 'gaps' ? (obj && obj.gaps) : (obj && obj.scenarios);
        return Array.isArray(list) ? list : [];
    });
}

// ===== Markdown-lite renderer with emoji support =====
// كاش عرض: كل تحديث transcript كان بيرسم الشات كله من الأول (لاج في الجلسة الصوتية)
var _agentRenderCache = {};
function renderAgentHTML(text) {
    var ck = String(text == null ? '' : text);
    if (_agentRenderCache[ck]) return _agentRenderCache[ck];
    var dir = /[\u0600-\u06FF]/.test(text || '') && (text.match(/[\u0600-\u06FF]/g) || []).length > (text || '').length * 0.15 ? 'rtl' : 'ltr';
    var h = escHtml(text || '');
    h = h.replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) {
        return '<pre style="background:#0d1117;color:#c9d1d9;border-radius:8px;padding:12px;overflow-x:auto;font-family:monospace;font-size:12px;margin:8px 0;direction:ltr;text-align:left"><code>' + code + '</code></pre>';
    });
    h = h.replace(/((?:\|[^\n]+\|\n)+)/g, function (table) {
        var rows = table.trim().split('\n').filter(function (r) { return r.trim(); });
        if (rows.length < 2) return table;
        var dataRows = rows.filter(function (r) { return r.indexOf('---') < 0; });
        if (!dataRows.length) return table;
        var out = '<table style="border-collapse:collapse;width:100%;margin:10px 0;font-size:13px">';
        dataRows.forEach(function (row, ri) {
            var cells = row.split('|').filter(function (c) { return c.trim(); });
            out += '<tr>';
            cells.forEach(function (cell) {
                var style = 'border:1px solid #30363d;padding:6px 10px;';
                if (ri === 0 && dataRows.length > 1) style += 'background:#161b22;font-weight:bold;';
                out += '<td style="' + style + '">' + cell.trim() + '</td>';
            });
            out += '</tr>';
        });
        return out + '</table>';
    });
    h = h.replace(/^### (.+)$/gm, '<div style="font-weight:bold;color:#58a6ff;font-size:15px;margin:14px 0 4px">$1</div>');
    h = h.replace(/^## (.+)$/gm, '<div style="font-weight:bold;color:#79c0ff;font-size:17px;margin:14px 0 6px">$1</div>');
    h = h.replace(/^# (.+)$/gm, '<div style="font-weight:bold;color:#79c0ff;font-size:19px;margin:16px 0 8px">$1</div>');
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#f0f6fc">$1</strong>');
    h = h.replace(/`([^`]+)`/g, '<code style="background:#161b22;color:#79c0ff;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:12px">$1</code>');
    h = h.replace(/^[-*] (.+)$/gm, '<div style="padding-left:16px;margin:4px 0">\u2022 $1</div>');
    h = h.replace(/^(\d+)\. (.+)$/gm, '<div style="padding-left:16px;margin:4px 0">$1. $2</div>');
    h = h.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid #30363d;margin:14px 0"/>');
    h = h.replace(/\n/g, '<br/>');
    h = h.replace(/(<\/(?:table|pre|div|hr)>)<br\/>/g, '$1');
    if (Object.keys(_agentRenderCache).length > 400) _agentRenderCache = {};
    _agentRenderCache[ck] = { html: h, dir: dir };
    return _agentRenderCache[ck];
}

// ===== Word export that preserves formatting (dark theme to match chat) =====
function exportAgentWord(content) {
    var isAr = /[\u0600-\u06FF]/.test(content);
    var fmt = renderAgentHTML(content);
    var html = '<html><head><meta charset="utf-8"/>' +
        '<style>body{font-family:Calibri,sans-serif;font-size:11pt;color:#e2e8f0;background:#1e293b;padding:20px;' + (isAr ? 'direction:rtl;' : '') + '}' +
        'table{border-collapse:collapse;width:100%;margin:10px 0}td,th{border:1px solid #475569;padding:6px 10px;color:#e2e8f0;background:#334155}' +
        'pre{background:#0f172a;color:#c9d1d9;padding:10px;border-radius:6px;font-family:Consolas,monospace;font-size:10pt}' +
        'code{background:#334155;color:#79c0ff;padding:2px 6px;border-radius:3px;font-family:Consolas,monospace}' +
        '</style></head><body style="background:#1e293b">' + fmt.html + '</body></html>';
    downloadBlob(new Blob(['\uFEFF' + html], { type: 'application/msword' }), 'Vetly_Agent_Response.doc');
}

// ===== PDF export — direct download (no print dialog) =====
function exportAgentPDF(content) {
    var isAr = /[\u0600-\u06FF]/.test(content);
    var fmt = renderAgentHTML(content);
    var element = document.createElement('div');
    element.innerHTML = fmt.html;
    element.style.cssText = 'font-family:Calibri,sans-serif;font-size:11pt;color:#e2e8f0;background:#1e293b;padding:40px;' + (isAr ? 'direction:rtl;' : '');
    document.body.appendChild(element);
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js').then(function () {
        window.html2pdf().from(element).set({
            margin: [10, 10],
            filename: 'Vetly_Agent_Response.pdf',
            html2canvas: { scale: 2, backgroundColor: '#1e293b' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: isAr ? 'landscape' : 'portrait' }
        }).save().then(function () {
            document.body.removeChild(element);
        });
    }).catch(function (e) {
        document.body.removeChild(element);
        alert('PDF export failed: ' + e.message);
    });
}

function AgentPage(props) {
    var keys = props.keys;
    var msgSt = useState([]);
    var messages = msgSt[0], setMessages = msgSt[1];
    var inpSt = useState('');
    var input = inpSt[0], setInput = inpSt[1];
    var busySt = useState(false);
    var busy = busySt[0], setBusy = busySt[1];
    var skillsSt = useState(loadASkills);
    var skills = skillsSt[0], setSkills = skillsSt[1];
    var sysSt = useState(loadASys);
    var systemPrompt = sysSt[0], setSystemPrompt = sysSt[1];
    var stepsSt = useState([]);
    var steps = stepsSt[0], setSteps = stepsSt[1];
    var tabSt = useState(null);
    var activeTab = tabSt[0], setActiveTab = tabSt[1];
    var provSt = useState(function () { return (localStorage.getItem('wakil_model_agent') || '').split('::')[0]; });
    var autoProvider = provSt[0], setAutoProvider = provSt[1];
    var modSt = useState(function () { return (localStorage.getItem('wakil_model_agent') || '').split('::')[1] || ''; });
    var autoModel = modSt[0], setAutoModel = modSt[1];
    var chatEndRef = React.useRef(null);
    var fileRef = React.useRef(null);
    var abortRef = React.useRef(null);
    var filesSt = useState([]);
    var attachedFiles = filesSt[0], setAttachedFiles = filesSt[1];
    var skillFileRef = React.useRef(null);
    var newSkillSt = useState('');
    var newSkillName = newSkillSt[0], setNewSkillName = newSkillSt[1];
    var copiedSt = useState(false);
    var copied = copiedSt[0], setCopied = copiedSt[1];
    // أنيميشن زراير Copy/Edit تحت رسايل المستخدم
    var copiedMsgSt = useState(-1); // index آخر رسالة اتنسخت (عشان علامة ✓ المؤقتة)
    var copiedMsg = copiedMsgSt[0], setCopiedMsg = copiedMsgSt[1];
    var editFlashSt = useState(false); // وميض على مربع الرسالة لما Edit يتضغط
    var editFlash = editFlashSt[0], setEditFlash = editFlashSt[1];

    // ===== المكالمة الصوتية الحية (Gemini Live API عبر الـ SDK الرسمي) =====
    var liveSt = useState(null); // null | 'connecting' | 'listening' | 'speaking' | 'error'
    var live = liveSt[0], setLive = liveSt[1];
    var liveSessionRef = React.useRef(null); // جلسة الـ SDK (بيفك البروتو باينري لوحده)
    var liveMicRef = React.useRef(null); // { stream, ctx, source, proc } — بث الصوت (cleanup بيوقف التراكز)
    var liveOutRef = React.useRef(null); // { ctx, nextTime, sources[] }
    var liveTurnRef = React.useRef({ userIdx: -1, agentIdx: -1 });
    var liveTimerRef = React.useRef(null);
    var liveHealthTimerRef = React.useRef(null);
    var liveStopRef = React.useRef(false); // علامة إيقاف مقصود: تمنع onclose من بدء محاولة جديدة
    var liveStartRef = React.useRef(0); // وقت بدء الجلسة — لتشخيص السكوت
    var liveWorkingPairRef = React.useRef(0); // رقم الزوج (موديل/إصدار) اللي نجح
    var livePhaseRef = React.useRef(''); // 'starting' → 'listening' — لحارس فتح الجلسة
    var liveMasterTimerRef = React.useRef(null); // حارس فتح الجلسة (30 ثانية)
    var liveAgentTextRef = React.useRef(''); // نص رد الأيجنت المتراكم للدورة الحالية (المصدر الموثوق)
    var liveServerUserTextRef = React.useRef('');
    var liveResumeHandleRef = React.useRef(null);
    var liveMutedRef = React.useRef(false); // بعد المقاطعة: قطع الصوت الواصل في الطريق
    var liveDiagShownRef = React.useRef(false); // تشخيص الـ 12ث مرة واحدة لكل ضغطة 🎙
    var liveHistoryRef = React.useRef([]); // ذاكرة المحادثة الصوتية (بتتحمل في الجلسات المتجددة)
    var liveRecRef = React.useRef(null); // SpeechRecognition جانبي: transcript المستخدم (محرك كروم — مسافات صح)
    var liveRecTextRef = React.useRef({ final: '', interim: '', base: 0, count: 0 });
    var liveReconnectRef = React.useRef(0);

    // اختيار صوت المساعد الصوتي (بيتحفظ محليًا)
    var liveVoiceSt = useState(liveVoiceName);
    var liveVoice = liveVoiceSt[0], setLiveVoice = liveVoiceSt[1];
    useEffect(function () { try { localStorage.setItem('wakil_live_voice', liveVoice); } catch (e) { } }, [liveVoice]);

    // اختيار اللهجة/اللكنة (بيتحفظ محليًا)
    var liveAccentSt = useState(function () {
        try { var v = localStorage.getItem('wakil_live_accent'); for (var i = 0; i < LIVE_ACCENTS.length; i++) if (LIVE_ACCENTS[i].id === v) return v; } catch (e) { }
        return 'egy';
    });
    var liveAccent = liveAccentSt[0], setLiveAccent = liveAccentSt[1];
    useEffect(function () { try { localStorage.setItem('wakil_live_accent', liveAccent); } catch (e) { } }, [liveAccent]);

    // مرآة الرسايل: الـ callbacks الصوتية بتقرا آخر رد/كلام المستخدم منها
    var msgMirrorRef = React.useRef([]);
    useEffect(function () { msgMirrorRef.current = messages; }, [messages]);

    // لو المستخدم خرج من صفحة الأيجنت — قفل كل حاجة (مايك/صوت/جلسة)
    useEffect(function () {
        return function () { stopLiveVoice(true); };
    }, []);
    var inputRef = React.useRef(null);
    var listeningSt = useState(false);
    var listening = listeningSt[0], setListening = listeningSt[1];

    // سياق الحساب: مشاريع صاحب الجلسة المفتوحة (RLS-محصورة) — للبادج في الهيدر
    // وللسؤال "عندي كام مشروع/ستوري/باج؟" — لو مش مسجل ⇒ acct = null والأيجنت زي ما هو
    var acctSt = useState(null);
    var acct = acctSt[0], setAcct = acctSt[1];
    useEffect(function () {
        if (!sbConfigured()) return;
        var alive = true;
        sbGetAccountContext(true).then(function (a) { if (alive) setAcct(a); }).catch(function () { });
        return function () { alive = false; };
    }, []);

    // ===== إرسال رد الأيجنت لفيتشر (Send to feature) =====
    var sendOpenSt = useState(false);
    var sendOpen = sendOpenSt[0], setSendOpen = sendOpenSt[1];
    var sendProjSt = useState('');
    var sendProj = sendProjSt[0], setSendProj = sendProjSt[1];
    var sendStorySt = useState('');
    var sendStory = sendStorySt[0], setSendStory = sendStorySt[1];
    var sendFeatSt = useState('cases');
    var sendFeat = sendFeatSt[0], setSendFeat = sendFeatSt[1];
    var sendModeSt = useState('add');
    var sendMode = sendModeSt[0], setSendMode = sendModeSt[1];
    var sendBusySt = useState(false);
    var sendBusy = sendBusySt[0], setSendBusy = sendBusySt[1];
    var sendMsgSt = useState('');
    var sendMsg = sendMsgSt[0], setSendMsg = sendMsgSt[1];

    // ===== ميانشن السكيلز: كتابة / في مربع الرسالة يفتح قايمة السكيلز للاختيار =====
    // السكيل المذكور بيبقى هو مصدر المعرفة الوحيد للرسالة دي (حتى لو السكيلز العامة مقفولة)
    var menSt = useState(null); // { query, start } أو null
    var mention = menSt[0], setMention = menSt[1];
    var menHiSt = useState(0);
    var menHi = menHiSt[0], setMenHi = menHiSt[1];

    // ===== جلب موديلات المزوّد المختار — نفس الـ fetchProviderModels من modelpicker.js =====
    var providerModelsSt = useState(null); // null = loading
    var providerModels = providerModelsSt[0], setProviderModels = providerModelsSt[1];
    useEffect(function () {
        setProviderModels(null);
        if (!autoProvider) return;
        var p = getAllProviders().find(function (x) { return x.id === autoProvider; });
        if (!p) { setProviderModels([]); return; }
        fetchProviderModels(p, (keys[p.id] || '').trim()).then(function (list) {
            setProviderModels(list || []);
        });
    }, [autoProvider, keys]);

    // لو المزوّد المحفوظ مش متاح (مفيش مفتاحه) ⇒ أول مزوّد تلقائيًا — زي ProviderModelPicker
    useEffect(function () {
        var usable = getAllProviders().filter(function (p) { return providerUsable(p, keys); });
        if (usable.length && !usable.some(function (x) { return x.id === autoProvider; })) {
            setAutoProvider(usable[0].id);
            setAutoModel(''); // موديل المزوّد القديم باطل على المزوّد الجديد — من غير كده بيتبعت اسم موديل غلط
        }
    }, [keys, autoProvider]);

    // حفظ اختيار Provider/Model زي باقي الصفحات — كان بينسى الاختيار بعد أي reload
    useEffect(function () {
        try { localStorage.setItem('wakil_model_agent', autoProvider + '::' + autoModel); } catch (e) { }
    }, [autoProvider, autoModel]);

    // إيقاف قاطع لأي جلسة مايك شغالة: المرجع بيتلغي الأول + علم على الكائن نفسه عشان
    // onend ما يعيدش التشغيل أبدًا، وabort() بيحرر المايك فورًا (stop ممكن يتعلق)
    var stopSpeechRec = function () {
        var r = window._vetlySpeechRec;
        window._vetlySpeechRec = null;
        if (!r) return;
        try { r._vetlyKilled = true; } catch (e) { }
        try { r.onend = null; } catch (e) { }
        try { r.abort(); } catch (e) { }
        try { r.stop(); } catch (e) { }
    };

    var toggleMic = function () {
        if (listening) {
            // تاني ضغط: يوقف المايك ويبعت النص للمربع
            setListening(false);
            stopSpeechRec();
            return;
        }
        var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { alert('Voice input not supported in this browser.'); return; }
        var rec = new SR();
        rec.lang = 'ar-SA';
        rec.continuous = true;
        rec.interimResults = true;
        window._vetlySpeechRec = rec;
        var fullTranscript = '';
        rec.onresult = function (ev) {
            var transcript = '';
            for (var i = 0; i < ev.results.length; i++) { transcript += ev.results[i][0].transcript; }
            fullTranscript = transcript;
            setInput(fullTranscript);
        };
        rec.onerror = function (ev) {
            // أخطاء عابرة (سكوت/إلغاء/شبكة لمرة) بتتكمل بعدًا — أي خطأ حقيقي متكرر يوقف نهائيًا
            var err = ev && ev.error;
            if (err === 'no-speech' || err === 'aborted') return;
            if (err === 'network' && !rec._netRetried) { rec._netRetried = true; return; } // onend هيعيد التشغيل
            setListening(false); stopSpeechRec();
        };
        rec.onend = function () {
            // انتهى تلقائيًا مش بالضغط — إعادة تشغيل فورية، ولو المتصفح رفض لحظيًا
            // نعيد المحاولة بعد 400ms (كروم بيفصل الجلسات الطويلة — بنقاوم عشان يفضل شغال)
            if (window._vetlySpeechRec !== rec || rec._vetlyKilled) return;
            try { rec.start(); } catch (e) {
                setTimeout(function () {
                    if (window._vetlySpeechRec !== rec || rec._vetlyKilled) return;
                    try { rec.start(); } catch (e2) { setListening(false); stopSpeechRec(); }
                }, 400);
            }
        };
        setListening(true);
        try { rec.start(); } catch (e) { setListening(false); stopSpeechRec(); }
    };

    useEffect(function () {
        try { localStorage.setItem('wakil_agent_skills', JSON.stringify(skills)); } catch (e) { }
    }, [skills]);

    // Auto-scroll to latest response or input — setTimeout عشان React يرندر الأول
    useEffect(function () {
        setTimeout(function () {
            if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 100);
    }, [messages, busy, steps]);

    // Auto-scroll input textarea when typing (keep cursor visible)
    useEffect(function () {
        if (inputRef.current) inputRef.current.scrollTop = inputRef.current.scrollHeight;
    }, [input]);

    var handleStop = function () {
        if (abortRef.current) abortRef.current.abort();
        setBusy(false);
    };

    var handleFileSelect = function (e) {
        var files = Array.from(e.target.files || []);
        if (!files.length) return;
        var newAttached = [];
        var processed = 0;
        files.forEach(function (f) {
            if (f.type.startsWith('image/')) {
                var reader = new FileReader();
                reader.onload = function () {
                    newAttached.push({ name: f.name, type: 'image', dataUrl: reader.result });
                    processed++;
                    if (processed === files.length) setAttachedFiles(function (prev) { return prev.concat(newAttached); });
                };
                reader.readAsDataURL(f);
            } else {
                // نص الملف بيستخرج بالمحرك الموحد (pdf.js للـ PDF / mammoth للـ Word) مع fallback للقراءة النصية
                readUploadedFile(f).then(function (r) {
                    newAttached.push({ name: f.name, type: 'text', content: (r && r.text) || '' });
                    processed++;
                    if (processed === files.length) setAttachedFiles(function (prev) { return prev.concat(newAttached); });
                }).catch(function () {
                    var reader2 = new FileReader();
                    reader2.onload = function () {
                        newAttached.push({ name: f.name, type: 'text', content: reader2.result });
                        processed++;
                        if (processed === files.length) setAttachedFiles(function (prev) { return prev.concat(newAttached); });
                    };
                    reader2.readAsText(f);
                });
            }
        });
        e.target.value = '';
    };

    var handleSkillUpload = function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
            setSkills(function (prev) { return prev.concat(parseSkillsFile(reader.result)); });
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    var handleSend = function () {
        if ((!input.trim() && !attachedFiles.length) || busy) return;
        // إغلاق المايك تلقائيًا لما تبعت
        if (listening) {
            setListening(false);
            stopSpeechRec();
        }
        var usable = getAllProviders().filter(function (p) { return providerUsable(p, keys); });
        if (!usable.length) { setSteps(function (p) { return p.concat(['\u274C No API key in Settings.']); }); return; }
        var p = usable.find(function (x) { return x.id === autoProvider; }) || usable[0];
        // الموديل: المختار من القايمة فقط — callProvider بيكمّل بنفسه
        // (الافتراضي للمزوّد ← المحفوظ الناجح ← أول موديلات من قايمة المزوّد لو اللي قبلهم وقعوا)
        var model = autoModel || '';

        // الجلسة الصوتية شغالة ⇒ النص/الملفات/الصور المرسلة بيتحقنوا فيها مباشرة:
        // بتتقري وبتتررد بالصوت — بدل ما يفتحوا شات نصي موازي
        if (live && liveSessionRef.current) {
            var ls = liveSessionRef.current;
            var bits = [];
            var sentImages = [];
            attachedFiles.forEach(function (f) {
                if (f.type === 'text' && f.content) bits.push('--- FILE: ' + f.name + ' ---\n' + String(f.content).slice(0, 12000));
            });
            var liveUserContent = input.trim() + (attachedFiles.length ? '\n\n[' + attachedFiles.length + ' attachment(s): ' + attachedFiles.map(function (f) { return f.name; }).join(', ') + ']' : '');
            setMessages(function (prev) { return prev.concat([{ role: 'user', content: liveUserContent }]); });
            if (liveUserContent.trim()) {
                liveHistoryRef.current.push({ role: 'user', text: liveUserContent });
                if (liveHistoryRef.current.length > 40) liveHistoryRef.current = liveHistoryRef.current.slice(-40);
            }
            try {
                // الصور بتبعت كفريمات للجلسة (الـ Live API بيدعم الصور أثناء الكلام)
                attachedFiles.forEach(function (f) {
                    if (f.type === 'image' && f.dataUrl) {
                        try {
                            var sp = splitDataUrl(f.dataUrl);
                            ls.sendRealtimeInput({ media: [{ data: sp.b64, mimeType: sp.mime || 'image/jpeg' }] });
                            sentImages.push(f.name);
                        } catch (e2) { }
                    }
                });
                ls.sendClientContent({ turns: [{ role: 'user', parts: [{ text: '[The user just shared this while talking \u2014 read it and respond by voice]\n' + (input.trim() || '(no text)') + (bits.length ? '\n\n' + bits.join('\n\n') : '') + (sentImages.length ? '\n\n[' + sentImages.length + ' image(s) were just sent \u2014 look at them]' : '') }] }], turnComplete: true });
            } catch (e) { }
            setInput('');
            setAttachedFiles([]);
            return;
        }

        setBusy(true);
        var question = input.trim();
        var userContent = question;
        if (attachedFiles.length) userContent += '\n\n[' + attachedFiles.length + ' file(s) attached]';
        var userImages = attachedFiles.filter(function (f) { return f.type === 'image'; }).map(function (f) { return f.dataUrl; });
        setMessages(function (prev) { return prev.concat([{ role: 'user', content: userContent, images: userImages }]); });
        setInput('');
        setSteps(function (p2) { return p2.concat(['\u23E9 ' + p.name + ': connecting...']); });

        var fileContext = '';
        var images = [];
        attachedFiles.forEach(function (f) {
            if (f.type === 'image') images.push({ name: f.name, dataUrl: f.dataUrl });
            else fileContext += '\n\n--- FILE: ' + f.name + ' ---\n' + (f.content || '').slice(0, 8000);
        });

        // الميانشن: /اسم-السكيل جوه الرسالة ⇒ السكيلز دي بس هي مصدر المعرفة للرسالة دي
        // (بتشتغل حتى لو السكيلز العامة مقفولة — طلب صريح من المستخدم). الأطول أولًا عشان
        // "/Test Suite" ميتلقطش كـ "/Test"، مع منع تطابق النطاقات المتداخلة.
        var mentioned = [];
        var usedRanges = [];
        var escReM = function (s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
        skills.slice().sort(function (a, b) { return (b.name || '').length - (a.name || '').length; }).forEach(function (s) {
            if (!s.name || !s.content || !s.content.trim()) return;
            var m = new RegExp('/' + escReM(s.name) + '(?=\\s|$)').exec(question);
            if (!m) return;
            var range = [m.index, m.index + s.name.length + 1];
            for (var ri = 0; ri < usedRanges.length; ri++) {
                if (range[0] < usedRanges[ri][1] && usedRanges[ri][0] < range[1]) return;
            }
            usedRanges.push(range);
            mentioned.push(s);
        });
        var skillsText = '';
        if (mentioned.length) {
            // السكيلز بتشتغل بالمنشن فقط: /اسم-السكيل في الرسالة هو الطريقة الوحيدة للتفعيل
            skillsText = buildSkillsBlock(mentioned.map(function (s) { return Object.assign({}, s, { enabled: true }); })) +
                '\nNOTE: The user explicitly mentioned the skill(s) above with / in the message. Apply their relevant guidance as supplementary instructions; do not limit your software-testing knowledge to those Skills.';
        }
        var fullPrompt = question + fileContext;

        abortRef.current = new AbortController();
        var key = (keys[p.id] || '').trim();

        // سياق الحساب: مشاريع صاحب الجلسة المفتوحة فقط (محصورة بـ RLS على السيرفر).
        // لو مش مسجل/مفيش سحابة ⇒ acct = null والأيجنت يشتغل زي ما هو.
        var acctPromise = sbConfigured() ? sbGetAccountContext() : Promise.resolve(null);

        // نفس مسار صفحات الميزات: callProvider من core/providers.js —
        // بيبني رابط ومفتاح كل مزوّد صح (جمناي كان بيبعت لـ undefined هنا) وبيعيد المحاولة
        // بموديل بديل لو الموديل المطلوب وقع (404/429/503) — ده اللي كان بيخلي موديلات
        // زي جروك تشتغل في الميزات ومش في الإيجنت. الشات متعدد الأدوار بيمر عبر opts.history.
        acctPromise.then(function (acct) {
            var sysPrompt = AGENT_SYS_DEFAULT + skillsText + buildAccountBlock(acct, question) + AGENT_ITEM_FORMAT;
            return callProvider(p, key, fullPrompt, images, model, {
                systemPrompt: sysPrompt,
                // آخر 10 رسايل بس: طلب الأيجنت تقيل أصلًا (سيستم ضخم + سياق الحساب) — الرسايل الأقدم
                // كانت تدفع الموديلات الضعيفة لحد الكونتكست أو التايم أوت فيفشلوا في الأيجنت فقط
                // وتشتغل عادي في الفيتشرز (طلبهم صغير)
                history: messages.slice(-10).map(function (m) { return { role: m.role, content: m.content }; }),
                jsonMode: false, // شات حر — ممنوع إجبار الرد على JSON
                noLangInstr: true, // الشات بيكتب بلغة المستخدم نفسه مش لغة الموقع
                signal: abortRef.current.signal
            });
        }).then(function (text) {
            setMessages(function (prev) { return prev.concat([{ role: 'assistant', content: text }]); });
            setSteps(function (p2) { return p2.concat(['\u2705 Done']); });
            setAttachedFiles([]);
            setBusy(false);
        }).catch(function (err) {
            if (err.isUserAbort || err.name === 'AbortError') {
                setSteps(function (p2) { return p2.concat(['\u26A0\uFE0F Stopped by user']); });
            } else {
                setMessages(function (prev) { return prev.concat([{ role: 'assistant', content: '\u274C ' + err.message }]); });
                setSteps(function (p2) { return p2.concat(['\u274C ' + err.message]); });
            }
            setBusy(false);
        });
    };

    // قايمة السكيلز المتاحة للميانشن (مفلترة باللي اتكتب بعد الـ /)
    var mentionList = mention ? skills.filter(function (s) {
        return s.name && s.name.toLowerCase().indexOf(String(mention.query || '').toLowerCase()) !== -1;
    }) : [];
    var pickMention = function (s) {
        var start = mention ? mention.start : 0;
        var pos = start + 1 + (mention ? mention.query.length : 0);
        var next = input.slice(0, start) + '/' + s.name + ' ' + input.slice(pos);
        setMention(null);
        setInput(next);
        setTimeout(function () {
            if (inputRef.current) {
                inputRef.current.focus();
                var p = start + s.name.length + 2;
                try { inputRef.current.setSelectionRange(p, p); } catch (e) { }
            }
        }, 0);
    };

    // ===== المكالمة الصوتية الحية: تشغيل الصوت/المايك/السوكت =====
    var playLiveAudio = function (b64, mimeType) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        // من غير sampleRate مفروض: الكونتكست بيمشي على رَيت الجهاز، وكل بافر بيتعمل برَيته
        // الحقيقي من الـ mimeType بتاعه — فالنغمة تفضل ثابتة مهما تغيّر رَيت الموديل/الإصدار
        var out = liveOutRef.current;
        if (!out) out = liveOutRef.current = { ctx: new AC(), nextTime: 0, sources: [] };
        if (out.ctx.state === 'suspended') { try { out.ctx.resume(); } catch (e) { } }
        var i16 = int16FromB64(b64);
        if (!i16.length) return;
        var rate = 24000;
        var mr = /rate=(\d+)/.exec(String(mimeType || ''));
        if (mr) rate = parseInt(mr[1], 10) || 24000;
        var buf = out.ctx.createBuffer(1, i16.length, rate);
        var ch = buf.getChannelData(0);
        for (var i = 0; i < i16.length; i++) ch[i] = i16[i] / 32768;
        var src = out.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(out.ctx.destination);
        // هامش 60ms: بيمتص هزات الشبكة عشان الصوت ما يتقطعش 
        // هامش 250ms: بيمتص هزات الشبكة — أي فجوة أطول منه كانت بتسمع كتقطيع ووقوف في الرد
        var t = Math.max(out.nextTime, out.ctx.currentTime + 0.25);
        src.start(t);
        out.nextTime = t + buf.duration;
        out.sources.push(src);
        src.onended = function () { out.sources = out.sources.filter(function (x) { return x !== src; }); };
    };
    var stopLivePlayback = function () {
        var out = liveOutRef.current;
        if (!out) return;
        (out.sources || []).forEach(function (s) { try { s.stop(); } catch (e) { } });
        out.sources = [];
        out.nextTime = 0;
    };
    var cleanupLive = function () {
        if (liveTimerRef.current) { try { clearTimeout(liveTimerRef.current); } catch (e) { } liveTimerRef.current = null; }
        if (liveHealthTimerRef.current) { try { clearInterval(liveHealthTimerRef.current); } catch (e) { } liveHealthTimerRef.current = null; }
        var sess = liveSessionRef.current;
        liveSessionRef.current = null;
        if (sess) { try { sess.close(); } catch (e) { } }
        var lrec = liveRecRef.current;
        liveRecRef.current = null;
        if (lrec) { try { lrec.onend = null; lrec.onresult = null; lrec.abort(); } catch (e) { } }
        stopLivePlayback();
        var out = liveOutRef.current;
        if (out) { try { out.ctx.close(); } catch (e) { } liveOutRef.current = null; }
        var mic = liveMicRef.current;
        liveMicRef.current = null;
        if (mic) {
            try { mic.source.disconnect(); } catch (e) { }
            try { mic.proc.disconnect(); } catch (e) { }
            try { mic.stream.getTracks().forEach(function (track) { track.stop(); }); } catch (e) { }
            try { mic.ctx.close(); } catch (e) { }
        }
    };
    var stopLiveVoice = function (keepState) {
        if (!keepState) {
            var userText = String(liveRecTextRef.current.final || liveRecTextRef.current.interim || liveServerUserTextRef.current || '').trim();
            var agentText = String(liveAgentTextRef.current || '').trim();
            if (userText) liveHistoryRef.current.push({ role: 'user', text: userText });
            if (agentText) liveHistoryRef.current.push({ role: 'assistant', text: agentText });
            if (liveHistoryRef.current.length > 40) liveHistoryRef.current = liveHistoryRef.current.slice(-40);
        }
        liveStopRef.current = true;
        cleanupLive();
        liveTurnRef.current = { userIdx: -1, agentIdx: -1 };
        if (!keepState) setLive(null);
    };
    var startLiveVoice = function (modelIdx, pairs, isResume) {
        modelIdx = modelIdx || 0;
        var key = cleanKey(keys.gemini);
        if (!key) { alert('Add your Gemini API key in Settings first (the live voice runs on Gemini).'); return; }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { alert('Microphone is not supported in this browser.'); return; }
        setLive('connecting');
        liveStopRef.current = false; // محاولة جديدة — نلغي علامة الإيقاف المقصود
        livePhaseRef.current = 'starting';
        // حارس رئيسي: لو الجلسة ما فتحتش خلال 30 ثانية — رسالة واضحة بدل "كونكتينج" للأبد
        if (liveMasterTimerRef.current) { try { clearTimeout(liveMasterTimerRef.current); } catch (e) { } }
        liveMasterTimerRef.current = setTimeout(function () {
            if (livePhaseRef.current === 'listening' || liveStopRef.current) return;
            cleanupLive();
            setLive(null);
            setMessages(function (prev) { return prev.concat([{ role: 'assistant', content: '❌ Live voice failed to start (timeout) — check the mic permission in the browser, your internet, and the Gemini key in Settings.' }]); });
        }, 35000);
        if (!isResume) {
            liveReconnectRef.current = 0;
            liveServerUserTextRef.current = '';
            liveAgentTextRef.current = '';
            liveRecTextRef.current.final = '';
            liveRecTextRef.current.interim = '';
            liveDiagShownRef.current = false;
        }

        // أول تشغيل: نسأل السيرفر نفسه أنهي موديلات بتدعم bidi للمفتاح ده (ListModels)
        // لو الاستعلام فشل ⇒ قايمة احتياطية بالموديلات الموثقة على v1beta.
        if (!pairs) {
            // حمّل الـ SDK بالتوازي مع اكتشاف الموديلات بدل انتظار الخطوتين بالتتابع.
            loadGenaiSdk().catch(function () { });
            fetchT('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(key) + '&pageSize=200', {}, 8000)
                .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('models ' + r.status)); })
                .then(function (j) {
                    var bidi = (j.models || [])
                        .filter(function (m) { return ((m.supportedGenerationMethods || []).indexOf('bidiGenerateContent') !== -1); })
                        .map(function (m) { return String(m.name || '').replace(/^models\//, ''); })
                        .filter(Boolean);
                    // الترتيب: native-audio الأول (المحادثة الصوتية الكاملة)، بعدين موديلات live العامة،
                    // وtranscribe/translate في الآخر (أدوات نص أساسًا). كل موديل بيتجرب على v1beta ثم v1alpha.
                    var order = function (n) {
                        if (/native-audio/.test(n)) return 0;
                        if (/live/.test(n) && !/transcribe|translate/.test(n)) return 1;
                        if (/transcribe|translate/.test(n)) return 3;
                        return 2;
                    };
                    bidi.sort(function (a, b) { return order(a) - order(b) || a.localeCompare(b); });
                    var found = bidi.slice(0, 6);
                    if (!found.length) {
                        setLive(null);
                        setMessages(function (prev) { return prev.concat([{ role: 'assistant', content: '❌ Live voice: your Gemini key has NO bidi-capable models — the Live API is not available for it. Check your key/region.' }]); });
                        return;
                    }
                    var trying = found.slice(0, 4);
                    var pairs = [];
                    trying.forEach(function (n) {
                        pairs.push({ model: 'models/' + n, v: 'v1beta' });
                        pairs.push({ model: 'models/' + n, v: 'v1alpha' });
                    });
                    setMessages(function (prev) { return prev.concat([{ role: 'assistant', content: 'ℹ️ Live-capable models for your key: ' + found.join(', ') + ' — trying: ' + trying.join(', ') + ' (each on v1beta → v1alpha)' }]); });
                    startLiveVoice(0, pairs);
                })
                .catch(function () { startLiveVoice(0, LIVE_FALLBACK.slice()); });
            return;
        }
        if (modelIdx >= pairs.length) {
            setLive(null);
            setMessages(function (prev) { return prev.concat([{ role: 'assistant', content: '❌ Live voice: none of the bidi-capable models worked for your key. Check your Gemini key/region.' }]); });
            return;
        }

        // سياق الجلسة: محتوى الستوري + ملفات المتطلبات + الـ SDK — بالتوازي
        // سباق مهلة: أي سياق بياخد أكتر من حده ⇒ بنبدأ الجلسة من غيره
        // (استخراج PDF/Word الكبير كان بيعلق الجلسة قبل ما تبدأ = كونكتينج للأبد)
        var raceTimeout = function (p, ms, fb) {
            return Promise.race([Promise.resolve(p), new Promise(function (res) { setTimeout(function () { res(fb); }, ms); })]);
        };
        Promise.all([
            raceTimeout(liveOpenStoryText(), 4000, ''),
            raceTimeout(liveReqFilesText(), 8000, ''),
            raceTimeout(loadGenaiSdk(), 12000, null)
        ]).then(function (res) {
            var storyFull = String(res[0] || '').slice(0, 16000);
            var filesFull = String(res[1] || '').slice(0, 12000);
            var mod = res[2];
            if (!mod) {
                cleanupLive();
                setLive(null);
                setMessages(function (prev) { return prev.concat([{ role: 'assistant', content: '❌ Live voice: could not load the Gemini SDK from the CDN (timeout) — check your internet and try again.' }]); });
                return;
            }
            var target = pairs[modelIdx];
            return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (stream) {
            var inCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            try { inCtx.resume(); } catch (e) { }
            var source = inCtx.createMediaStreamSource(stream);
            var proc = inCtx.createScriptProcessor(1024, 1, 1);
            liveMicRef.current = { stream: stream, ctx: inCtx, source: source, proc: proc };
            // توصيل المايك: من غير السطرين دول onaudioprocess عمره ما بينادي
            source.connect(proc);
            // البروسيسور محتاج مقصد عشان يشتغل — بس عن طريق Gain صفر (عشان الصدى ما يرجع)
            var muteGain = inCtx.createGain();
            muteGain.gain.value = 0;
            proc.connect(muteGain);
            muteGain.connect(inCtx.destination);
            // ممنوع نبعت أي صوت قبل ما setupComplete يرجع
            var liveReady = false;
            var sentChunks = 0, loudChunks = 0;
            var lastVoiceAt = 0, lastAgentAt = 0;
            var sendShape = -1; // شكل الإرسال اللي نجح — بنحفظه عشان ما نجربش كل مرة
            var sendAudio = function (f32) {
                var s = liveSessionRef.current;
                if (!s) return;
                var data = b64FromInt16(floatToInt16(f32));
                // أشكال الإرسال بتختلف بين إصدارات الـ SDK — بنجرب بالترتيب
                var shapes = [
                    { media: [{ data: data, mimeType: 'audio/pcm;rate=16000' }] },
                    { audio: { data: data, mimeType: 'audio/pcm;rate=16000' } },
                    { media: { data: data, mimeType: 'audio/pcm;rate=16000' } },
                    { mediaChunks: [{ data: data, mimeType: 'audio/pcm;rate=16000' }] }
                ];
                if (sendShape !== -1) {
                    try { s.sendRealtimeInput(shapes[sendShape]); return; } catch (e0) { sendShape = -1; }
                }
                for (var si = 0; si < shapes.length; si++) {
                    try { s.sendRealtimeInput(shapes[si]); sendShape = si; return; } catch (e) { }
                }
            };
            proc.onaudioprocess = function (ev) {
                if (!liveReady) return;
                var f32 = ev.inputBuffer.getChannelData(0);
                sendAudio(f32);
                sentChunks++;
                for (var i = 0; i < f32.length; i += 16) {
                    if (Math.abs(f32[i]) > 0.02) { loudChunks++; lastVoiceAt = Date.now(); break; }
                }
            };
            liveHealthTimerRef.current = setInterval(function () {
                if (!liveReady || advanced || liveStopRef.current || !lastVoiceAt) return;
                if (Date.now() - lastVoiceAt > 20000 && lastAgentAt < lastVoiceAt) reconnectLive();
            }, 5000);
            // ===== transcript المستخدم: محرك كروم الجانبي — شغال بس وأنت اللي بتتكلم =====
            var startLiveRec = function () {
                if (liveStopRef.current || liveRecRef.current) return;
                var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!SR) return;
                var rec = new SR();
                rec.lang = liveAccent === 'en-us' ? 'en-US' : liveAccent === 'en-uk' ? 'en-GB' : liveAccent === 'de' ? 'de-DE' : liveAccent === 'gulf' ? 'ar-SA' : liveAccent === 'lev' ? 'ar-LB' : 'ar-EG';
                rec.continuous = true;
                rec.interimResults = true;
                liveRecRef.current = rec;
                // instance جديد ⇒ دورة جديدة: تصفير المؤشرات (نتايجه بتبدأ من صفر)
                liveRecTextRef.current.base = 0;
                liveRecTextRef.current.final = '';
                liveRecTextRef.current.interim = '';
                rec.onresult = function (ev) {
                    var s = liveRecTextRef.current;
                    var base = s.base || 0;
                    var fin = '', interim = '';
                    for (var i = base; i < ev.results.length; i++) {
                        var t = (ev.results[i][0].transcript || '');
                        // النهائي بيتثبت (المؤشر بيتقدم عليه) — المؤقت للعرض بس لحد ما يتحول نهائي
                        if (ev.results[i].isFinal) {
                            if (fin && t && !/\s$/.test(fin) && !/^\s/.test(t)) fin += ' ';
                            fin += t;
                            s.base = i + 1;
                        } else {
                            if (interim && t && !/\s$/.test(interim) && !/^\s/.test(t)) interim += ' ';
                            interim += t;
                        }
                    }
                    if (fin) s.final = (s.final ? (/\s$/.test(s.final) ? s.final : s.final + ' ') : '') + fin;
                    s.interim = interim;
                    var txt = ((s.final || '') + ' ' + (s.interim || '')).replace(/\s+/g, ' ').trim();
                    if (!txt) return;
                    var displayTxt = txt;
                    setMessages(function (prev) {
                        var arr = prev.slice();
                        var idx = liveTurnRef.current.userIdx;
                        if (idx === -1 || !arr[idx] || arr[idx].role !== 'user') {
                            arr.push({ role: 'user', content: displayTxt, live: true });
                            liveTurnRef.current.userIdx = arr.length - 1;
                            liveTurnRef.current.agentIdx = -1;
                        } else arr[idx] = Object.assign({}, arr[idx], { content: displayTxt });
                        return arr;
                    });
                };
                rec.onend = function () {
                    // كروم بيفصل الجلسات دوريًا — إعادة تشغيل عنيدة، وbase بيرجع صفر (النتايج بتتصفّر)
                    if (liveRecRef.current !== rec) return;
                    liveRecTextRef.current.base = 0;
                    try { rec.start(); } catch (e) {
                        setTimeout(function () {
                            if (liveRecRef.current !== rec) return;
                            try { rec.start(); } catch (e2) { }
                        }, 400);
                    }
                };
                rec.onerror = function (ev) {
                    // خطأ محرك التعرف الصامت كان بيضيع من غير أثر — نظهره مرة واحدة
                    var err = ev && ev.error;
                    if (err && err !== 'no-speech' && err !== 'aborted') {
                        setMessages(function (prev) { return prev.concat([{ role: 'assistant', content: 'ℹ️ Voice recognition error (' + err + ') \u2014 the mic may be busy or blocked. The live session continues anyway.' }]); });
                    }
                };
                try { rec.start(); } catch (e) { }
            };
            var stopLiveRecSilent = function () {
                var rec = liveRecRef.current;
                liveRecRef.current = null;
                if (rec) { try { rec.onend = null; rec.onresult = null; rec.abort(); } catch (e) { } }
            };
            startLiveRec();
            // حارس الانتقال: مره واحد لكل محاولة (onerror + onclose بيتنادوا مع بعض)
            var advanced = false;
            // هل وصل من الموديل أي رد فعلي (صوت/كلام)؟ لو لأ والجلسة اتقفلت ⇒ محاولة فاشلة نتجاوزها
            var gotAny = false;
            var advance = function (whyShort, failMsg) {
                if (advanced) return;
                advanced = true;
                stopLiveVoice(true);
                if (modelIdx < pairs.length - 1) {
                    setMessages(function (prev) { return prev.concat([{ role: 'assistant', content: 'ℹ️ ' + String(target.model || '').replace('models/', '') + '@' + target.v + ' failed (' + (whyShort || 'unknown') + ') — trying the next…' }]); });
                    startLiveVoice(modelIdx + 1, pairs);
                    return;
                }
                setLive(null);
                setMessages(function (prev) { return prev.concat([{ role: 'assistant', content: failMsg || '❌ Live voice could not connect. Check your Gemini key/region and try again.' }]); });
            };
            var reconnectLive = function (delayMs) {
                if (advanced || liveStopRef.current) return;
                if (liveReconnectRef.current >= 3) {
                    advanced = true;
                    cleanupLive();
                    setLive(null);
                    setMessages(function (prev) { return prev.concat([{ role: 'assistant', content: '⚠ Live voice disconnected repeatedly. Please press 🎙 to reconnect.' }]); });
                    return;
                }
                advanced = true;
                liveReconnectRef.current++;
                cleanupLive();
                setLive('connecting');
                liveTimerRef.current = setTimeout(function () {
                    if (!liveStopRef.current) startLiveVoice(modelIdx, pairs, true);
                }, typeof delayMs === 'number' ? delayMs : 500);
            };
            // مهلة 15 ثانية على setupComplete — حد أمان ضد السكوت (مش وقت انتظار)
            liveTimerRef.current = setTimeout(function () {
                if (advanced || liveReady) return;
                advance('no setupComplete in 15s', '❌ Live voice could not connect — the model (' + String(target.model || '').replace('models/', '') + ') never completed setup. Check your Gemini key/region.');
            }, 15000);

            var ai = new mod.GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: target.v } });
            var liveSystemPrompt = buildLiveSystemPrompt(acct, storyFull, filesFull);
            if (liveHistoryRef.current.length) {
                liveSystemPrompt += '\n\nCONTINUE THE EXISTING VOICE CHAT. Do not greet the user again, introduce yourself, or proactively summarize/repeat their account, project, or story context. Use the recent conversation below as the active task context. If the user says "continue", continue the last unfinished answer, task, scenario, or question from where it stopped. Only discuss account/project context when explicitly asked.\nRECENT VOICE CONVERSATION:\n' + liveHistoryRef.current.slice(-20).map(function (turn) {
                    return (turn.role === 'user' ? 'User: ' : 'Assistant: ') + turn.text;
                }).join('\n').slice(-8000);
            }
            ai.live.connect({
                model: target.model,
                config: {
                    responseModalities: ['AUDIO'],
                    realtimeInputConfig: {
                        automaticActivityDetection: { disabled: false, prefixPaddingMs: 100, silenceDurationMs: 500 },
                        activityHandling: 'START_OF_ACTIVITY_INTERRUPTS'
                    },
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: liveVoiceName() } } },
                    systemInstruction: liveSystemPrompt,
                    sessionResumption: liveResumeHandleRef.current ? { handle: liveResumeHandleRef.current } : {},
                    inputAudioTranscription: {},
                    outputAudioTranscription: {}
                },
                callbacks: {
                    onopen: function () { setLive('connecting'); },
                    onmessage: function (msg) {
                        if (!msg) return;
                        if (msg.sessionResumptionUpdate && msg.sessionResumptionUpdate.resumable && msg.sessionResumptionUpdate.newHandle) {
                            liveResumeHandleRef.current = msg.sessionResumptionUpdate.newHandle;
                        }
                        if (msg.goAway) {
                            var waitMs = 500;
                            var timeLeft = msg.goAway.timeLeft;
                            if (typeof timeLeft === 'string') waitMs = Math.max(0, Math.min(3000, (parseFloat(timeLeft) * 1000) - 250));
                            else if (timeLeft && typeof timeLeft === 'object') {
                                var seconds = Number(timeLeft.seconds || 0) + Number(timeLeft.nanos || 0) / 1000000000;
                                if (seconds > 0) waitMs = Math.max(0, Math.min(3000, seconds * 1000 - 250));
                            }
                            reconnectLive(waitMs);
                            return;
                        }
                        if (msg.error) {
                            var em = String((msg.error && msg.error.message) || 'Live API error');
                            advance(em.slice(0, 160), '❌ ' + em);
                            return;
                        }
                        if (msg.setupComplete) {
                                liveReady = true;
                                livePhaseRef.current = 'listening';
                                liveStartRef.current = Date.now();
                                liveWorkingPairRef.current = modelIdx;
                                if (liveTimerRef.current) { try { clearTimeout(liveTimerRef.current); } catch (e) { } liveTimerRef.current = null; }
                                if (liveMasterTimerRef.current) { try { clearTimeout(liveMasterTimerRef.current); } catch (e) { } liveMasterTimerRef.current = null; }
                            // تشخيص بعد 12 ثانية: المايك شغال فعلًا؟ والصوت بيتبعت والموديل صامت؟
                            setTimeout(function () {
                                    if (advanced || liveStopRef.current || liveDiagShownRef.current) return;
                                    liveDiagShownRef.current = true;
                                    setMessages(function (prev) { return prev.concat([{ role: 'assistant', content: 'ℹ️ The session is ALREADY open (no waiting \u2014 talk now): still no reply after 12s \u2014 ' + sentChunks + ' audio chunks sent' + (sentChunks ? (loudChunks ? ', mic is active' : ', but the mic looks SILENT \u2014 check the right mic device/permissions in the browser') : ' but no audio is being captured') + '. Keep talking, or stop & retry another model.' }]); });
                                }, 12000);
                            setLive('listening');
                            return;
                        }
                        var sc = msg.serverContent;
                        if (!sc) return;
                        if (sc.inputTranscription && sc.inputTranscription.text) {
                            liveServerUserTextRef.current += sc.inputTranscription.text;
                            var serverUserText = liveServerUserTextRef.current.trim();
                            if (serverUserText && !liveRecRef.current) {
                                setMessages(function (prev) {
                                    var arr = prev.slice();
                                    var idx = liveTurnRef.current.userIdx;
                                    if (idx === -1 || !arr[idx] || arr[idx].role !== 'user') {
                                        arr.push({ role: 'user', content: serverUserText, live: true });
                                        liveTurnRef.current.userIdx = arr.length - 1;
                                        liveTurnRef.current.agentIdx = -1;
                                    } else arr[idx] = Object.assign({}, arr[idx], { content: serverUserText });
                                    return arr;
                                });
                            }
                        }
                        if (sc.interrupted) {
                            // المقاطعة: نقفل التشغيل فورًا + نكتم القطع الواصلة في الطريق
                            // (بدل ما تكمل بتتقيل على كلام المستخدم — سبب "المقاطعة مش بتسمع")
                            stopLivePlayback();
                            liveMutedRef.current = true;
                            startLiveRec();
                            setLive('listening');
                            setTimeout(function () { liveMutedRef.current = false; }, 1500); // القطع الواصلة بتوصل خلال أجزاء من الثانية
                        }
                        if (sc.outputTranscription && sc.outputTranscription.text) {
                            lastAgentAt = Date.now();
                            var tOut = sc.outputTranscription.text;
                            liveAgentTextRef.current += tOut;
                            setMessages(function (prev) {
                                var arr = prev.slice();
                                var idx = liveTurnRef.current.agentIdx;
                                if (idx === -1 || !arr[idx] || arr[idx].role !== 'assistant') {
                                    arr.push({ role: 'assistant', content: tOut, live: true });
                                    liveTurnRef.current.agentIdx = arr.length - 1;
                                } else arr[idx] = Object.assign({}, arr[idx], { content: arr[idx].content + tOut });
                                return arr;
                            });
                        }
                            var parts = (sc.modelTurn && sc.modelTurn.parts) || [];
                            var gotAudio = false;
                            for (var pi = 0; pi < parts.length; pi++) {
                                var pt = parts[pi];
                                if (pt.inlineData && pt.inlineData.data) gotAudio = true;
                            }
                            if (gotAudio) {
                                lastAgentAt = Date.now();
                                gotAny = true;
                                stopLiveRecSilent(); // الأيجنت بيتكلم — محرك التعرف جانبي بيقفل (مايسجلش صوته)
                                // الكتم بعد المقاطعة: القطع الواصلة في الطريق بتتجاهل بدل ما تتقيل على كلام المستخدم
                                if (!liveMutedRef.current) {
                                    for (var pj = 0; pj < parts.length; pj++) {
                                        var pj2 = parts[pj];
                                        if (pj2.inlineData && pj2.inlineData.data) playLiveAudio(pj2.inlineData.data, pj2.inlineData.mimeType);
                                    }
                                }
                                setLive('speaking');
                            }
                        if (sc.turnComplete) {
                            var aIdx = liveTurnRef.current.agentIdx;
                            var uIdx = liveTurnRef.current.userIdx;
                            // النص الموثوق من المراجع المتراكمة (مش المرآة — بتكون متأخرة فبتنسي آخر القطع)
                            var agentText = String(liveAgentTextRef.current || '').trim();
                            var userText = String(liveRecTextRef.current.final || liveRecTextRef.current.interim || liveServerUserTextRef.current || '').trim();
                            liveTurnRef.current = { userIdx: -1, agentIdx: -1 };
                            liveAgentTextRef.current = '';
                            liveServerUserTextRef.current = '';
                            liveRecTextRef.current.base = liveRecTextRef.current.count || 0;
                            liveRecTextRef.current.final = '';
                            liveRecTextRef.current.interim = '';
                            if (userText) {
                                setMessages(function (prev) {
                                    var arr = prev.slice();
                                    if (uIdx !== -1 && arr[uIdx] && arr[uIdx].role === 'user') {
                                        arr[uIdx] = Object.assign({}, arr[uIdx], { content: userText });
                                    } else arr.push({ role: 'user', content: userText, live: true });
                                    return arr;
                                });
                            }
                            // تنسيق transcript الطرفين: سطور وفواصل ثابتة (مش بترجع تلزق)
                            if (userText) liveHistoryRef.current.push({ role: 'user', text: userText });
                            if (aIdx !== -1) {
                                var cleanA = formatLiveTranscript(agentText);
                                setMessages(function (prev) { return prev.map(function (m, i2) { return i2 === aIdx ? Object.assign({}, m, { content: cleanA }) : m; }); });
                                liveHistoryRef.current.push({ role: 'assistant', text: cleanA });
                                if (liveHistoryRef.current.length > 40) liveHistoryRef.current = liveHistoryRef.current.slice(-40);
                            }
                            if (liveHistoryRef.current.length > 40) liveHistoryRef.current = liveHistoryRef.current.slice(-40);
                            startLiveRec(); // نهاية رد الأيجنت — المستخدم يتكلم تاني
                            setLive('listening');
                        }
                    },
                    onerror: function (e) {
                        if (liveStopRef.current) return;
                        if (liveReady || gotAny) { reconnectLive(); return; }
                        advance('SDK error: ' + ((e && e.message) || 'unknown'), '❌ Live voice connection failed — check your internet/Gemini key and try again.');
                    },
                    onclose: function (ev) {
                        if (liveStopRef.current || advanced) return;
                        var why = (ev && ((ev.code ? 'code ' + ev.code : '') + (ev.reason ? ' — ' + ev.reason : ''))) || '';
                        if (liveReady || gotAny || liveResumeHandleRef.current) reconnectLive();
                        else advance('closed' + (why ? ' (' + why + ')' : ''), '❌ Live voice: none of the Live models worked for your key' + (why ? ' — last attempt: ' + why : '') + '. Check your key/region.');
                    }
                }
            }).then(function (session) {
                liveSessionRef.current = session;
            }).catch(function (e) {
                advance('connect failed: ' + ((e && e.message) || 'unknown'), '❌ Live voice connect failed: ' + ((e && e.message) || 'unknown'));
            });
            });
        }).catch(function (e) {
            setLive(null);
            setMessages(function (prev) { return prev.concat([{ role: 'assistant', content: '❌ ' + ((e && e.message) || 'Live voice failed to start') }]); });
            cleanupLive();
        });
    };

    var lastAssistantMsg = null;
    for (var mi = messages.length - 1; mi >= 0; mi--) { if (messages[mi].role === 'assistant') { lastAssistantMsg = messages[mi]; break; } }

    var exportWord = function () {
        if (!lastAssistantMsg) return;
        exportAgentWord(lastAssistantMsg.content);
    };

    var exportPDF = function () {
        if (!lastAssistantMsg) return;
        exportAgentPDF(lastAssistantMsg.content);
    };

    var copyResponse = function () {
        if (!lastAssistantMsg) return;
        try { navigator.clipboard.writeText(lastAssistantMsg.content); setCopied(true); setTimeout(function () { setCopied(false); }, 2000); } catch (e) { window.prompt('Copy:', lastAssistantMsg.content); }
    };

    // ===== حفظ المحادثة الكاملة كـ PDF =====
    var saveChatPDF = function () {
        var exportMessages = messages.map(function (message) {
            return Object.assign({}, message);
        });
        var activeTurn = liveTurnRef.current || {};
        var liveUserText = String(liveRecTextRef.current.final || liveRecTextRef.current.interim || liveServerUserTextRef.current || '').trim();
        var liveAgentText = String(liveAgentTextRef.current || '').trim();
        if (liveUserText) {
            if (activeTurn.userIdx >= 0 && exportMessages[activeTurn.userIdx] && exportMessages[activeTurn.userIdx].role === 'user') {
                exportMessages[activeTurn.userIdx].content = liveUserText;
            } else exportMessages.push({ role: 'user', content: liveUserText });
        }
        if (liveAgentText) {
            if (activeTurn.agentIdx >= 0 && exportMessages[activeTurn.agentIdx] && exportMessages[activeTurn.agentIdx].role === 'assistant') {
                exportMessages[activeTurn.agentIdx].content = liveAgentText;
            } else exportMessages.push({ role: 'assistant', content: liveAgentText });
        }
        if (!exportMessages.length) { alert(tr('No messages to save.')); return; }
        var chatHtml = '';
        exportMessages.forEach(function (m, index) {
            var isAgent = m.role === 'assistant';
            var content = String(m.content == null ? '' : m.content);
            var fmt = isAgent ? renderAgentHTML(content) : {
                html: escHtml(content).replace(/\r\n?/g, '\n').replace(/\n/g, '<br/>'),
                dir: /[\u0600-\u06FF]/.test(content) ? 'rtl' : 'ltr'
            };
            chatHtml += '<article class="message ' + (isAgent ? 'agent' : 'user') + '" dir="' + fmt.dir + '">' +
                '<div class="label" dir="ltr">' + (isAgent ? '\uD83E\uDD16 Vetly Agent' : '\uD83D\uDC64 You') + ' <span>#' + (index + 1) + '</span></div>' +
                '<div class="content">' + fmt.html + '</div></article>';
        });
        var printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Allow pop-ups for this site to print the conversation as a PDF.');
            return;
        }
        var printStarted = false;
        var printConversation = function () {
            if (printStarted || printWindow.closed) return;
            printStarted = true;
            printWindow.focus();
            printWindow.print();
        };
        printWindow.onload = printConversation;
        printWindow.document.open();
        printWindow.document.write('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<title>Vetly Agent Conversation</title><style>' +
            '*{box-sizing:border-box}html,body{width:100%;min-height:100%;margin:0;padding:0}' +
            'body{background:#0b1220;color:#e2e8f0;font:11pt Arial,Calibri,sans-serif}' +
            '.page{width:100%;max-width:none;margin:0;padding:0}' +
            '.message{display:block;width:100%;max-width:100%;margin:0;padding:12px 14px;overflow:visible;break-inside:auto;page-break-inside:auto}' +
            '.message.user{background:#123344;color:#ecfeff;border-bottom:1px solid #0e7490}' +
            '.message.agent{background:#111d3a;color:#eff6ff;border-bottom:1px solid #1e40af}' +
            '.label{margin:0 0 6px;font-size:10px;font-weight:bold;letter-spacing:.3px;color:#67e8f9}' +
            '.agent .label{color:#93c5fd}.label span{color:#64748b;font-weight:normal}' +
            '.content{width:100%;max-width:100%;line-height:1.65;overflow-wrap:anywhere;word-break:normal}' +
            '.content pre{max-width:100%;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal}' +
            '.content table{width:100%;max-width:100%;border-collapse:collapse;table-layout:fixed;}' +
            '.content td,.content th{border:1px solid #64748b;padding:5px;overflow-wrap:anywhere;word-break:normal;vertical-align:top}' +
            '@page{size:A4;margin:0}@media print{html,body{width:100%;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:100%;padding:0}.message{width:100%;max-width:100%}}</style></head><body><main class="page">' +
            chatHtml + '</main></body></html>');
        printWindow.document.close();
        setTimeout(printConversation, 500);
    };

    var copyChat = function () {
        var text = messages.map(function (m) {
            return (m.role === 'user' ? 'You: ' : 'Agent: ') + m.content;
        }).join('\n\n---\n\n');
        try { navigator.clipboard.writeText(text); } catch (e) { window.prompt('Copy:', text); }
    };

    // ===== Send to feature: فتح المودال + التحويل + الحفظ =====
    var openSend = function () {
        setSendProj(acct && acct.projects && acct.projects.length ? acct.projects[0].id : '');
        setSendStory('');
        setSendFeat('cases');
        setSendMode('add');
        setSendMsg('');
        setSendOpen(true);
    };

    // الستوري المفتوحة حاليًا: دمج في localStorage + حدث ⇒ App يعيد القراءة فورًا
    // والـ auto-save يرفع للسحابة لوحده (عشان مايتلغاش بالحفظ التالي)
    var sendItemsLocal = function (feature, mode, items) {
        var res = { added: 0, updated: 0 };
        if (feature === 'gaps') {
            // نفس قاعدة الإضافة اليدوية: الثغرات بتتسجل في cross (وبنية جديدة لو مفيش تحليل)
            var gd = safeJSON('wakil_gap_data', null);
            if (!gd || typeof gd !== 'object' || Array.isArray(gd)) gd = { sections: [], cross: [], createdAt: '' };
            if (!Array.isArray(gd.sections)) gd.sections = [];
            if (!Array.isArray(gd.cross)) gd.cross = [];
            items.forEach(function (it) {
                if (!it || !String(it.description || '').trim()) return;
                var clean = {
                    id: String(it.id || '').trim(),
                    type: normalizeGapType(String(it.type || '')),
                    requirementRef: String(it.requirementRef || ''),
                    description: String(it.description).trim(),
                    evidence: String(it.evidence || ''),
                    scenario: String(it.scenario || ''),
                    question: String(it.question || ''),
                    priority: ['Critical', 'High', 'Medium', 'Low'].indexOf(it.priority) !== -1 ? it.priority : 'Medium',
                    status: String(it.status || 'Open')
                };
                var gidx = clean.id ? gd.cross.findIndex(function (g) { return g && String(g.id) === clean.id; }) : -1;
                if (mode === 'update' && gidx !== -1) { gd.cross[gidx] = Object.assign({}, gd.cross[gidx], clean); res.updated++; }
                else { gd.cross.push(clean); res.added++; }
            });
            try { localStorage.setItem('wakil_gap_data', JSON.stringify(gd)); } catch (e) { }
        } else if (feature === 'cases') {
            var ai = sanitizeSuite(safeJSON('wakil_ai_data', null) || { testCases: [], scenarios: [] });
            var scenIds = {};
            (ai.scenarios || []).forEach(function (s) { if (s && s.id) scenIds[s.id] = true; });
            var cases = ai.testCases || [];
            var maxN = 0;
            cases.forEach(function (tc) { var m = /^[A-Za-z]+-(\d+)$/.exec(String((tc && tc.id) || '')); if (m) maxN = Math.max(maxN, parseInt(m[1], 10)); });
            items.forEach(function (it) {
                if (!it || !String(it.title || '').trim()) return;
                var clean = {
                    id: String(it.id || '').trim(),
                    title: String(it.title).trim(),
                    type: ['Positive', 'Negative', 'Edge Case'].indexOf(it.type) !== -1 ? it.type : 'Positive',
                    priority: ['Critical', 'High', 'Medium', 'Low'].indexOf(it.priority) !== -1 ? it.priority : 'Medium',
                    technique: String(it.technique || ''),
                    preCondition: String(it.preCondition || ''),
                    testData: String(it.testData || ''),
                    steps: (Array.isArray(it.steps) ? it.steps : []).map(function (s) { return String(s); }),
                    expected: String(it.expected || ''),
                    scenarioId: scenIds[String(it.scenarioId || '').trim()] ? String(it.scenarioId).trim() : ''
                };
                var idx = clean.id ? cases.findIndex(function (tc) { return tc && String(tc.id) === clean.id; }) : -1;
                if (mode === 'update' && idx !== -1) { cases[idx] = Object.assign({}, cases[idx], clean); res.updated++; }
                else {
                    if (!clean.id || cases.some(function (tc) { return tc && tc.id === clean.id; })) { maxN++; clean.id = 'TC-' + String(maxN).padStart(2, '0'); }
                    cases.push(clean); res.added++;
                }
            });
            ai.testCases = cases;
            try { localStorage.setItem('wakil_ai_data', JSON.stringify(ai)); } catch (e) { }
        } else {
            var sc = sanitizeScenarioList(safeJSON('wakil_sc_data', [])) || [];
            var maxN2 = 0;
            sc.forEach(function (s) { var m = /^[A-Za-z]+-(\d+)$/.exec(String((s && s.id) || '')); if (m) maxN2 = Math.max(maxN2, parseInt(m[1], 10)); });
            items.forEach(function (it) {
                if (!it || !String(it.title || '').trim()) return;
                var clean2 = {
                    id: String(it.id || '').trim(),
                    title: String(it.title).trim(),
                    type: ['Positive', 'Negative', 'Edge Case'].indexOf(it.type) !== -1 ? it.type : 'Positive',
                    priority: ['Critical', 'High', 'Medium', 'Low'].indexOf(it.priority) !== -1 ? it.priority : 'Medium'
                };
                var idx2 = clean2.id ? sc.findIndex(function (s) { return s && String(s.id) === clean2.id; }) : -1;
                if (mode === 'update' && idx2 !== -1) { sc[idx2] = Object.assign({}, sc[idx2], clean2); res.updated++; }
                else {
                    if (!clean2.id || sc.some(function (s) { return s && s.id === clean2.id; })) { maxN2++; clean2.id = 'TS-' + String(maxN2).padStart(2, '0'); }
                    sc.push(clean2); res.added++;
                }
            });
            try { localStorage.setItem('wakil_sc_data', JSON.stringify(sc)); } catch (e) { }
        }
        // إعادة الترقيم التسلسلي (TC/TS/GAP من 1) + تصحيح المراجع على مستوى الستوري كلها
        // (الحفظ للسحابة بيجي تلقائي من الـ auto-save بعد تغيّر البصمة)
        var ws = {};
        ['wakil_ai_data', 'wakil_sc_data', 'wakil_linked', 'wakil_bugs', 'wakil_runs', 'wakil_gap_data'].forEach(function (k) {
            var v = localStorage.getItem(k);
            if (v != null && v !== '') ws[k] = v;
        });
        sbRenumberStoryData(ws);
        Object.keys(ws).forEach(function (k) { try { localStorage.setItem(k, ws[k]); } catch (e) { } });
        return res;
    };

    var handleSendToFeature = function () {
        if (sendBusy || !lastAssistantMsg) return;
        var proj = ((acct && acct.projects) || []).find(function (x) { return x.id === sendProj; });
        var story = proj ? (proj.stories || []).find(function (x) { return x.id === sendStory; }) : null;
        if (!proj || !story || !story.id) { setSendMsg('Choose a project and a story first.'); return; }
        var usable = getAllProviders().filter(function (x) { return providerUsable(x, keys); });
        if (!usable.length) { setSendMsg('\u274C No API key in Settings.'); return; }
        var p = usable.find(function (x) { return x.id === autoProvider; }) || usable[0];
        var key = (keys[p.id] || '').trim();
        var featLabel = sendFeat === 'cases' ? 'Test Cases' : sendFeat === 'gaps' ? 'Requirement Gaps' : 'Test Scenarios';
        var okFlag = false; // النجاح ⇒ يقفل المودال لوحده (يمنع الإرسال المكرر بالخطأ)
        setSendBusy(true);
        setSendMsg('\u23F3 Converting the response to items\u2026');
        parseAgentItemsWithAI(lastAssistantMsg.content, sendFeat, p, key, autoModel).then(function (items) {
            if (!items.length) throw new Error('No test case/scenario/gap items found in the response.');
            var openProj = safeJSON('wakil_cloud_project', null);
            var openStory = safeJSON('wakil_cloud_story', null);
            var isOpen = !!(openProj && openStory && openProj.id === proj.id && openStory.id === story.id);
            if (isOpen) {
                var r = sendItemsLocal(sendFeat, sendMode, items);
                window.dispatchEvent(new Event('vetly_feature_data_changed'));
                okFlag = true;
                setSendMsg('\u2705 Sent to "' + story.name + '" (' + featLabel + '): ' + r.added + ' added, ' + r.updated + ' updated \u2014 saving to cloud automatically\u2026');
            } else {
                return sbSendAgentItems({ projectId: proj.id, storyId: story.id, feature: sendFeat, mode: sendMode, items: items }).then(function (r) {
                    if (r.error) throw new Error(r.error);
                    okFlag = true;
                    setSendMsg('\u2705 Sent to "' + story.name + '" (' + featLabel + '): ' + r.added + ' added, ' + r.updated + ' updated.');
                });
            }
        }).catch(function (e) {
            setSendMsg('\u274C ' + ((e && e.message) || 'Send failed'));
        }).then(function () {
            setSendBusy(false);
            if (okFlag) setTimeout(function () { setSendOpen(false); }, 1600);
        });
    };

    var tabBtn = function (id, label) {
        return React.createElement('button', {
            onClick: function () { setActiveTab(activeTab === id ? null : id); },
            className: 'px-2.5 py-1 rounded-lg text-[10px] font-semibold transition ' + (activeTab === id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700')
        }, label);
    };

    return React.createElement('main', { className: 'flex-1 flex flex-col overflow-hidden bg-slate-900 agent-page' },
        // Header: title + Clear + Skills/Prompt tabs
        React.createElement('div', { className: 'px-4 py-2 bg-slate-900 border-b border-slate-700 flex items-center gap-2 flex-shrink-0' },
            React.createElement('span', { className: 'flex items-center gap-2' },
                React.createElement(AppLogo, { size: 26 }),
                React.createElement('span', { className: 'text-sm font-bold text-white' }, 'Vetly Agent')
            ),
            React.createElement('span', { className: 'text-[10px] bg-blue-500/20 text-blue-300 rounded-full px-2 py-0.5' }, 'Software Testing'),
            // بادج الحساب: الأيجنت متصل بمشاريع صاحب الجلسة بس (RLS-محصورة)
            acct && acct.email ? React.createElement('span', {
                className: 'text-[10px] bg-emerald-500/20 text-emerald-300 rounded-full px-2 py-0.5',
                title: 'Agent answers account questions from this account only (' + acct.projects.length + ' project(s) loaded)'
            }, '\uD83D\uDD17 ' + acct.email) : null,
            React.createElement('div', { className: 'ml-auto flex gap-1 items-center flex-wrap justify-end' },
                // اختيار صوت المساعد — يظهر والجلسة مقفولة (التغيير بيتطبق في الجلسة الجاية)
                !live ? React.createElement('select', {
                    value: liveVoice,
                    onChange: function (e) { setLiveVoice(e.target.value); },
                    className: 'border border-slate-600 rounded-md px-1.5 py-0.5 text-[10px] bg-slate-700 text-slate-300',
                    title: 'Assistant voice'
                }, LIVE_VOICES.map(function (v) {
                    return React.createElement('option', { key: v.name, value: v.name }, '\uD83D\uDD0A ' + v.name + ' (' + v.note + ')');
                })) : null,
                // لهجة/لكنة الصوت
                !live ? React.createElement('select', {
                    value: liveAccent,
                    onChange: function (e) { setLiveAccent(e.target.value); },
                    className: 'border border-slate-600 rounded-md px-1.5 py-0.5 text-[10px] bg-slate-700 text-slate-300',
                    title: 'Accent / dialect'
                }, LIVE_ACCENTS.map(function (a) {
                    return React.createElement('option', { key: a.id, value: a.id }, '\uD83D\uDDE3 ' + a.label);
                })) : null,
                // المكالمة الصوتية الحية (Gemini Live API — واعية بالشاشة الحالية)
                React.createElement('button', {
                    onClick: function () { if (live) { stopLiveVoice(false); } else { startLiveVoice(0); } },
                    className: live
                        ? 'px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-red-600 text-white hover:bg-red-700 animate-pulse'
                        : 'px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700'
                }, live ? '\u23F9 Stop Live' : '\uD83C\uDF99 Live Voice'),
                live && live !== 'error' ? React.createElement('span', {
                    className: 'text-[10px] px-2 py-0.5 rounded-full ' + (live === 'speaking' ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300')
                }, live === 'connecting' ? '\u23F3 connecting\u2026 (allow the mic if the browser asks)' : live === 'speaking' ? '\uD83D\uDD0A speaking' : '\uD83C\uDFA4 listening \u2014 say something') : null,
                messages.length > 0 ? React.createElement('button', {
                    onClick: function () {
                        if (live) stopLiveVoice(false);
                        liveHistoryRef.current = [];
                        liveResumeHandleRef.current = null;
                        liveServerUserTextRef.current = '';
                        liveAgentTextRef.current = '';
                        setMessages([]);
                        setSteps([]);
                    },
                    className: 'px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700'
                }, '\uD83D\uDDD1 Clear') : null,
                messages.length > 0 ? React.createElement('button', {
                    onClick: saveChatPDF,
                    className: 'px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700'
                }, '\uD83D\uDCC4 Save Chat PDF') : null,
                tabBtn('skills', '\uD83E\uDDE0 Skills (' + skills.length + ')'),
                tabBtn('prompt', '\uD83D\uDCDD Prompt')
            )
        ),
        // Settings panel (SINGLE — below header, above chat)
        activeTab ? React.createElement('div', { className: 'border-b border-slate-700 bg-slate-800 p-3 max-h-72 overflow-y-auto flex-shrink-0' },
            activeTab === 'skills' ? React.createElement('div', { className: 'space-y-2' },
                React.createElement('div', { className: 'flex items-center justify-between' },
                    React.createElement('span', { className: 'text-xs text-slate-300' }, 'Skills \u2014 activate a skill by mentioning it with / in the message'),
                    React.createElement('button', { onClick: function () { if (skillFileRef.current) skillFileRef.current.click(); }, className: 'bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-medium hover:bg-blue-700' }, 'Upload File'),
                    React.createElement('input', { ref: skillFileRef, type: 'file', accept: '.txt,.md,.json', className: 'hidden', onChange: handleSkillUpload })
                ),
                skills.length === 0 ? React.createElement('p', { className: 'text-[11px] text-slate-500 text-center py-1' }, 'No skills yet \u2014 add one below') : null,
                skills.map(function (s) {
                    return React.createElement('div', { key: s.id, className: 'border border-slate-600 rounded-lg p-2 space-y-1 bg-slate-700' },
                        React.createElement('div', { className: 'flex items-center gap-1.5' },
                            React.createElement('input', { type: 'checkbox', checked: s.enabled, onChange: function (e) { setSkills(function (p) { return p.map(function (x) { return x.id === s.id ? Object.assign({}, x, { enabled: e.target.checked }) : x; }); }); }, className: 'w-3.5 h-3.5 accent-emerald-500' }),
                            React.createElement('input', { className: 'flex-1 border border-slate-500 rounded p-1 text-xs font-semibold bg-slate-600 text-white', value: s.name, onChange: function (e) { setSkills(function (p) { return p.map(function (x) { return x.id === s.id ? Object.assign({}, x, { name: e.target.value }) : x; }); }); }, placeholder: 'Skill name' }),
                            React.createElement('button', { onClick: function () { setSkills(function (p) { return p.filter(function (x) { return x.id !== s.id; }); }); }, className: 'text-red-400 hover:text-red-300 text-[10px]' }, '\u2715')
                        ),
                        React.createElement('textarea', { className: 'w-full border border-slate-500 rounded p-1.5 text-xs bg-slate-600 text-slate-200 font-mono', rows: 3, value: s.content, onChange: function (e) { setSkills(function (p) { return p.map(function (x) { return x.id === s.id ? Object.assign({}, x, { content: e.target.value }) : x; }); }); }, placeholder: 'Skill content...' })
                    );
                }),
                React.createElement('div', { className: 'flex gap-1.5' },
                    React.createElement('input', { className: 'flex-1 border border-slate-600 rounded p-1 text-[11px] bg-slate-700 text-white placeholder-slate-500', value: newSkillName, onChange: function (e) { setNewSkillName(e.target.value); }, placeholder: 'New skill name...' }),
                    React.createElement('button', {
                        onClick: function () {
                            if (!newSkillName.trim()) return;
                            setSkills(function (p) { return p.concat([{ id: 'sk-' + Date.now().toString(36), name: newSkillName.trim(), content: '', enabled: true }]); });
                            setNewSkillName('');
                        },
                        className: 'bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded text-[11px] font-medium'
                    }, '+ Add')
                )
            ) : null,
            activeTab === 'prompt' ? React.createElement('div', { className: 'space-y-1' },
                React.createElement('textarea', { className: 'w-full border border-slate-600 rounded p-2 text-[11px] font-mono bg-slate-700 text-slate-200', rows: 8, value: systemPrompt, onChange: function (e) { setSystemPrompt(e.target.value); } }),
                React.createElement('button', { onClick: function () { setSystemPrompt(AGENT_SYS_DEFAULT); }, className: 'text-[10px] text-blue-400 hover:underline' }, 'Reset to Default')
            ) : null
        ) : null,
        // ===== Chat area (ONLY messages) =====
        React.createElement('div', { className: 'flex-1 overflow-y-auto p-4 space-y-3' },
            messages.length === 0 && !busy ? React.createElement('div', { className: 'text-center text-slate-500 py-16' },
                React.createElement('div', { className: 'mb-3 flex justify-center' }, React.createElement(AppLogo, { size: 64 })),
                React.createElement('p', { className: 'text-base text-slate-300' }, 'Ask me anything about software testing...'),
                React.createElement('p', { className: 'text-xs text-slate-500 mt-2' }, 'Skills: ' + skills.length + ' available \u00B7 type / to mention \u00B7 Model: ' + (autoProvider || 'not set') + (acct ? ' \u00B7 Account: ' + acct.projects.length + ' project(s) connected' : ''))
            ) : null,
            messages.map(function (m, i) {
                var isAgent = m.role === 'assistant';
                var fmt = isAgent ? renderAgentHTML(m.content) : { html: escHtml(m.content), dir: 'ltr' };
                var msgImages = m.images || [];
                return React.createElement('div', { key: i, className: 'flex ' + (isAgent ? 'justify-start' : 'justify-end') },
                    React.createElement('div', { className: 'max-w-[85%] ' + (isAgent
                        ? 'bg-slate-800/80 border border-slate-700 rounded-2xl rounded-bl-md px-4 py-3'
                        : 'bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-3'
                    ), dir: fmt.dir },
                        isAgent ? React.createElement('div', {
                            dangerouslySetInnerHTML: { __html: fmt.html },
                            dir: fmt.dir,
                            style: { lineHeight: '1.8' },
                            className: 'text-slate-100'
                        }) : React.createElement('span', { style: { whiteSpace: 'pre-wrap' } }, m.content),
                        // صور مصغرة للمرفقات في رسايل المستخدم
                        msgImages.length > 0 ? React.createElement('div', { className: 'flex flex-wrap gap-1.5 mt-2' },
                            msgImages.map(function (img, idx) {
                                return React.createElement('img', { key: idx, src: img, className: 'w-20 h-20 object-cover rounded-lg border border-white/20', style: { maxHeight: '80px' } });
                            })
                        ) : null,
                        // Copy/Edit buttons under user messages
                        !isAgent && m.content ? React.createElement('div', { className: 'flex gap-1.5 mt-2 pt-2 border-t border-white/10 items-center' },
                            React.createElement('button', {
                                onClick: function () {
                                    try { navigator.clipboard.writeText(m.content); } catch (e) { }
                                    setCopiedMsg(i);
                                    setTimeout(function () { setCopiedMsg(function (x) { return x === i ? -1 : x; }); }, 1400);
                                },
                                className: 'text-[10px] text-slate-200 hover:text-white px-2 py-1 rounded-md bg-slate-700/90 hover:bg-slate-600 flex items-center gap-1 transition active:scale-90'
                            }, copiedMsg === i ? '\u2705 Copied!' : '\uD83D\uDCCB Copy'),
                            React.createElement('button', {
                                onClick: function () {
                                    setInput(m.content);
                                    setEditFlash(true);
                                    setTimeout(function () { setEditFlash(false); }, 900);
                                    if (inputRef.current) inputRef.current.focus();
                                },
                                className: 'text-[10px] text-slate-200 hover:text-white px-2 py-1 rounded-md bg-slate-700/90 hover:bg-slate-600 transition active:scale-90'
                            }, '\u270F\uFE0F Edit')
                        ) : null,
                        // Export icons under agent response with labels
                        isAgent && i === messages.length - 1 ? React.createElement('div', { className: 'flex gap-2 mt-3 pt-2 border-t border-slate-700 items-center' },
                            React.createElement('span', { className: 'text-[10px] text-slate-500' }, '\uD83D\uDCE4 Export:'),
                            React.createElement('button', {
                                onClick: copyResponse,
                                className: 'text-[10px] text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 flex items-center gap-1 transition'
                            }, copied ? '\u2705 Copied!' : '\uD83D\uDCCB Copy'),
                            React.createElement('button', {
                                onClick: exportPDF,
                                className: 'text-[10px] text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 flex items-center gap-1 transition'
                            }, '\uD83D\uDCC4 PDF'),
                            React.createElement('button', {
                                onClick: exportWord,
                                className: 'text-[10px] text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 flex items-center gap-1 transition'
                            }, '\uD83D\uDCDD Word'),
                            // إرسال رد الأيجنت لفيتشر في مشاريع المستخدم (لو مسجل وفيه مشاريع)
                            acct && acct.projects && acct.projects.length ? React.createElement('button', {
                                onClick: openSend,
                                className: 'text-[10px] text-emerald-400 hover:text-emerald-300 px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 flex items-center gap-1 transition'
                            }, '\uD83D\uDCE4 Send to feature') : null
                        ) : null
                    )
                );
            }),
            busy ? React.createElement('div', { className: 'flex justify-start' },
                React.createElement('div', { className: 'bg-slate-800/80 border border-slate-700 text-slate-400 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm animate-pulse' }, '\u23F3 Thinking...')
            ) : null,
            // Auto-scroll anchor — chatEndRef موجودة هنا دايماً
            React.createElement('div', { ref: chatEndRef })
        ),
        // ===== Input bar =====
        React.createElement('div', { className: 'border-t border-slate-700 bg-slate-800 p-3 flex-shrink-0 relative' },
            // قايمة ميانشن السكيلز — بتظهر فوق مربع الرسالة لما تكتب /
            mention ? React.createElement('div', {
                className: 'absolute bottom-full left-3 right-3 mb-1 max-h-48 overflow-y-auto bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50'
            },
                React.createElement('p', { className: 'px-3 pt-2 pb-1 text-[10px] text-slate-500' }, 'Mention a skill to apply its guidance to this message'),
                mentionList.length ? mentionList.map(function (s, i) {
                    return React.createElement('button', {
                        key: s.id,
                        onMouseDown: function (e) { e.preventDefault(); pickMention(s); },
                        className: 'w-full text-left px-3 py-2 text-xs flex items-center gap-2 ' + (i === menHi ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-700')
                    }, '\uD83E\uDDE0 /' + s.name);
                }) : React.createElement('div', { className: 'px-3 pb-2 text-xs text-slate-500' }, 'No matching skills')
            ) : null,
            // Provider/Model + file upload — LEFT-aligned, same row
            React.createElement('div', { className: 'flex justify-start mb-1.5 gap-1.5 items-center' },
                React.createElement('select', {
                    className: 'border border-slate-600 rounded-md px-2 py-0.5 text-[10px] bg-slate-700 text-slate-300',
                    value: autoProvider,
                    onChange: function (e) { setAutoProvider(e.target.value); setAutoModel(''); }
                },
                    getAllProviders().filter(function (p) { return providerUsable(p, keys); }).map(function (p) {
                        return React.createElement('option', { key: p.id, value: p.id }, p.name);
                    })
                ),
                React.createElement('select', {
                    className: 'border border-slate-600 rounded-md px-2 py-0.5 text-[10px] bg-slate-700 text-slate-300',
                    value: autoModel,
                    onChange: function (e) { setAutoModel(e.target.value); }
                },
                    React.createElement('option', { value: '' }, 'default'),
                    (providerModels || []).map(function (m) { return React.createElement('option', { key: m, value: m }, m); })
                ),
                // 📎 file upload — SAME ROW as Provider/Model
                React.createElement('button', {
                    onClick: function () { if (fileRef.current) fileRef.current.click(); },
                    className: 'bg-slate-700 hover:bg-slate-600 text-slate-400 px-2 py-0.5 rounded-md text-[10px]',
                    title: 'Attach file or image'
                }, '\uD83D\uDCCE'),
                // 🎤 mic (voice input) — SVG podcast mic icon
                React.createElement('button', {
                    onClick: toggleMic,
                    className: 'bg-slate-700 hover:bg-slate-600 text-slate-400 px-2 py-0.5 rounded-md text-[10px] transition ' + (listening ? '!bg-red-600 !text-white animate-pulse' : ''),
                    title: listening ? 'اضغط تاني للإيقاف والإرسال' : 'Voice input'
                },
                    React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
                        React.createElement('rect', { x: 9, y: 2, width: 6, height: 12, rx: 3, fill: 'currentColor', stroke: 'none' }),
                        React.createElement('path', { d: 'M5 10v2c0 4.418 3.582 8 8 8s8-3.582 8-8v-2' }),
                        React.createElement('line', { x1: 12, y1: 20, x2: 12, y2: 23 }),
                        React.createElement('line', { x1: 8, y1: 23, x2: 16, y2: 23 })
                    )
                ),
                // Image thumbnails
                attachedFiles.filter(function (f) { return f.type === 'image'; }).map(function (f, i) {
                    return React.createElement('img', { key: 'img' + i, src: f.dataUrl, className: 'w-10 h-10 object-cover rounded-lg border border-slate-500' });
                }),
                // Text file chips
                attachedFiles.filter(function (f) { return f.type !== 'image'; }).map(function (f, i) {
                    return React.createElement('span', { key: 'txt' + i, className: 'text-[10px] bg-slate-600 text-slate-300 rounded px-1.5 py-0.5' }, '\uD83D\uDCC4 ' + f.name.slice(0, 12));
                })
            ),
            React.createElement('input', { ref: fileRef, type: 'file', multiple: true, className: 'hidden', onChange: handleFileSelect }),
            // Textarea + send/stop
            React.createElement('div', { className: 'flex gap-2 items-end' },
            React.createElement('textarea', {
                ref: inputRef,
                className: 'flex-1 bg-slate-800 border border-slate-600 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 resize-none outline-none focus:ring-2 focus:ring-blue-500 transition' + (editFlash ? ' border-blue-500 ring-2 ring-blue-500/70' : ''),
                rows: 2,
                value: input,
                onChange: function (e) {
                    var v = e.target.value, pos = e.target.selectionStart;
                    var slash = v.lastIndexOf('/', pos - 1);
                    if (slash !== -1 && !/\s/.test(v.slice(slash + 1, pos))) {
                        setMention({ query: v.slice(slash + 1, pos), start: slash });
                        setMenHi(0);
                    } else setMention(null);
                    setInput(v);
                },
                onBlur: function () { setTimeout(function () { setMention(null); }, 150); },
                placeholder: 'Ask me anything about software testing... (type / to mention a skill)',
                onKeyDown: function (e) {
                    if (mention && mentionList.length) {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setMenHi(function (x) { return (x + 1) % mentionList.length; }); return; }
                        if (e.key === 'ArrowUp') { e.preventDefault(); setMenHi(function (x) { return (x - 1 + mentionList.length) % mentionList.length; }); return; }
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); pickMention(mentionList[Math.min(menHi, mentionList.length - 1)]); return; }
                        if (e.key === 'Escape') { setMention(null); return; }
                    }
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                },
                disabled: busy
            }),
                busy ? React.createElement('button', {
                    onClick: handleStop,
                    className: 'bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-medium flex-shrink-0'
                }, '\u25A0 Stop') : React.createElement('button', {
                    onClick: handleSend, disabled: !input.trim() && !attachedFiles.length,
                    className: 'bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium disabled:opacity-40 flex-shrink-0'
                }, '\u27A4')
            )
        ),
        // ===== مودال الإرسال للفيتشر =====
        sendOpen ? React.createElement('div', {
            className: 'fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4',
            onClick: function () { if (!sendBusy) setSendOpen(false); }
        },
            React.createElement('div', {
                className: 'bg-slate-800 border border-slate-600 rounded-xl w-full max-w-md p-4 space-y-3 shadow-2xl',
                onClick: function (e) { e.stopPropagation(); }
            },
                React.createElement('p', { className: 'text-sm font-bold text-white' }, '\uD83D\uDCE4 Send agent response to feature'),
                React.createElement('p', { className: 'text-[11px] text-slate-400' }, 'The response is converted to structured items by the model, then saved into the chosen story. Update mode replaces items with the same ID.'),
                React.createElement('div', { className: 'grid grid-cols-2 gap-2' },
                    React.createElement('label', { className: 'text-[11px] text-slate-300 space-y-1' },
                        'Project',
                        React.createElement('select', {
                            className: 'w-full border border-slate-600 rounded p-1.5 text-xs bg-slate-700 text-white',
                            value: sendProj,
                            onChange: function (e) { setSendProj(e.target.value); setSendStory(''); }
                        },
                            ((acct && acct.projects) || []).map(function (pr) {
                                return React.createElement('option', { key: pr.id, value: pr.id }, pr.name);
                            })
                        )
                    ),
                    React.createElement('label', { className: 'text-[11px] text-slate-300 space-y-1' },
                        'Story',
                        React.createElement('select', {
                            className: 'w-full border border-slate-600 rounded p-1.5 text-xs bg-slate-700 text-white',
                            value: sendStory,
                            onChange: function (e) { setSendStory(e.target.value); }
                        },
                            React.createElement('option', { value: '' }, '\u2014 choose \u2014'),
                            (((acct && acct.projects) || []).find(function (x) { return x.id === sendProj; }) || { stories: [] }).stories.map(function (st) {
                                return React.createElement('option', { key: st.id || st.name, value: st.id }, st.name);
                            })
                        )
                    ),
                    React.createElement('label', { className: 'text-[11px] text-slate-300 space-y-1' },
                        'Feature',
                        React.createElement('select', {
                            className: 'w-full border border-slate-600 rounded p-1.5 text-xs bg-slate-700 text-white',
                            value: sendFeat,
                            onChange: function (e) { setSendFeat(e.target.value); }
                        },
                            React.createElement('option', { value: 'cases' }, '\u2705 Test Cases'),
                            React.createElement('option', { value: 'scenarios' }, '\uD83E\uDDEA Test Scenarios'),
                            React.createElement('option', { value: 'gaps' }, '\uD83D\uDD0D Requirement Gaps')
                        )
                    ),
                    React.createElement('label', { className: 'text-[11px] text-slate-300 space-y-1' },
                        'Mode',
                        React.createElement('select', {
                            className: 'w-full border border-slate-600 rounded p-1.5 text-xs bg-slate-700 text-white',
                            value: sendMode,
                            onChange: function (e) { setSendMode(e.target.value); }
                        },
                            React.createElement('option', { value: 'add' }, 'Add as new'),
                            React.createElement('option', { value: 'update' }, 'Update existing (same ID)')
                        )
                    )
                ),
                sendMsg ? React.createElement('p', {
                    className: 'text-[11px] ' + (sendMsg.indexOf('\u274C') === 0 ? 'text-red-400' : 'text-emerald-300')
                }, sendMsg) : null,
                React.createElement('div', { className: 'flex gap-2 justify-end' },
                    React.createElement('button', {
                        onClick: function () { if (!sendBusy) setSendOpen(false); },
                        className: 'px-3 py-1.5 rounded-lg text-xs bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }, 'Cancel'),
                    React.createElement('button', {
                        onClick: handleSendToFeature,
                        disabled: sendBusy || !sendStory || sendMsg.indexOf('\u2705') === 0,
                        className: 'px-3 py-1.5 rounded-lg text-xs bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40'
                    }, sendBusy ? '\u23F3 Sending\u2026' : '\uD83D\uDCE4 Send')
                )
            )
        ) : null
    );
}
