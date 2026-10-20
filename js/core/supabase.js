/* =====================================================================
   core/supabase.js
   طبقة السحابة: العميل + الحسابات (Auth) + المشاريع (Projects) +
   حفظ/سحب بيانات المشروع كـ snapshot. كل الدوال function declarations
   عشان تتاح لكل الملفات (نفس قاعدة helpers.js).
   ملاحظة: مفاتيح الـ API (wakil_keys / wakil_models) بتتفضل محلية
   على الجهاز ومش بتترفع للسحابة.
   ===================================================================== */

// عميل Supabase الوحيد (بيتعمل أول مرة بس ولو المفتاح متحط صح)
function sbClient() {
    if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return null;
    if (String(window.SUPABASE_ANON_KEY).includes('PASTE-')) return null;
    if (!window._sbClient) {
        try {
            window._sbClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        } catch (e) {
            console.error('Supabase init failed:', e.message);
            return null;
        }
    }
    return window._sbClient;
}
window.sbClient = sbClient;          // ضمان الوصول العام

function sbConfigured() { return !!sbClient(); }
window.sbConfigured = sbConfigured;  // ضمان الوصول العام

// ---------- Auth (كلها async بترجع { data, error }) ----------
async function sbGetSessionUser() {
    const c = sbClient();
    if (!c) return null;
    const { data, error } = await c.auth.getSession();
    if (error) return null;
    return (data && data.session && data.session.user) ? data.session.user : null;
}

async function sbSignIn(email, password) {
    const c = sbClient();
    if (!c) return { error: { message: 'Supabase not configured' } };
    const { data, error } = await c.auth.signInWithPassword({ email: String(email || '').trim(), password: String(password || '') });
    return error ? { error } : { data };
}

async function sbSignUp(email, password) {
    const c = sbClient();
    if (!c) return { error: { message: 'Supabase not configured' } };
    const { data, error } = await c.auth.signUp({ email: String(email || '').trim(), password: String(password || '') });
    return error ? { error } : { data };
}

async function sbSignOut() {
    const c = sbClient();
    if (!c) return { error: null };
    const { error } = await c.auth.signOut();
    return { error };
}

// ---------- استرجاع كلمة السر (Forgot password) ----------
// بيخلي Supabase يبعت إيميل فيه لينك استرجاع آمن (صالح ~ساعة).
// اللينك بيرجّع المستخدم على نفس المكان اللي فاتح منه التطبيق
// (GitHub Pages / localhost / أي استضافة جاية) — من غير أي تعديل مستقبلًا.
async function sbResetPassword(email) {
    const c = sbClient();
    if (!c) return { error: { message: 'Supabase not configured' } };
    const redirectTo = window.location.origin + window.location.pathname;
    const { data, error } = await c.auth.resetPasswordForEmail(String(email || '').trim(), { redirectTo });
    return error ? { error } : { data };
}

// تسجيل كلمة السر الجديدة بعد فتح لينك الاسترجاع (محتاجة جلسة الاسترجاع اللي بيتفتح بيها اللينك)
async function sbUpdatePassword(newPass) {
    const c = sbClient();
    if (!c) return { error: { message: 'Supabase not configured' } };
    const { data, error } = await c.auth.updateUser({ password: String(newPass || '') });
    return error ? { error } : { data };
}

// متابعة حالة الدخول (Sign in / Sign out في أي مكان في التطبيق يحدّث الكولباك)
// الكولباك بيستقبل (user, event) — الـ event زي SIGNED_IN / PASSWORD_RECOVERY
// (اسم حدث استرجاع كلمة السر لما المستخدم يفتح اللينك من إيميله)
function sbWatchAuth(cb) {
    const c = sbClient();
    if (!c || !c.auth || !c.auth.onAuthStateChange) return () => {};
    const { data } = c.auth.onAuthStateChange((event, session) => cb((session && session.user) || null, event));
    return () => { try { data.subscription.unsubscribe(); } catch (e) { /* ignore */ } };
}

// ---------- روابط المشاركة (قراءة فقط — LIVE) ----------
// اللينك بيفضل نفسه للأبد وبيتحدّث تلقائيًا مع كل حفظ: الزائر بيفتح أي وقت
// ويلاقي آخر نسخة محفوظة من الشغل — من غير ما المالك يعمل لينك جديد.

// الفيتشرات اللي ممكن تتشارك لوحدها جوه يوزر ستوري + مفاتيح التخزين بتاعتها
const SHARE_FEATURES = [
    { id: 'requirements', label: '📋 Requirements' },
    { id: 'gaps', label: '🔍 Requirement Gaps' },
    { id: 'scenarios', label: '🧪 Test Scenarios' },
    { id: 'cases', label: '✅ Test Cases' },
    { id: 'bugs', label: '🐞 Bugs' },
    { id: 'runs', label: '🏃 Test Runs' },
    { id: 'summary', label: '📊 Summary Report' }
];
const SHARE_FEATURE_KEYS = {
    requirements: ['wakil_req_text', 'wakil_req_files'],
    story: ['wakil_story'],
    gaps: ['wakil_gap_text', 'wakil_gap_data'],
    scenarios: ['wakil_sc_story', 'wakil_sc_data', 'wakil_linked'],
    cases: ['wakil_ai_data'],
    bugs: ['wakil_bugs'],
    runs: ['wakil_runs'],
    summary: ['wakil_gap_data', 'wakil_sc_data', 'wakil_linked', 'wakil_ai_data', 'wakil_bugs', 'wakil_runs']
};

// لينك المشاركة: نفس مكان التطبيق + ?share=<id> — يشتغل على أي استضافة من غير تعديل
function sbShareLink(shareId) {
    return window.location.origin + window.location.pathname + '?share=' + encodeURIComponent(shareId);
}

// بناء النسخة المشارَكة من payload المشروع حسب النطاق:
// project = كل القصص | story = قصة واحدة | feature = مفاتيح فيتشر واحدة من قصة
function sbBuildSharePayload(rawPay, scope, storyId, feature) {
    const pay = sbNormalizePayload(rawPay);
    if (scope === 'project') return { _v: 2, stories: pay.stories };
    const story = pay.stories.find(s => s.id === storyId) || null;
    if (!story) return null;
    if (scope === 'story') return { _v: 2, stories: [story] };
    if (scope === 'feature') {
        const keys = SHARE_FEATURE_KEYS[feature] || [];
        const data = {};
        // سياق الستوري بيسافر مع الفيتشر: نص اليوزر ستوري اللي الفيتشر تابعة له
        // عشان الزائر يشوف الفيتشر مرتبطة بمصدرها مش معزولة
        if (story.data && story.data.wakil_story != null) data.wakil_story = story.data.wakil_story;
        keys.forEach(k => { if (story.data && story.data[k] != null) data[k] = story.data[k]; });
        return { _v: 2, stories: [{ id: story.id, name: story.name, data, updated: story.updated }] };
    }
}

async function sbCreateShare({ projectId, projectName, scope, storyId, storyName, feature, featureLabel, payload }) {
    const c = sbClient();
    if (!c) return { error: { message: 'Supabase not configured' } };
    const user = await sbGetSessionUser();
    if (!user) return { error: { message: 'Not signed in' } };
    const { data, error } = await c.from('public_shares').insert({
        owner: user.id, project_id: projectId || null, project_name: projectName || null, scope,
        story_id: storyId || null, story_name: storyName || null,
        feature: feature || null, feature_label: featureLabel || null,
        payload: payload || {}
    }).select().single();
    return error ? { error } : { data };
}

// لينكات مشروع (لإدارتها: نسخ تاني / حذف = إبطال اللينك)
async function sbListShares(projectId) {
    const c = sbClient();
    if (!c) return { error: { message: 'Supabase not configured' } };
    const { data, error } = await c.from('public_shares')
        .select('id, scope, story_name, feature_label, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
    return error ? { error } : { data: data || [] };
}

// تجديد محتوى كل لينكات المشروع بآخر نسخة — بيتنادى تلقائيًا بعد كل حفظ
// (ده اللي بيخلّي اللينك live). لو ستوري مشترَكة اتمسحت ⇒ لينكها يتلغي لوحده.
async function sbRefreshProjectShares(projectId, pay) {
    try {
        const c = sbClient();
        if (!c || !projectId || !pay) return;
        const { data: shares } = await c.from('public_shares')
            .select('id, scope, story_id, story_name, feature')
            .eq('project_id', projectId);
        if (!shares || !shares.length) return;
        for (const s of shares) {
            const payload = sbBuildSharePayload(pay, s.scope, s.story_id, s.feature);
            if (!payload) { await c.from('public_shares').delete().eq('id', s.id); continue; }
            const st = payload.stories && payload.stories[0];
            await c.from('public_shares').update({
                payload,
                story_name: (s.scope !== 'project' && st && st.name) ? st.name : s.story_name
            }).eq('id', s.id);
        }
    } catch (e) { /* تجديد اللينكات ممنوع يبوّظ الحفظ أبدًا */ }
}

// حذف اللينك = إبطاله فورًا (أي حد يفتحه بعدها هيلاقي "اللينك ملغي")
async function sbDeleteShare(shareId) {
    const c = sbClient();
    if (!c) return { error: { message: 'Supabase not configured' } };
    const { error } = await c.from('public_shares').delete().eq('id', shareId);
    return { error };
}

// قراءة اللينك — عامة عن قصد: بتشتغل من غير تسجيل دخول (سياسة RLS: select للكل)
async function sbGetShare(shareId) {
    const c = sbClient();
    if (!c) return { error: { message: 'Supabase not configured' } };
    const { data, error } = await c.from('public_shares').select('*').eq('id', String(shareId || '').trim()).maybeSingle();
    return error ? { error } : { data };
}

// -----------------------------------------------------------------
// NEW HELPERS: move scenario / test case within a story
// -----------------------------------------------------------------
// NOTE: 1️⃣▸ project_snapshot -> stories[...].data  (JSON strings)
//        2️⃣▸ we operate on a single story only, *not* across stories.
//        3️⃣▸ Each feature’s data key: `wakil_<feature>_data`
//        4️⃣▸ Scenario data lives usually in `wakil_sc_data` for the feature
//        5️⃣▸ Test‑case data lives usually in `wakil_ai_data` for the feature
//        6️⃣▸ We simply serialize‑deserialize JSON, splice, and write back.

async function moveScenario(projectId, storyId, sourceFeature, targetFeature, scenarioId) {
  try {
    // 1. read current snapshot
    const { data, error: fetchErr } = await sbClient()
      .from('project_snapshots')
      .select('payload')
      .eq('project_id', projectId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!data) throw new Error('No snapshot for this project');
    const payload = _acctParse(data.payload, {});
    const story = payload.stories.find(s => s.id === storyId);
    if (!story) throw new Error(`Story ${storyId} not found`);

    const srcKey = `wakil_${sourceFeature}_data`;
    const tgtKey = `wakil_${targetFeature}_data`;
    const srcObj = story.data && story.data[srcKey] ? JSON.parse(story.data[srcKey]) : {};
    const tgtObj = story.data && story.data[tgtKey] ? JSON.parse(story.data[tgtKey]) : {};

    const srcScenarios = srcObj.scenarios || srcObj.sc_data || srcObj.wakil_sc_data || [];
    const foundIdx = srcScenarios.findIndex(s => s.id === scenarioId);
    if (foundIdx === -1) throw new Error(`Scenario ${scenarioId} not in ${sourceFeature}`);
    const [moved] = srcScenarios.splice(foundIdx, 1);
    const tgtScenarios = tgtObj.scenarios || tgtObj.sc_data || tgtObj.wakil_sc_data || [];
    tgtScenarios.push(moved);
    srcObj.scenarios = srcScenarios;
    tgtObj.scenarios = tgtScenarios;
    story.data[srcKey] = JSON.stringify(srcObj);
    story.data[tgtKey] = JSON.stringify(tgtObj);

    // 2. write back
    const { error: updErr } = await sbClient()
      .from('project_snapshots')
            .update({ payload: payload, updated_at: new Date().toISOString() })
      .eq('project_id', projectId);
    if (updErr) throw updErr;
    return { ok: true, story };
  } catch (e) {
    return { ok: false, error: e.message || e.toString() };
  }
}

async function moveTestCase(projectId, storyId, sourceFeature, targetFeature, testCaseId) {
  try {
    const { data, error: fetchErr } = await sbClient()
      .from('project_snapshots')
      .select('payload')
      .eq('project_id', projectId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!data) throw new Error('No snapshot for this project');
    const payload = _acctParse(data.payload, {});
    const story = payload.stories.find(s => s.id === storyId);
    if (!story) throw new Error(`Story ${storyId} not found`);

    const srcKey = `wakil_${sourceFeature}_data`;
    const tgtKey = `wakil_${targetFeature}_data`;
    const srcObj = story.data && story.data[srcKey] ? JSON.parse(story.data[srcKey]) : {};
    const tgtObj = story.data && story.data[tgtKey] ? JSON.parse(story.data[tgtKey]) : {};

    const srcCases = srcObj.scenarios || srcObj.sc_data || srcObj.wakil_ai_data || [];
    const foundIdx = srcCases.findIndex(c => c.id === testCaseId);
    if (foundIdx === -1) throw new Error(`Test case ${testCaseId} not in ${sourceFeature}`);
    const [moved] = srcCases.splice(foundIdx, 1);
    const tgtCases = tgtObj.scenarios || tgtObj.sc_data || tgtObj.wakil_ai_data || [];
    tgtCases.push(moved);
    srcObj.scenarios = srcCases;
    tgtObj.scenarios = tgtCases;
    story.data[srcKey] = JSON.stringify(srcObj);
    story.data[tgtKey] = JSON.stringify(tgtObj);

    const { error: updErr } = await sbClient()
      .from('project_snapshots')
            .update({ payload: payload, updated_at: new Date().toISOString() })
      .eq('project_id', projectId);
    if (updErr) throw updErr;
    return { ok: true, story };
  } catch (e) {
    return { ok: false, error: e.message || e.toString() };
  }
}

// ---------- سياق الحساب للأيجنت (قراءة فقط — محصور بمالك الحساب) ----------
// الأمان على مستوى قاعدة البيانات نفسها: RLS على projects و project_snapshots
// (auth.uid() = owner) معناه أي استعلام من الجلسة الحالية بيرجع مشاريع صاحب
// الحساب المفتوح هو بس — مستحيل يوصل لداتا حساب تاني حتى لو اتسأل عنها بالاسم.
// الأيجنت بيبعت السياق ده للموديل كـ"المعرفة الوحيدة" عن مشاريع المستخدم.
var _acctCtxCache = null; // { at, val } — كاش 30 ثانية عشان كل رسالة ماتجيبش من السحابة

function _acctParse(v, fb) { try { const x = (typeof v === 'string') ? JSON.parse(v) : v; return x ?? fb; } catch (e) { return fb; } }
function _acctList(v) { return Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : []; }

// أرقام فيتشرز ستوري واحدة من داتا الـ wakil_* (نفس منطق حسابات Summary Report)
function sbAccountStoryStats(d) {
    d = d || {};
    const bugs = _acctList(_acctParse(d.wakil_bugs, []));
    const sc = _acctList(_acctParse(d.wakil_sc_data, []));
    const linked = _acctList(_acctParse(d.wakil_linked, []));
    const ai = d.wakil_ai_data ? _acctParse(d.wakil_ai_data, null) : null;
    const gap = d.wakil_gap_data ? _acctParse(d.wakil_gap_data, null) : null;
    const scenIds = new Set();
    [...sc, ...linked, ..._acctList(ai && ai.scenarios)].forEach(s => { if (s && s.id) scenIds.add(s.id); });
    const gaps = gap
        ? _acctList(gap.sections).reduce((a, s) => a.concat(_acctList(s && s.gaps)), []).concat(_acctList(gap.cross))
        : [];
    return {
        bugs: bugs.length,
        bugsOpen: bugs.filter(b => b.status !== 'Closed' && b.status !== 'Rejected').length,
        bugsCritical: bugs.filter(b => b.severity === 'Critical').length,
        scenarios: scenIds.size,
        cases: _acctList(ai && ai.testCases).length,
        runs: _acctList(_acctParse(d.wakil_runs, [])).length,
        gaps: gaps.length,
        gapsOpen: gaps.filter(g => g.status === 'Open').length
    };
}

function _acctCut(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '…' : s; }

// فهرس مختصر (IDs + عناوين) — موجود دايمًا في سياق الأيجنت عشان الموديل يعرف
// إن العناصر دي موجودة فعلًا ويرجع بيها بدل ما يقول "مش مسموح/مش موجود"
function sbAccountStoryIndex(d) {
    d = d || {};
    const bugs = _acctList(_acctParse(d.wakil_bugs, []));
    const sc = _acctList(_acctParse(d.wakil_sc_data, []));
    const linked = _acctList(_acctParse(d.wakil_linked, []));
    const ai = d.wakil_ai_data ? _acctParse(d.wakil_ai_data, null) : null;
    const gap = d.wakil_gap_data ? _acctParse(d.wakil_gap_data, null) : null;
    const runs = _acctList(_acctParse(d.wakil_runs, []));
    const scenIds = new Set();
    [...sc, ...linked, ..._acctList(ai && ai.scenarios)].forEach(s => { if (s && s.id) scenIds.add(s.id); });
    const scen = [...sc, ...linked, ..._acctList(ai && ai.scenarios)].filter((s, i, arr) => s && s.id && scenIds.has(s.id) && arr.findIndex(x => x && x.id === s.id) === i);
    const gaps = gap ? _acctList(gap.sections).reduce((a, s) => a.concat(_acctList(s && s.gaps)), []).concat(_acctList(gap.cross)) : [];
    return {
        cases: _acctList(ai && ai.testCases).map(tc => ({ id: (tc && tc.id) || '—', title: _acctCut(tc && tc.title, 90) })),
        scenarios: scen.map(s => ({ id: s.id || '—', title: _acctCut(s.title, 90) })),
        gaps: gaps.map(g => ({ id: (g && g.id) || '—', desc: _acctCut(g && g.description, 90) })),
        bugs: bugs.map(b => ({ id: (b && b.id) || '—', title: _acctCut(b && b.title, 80), severity: (b && b.severity) || '', status: (b && b.status) || '' })),
        runs: runs.map(r => ({ id: (r && r.id) || '—', name: _acctCut(r && r.name, 60), date: (r && r.date) || '' }))
    };
}

// المحتوى الكامل للعناصر (نصوص/خطوات/نتايج) — بيتحمل مع السياق والسياق بيقرر يعرضه امتى
// (لما المستخدم يطلب "هات الكيس/السيناريو/الجاب رقم كذا أو هاتهم كلهم" أو يحلل)
function sbAccountStoryItems(d) {
    d = d || {};
    const bugs = _acctList(_acctParse(d.wakil_bugs, []));
    const sc = _acctList(_acctParse(d.wakil_sc_data, []));
    const linked = _acctList(_acctParse(d.wakil_linked, []));
    const ai = d.wakil_ai_data ? _acctParse(d.wakil_ai_data, null) : null;
    const gap = d.wakil_gap_data ? _acctParse(d.wakil_gap_data, null) : null;
    const runs = _acctList(_acctParse(d.wakil_runs, []));
    const allSc = [...sc, ...linked, ..._acctList(ai && ai.scenarios)];
    const scenIds = new Set();
    allSc.forEach(s => { if (s && s.id) scenIds.add(s.id); });
    const scen = allSc.filter(s => s && s.id && scenIds.has(s.id)).filter((s, i, arr) => arr.findIndex(x => x && x.id === s.id) === i);
    const gaps = gap ? _acctList(gap.sections).reduce((a, s) => a.concat(_acctList(s && s.gaps)), []).concat(_acctList(gap.cross)) : [];
    return {
        reqText: _acctCut(d.wakil_req_text || d.wakil_story || '', 1500),
        cases: _acctList(ai && ai.testCases).map(tc => ({
            id: (tc && tc.id) || '—', title: _acctCut(tc && tc.title, 300), type: (tc && tc.type) || '', priority: (tc && tc.priority) || '',
            technique: _acctCut(tc && tc.technique, 120), scenarioId: (tc && tc.scenarioId) || '',
            preCondition: _acctCut(tc && tc.preCondition, 300), testData: _acctCut(tc && tc.testData, 300),
            steps: _acctList(tc && tc.steps).slice(0, 20).map(s => _acctCut(s, 300)),
            expected: _acctCut(tc && tc.expected, 500)
        })),
        scenarios: scen.map(s => ({ id: s.id || '—', title: _acctCut(s.title, 300), type: (s && s.type) || '', priority: (s && s.priority) || '' })),
        gaps: gaps.map(g => ({ id: (g && g.id) || '—', description: _acctCut(g && g.description, 400), priority: (g && g.priority) || '', status: (g && g.status) || '' })),
        bugs: bugs.map(b => ({
            id: (b && b.id) || '—', title: _acctCut(b && b.title, 300), severity: (b && b.severity) || '', priority: (b && b.priority) || '', status: (b && b.status) || '',
            module: _acctCut(b && b.module, 120), testCaseId: (b && b.testCaseId) || '',
            steps: _acctCut(b && b.steps, 500), expected: _acctCut(b && b.expected, 300), actual: _acctCut(b && b.actual, 300)
        })),
        runs: runs.map(r => {
            const res = (r && r.results && typeof r.results === 'object' && !Array.isArray(r.results)) ? r.results : {};
            return {
                id: (r && r.id) || '—', name: _acctCut(r && r.name, 100), date: (r && r.date) || '', build: _acctCut(r && r.build, 60),
                results: Object.entries(res).slice(0, 80).map(([k, v]) => String(k).split('::')[0] + ':' + v).join(', ')
            };
        })
    };
}

function _acctSumStats(stories) {
    const out = { stories: stories.length, bugs: 0, bugsOpen: 0, bugsCritical: 0, scenarios: 0, cases: 0, runs: 0, gaps: 0, gapsOpen: 0 };
    stories.forEach(s => { Object.keys(out).forEach(k => { if (k !== 'stories') out[k] += s[k] || 0; }); });
    return out;
}

// بيقرا مشاريع صاحب الجلسة + snapshot كل مشروع ويجمع أرقامه.
// force=true يتجاهل الكاش (بيتنادى عند فتح صفحة الأيجنت).
async function sbGetAccountContext(force) {
    const c = sbClient();
    if (!c) return null;
    const user = await sbGetSessionUser();
    if (!user) return null;
    if (!force && _acctCtxCache && (Date.now() - _acctCtxCache.at) < 30000) return _acctCtxCache.val;
    const { data: projs, error } = await c.from('projects').select('id, name, owner, created_at').order('created_at', { ascending: true });
    if (error) return null;
    // فلترة دفاعية فوق الـ RLS: مشاريع صاحب الجلسة فقط
    const mine = (projs || []).filter(p => p && p.owner === user.id);
    let snaps = [];
    if (mine.length) {
        const { data: ss } = await c.from('project_snapshots')
            .select('project_id, payload, updated_at')
            .in('project_id', mine.map(p => p.id));
        snaps = ss || [];
    }
    const projects = mine.map(p => {
        const snap = snaps.find(s => s && s.project_id === p.id);
        const stories = _acctList(snap ? _acctParse(snap.payload, {}).stories : [])
            .map(st => {
                const stData = (st && st.data) || {};
                return {
                    id: (st && st.id) || '',
                    name: (st && st.name) || 'Story',
                    ...sbAccountStoryStats(stData),
                    index: sbAccountStoryIndex(stData),
                    items: sbAccountStoryItems(stData)
                };
            });
        return { id: p.id, name: p.name || 'Project', savedAt: (snap && snap.updated_at) || null, stories, totals: _acctSumStats(stories) };
    });
    const val = {
        email: user.email || String(user.id || ''),
        projects,
        totals: projects.reduce((a, p) => {
            Object.keys(p.totals).forEach(k => { a[k] = (a[k] || 0) + p.totals[k]; });
            return a;
        }, {}),
        fetchedAt: new Date().toISOString()
    };
    _acctCtxCache = { at: Date.now(), val };
    return val;
}

// ---------- إعادة الترقيم التسلسلي لعناصر الستوري بعد أي إضافة/إرسال ----------
// بيخلي الأرقام مستمرة من 1 (TC-01.. / TS-01.. / GAP-001..) حتى لو كانت فيه حذفات قديمة،
// وبيحدّث كل المراجع عشان اللينكات متبقاش مكسورة: scenarioId في الكيسز، testCaseId
// في الباجز، ومفاتيح نتايج الجولات (scenarioId::tcId). d = كائن wakil_* بقيم JSON strings.
function sbRenumberStoryData(d) {
    try {
        d = (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
        // undefined = المفتاح مش موجود (متيتكتبش) | null = موجود بس مش JSON سليم (متيتكتبش — حماية من المسح)
        const okArr = (key) => {
            if (d[key] == null || d[key] === '') return null;
            const x = _acctParse(d[key], null);
            return Array.isArray(x) ? x.filter(i => i && typeof i === 'object') : undefined;
        };
        const scO = okArr('wakil_sc_data');
        const linkedO = okArr('wakil_linked');
        const bugsO = okArr('wakil_bugs');
        const runsO = okArr('wakil_runs');
        const aiO = (() => {
            if (d.wakil_ai_data == null || d.wakil_ai_data === '') return null;
            const x = _acctParse(d.wakil_ai_data, null);
            return (x && typeof x === 'object' && !Array.isArray(x)) ? x : undefined;
        })();
        const gapO = (() => {
            if (d.wakil_gap_data == null || d.wakil_gap_data === '') return null;
            const x = _acctParse(d.wakil_gap_data, null);
            return (x && typeof x === 'object' && !Array.isArray(x)) ? x : undefined;
        })();

        // 1) السيناريوهات: ترقيم بترتيب الظهور (sc ثم linked ثم ai.scenarios) — المكرر بين القوائم ياخد نفس الرقم
        const scenMap = {}, caseMap = {};
        let n = 0;
        const walkScen = (list) => list.forEach(s => {
            if (!s || typeof s !== 'object') return;
            const oldId = String(s.id || '');
            if (oldId && scenMap[oldId]) { s.id = scenMap[oldId]; return; }
            n++;
            const newId = 'TS-' + String(n).padStart(2, '0');
            if (oldId) scenMap[oldId] = newId;
            s.id = newId;
        });
        if (Array.isArray(scO)) walkScen(scO);
        if (Array.isArray(linkedO)) walkScen(linkedO);
        const aiScen = (aiO && Array.isArray(aiO.scenarios)) ? aiO.scenarios.filter(x => x && typeof x === 'object') : [];
        if (aiO) walkScen(aiScen);

        // 2) الكيسز: TC-01.. + تصحيح scenarioId (المرجع الميت بيتشال)
        let m = 0;
        const aiCases = (aiO && Array.isArray(aiO.testCases)) ? aiO.testCases.filter(x => x && typeof x === 'object') : [];
        aiCases.forEach(tc => {
            const oldId = String(tc.id || '');
            m++;
            const newId = 'TC-' + String(m).padStart(2, '0');
            if (oldId) caseMap[oldId] = newId;
            tc.id = newId;
            tc.scenarioId = scenMap[String(tc.scenarioId || '')] || '';
        });

        // 3) الباجز: testCaseId بيتحدّث بالترقيم الجديد (اللي مالقاش مرجعه بيفضل زي ما هو)
        if (Array.isArray(bugsO)) bugsO.forEach(b => {
            if (!b || typeof b !== 'object' || !b.testCaseId) return;
            b.testCaseId = caseMap[String(b.testCaseId)] || b.testCaseId;
        });

        // 4) الجولات: مفاتيح النتايج scenarioId::tcId بتعدي بخريطة الترقيم
        if (Array.isArray(runsO)) runsO.forEach(r => {
            if (!r || typeof r !== 'object' || !r.results || typeof r.results !== 'object' || Array.isArray(r.results)) return;
            const out = {};
            Object.keys(r.results).forEach(k => {
                const parts = String(k).split('::');
                if (parts.length === 2) out[(scenMap[parts[0]] || parts[0]) + '::' + (caseMap[parts[1]] || parts[1])] = r.results[k];
                else out[k] = r.results[k];
            });
            r.results = out;
        });

        // 5) الجابز: GAP-001.. بترتيب (sections ثم cross)
        if (gapO) {
            let g = 0;
            const renumGap = (x) => { if (!x || typeof x !== 'object') return; g++; x.id = 'GAP-' + String(g).padStart(3, '0'); };
            (Array.isArray(gapO.sections) ? gapO.sections : []).forEach(sec => (Array.isArray(sec && sec.gaps) ? sec.gaps : []).forEach(renumGap));
            (Array.isArray(gapO.cross) ? gapO.cross : []).forEach(renumGap);
        }

        // كتابة النتايج (المفاتيح غير السليمة/غير الموجودة بتتفضل زي ما هي)
        if (aiO) { aiO.testCases = aiCases; aiO.scenarios = aiScen; d.wakil_ai_data = JSON.stringify(aiO); }
        if (Array.isArray(scO)) d.wakil_sc_data = JSON.stringify(scO);
        if (Array.isArray(linkedO)) d.wakil_linked = JSON.stringify(linkedO);
        if (Array.isArray(bugsO)) d.wakil_bugs = JSON.stringify(bugsO);
        if (Array.isArray(runsO)) d.wakil_runs = JSON.stringify(runsO);
        if (gapO) d.wakil_gap_data = JSON.stringify(gapO);
        return d;
    } catch (e) { return d; }
}

// ---------- إرسال عناصر من الأيجنت لفيتشر في ستوري (كتابة في snapshot المشروع) ----------
// بيتنادى من صفحة الأيجنت لما المستخدم يبعت رد الأيجنت كـTest Cases أو Test Scenarios.
// الستوري المفتوح حاليًا ماشي في مسار تاني (localStorage + حدث) عشان الـ auto-save
// مايلغيش الكتابة — دي لستوريات مش مفتوحة محليًا.
// الأمان: RLS على project_snapshots ⇒ قراءة/كتابة مالك المشروع فقط.
async function sbSendAgentItems(opts) {
    try {
        const c = sbClient();
        if (!c) return { error: 'Supabase not configured' };
        const user = await sbGetSessionUser();
        if (!user) return { error: 'Not signed in' };
        const { data, error: fetchErr } = await c.from('project_snapshots')
            .select('payload').eq('project_id', opts.projectId).maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!data) return { error: 'Project not found in your account' };
        const payload = _acctParse(data.payload, {});
        const story = _acctList(payload.stories).find(s => s && s.id === opts.storyId);
        if (!story) return { error: 'Story not found in this project' };
        story.data = (story.data && typeof story.data === 'object' && !Array.isArray(story.data)) ? story.data : {};
        let added = 0, updated = 0;
        if (opts.feature === 'cases') {
            const ai = _acctParse(story.data.wakil_ai_data, null);
            const suite = (ai && typeof ai === 'object' && !Array.isArray(ai)) ? ai : {};
            const cases = _acctList(suite.testCases);
            const scenIds = new Set(_acctList(suite.scenarios).map(s => s && s.id));
            let maxN = 0;
            cases.forEach(tc => { const m = /^[A-Za-z]+-(\d+)$/.exec(String((tc && tc.id) || '')); if (m) maxN = Math.max(maxN, parseInt(m[1], 10)); });
            _acctList(opts.items).forEach(it => {
                if (!it || !String(it.title || '').trim()) return;
                const clean = {
                    id: String(it.id || '').trim(),
                    title: String(it.title).trim(),
                    type: ['Positive', 'Negative', 'Edge Case'].indexOf(it.type) !== -1 ? it.type : 'Positive',
                    priority: ['Critical', 'High', 'Medium', 'Low'].indexOf(it.priority) !== -1 ? it.priority : 'Medium',
                    technique: String(it.technique || ''),
                    preCondition: String(it.preCondition || ''),
                    testData: String(it.testData || ''),
                    steps: _acctList(it.steps).map(s => String(s)),
                    expected: String(it.expected || ''),
                    scenarioId: scenIds.has(String(it.scenarioId || '').trim()) ? String(it.scenarioId).trim() : ''
                };
                const idx = clean.id ? cases.findIndex(tc => tc && String(tc.id) === clean.id) : -1;
                if (opts.mode === 'update' && idx !== -1) { cases[idx] = Object.assign({}, cases[idx], clean); updated++; }
                else {
                    if (!clean.id || cases.some(tc => tc && tc.id === clean.id)) { maxN++; clean.id = 'TC-' + String(maxN).padStart(2, '0'); }
                    cases.push(clean); added++;
                }
            });
            suite.testCases = cases;
            if (!Array.isArray(suite.scenarios)) suite.scenarios = _acctList(suite.scenarios);
            story.data.wakil_ai_data = JSON.stringify(suite);
        } else if (opts.feature === 'scenarios') {
            const sc = _acctList(_acctParse(story.data.wakil_sc_data, []));
            let maxN = 0;
            sc.forEach(s => { const m = /^[A-Za-z]+-(\d+)$/.exec(String((s && s.id) || '')); if (m) maxN = Math.max(maxN, parseInt(m[1], 10)); });
            _acctList(opts.items).forEach(it => {
                if (!it || !String(it.title || '').trim()) return;
                const clean = {
                    id: String(it.id || '').trim(),
                    title: String(it.title).trim(),
                    type: ['Positive', 'Negative', 'Edge Case'].indexOf(it.type) !== -1 ? it.type : 'Positive',
                    priority: ['Critical', 'High', 'Medium', 'Low'].indexOf(it.priority) !== -1 ? it.priority : 'Medium'
                };
                const idx = clean.id ? sc.findIndex(s => s && String(s.id) === clean.id) : -1;
                if (opts.mode === 'update' && idx !== -1) { sc[idx] = Object.assign({}, sc[idx], clean); updated++; }
                else {
                    if (!clean.id || sc.some(s => s && s.id === clean.id)) { maxN++; clean.id = 'TS-' + String(maxN).padStart(2, '0'); }
                    sc.push(clean); added++;
                }
            });
            story.data.wakil_sc_data = JSON.stringify(sc);
        } else if (opts.feature === 'gaps') {
            // نفس قاعدة الإضافة اليدوية في صفحة Requirement Gaps: الثغرات الجاية بتتسجل في cross
            const gap = _acctParse(story.data.wakil_gap_data, null);
            const gd = (gap && typeof gap === 'object' && !Array.isArray(gap)) ? gap : { sections: [], cross: [], createdAt: '' };
            if (!Array.isArray(gd.sections)) gd.sections = [];
            if (!Array.isArray(gd.cross)) gd.cross = [];
            _acctList(opts.items).forEach(it => {
                if (!it || !String(it.description || '').trim()) return;
                const clean = {
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
                const idx = clean.id ? gd.cross.findIndex(g => g && String(g.id) === clean.id) : -1;
                if (opts.mode === 'update' && idx !== -1) { gd.cross[idx] = Object.assign({}, gd.cross[idx], clean); updated++; }
                else { gd.cross.push(clean); added++; }
            });
            story.data.wakil_gap_data = JSON.stringify(gd);
        } else return { error: 'Unsupported feature' };
        // إعادة الترقيم التسلسلي (TC/TS/GAP من 1) + تصحيح كل المراجع بعد أي إضافة/تحديث
        sbRenumberStoryData(story.data);
        const { error: updErr } = await c.from('project_snapshots')
            .update({ payload: payload, updated_at: new Date().toISOString() })
            .eq('project_id', opts.projectId);
        if (updErr) throw updErr;
        // اللينكات المشتركة live: بتتحدّث بآخر نسخة بعد أي كتابة (نفس ما بيحصل بعد كل حفظ)
        sbRefreshProjectShares(opts.projectId, payload);
        return { ok: true, added, updated };
    } catch (e) {
        return { error: (e && e.message) || String(e) };
    }
}

// ---------- Projects ----------
async function sbListProjects() {
    const c = sbClient();
    if (!c) return { error: { message: 'Supabase not configured' } };
    const { data, error } = await c
        .from('projects')
        .select('id, name, created_at, project_snapshots(updated_at)')
        .order('created_at', { ascending: false });
    if (error) return { error };
    const list = (data || []).map(p => ({
        id: p.id,
        name: p.name,
        created_at: p.created_at,
        savedAt: (p.project_snapshots && p.project_snapshots[0] && p.project_snapshots[0].updated_at) || null
    }));
    return { data: list };
}

async function sbCreateProject(name) {
    const c = sbClient();
    if (!c) return { error: { message: 'Supabase not configured' } };
    // الـ owner لازم يتكتب مع الصف عشان سياسة الـ RLS (auth.uid() = owner)
    const user = await sbGetSessionUser();
    if (!user) return { error: { message: 'Not signed in' } };
    const { data, error } = await c.from('projects').insert({ name: String(name || '').trim(), owner: user.id }).select().single();
    return error ? { error } : { data };
}

async function sbRenameProject(id, name) {
    const c = sbClient();
    if (!c) return { error: { message: 'Supabase not configured' } };
    const { data, error } = await c.from('projects').update({ name: String(name || '').trim() }).eq('id', id).select().single();
    return error ? { error } : { data };
}

// الحذف بيتمسح معاه الـ snapshot تلقائيًا (on delete cascade)
async function sbDeleteProject(id) {
    const c = sbClient();
    if (!c) return { error: { message: 'Supabase not configured' } };
    const { error } = await c.from('projects').delete().eq('id', id);
    return { error };
}

// ---------- Snapshot: كل بيانات الشغل المحلية في jsonb واحد ----------
// مفاتيح تتفضل محلية على الجهاز (سرية): مفاتيح الـ API والموديلات
function sbWorkspaceDump() {
    const skip = { wakil_keys: 1, wakil_models: 1, wakil_cloud_project: 1, wakil_last_page: 1 };
    const dump = {};
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        // مفاتيح اختيار الموديل (wakil_model_*) وحالة المزوّدين الواقفين (wakil_provider_down_*)
        // وتعريفات المزوّدات المخصصة (wakil_custom_providers) — كلها تفضيلات جهاز زي مفاتيح الـ API
        if (k && k.startsWith('wakil_') && !skip[k] && !k.startsWith('wakil_model_') && !k.startsWith('wakil_provider_down_') && !k.startsWith('wakil_auto_') && k !== 'wakil_custom_providers' && k !== 'wakil_cloud_story') dump[k] = localStorage.getItem(k);
    }
    return dump;
}

function sbWorkspaceApply(dump) {
    Object.keys(dump || {}).forEach(k => {
        if (k === 'wakil_keys' || k === 'wakil_models' || k === 'wakil_cloud_project') return;
        try { localStorage.setItem(k, dump[k]); } catch (e) { /* quota */ }
    });
}

function sbWorkspaceReplace(dump) {
    Object.keys(sbWorkspaceDump()).forEach(k => localStorage.removeItem(k));
    sbWorkspaceApply(dump);
    window._sbLastSyncedFingerprint = _sbFingerprint();
    window.dispatchEvent(new Event('vetly_feature_data_changed'));
}

// تفريغ الشغل المحلي بالكامل (كل الميزات تفضى) — بيستخدم عند التبديل بين المشاريع
// عشان كل مشروع يبقى عالم منفصل. مفاتيح الجهاز فقط (مفاتيح API + الثيم + اللغة) بتتفضل.
function sbWorkspaceClear() {
    const keep = { wakil_keys: 1, wakil_models: 1, wakil_cloud_project: 1, wakil_cloud_story: 1, wakil_last_page: 1 };
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('wakil_') && !keep[k] && !k.startsWith('wakil_model_') && !k.startsWith('wakil_provider_down_') && !k.startsWith('wakil_auto_') && k !== 'wakil_custom_providers' && k !== 'wakil_cloud_story') toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
}

// ---------- Snapshot v2: قصص المستخدم (User Stories) جوه المشروع ----------
// صيغة الـ payload: { _v: 2, stories: [{ id, name, data: {wakil_*: ...}, updated }], activeStory }
// الصيغة القديمة (بيانات مباشرة) بتتحول تلقائيًا لقصة واحدة أول ما تتقرا — من غير أي خطوة من المستخدم.
function sbNormalizePayload(raw) {
    const pay = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    if (pay._v === 2 && Array.isArray(pay.stories)) return pay;
    const hasData = Object.keys(pay).some(k => k.startsWith('wakil_'));
    if (!hasData) return { _v: 2, stories: [], activeStory: null };
    const story = { id: 'story-' + Date.now().toString(36), name: 'Story 1', data: pay, updated: null };
    return { _v: 2, stories: [story], activeStory: story.id };
}

// قفل التبديل: أثناء فتح/إنشاء قصة (فضي ← تحميل) الحفظ التلقائي يقف عشان ما يكتبش
// الفراغ المؤقت فوق داتا القصة القديمة في السحابة. الـ reload بيفك القفل تلقائيًا.
function sbSwitchLock(on) { window._sbSwitching = !!on; }

function sbSnapshotVersion(projectId) {
    if (!window._sbSnapshotVersions) window._sbSnapshotVersions = {};
    return window._sbSnapshotVersions[projectId] || null;
}

function sbSetSnapshotVersion(projectId, version) {
    if (!window._sbSnapshotVersions) window._sbSnapshotVersions = {};
    window._sbSnapshotVersions[projectId] = version || null;
}

function sbNextSnapshotVersion(remoteVersion) {
    const parsedVersion = remoteVersion ? Date.parse(remoteVersion) : 0;
    const nextMillis = Number.isFinite(parsedVersion) ? Math.max(Date.now(), parsedVersion + 1) : Date.now();
    return new Date(nextMillis).toISOString();
}

function sbPendingSnapshotKey(projectId, storyId) {
    return 'vetly_pending_snapshot:' + projectId + ':' + storyId;
}

function sbQueueSnapshot(projectId, storyOpen, data, baseVersion) {
    const pending = {
        projectId,
        storyId: storyOpen.id,
        storyName: storyOpen.name || 'Story',
        data: data || sbWorkspaceDump(),
        baseVersion: baseVersion === undefined ? sbSnapshotVersion(projectId) : baseVersion,
        queuedAt: new Date().toISOString()
    };
    try {
        localStorage.setItem(sbPendingSnapshotKey(projectId, storyOpen.id), JSON.stringify(pending));
        return { error: null, pending: true };
    } catch (e) {
        return { error: { message: 'Could not queue offline changes in this browser: ' + e.message } };
    }
}

async function sbSaveSnapshot(projectId, queuedSnapshot) {
    const c = sbClient();
    if (!c) return { error: { message: 'Supabase not configured' } };
    const user = await sbGetSessionUser();
    if (!user) return { error: { message: 'Not signed in' } };
    const storyOpen = queuedSnapshot
        ? { id: queuedSnapshot.storyId, name: queuedSnapshot.storyName }
        : sbGetOpenStory();
    if (!storyOpen || !storyOpen.id) return { error: null };
    if (navigator.onLine === false) {
        return sbQueueSnapshot(projectId, storyOpen, queuedSnapshot && queuedSnapshot.data, queuedSnapshot && queuedSnapshot.baseVersion);
    }
    let snapshotResult;
    try {
        snapshotResult = await c.from('project_snapshots')
            .select('payload, updated_at').eq('project_id', projectId).maybeSingle();
    } catch (e) {
        if (/fetch|network|offline|load failed/i.test(String(e.message || '')) || navigator.onLine === false) {
            return sbQueueSnapshot(projectId, storyOpen, queuedSnapshot && queuedSnapshot.data, queuedSnapshot && queuedSnapshot.baseVersion);
        }
        return { error: e };
    }
    const { data, error: readError } = snapshotResult;
    if (readError) {
        if (/fetch|network|offline|load failed/i.test(String(readError.message || ''))) {
            return sbQueueSnapshot(projectId, storyOpen, queuedSnapshot && queuedSnapshot.data, queuedSnapshot && queuedSnapshot.baseVersion);
        }
        return { error: readError };
    }
    const expectedVersion = queuedSnapshot ? queuedSnapshot.baseVersion : sbSnapshotVersion(projectId);
    const remoteVersion = data && data.updated_at || null;
    if ((expectedVersion && remoteVersion !== expectedVersion) || (!expectedVersion && remoteVersion)) {
        return { error: { message: 'Cloud data changed in another browser. Reload the story before saving to avoid overwriting newer changes.', conflict: true } };
    }
    if (expectedVersion && !remoteVersion) {
        return { error: { message: 'The cloud snapshot was removed in another session. Reload the project before saving.', conflict: true } };
    }
    const pay = sbNormalizePayload(data && data.payload);
    let story = pay.stories.find(s => s.id === storyOpen.id);
    if (!story) {
        story = { id: storyOpen.id, name: storyOpen.name || 'Story', data: {} };
        pay.stories.push(story);
    }
    if (storyOpen.name) story.name = storyOpen.name;
    story.data = queuedSnapshot ? queuedSnapshot.data : sbWorkspaceDump();
    story.updated = new Date().toISOString();
    pay.activeStory = story.id;
    const updatedAt = sbNextSnapshotVersion(remoteVersion);
    let writeResult;
    try {
        if (remoteVersion) {
            writeResult = await c.from('project_snapshots')
                .update({ owner: user.id, payload: pay, updated_at: updatedAt })
                .eq('project_id', projectId).eq('updated_at', remoteVersion)
                .select('updated_at').maybeSingle();
            if (!writeResult.error && !writeResult.data) {
                return { error: { message: 'Cloud data changed while saving. Reload the story to avoid overwriting newer changes.', conflict: true } };
            }
        } else {
            writeResult = await c.from('project_snapshots').insert({
                project_id: projectId, owner: user.id, payload: pay, updated_at: updatedAt
            }).select('updated_at').maybeSingle();
        }
    } catch (e) {
        if (/fetch|network|offline|load failed/i.test(String(e.message || '')) || navigator.onLine === false) {
            return sbQueueSnapshot(projectId, storyOpen, queuedSnapshot && queuedSnapshot.data, queuedSnapshot && queuedSnapshot.baseVersion);
        }
        return { error: e };
    }
    if (writeResult.error) {
        if (/fetch|network|offline|load failed/i.test(String(writeResult.error.message || ''))) {
            return sbQueueSnapshot(projectId, storyOpen, queuedSnapshot && queuedSnapshot.data, queuedSnapshot && queuedSnapshot.baseVersion);
        }
        return { error: writeResult.error };
    }
    sbSetSnapshotVersion(projectId, writeResult.data && writeResult.data.updated_at || updatedAt);
    if (!queuedSnapshot) window._sbLastSyncedFingerprint = _sbFingerprint();
    if (queuedSnapshot) {
        const key = sbPendingSnapshotKey(projectId, storyOpen.id);
        try {
            const current = JSON.parse(localStorage.getItem(key) || 'null');
            if (current && current.queuedAt === queuedSnapshot.queuedAt) localStorage.removeItem(key);
        } catch (e) { localStorage.removeItem(key); }
    }
    sbRefreshProjectShares(projectId, pay);
    return { error: null, pending: false };
}

async function sbLoadSnapshot(projectId) {
    const c = sbClient();
    if (!c) return { error: { message: 'Supabase not configured' } };
    const { data, error } = await c.from('project_snapshots').select('payload, updated_at').eq('project_id', projectId).maybeSingle();
    if (error) return { error };
    sbSetSnapshotVersion(projectId, data && data.updated_at);
    const payload = sbNormalizePayload(data && data.payload);
    return { data: { payload, hasData: payload.stories.some(s => s.data && Object.keys(s.data).length), savedAt: (data && data.updated_at) || null } };
}

// تعديل قصص المشروع في السحابة (إنشاء/تسمية/حذف) — fn بتستقبل الـ payload وتعدّل فيه
async function sbMutateStories(projectId, fn) {
    const c = sbClient();
    if (!c) return { error: { message: 'Supabase not configured' } };
    const user = await sbGetSessionUser();
    if (!user) return { error: { message: 'Not signed in' } };
    const { data, error } = await c.from('project_snapshots').select('payload, updated_at').eq('project_id', projectId).maybeSingle();
    if (error) return { error };
    const pay = sbNormalizePayload(data && data.payload);
    const res = fn(pay) || {};
    const updatedAt = sbNextSnapshotVersion(data && data.updated_at);
    let writeResult;
    if (data) {
        writeResult = await c.from('project_snapshots')
            .update({ owner: user.id, payload: pay, updated_at: updatedAt })
            .eq('project_id', projectId).eq('updated_at', data.updated_at)
            .select('updated_at').maybeSingle();
        if (!writeResult.error && !writeResult.data) {
            return { error: { message: 'Cloud data changed in another browser. Refresh the project and try again.', conflict: true } };
        }
    } else {
        writeResult = await c.from('project_snapshots').insert({
            project_id: projectId, owner: user.id, payload: pay, updated_at: updatedAt
        }).select('updated_at').maybeSingle();
    }
    if (writeResult.error) return { error: writeResult.error };
    sbSetSnapshotVersion(projectId, writeResult.data && writeResult.data.updated_at || updatedAt);
    // نفس قاعدة الحفظ: لينكات المشروع تاخد آخر نسخة (إنشاء/تسمية/حذف ستوريز)
    sbRefreshProjectShares(projectId, pay);
    return { data: res };
}

async function sbCreateStory(projectId, name) {
    const id = 'story-' + Date.now().toString(36);
    const r = await sbMutateStories(projectId, pay => {
        const nm = (name || '').trim() || ('Story ' + (pay.stories.length + 1));
        pay.stories.push({ id, name: nm, data: {}, updated: null });
        pay.activeStory = id;
        return { id, name: nm };
    });
    return r.error ? r : { data: r.data };
}

async function sbRenameStory(projectId, storyId, name) {
    return sbMutateStories(projectId, pay => {
        const s = pay.stories.find(x => x.id === storyId);
        if (s && (name || '').trim()) s.name = name.trim();
    });
}

async function sbDeleteStory(projectId, storyId) {
    return sbMutateStories(projectId, pay => {
        pay.stories = pay.stories.filter(x => x.id !== storyId);
        if (pay.activeStory === storyId) pay.activeStory = pay.stories.length ? pay.stories[0].id : null;
    });
}

// ---------- Auto-save: بيرفع الشغل تلقائيًا كل ما الداتا المحلية تتغير ----------
function sbGetOpenProject() {
    try { return JSON.parse(localStorage.getItem('wakil_cloud_project')) || null; } catch (e) { return null; }
}

// القصة المفتوحة حاليًا داخل المشروع (wakil_cloud_story)
function sbGetOpenStory() {
    try { return JSON.parse(localStorage.getItem('wakil_cloud_story')) || null; } catch (e) { return null; }
}

// هل فيه شغل حقيقي محفوظ محليًا على الجهاز ده؟ (لتجنب رفع حالة فاضية على مشروع في السحابة)
function sbWorkspaceHasContent() {
    const dump = sbWorkspaceDump();
    const meaningful = (v) => {
        if (v == null) return false;
        const s = String(v).trim();
        return !!s && s !== 'null' && s !== '[]' && s !== '{}';
    };
    return ['wakil_ai_data', 'wakil_runs', 'wakil_bugs', 'wakil_gap_data', 'wakil_sc_data', 'wakil_story', 'wakil_gap_text', 'wakil_sc_story']
        .some(k => meaningful(dump[k]));
}

// بصمة الشغل الحالي: أي تغيير في أي مفتاح wakil_ بيغيرها
function _sbFingerprint() {
    const dump = sbWorkspaceDump();
    return JSON.stringify(Object.keys(dump).sort().map(k => [k, dump[k]]));
}

async function sbFlushPendingSnapshots() {
    if (navigator.onLine === false) return { error: null, pending: true };
    if (window._sbFlushingPending) return window._sbFlushingPending;
    window._sbFlushingPending = (async () => {
        const pending = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || key.indexOf('vetly_pending_snapshot:') !== 0) continue;
            try {
                const item = JSON.parse(localStorage.getItem(key) || 'null');
                if (!item || !item.projectId || !item.storyId) {
                    return { error: { message: 'An offline change could not be read. Its local queue entry needs attention: ' + key } };
                }
                pending.push(item);
            } catch (e) {
                console.error('Invalid queued Supabase snapshot:', e);
                return { error: { message: 'An offline change could not be read. Its local queue entry is invalid: ' + key } };
            }
        }
        for (let i = 0; i < pending.length; i++) {
            const item = pending[i];
            const result = await sbSaveSnapshot(item.projectId, item);
            if (result.error || result.pending) return result;
            const version = sbSnapshotVersion(item.projectId);
            for (let j = i + 1; j < pending.length; j++) {
                const next = pending[j];
                if (next.projectId !== item.projectId) continue;
                next.baseVersion = version;
                try {
                    localStorage.setItem(sbPendingSnapshotKey(next.projectId, next.storyId), JSON.stringify(next));
                } catch (e) {
                    return { error: { message: 'Could not update the offline queue: ' + e.message } };
                }
            }
        }
        return { error: null, pending: false, flushed: pending.length > 0 };
    })();
    try {
        return await window._sbFlushingPending;
    } finally {
        window._sbFlushingPending = null;
    }
}

function sbStartAutoSave(onStatus) {
    if (!sbClient() || window._sbAutoSaveStarted) return;
    window._sbAutoSaveStarted = true;
    let lastFp = _sbFingerprint();
    let busy = false;
    let timer = null;
    const flush = async () => {
        if (busy || window._sbSwitching) return;
        const fp = _sbFingerprint();
        if (window._sbLastSyncedFingerprint === fp) {
            lastFp = fp;
            return;
        }
        if (fp === lastFp) return;
        const project = sbGetOpenProject();
        if (!project || !project.id) return;
        const story = sbGetOpenStory();
        if (!story || !story.id) return; // مفيش قصة مفتوحة ⇒ مفيش حفظ (منع القصص الشبح)
        const user = await sbGetSessionUser();
        if (!user) return;
        busy = true;
        if (onStatus) onStatus('saving');
        try {
            const result = await sbSaveSnapshot(project.id);
            if (result.pending) {
                lastFp = fp;
                if (onStatus) onStatus('queued');
            } else if (!result.error) {
                lastFp = fp;
                window._sbLastSyncedFingerprint = fp;
                if (onStatus) onStatus('saved');
            } else {
                lastFp = fp;
                if (onStatus) onStatus(result.error.conflict ? 'conflict' : 'error');
            }
        } catch (e) {
            const result = sbQueueSnapshot(project.id, story, sbWorkspaceDump());
            if (result.error) {
                lastFp = fp;
                if (onStatus) onStatus('error');
            } else {
                lastFp = fp;
                if (onStatus) onStatus('queued');
            }
            console.error('Supabase autosave failed:', e);
        } finally {
            busy = false;
        }
    };
    const schedule = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(flush, 800);
    };
    setInterval(() => {
        if (_sbFingerprint() !== lastFp) schedule();
    }, 300);
    window.addEventListener('online', async () => {
        if (onStatus) onStatus('saving');
        const result = await sbFlushPendingSnapshots();
        if (result.error) {
            if (onStatus) onStatus(result.error.conflict ? 'conflict' : 'error');
            return;
        }
        if (result.flushed) {
            lastFp = window._sbLastSyncedFingerprint || '';
            schedule();
        } else if (onStatus) onStatus(result.pending ? 'queued' : 'saved');
    });
    window.addEventListener('offline', () => {
        if (onStatus) onStatus('offline');
    });
    sbFlushPendingSnapshots().then(result => {
        if (result.error && onStatus) onStatus(result.error.conflict ? 'conflict' : 'error');
        else if (result.pending && onStatus) onStatus('queued');
        if (result.flushed) {
            lastFp = window._sbLastSyncedFingerprint || '';
            schedule();
        }
    });
}

function sbWatchSnapshot(projectId, onChange, onStatus) {
    const c = sbClient();
    if (!c || !projectId || typeof onChange !== 'function') return () => {};
    const channel = c.channel('project-snapshot-' + projectId)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'project_snapshots',
            filter: 'project_id=eq.' + projectId
        }, payload => onChange(payload))
        .subscribe((status, error) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('Supabase Realtime subscription failed:', error || status);
                if (onStatus) onStatus('error');
            }
        });
    return () => {
        try { c.removeChannel(channel); }
        catch (e) { console.error('Failed to close snapshot subscription:', e); }
    };
}
