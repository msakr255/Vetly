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
    return Object.assign({}, window._wkMem);
}

function sbWorkspaceApply(dump) {
    Object.keys(dump || {}).forEach(k => {
        if (wkIsDataKey(k)) window._wkMem[k] = String(dump[k]);
    });
}

function sbWorkspaceReplace(dump) {
    sbWorkspaceClear();
    sbWorkspaceApply(dump);
    sbWorkspaceMarkReady();
    window.dispatchEvent(new Event('vetly_feature_data_changed'));
}

// تفريغ الشغل المحلي بالكامل (كل الميزات تفضى) — بيستخدم عند التبديل بين المشاريع
// عشان كل مشروع يبقى عالم منفصل. مفاتيح الجهاز فقط (مفاتيح API + الثيم + اللغة) بتتفضل.
function sbWorkspaceClear() {
    Object.keys(window._wkMem).forEach(k => delete window._wkMem[k]);
    window._sbReadyKey = null;
}

function sbWorkspaceMarkReady() {
    const project = sbGetOpenProject();
    const story = sbGetOpenStory();
    window._sbReadyKey = project && story ? project.id + ':' + story.id : null;
    window._sbConflict = false;
    window._sbLastSyncedFingerprint = _sbFingerprint();
}

function sbIsDirty() {
    return !!window._sbReadyKey && _sbFingerprint() !== window._sbLastSyncedFingerprint;
}

function sbIsOwnVersion(projectId, version) {
    if (!version) return false;
    const time = Date.parse(version);
    return [sbSnapshotVersion(projectId), window._sbInFlight && window._sbInFlight[projectId]]
        .some(item => item && Date.parse(item) === time);
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

function sbOfflineQueueId(userId, projectId, storyId) {
    return [userId, projectId, storyId].join(':');
}

function sbOfflineQueueDb() {
    if (window._sbOfflineQueueDbPromise) return window._sbOfflineQueueDbPromise;
    if (!window.indexedDB) return Promise.reject(new Error('IndexedDB is unavailable; offline changes cannot be stored safely.'));
    window._sbOfflineQueueDbPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open('vetly-offline-sync', 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains('snapshots')) {
                request.result.createObjectStore('snapshots', { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Failed to open offline sync storage.'));
        request.onblocked = () => reject(new Error('Offline sync storage upgrade is blocked by another open tab.'));
    }).catch(error => {
        window._sbOfflineQueueDbPromise = null;
        throw error;
    });
    return window._sbOfflineQueueDbPromise;
}

async function sbGetQueuedSnapshot(userId, projectId, storyId) {
    await (window._sbQueueMutationChain || Promise.resolve());
    const db = await sbOfflineQueueDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('snapshots', 'readonly');
        const request = transaction.objectStore('snapshots').get(sbOfflineQueueId(userId, projectId, storyId));
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error('Failed to read pending offline changes.'));
        transaction.onabort = () => reject(transaction.error || new Error('Failed to read pending offline changes.'));
    });
}

async function sbGetQueuedSnapshots(userId) {
    await (window._sbQueueMutationChain || Promise.resolve());
    const db = await sbOfflineQueueDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('snapshots', 'readonly');
        const request = transaction.objectStore('snapshots').getAll();
        request.onsuccess = () => resolve((request.result || []).filter(record => record.userId === userId));
        request.onerror = () => reject(request.error || new Error('Failed to list pending offline changes.'));
        transaction.onabort = () => reject(transaction.error || new Error('Failed to list pending offline changes.'));
    });
}

async function sbGetQueuedSnapshotCount(userId, projectId, storyId) {
    const records = await sbGetQueuedSnapshots(userId);
    return records.filter(record =>
        (!projectId || record.projectId === projectId) &&
        (!storyId || record.storyId === storyId)
    ).length;
}

async function sbStoreQueuedSnapshot(record) {
    const db = await sbOfflineQueueDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('snapshots', 'readwrite');
        transaction.objectStore('snapshots').put(record);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error('Failed to save pending offline changes.'));
        transaction.onabort = () => reject(transaction.error || new Error('Failed to save pending offline changes.'));
    });
}

function sbSerializeQueueMutation(operation) {
    const previous = window._sbQueueMutationChain || Promise.resolve();
    const next = previous.then(operation);
    window._sbQueueMutationChain = next.catch(() => {});
    return next;
}

async function sbQueueSnapshotData(userId, projectId, storyId, data, baseVersion, legacyConflict) {
    const copy = Object.assign({}, data || {});
    const record = {
        id: sbOfflineQueueId(userId, projectId, storyId),
        userId,
        projectId,
        storyId,
        data: copy,
        fingerprint: _sbFingerprint(copy),
        baseVersion: baseVersion || null,
        legacyConflict: !!legacyConflict,
        updatedAt: Date.now()
    };
    await sbSerializeQueueMutation(() => sbStoreQueuedSnapshot(record));
    return record;
}

async function sbRemoveQueuedSnapshot(userId, projectId, storyId, fingerprint) {
    return sbSerializeQueueMutation(async () => {
        const db = await sbOfflineQueueDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('snapshots', 'readwrite');
            const store = transaction.objectStore('snapshots');
            const request = store.get(sbOfflineQueueId(userId, projectId, storyId));
            request.onsuccess = () => {
                const record = request.result;
                if (record && (!fingerprint || record.fingerprint === fingerprint)) store.delete(record.id);
            };
            request.onerror = () => reject(request.error || new Error('Failed to inspect pending offline changes.'));
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error || new Error('Failed to clear pending offline changes.'));
            transaction.onabort = () => reject(transaction.error || new Error('Failed to clear pending offline changes.'));
        });
    });
}

async function sbRemoveQueuedProjectSnapshots(userId, projectId) {
    return sbSerializeQueueMutation(async () => {
        const db = await sbOfflineQueueDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('snapshots', 'readwrite');
            const store = transaction.objectStore('snapshots');
            const request = store.getAll();
            request.onsuccess = () => {
                (request.result || []).forEach(record => {
                    if (record.userId === userId && record.projectId === projectId) store.delete(record.id);
                });
            };
            request.onerror = () => reject(request.error || new Error('Failed to inspect pending project changes.'));
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error || new Error('Failed to clear pending project changes.'));
            transaction.onabort = () => reject(transaction.error || new Error('Failed to clear pending project changes.'));
        });
    });
}

async function sbPersistPendingSnapshot() {
    const readyKey = window._sbReadyKey;
    if (!readyKey || !sbIsDirty()) return false;
    const project = sbGetOpenProject();
    const story = sbGetOpenStory();
    if (!project || !project.id || !story || !story.id || readyKey !== project.id + ':' + story.id) return false;
    const user = await sbGetSessionUser();
    if (!user) return false;
    const data = sbWorkspaceDump();
    await sbQueueSnapshotData(user.id, project.id, story.id, data, sbSnapshotVersion(project.id));
    return true;
}

async function sbSaveSnapshot(projectId) {
    const c = sbClient();
    if (!c) return { error: { message: 'Supabase not configured' } };
    const user = await sbGetSessionUser();
    if (!user) return { error: { message: 'Not signed in' } };
    const storyOpen = sbGetOpenStory();
    if (!storyOpen || !storyOpen.id) return { error: null };
    const dump = sbWorkspaceDump();
    const fingerprint = _sbFingerprint(dump);
    let snapshotResult;
    try {
        snapshotResult = await c.from('project_snapshots')
            .select('payload, updated_at').eq('project_id', projectId).maybeSingle();
    } catch (e) {
        return { error: e };
    }
    const { data, error: readError } = snapshotResult;
    if (readError) return { error: readError };
    const expected = sbSnapshotVersion(projectId);
    const remote = (data && data.updated_at) || null;
    if (expected !== remote) {
        return { error: { message: 'Cloud data changed in another browser. Reload the story before saving.', conflict: true } };
    }
    const pay = sbNormalizePayload(data && data.payload);
    let story = pay.stories.find(item => item.id === storyOpen.id);
    if (!story) {
        story = { id: storyOpen.id, name: storyOpen.name || 'Story', data: {} };
        pay.stories.push(story);
    }
    if (storyOpen.name) story.name = storyOpen.name;
    story.data = dump;
    story.updated = new Date().toISOString();
    pay.activeStory = story.id;
    const updatedAt = sbNextSnapshotVersion(remote);
    window._sbInFlight = window._sbInFlight || {};
    window._sbInFlight[projectId] = updatedAt;
    let writeResult;
    try {
        writeResult = remote
            ? await c.from('project_snapshots')
                .update({ owner: user.id, payload: pay, updated_at: updatedAt })
                .eq('project_id', projectId).eq('updated_at', remote)
                .select('updated_at').maybeSingle()
            : await c.from('project_snapshots').insert({
                project_id: projectId, owner: user.id, payload: pay, updated_at: updatedAt
            }).select('updated_at').maybeSingle();
    } catch (e) {
        delete window._sbInFlight[projectId];
        return { error: e };
    }
    delete window._sbInFlight[projectId];
    if (writeResult.error) return { error: writeResult.error };
    if (remote && !writeResult.data) {
        return { error: { message: 'Cloud data changed while saving. Reload the story.', conflict: true } };
    }
    sbSetSnapshotVersion(projectId, (writeResult.data && writeResult.data.updated_at) || updatedAt);
    if (_sbFingerprint() === fingerprint) {
        window._sbLastSyncedFingerprint = fingerprint;
        try {
            await sbRemoveQueuedSnapshot(user.id, projectId, storyOpen.id);
        } catch (e) {
            console.error('Cloud snapshot saved, but pending offline data could not be cleared:', e);
        }
    }
    sbRefreshProjectShares(projectId, pay);
    return { error: null };
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
function sbWorkspaceHasContent(dump) {
    dump = dump || sbWorkspaceDump();
    const meaningful = (v) => {
        if (v == null) return false;
        const s = String(v).trim();
        return !!s && s !== 'null' && s !== '[]' && s !== '{}';
    };
    return Object.values(dump).some(meaningful);
}

// بصمة الشغل الحالي: أي تغيير في أي مفتاح wakil_ بيغيرها
function _sbFingerprint(dump) {
    dump = dump || sbWorkspaceDump();
    return JSON.stringify(Object.keys(dump).sort().map(k => [k, dump[k]]));
}

function sbCompareWorkspaceSnapshots(localData, cloudData) {
    const local = localData || {};
    const cloud = cloudData || {};
    const keys = [...new Set([...Object.keys(local), ...Object.keys(cloud)])].sort();
    return keys.reduce((rows, key) => {
        const hasLocal = Object.prototype.hasOwnProperty.call(local, key);
        const hasCloud = Object.prototype.hasOwnProperty.call(cloud, key);
        const localValue = hasLocal ? String(local[key]) : null;
        const cloudValue = hasCloud ? String(cloud[key]) : null;
        if (localValue === cloudValue && hasLocal === hasCloud) return rows;
        const preview = value => {
            if (value == null) return '(missing)';
            const text = value.length > 180 ? value.slice(0, 180) + '…' : value;
            return text || '(empty)';
        };
        rows.push({
            key,
            local: preview(localValue),
            cloud: preview(cloudValue),
            change: !hasCloud ? 'local-only' : !hasLocal ? 'cloud-only' : 'changed'
        });
        return rows;
    }, []);
}

function sbStartAutoSave(onStatus) {
    if (!sbClient() || window._sbAutoSaveStarted) return;
    window._sbAutoSaveStarted = true;
    let busy = false;
    let timer = null;
    let retryAt = 0;
    const say = (status, details) => { if (onStatus) onStatus(status, details); };

    const schedule = () => {
        if (navigator.onLine === false && sbIsDirty()) {
            sbPersistPendingSnapshot().then(stored => {
                if (stored) {
                    const project = sbGetOpenProject();
                    const story = sbGetOpenStory();
                    sbGetSessionUser().then(user => user && project && story
                        ? sbGetQueuedSnapshotCount(user.id, project.id, story.id) : 0)
                        .then(count => {
                            if (navigator.onLine === false) say('queued', { pendingCount: count });
                        })
                        .catch(error => {
                            say('error', { error: error.message });
                            console.error('Failed to count pending offline changes:', error);
                        });
                }
            }).catch(error => {
                say('error', { error: error.message });
                console.error('Failed to preserve pending offline changes:', error);
            });
        }
        if (timer) clearTimeout(timer);
        timer = setTimeout(flush, Math.max(800, retryAt - Date.now()));
    };
    window._sbSchedule = schedule;

    async function flush() {
        timer = null;
        if (busy || window._sbSwitching || window._sbConflict || !sbIsDirty()) return;
        const project = sbGetOpenProject();
        const story = sbGetOpenStory();
        if (!project || !project.id || !story || !story.id) return;
        if (window._sbReadyKey !== project.id + ':' + story.id) return;
        if (navigator.onLine === false) {
            try {
                await sbPersistPendingSnapshot();
                const user = await sbGetSessionUser();
                const pendingCount = user ? await sbGetQueuedSnapshotCount(user.id, project.id, story.id) : 0;
                say('queued', { pendingCount });
            } catch (error) {
                say('error', { error: error.message || String(error) });
                console.error('Failed to preserve offline changes:', error);
            }
            return;
        }
        busy = true;
        try {
            if (!(await sbGetSessionUser())) {
                retryAt = Date.now() + 5000;
                return;
            }
            say('saving');
            const result = await sbSaveSnapshot(project.id);
            if (result.error) {
                if (result.error.conflict) {
                    window._sbConflict = true;
                    say('conflict');
                } else {
                    retryAt = Date.now() + 5000;
                    say('error', { error: result.error.message || String(result.error) });
                    console.error('Supabase save failed:', result.error);
                }
            } else {
                retryAt = 0;
                if (sbIsDirty()) say('saving');
                else {
                    const user = await sbGetSessionUser();
                    const pendingCount = user ? await sbGetQueuedSnapshotCount(user.id, project.id, story.id) : 0;
                    say(pendingCount && navigator.onLine === false ? 'queued' : 'saved', {
                        lastSavedAt: Date.now(),
                        pendingCount: navigator.onLine === false ? pendingCount : 0,
                        error: ''
                    });
                }
            }
        } catch (e) {
            retryAt = Date.now() + 5000;
            say('error', { error: e.message || String(e) });
            console.error('Supabase save failed:', e);
        } finally {
            busy = false;
            if (sbIsDirty() && !window._sbConflict) schedule();
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && sbIsDirty()) {
            if (timer) clearTimeout(timer);
            flush();
        }
    });
    window.addEventListener('beforeunload', event => {
        if (sbIsDirty() || (!window._sbReadyKey && sbWorkspaceHasContent())) {
            event.preventDefault();
            event.returnValue = '';
        }
    });
    window.addEventListener('online', schedule);
    window.addEventListener('offline', () => {
        if (sbIsDirty()) schedule();
        else say('offline');
    });
    window._sbRetrySync = () => {
        retryAt = 0;
        if (window._sbReadyKey) window._sbLastSyncedFingerprint = null;
        schedule();
        return true;
    };
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

function sbWatchProjects(onChange, onStatus) {
    const c = sbClient();
    if (!c || typeof onChange !== 'function') return () => {};
    const channel = c.channel('projects-list')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'projects'
        }, payload => onChange(payload))
        .subscribe((status, error) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.error('Supabase project-list subscription failed:', error || status);
                if (onStatus) onStatus('error');
            }
        });
    return () => {
        try { c.removeChannel(channel); }
        catch (error) { console.error('Failed to close project-list subscription:', error); }
    };
}
