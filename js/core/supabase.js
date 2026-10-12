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

function sbConfigured() { return !!sbClient(); }

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

// متابعة حالة الدخول (Sign in / Sign out في أي مكان في التطبيق يحدّث الكولباك)
function sbWatchAuth(cb) {
    const c = sbClient();
    if (!c || !c.auth || !c.auth.onAuthStateChange) return () => {};
    const { data } = c.auth.onAuthStateChange((_event, session) => cb((session && session.user) || null));
    return () => { try { data.subscription.unsubscribe(); } catch (e) { /* ignore */ } };
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
        if (k && k.startsWith('wakil_') && !skip[k] && !k.startsWith('wakil_model_') && !k.startsWith('wakil_provider_down_') && !k.startsWith('wakil_auto_') && k !== 'wakil_custom_providers') dump[k] = localStorage.getItem(k);
    }
    return dump;
}

function sbWorkspaceApply(dump) {
    Object.keys(dump || {}).forEach(k => {
        if (k === 'wakil_keys' || k === 'wakil_models' || k === 'wakil_cloud_project') return;
        try { localStorage.setItem(k, dump[k]); } catch (e) { /* quota */ }
    });
}

// تفريغ الشغل المحلي بالكامل (كل الميزات تفضى) — بيستخدم عند التبديل بين المشاريع
// عشان كل مشروع يبقى عالم منفصل. مفاتيح الجهاز فقط (مفاتيح API + الثيم + اللغة) بتتفضل.
function sbWorkspaceClear() {
    const keep = { wakil_keys: 1, wakil_models: 1, wakil_cloud_project: 1, wakil_last_page: 1 };
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('wakil_') && !keep[k] && !k.startsWith('wakil_model_') && !k.startsWith('wakil_provider_down_') && !k.startsWith('wakil_auto_') && k !== 'wakil_custom_providers') toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
}

async function sbSaveSnapshot(projectId) {
    const c = sbClient();
    if (!c) return { error: { message: 'Supabase not configured' } };
    const user = await sbGetSessionUser();
    if (!user) return { error: { message: 'Not signed in' } };
    const { error } = await c.from('project_snapshots').upsert({
        project_id: projectId,
        owner: user.id,
        payload: sbWorkspaceDump(),
        updated_at: new Date().toISOString()
    });
    return { error };
}

async function sbLoadSnapshot(projectId) {
    const c = sbClient();
    if (!c) return { error: { message: 'Supabase not configured' } };
    const { data, error } = await c.from('project_snapshots').select('payload, updated_at').eq('project_id', projectId).maybeSingle();
    if (error) return { error };
    return { data: { payload: (data && data.payload) || null, savedAt: (data && data.updated_at) || null } };
}

// ---------- Auto-save: بيرفع الشغل تلقائيًا كل ما الداتا المحلية تتغير ----------
function sbGetOpenProject() {
    try { return JSON.parse(localStorage.getItem('wakil_cloud_project')) || null; } catch (e) { return null; }
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
    let fp = '';
    Object.keys(dump).sort().forEach(k => { fp += k + ':' + dump[k].length + ':' + (dump[k] ? dump[k].slice(-40) : '') + '|'; });
    return fp;
}

// بيشتغل مرة واحدة عند تحميل التطبيق: كل 5 ثواني بيقارن البصمة،
// ولو اتغيرت والحساب داخل وفي مشروع مفتوح ⇒ يرفع لوحده (من غير زراير)
function sbStartAutoSave(onStatus) {
    if (!sbClient() || window._sbAutoSaveStarted) return;
    window._sbAutoSaveStarted = true;
    let lastFp = _sbFingerprint();
    let busy = false;
    setInterval(async () => {
        if (busy) return;
        const fp = _sbFingerprint();
        if (fp === lastFp) return;
        const project = sbGetOpenProject();
        if (!project || !project.id) return;
        const user = await sbGetSessionUser();
        if (!user) return;
        busy = true;
        if (onStatus) onStatus('saving');
        const r = await sbSaveSnapshot(project.id);
        busy = false;
        if (!r.error) { lastFp = fp; if (onStatus) onStatus('saved'); }
        else if (onStatus) onStatus('error');
    }, 5000);
}
