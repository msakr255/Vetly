/* =====================================================================
   features/projects.js
   صفحة My Projects (صفحة كاملة مش popup):
   - Dashboard إحصائيات عبر كل المشاريع (كيسز/باجز/جولات/تنفيذ/Pass rate)
   - قائمة المشاريع: فتح / إعادة تسمية / حذف / إنشاء
   - إحصائيات تفصيلية جوه كل مشروع (سويتش على المشروع ويعرض تفاصيله)
   - منطق الفصل: فتح أو إنشاء مشروع ⇒ الشغل المحلي يتفضى الأول،
     ومشروع جديد يفتح فاضي، ومشروع قديم يجيب داتاه هو بس.
   ===================================================================== */

const parseJ = (v, fb) => { try { const x = (typeof v === 'string') ? JSON.parse(v) : v; return x ?? fb; } catch (e) { return fb; } };
const _tlArr = (v) => (Array.isArray(v) ? v : []);

// إحصائيات مفصلة من payload مشروع — بيدعم صيغة القصص (v2) والصيغة القديمة،
// وبيلمع الداتا من كل القصص مع بعض (كل قصة فيها نسخة كاملة من الميزات)
function computeProjectDetail(pay) {
    const stories = (pay && pay._v === 2 && Array.isArray(pay.stories))
        ? pay.stories
        : [{ data: (pay && typeof pay === 'object') ? pay : {} }];
    let cases = [], scenarios = [], bugs = [], runs = [], gapSections = [], gapCross = [];
    stories.forEach(s => {
        const d = s.data || {};
        const c = parseJ(d.wakil_ai_data, null);
        if (c) { cases = cases.concat(c.testCases || []); scenarios = scenarios.concat(c.scenarios || []); }
        scenarios = scenarios.concat(parseJ(d.wakil_sc_data, []));
        bugs = bugs.concat(parseJ(d.wakil_bugs, []));
        runs = runs.concat(parseJ(d.wakil_runs, []));
        const g = parseJ(d.wakil_gap_data, null);
        if (g) { gapSections = gapSections.concat(g.sections || []); gapCross = gapCross.concat(g.cross || []); }
    });
    const scMap = new Map();
    scenarios.forEach(s => { if (s && s.id && !scMap.has(s.id)) scMap.set(s.id, s); });
    const scList = [...scMap.values()];

    const countBy = (arr, key, values) => {
        const m = {}; values.forEach(v => { m[v] = 0; });
        (arr || []).forEach(x => { const k = x[key] || values[0]; m[k] = (m[k] || 0) + 1; });
        return m;
    };
    const caseTypes = countBy(cases, 'type', ['Positive', 'Negative', 'Edge Case']);
    const bugSev = countBy(bugs, 'severity', ['Critical', 'High', 'Medium', 'Low']);
    const bugStatus = {};
    bugs.forEach(b => { bugStatus[b.status] = (bugStatus[b.status] || 0) + 1; });

    let executions = 0, passes = 0, fails = 0, blocked = 0, skipped = 0, untested = 0;
    const runRows = (runs || []).map(run => {
        let rp = 0, rf = 0, rb = 0, rs = 0, ru = 0;
        Object.values(run.results || {}).forEach(st => {
            executions++;
            if (st === 'Pass') { passes++; rp++; }
            else if (st === 'Fail') { fails++; rf++; }
            else if (st === 'Blocked') { blocked++; rb++; }
            else if (st === 'Skipped') { skipped++; rs++; }
            else untested++;
        });
        return { id: run.id, name: run.name, date: run.date, build: run.build, pass: rp, fail: rf, blocked: rb, skipped: rs, untested: ru };
    });

    const gapCount = gapSections.reduce((a, sec) => a + ((sec.gaps && sec.gaps.length) || 0), 0) + (gapCross.length || 0);
    const gapHigh = [].concat(...gapSections.map(s => s.gaps || []), gapCross).filter(g => g.priority === 'High').length;

    return {
        scenarios: scList.length,
        scTypes: countBy(scList, 'type', ['Positive', 'Negative', 'Edge Case']),
        caseCount: cases.length,
        caseTypes,
        bugCount: bugs.length, bugSev, bugStatus,
        runCount: runs.length, runRows,
        executions, passes, fails, blocked, skipped, untested,
        passRate: executions ? Math.round((passes / executions) * 100) : 0,
        gapCount, gapHigh
    };
}

function ProjectsPage({ cloudProject, setCloudProject, cloudStory, setCloudStory, resetFeatureStates }) {
    const [rows, setRows] = useState(null);   // إحصائيات كل المشاريع + قصص كل مشروع (Dashboard)
    const [sel, setSel] = useState(null);      // تفاصيل مشروع مختار { id, name, d }
    const [newName, setNewName] = useState('');
    const [newStoryName, setNewStoryName] = useState('');
    const [newStoryFor, setNewStoryFor] = useState(null); // أنهي مشروع الـ input بتاعه مفتوح
    const [expanded, setExpanded] = useState(() => (cloudProject ? cloudProject.id : null)); // المشروع المفتوحAccordion مفتوح افتراضيًا
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);
    const [shareFor, setShareFor] = useState(null); // مشروع بنعمل له لينك مشاركة (قراءة فقط)
    const [summaryFor, setSummaryFor] = useState(null); // ملخص المشروع: صفحة كاملة
    const [summaryData, setSummaryData] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    // إعادة تحميل بتسجّل إن المحتوى المحمّل بلغة الموقع الحالية (عشان كاش الترجمة ميتلخبطش)
    const finishSwitch = () => { if (typeof markAllContentLang === 'function') markAllContentLang(getLang()); if (typeof resetFeatureStates === 'function') resetFeatureStates(); };

    // ---------- ملخص المشروع: نفس صفحة Summary Report بالظبط لكن بيجمع كل اليوزر ستوريز ----------
    const openProjectSummary = async (proj) => {
        setSummaryFor(proj); setSummaryData(null); setSummaryLoading(true);
        const r = await sbLoadSnapshot(proj.id);
        setSummaryLoading(false);
        if (r.error) { setSummaryFor(null); setMsg(r.error.message); return; }
        const pay = sbNormalizePayload(r.data && r.data.payload);
        const stories = (pay._v === 2 && Array.isArray(pay.stories)) ? pay.stories.filter(s => s && typeof s === 'object') : [];
        if (!stories.length) { setSummaryFor(null); setMsg(tr('This project has no stories yet.')); return; }
        // تجميع كل الفيتشرز من كل الستوريز — وكل عنصر بيتبصم بـ US1/US2… عشان الـ IDs المكررة ما تتلخبطش
        const aggGapSections = [], aggGapCross = [], aggSc = [], aggScn = [], aggCases = [], aggBugs = [], aggRuns = [];
        stories.forEach((st, i) => {
            const tag = 'US' + (i + 1);
            const storyName = st.name || ('Story ' + (i + 1));
            const d = st.data || {};
            const gd = parseJ(d.wakil_gap_data, null);
            if (gd && typeof gd === 'object') {
                _tlArr(gd.sections).forEach(sec => aggGapSections.push(sec));
                _tlArr(gd.cross).forEach(g => aggGapCross.push(g));
            }
            _tlArr(parseJ(d.wakil_sc_data, [])).forEach(sc => aggSc.push({ ...sc, id: tag + '-' + sc.id, _story: storyName }));
            _tlArr(parseJ(d.wakil_linked, [])).forEach(sc => aggSc.push({ ...sc, id: tag + '-' + sc.id, _story: storyName }));
            const ai = parseJ(d.wakil_ai_data, null);
            if (ai && typeof ai === 'object') {
                _tlArr(ai.scenarios).forEach(sc => aggScn.push({ ...sc, id: tag + '-' + sc.id, _story: storyName }));
                _tlArr(ai.testCases).forEach(tc => aggCases.push({ ...tc, id: tag + '-' + tc.id, scenarioId: tc.scenarioId ? tag + '-' + tc.scenarioId : '', _story: storyName }));
            }
            _tlArr(parseJ(d.wakil_bugs, [])).forEach(b => aggBugs.push({ ...b, testCaseId: b.testCaseId ? tag + '-' + b.testCaseId : '', _story: storyName }));
            _tlArr(parseJ(d.wakil_runs, [])).forEach(rn => aggRuns.push({
                ...rn,
                results: Object.fromEntries(Object.entries(rn.results || {}).map(([k, v]) => [tag + '-' + String(k).split('::')[0], v])),
                outputs: Object.fromEntries(Object.entries(rn.outputs || {}).map(([k, v]) => [tag + '-' + String(k).split('::')[0], v])),
                _story: storyName
            }));
        });
        setSummaryData({
            proj,
            gapData: { sections: aggGapSections, cross: aggGapCross },
            scData: aggSc,
            data: { scenarios: aggScn, testCases: aggCases },
            bugs: aggBugs,
            runs: aggRuns
        });
    };

    const load = async () => {
        setRows(null); setMsg('');
        const r = await sbListProjects();
        if (r.error) { setMsg(r.error.message); return; }
        const c = sbClient();
        const { data: snaps, error } = await c.from('project_snapshots').select('project_id, payload, updated_at');
        if (error) { setMsg(error.message); return; }
        const byProj = {};
        (snaps || []).forEach(s => { byProj[s.project_id] = s; });
        setRows((r.data || []).map(p => {
            const s = byProj[p.id];
            const payN = sbNormalizePayload(s && s.payload);
            const d = computeProjectDetail(payN);
            const stories = payN.stories.map(st => ({
                id: st.id, name: st.name,
                hasData: !!(st.data && Object.keys(st.data).length),
                updated: st.updated
            }));
            return { id: p.id, name: p.name, savedAt: s ? s.updated_at : null, d, stories };
        }));
    };

    useEffect(() => { load(); }, []);

    // حفظ المشروع المفتوح حاليًا قبل أي تبديل (ضمانة فوق الحفظ التلقائي)
    const saveCurrent = async () => {
        if (!cloudProject || !cloudProject.id || !cloudStory || !cloudStory.id) return { error: null };
        const result = await sbSaveSnapshot(cloudProject.id);
        if (!result.error || !result.error.conflict) return result;
        if (!window.confirm("Newer cloud data exists for this story. Discard this device's unsaved changes and reload the cloud copy before continuing?")) return result;
        const latest = await sbLoadSnapshot(cloudProject.id);
        if (latest.error) return latest;
        const story = latest.data.payload.stories.find(item => item.id === cloudStory.id);
        sbWorkspaceReplace(story && story.data ? story.data : {});
        localStorage.removeItem(sbPendingSnapshotKey(cloudProject.id, cloudStory.id));
        return { error: null };
    };

    // فتح مشروع: فضّي الشغل المحلي الأول، وبعدين طبّق داتا المشروع لو فيها.
    // كل مشروع بيبقى عالم منفصل — وجواه يوزر ستوريز، كل ستوري عالم منفصل كمان:
    // فتح قصة = حفظ الحالية → فضي الشغل المحلي → طبّق داتا القصة → reload.


    const doOpen = async (p) => {
        setBusy(true); setMsg('');
        const saveResult = await saveCurrent();
        if (saveResult.error) { setBusy(false); setMsg(saveResult.error.message); return; }
        const r = await sbLoadSnapshot(p.id);
        if (r.error) { setBusy(false); setMsg(r.error.message); return; }
        const pay = (r.data && r.data.payload) || { _v: 2, stories: [], activeStory: null };
        sbWorkspaceClear();
        localStorage.setItem('wakil_cloud_project', JSON.stringify({ id: p.id, name: p.name }));
        setCloudProject({ id: p.id, name: p.name });
        localStorage.removeItem('wakil_cloud_story');
        setCloudStory(null);
        // اختار القصة النشطة (أو أول واحدة فيها داتا)
        const active = pay.stories.find(s => s.id === pay.activeStory)
            || pay.stories.find(s => s.data && Object.keys(s.data).length)
            || pay.stories[0]
            || null;
        if (active) {
            if (active.data && Object.keys(active.data).length) sbWorkspaceApply(active.data);
            localStorage.setItem('wakil_cloud_story', JSON.stringify({ id: active.id, name: active.name }));
            setCloudStory({ id: active.id, name: active.name });
        }
        finishSwitch();
    };

    const doCreate = async () => {
        if (!newName.trim()) { setMsg('Write a project name first.'); return; }
        setBusy(true); setMsg('');
        const saveResult = await saveCurrent();
        if (saveResult.error) { setBusy(false); setMsg(saveResult.error.message); return; }
        const r = await sbCreateProject(newName.trim());
        if (r.error) { setBusy(false); setMsg(r.error.message); return; }
        const p = { id: r.data.id, name: r.data.name };
        // لو مفيش مشروع مفتوح وعلى الجهاز ده شغل محلي من غير ربط ⇒ اعرض رفعه على الجديد
        if (!cloudProject && sbWorkspaceHasContent()) {
            if (window.confirm(tr('You have local work on this device with no open project.\nUpload it and link it to the new project "{p}"?', { p: p.name }))) {
                // ننشئ القصة الأول ونربطها، وبعدين نحفظ — عشان الداتا تدخل جوه القصة مش قصة شبح
                const s = await sbCreateStory(p.id, 'Story 1');
                if (s.error) { setBusy(false); setMsg(s.error.message); return; }
                const story = { id: s.data.id, name: s.data.name };
                localStorage.setItem('wakil_cloud_project', JSON.stringify(p));
                localStorage.setItem('wakil_cloud_story', JSON.stringify(story));
                setCloudProject(p);
                setCloudStory(story);
                const uploadResult = await sbSaveSnapshot(p.id);
                if (uploadResult.error) { setBusy(false); setMsg(uploadResult.error.message); return; }
                finishSwitch();
                return;
            }
        }
        // مشروع جديد = فاضي تمامًا: فضّي كل الميزات (ومفيش قصص لسه)
        sbWorkspaceClear();
        localStorage.removeItem('wakil_cloud_story');
        setCloudStory(null);
        localStorage.setItem('wakil_cloud_project', JSON.stringify(p));
        setCloudProject(p);
        finishSwitch();
    };

    const doRename = async (p) => {
        const name = window.prompt('New project name:', p.name);
        if (!name || !name.trim()) return;
        const r = await sbRenameProject(p.id, name.trim());
        if (!r.error) {
            await load();
            if (cloudProject && cloudProject.id === p.id) setCloudProject({ ...cloudProject, name: name.trim() });
            if (sel && sel.id === p.id) setSel({ ...sel, name: name.trim() });
        }
    };

    const doDelete = async (p) => {
        if (!window.confirm(`Delete project "${p.name}" with ALL its data?`)) return;
        setBusy(true);
        const r = await sbDeleteProject(p.id);
        setBusy(false);
        if (r.error) { setMsg(r.error.message); return; }
        if (sel && sel.id === p.id) setSel(null);
        // لو المحذوف هو المشروع المفتوح: الداتا بتاعته تتمسح من الموقع كله
        // (تفريغ كل الميزات المحلية + رفع الربط) — عشان يبقى مفيش أي أثر
        if (cloudProject && cloudProject.id === p.id) {
            sbWorkspaceClear();
            localStorage.removeItem('wakil_cloud_project');
            localStorage.removeItem('wakil_cloud_story');
            setCloudProject(null);
            setCloudStory(null);
            // لو لسه في مشاريع تانية: الهبوط يكون على صفحة My Projects على طول
            if (rows && rows.length > 1) localStorage.setItem('wakil_last_page', 'projects');
            finishSwitch();
            return;
        }
        await load();
    };

    // ---------- User Stories جوه المشروع المفتوح ----------
    // فتح قصة من أي مشروع: حفظ الحالية → فضي الشغل المحلي → طبّق داتا القصة
    // → ربط المشروع والقصة معًا → reload. كل قصة عالم منفصل.
    const openStory = async (proj, story) => {
        setBusy(true); setMsg('');
        if (!cloudStory || cloudStory.id !== story.id || !cloudProject || cloudProject.id !== proj.id) {
            const saveResult = await saveCurrent();
            if (saveResult.error) { setBusy(false); setMsg(saveResult.error.message); return; }
        }
        const r = await sbLoadSnapshot(proj.id);
        if (r.error) { setBusy(false); setMsg(r.error.message); return; }
        const target = ((r.data && r.data.payload && r.data.payload.stories) || []).find(s => s.id === story.id);
        sbWorkspaceClear();
        if (target && target.data && Object.keys(target.data).length) sbWorkspaceApply(target.data);
        localStorage.setItem('wakil_cloud_project', JSON.stringify({ id: proj.id, name: proj.name }));
        setCloudProject({ id: proj.id, name: proj.name });
        localStorage.setItem('wakil_cloud_story', JSON.stringify({ id: story.id, name: story.name }));
        setCloudStory({ id: story.id, name: story.name });
        finishSwitch();
    };

    const createStory = async (proj) => {
        if (!newStoryName.trim()) { setMsg('Write a story name first.'); return; }
        setBusy(true); setMsg('');
        const saveResult = await saveCurrent();
        if (saveResult.error) { setBusy(false); setMsg(saveResult.error.message); return; }
        const r = await sbCreateStory(proj.id, newStoryName.trim());
        if (r.error) { setBusy(false); setMsg(r.error.message); return; }
        // قصة جديدة = فاضي تمامًا: فضّي كل الميزات وابدأ عليها نظيف
        sbWorkspaceClear();
        localStorage.setItem('wakil_cloud_project', JSON.stringify({ id: proj.id, name: proj.name }));
        setCloudProject({ id: proj.id, name: proj.name });
        localStorage.setItem('wakil_cloud_story', JSON.stringify({ id: r.data.id, name: r.data.name }));
        setCloudStory({ id: r.data.id, name: r.data.name });
        setNewStoryName('');
        setNewStoryFor(null);
        finishSwitch();
    };

    const renameStory = async (proj, story) => {
        const name = window.prompt('New story name:', story.name);
        if (!name || !name.trim()) return;
        const r = await sbRenameStory(proj.id, story.id, name.trim());
        if (!r.error) {
            await load(); // بيحدّث الاسم في الـ Accordion (والـ expanded بيفضل مفتوح)
            if (cloudStory && cloudStory.id === story.id && cloudProject && cloudProject.id === proj.id) {
                setCloudStory({ ...cloudStory, name: name.trim() });
                localStorage.setItem('wakil_cloud_story', JSON.stringify({ id: story.id, name: name.trim() }));
            }
        } else setMsg(r.error.message);
    };

    const deleteStory = async (proj, story) => {
        if (!window.confirm(`Delete story "${story.name}" with ALL its data?`)) return;
        setBusy(true);
        const r = await sbDeleteStory(proj.id, story.id);
        setBusy(false);
        if (r.error) { setMsg(r.error.message); return; }
        const wasOpen = !!(cloudStory && cloudStory.id === story.id && cloudProject && cloudProject.id === proj.id);
        await load(); // الـ Accordion بيفضل مفتوح والقايمة تتحدث فورًا
        if (wasOpen) {
            sbWorkspaceClear();
            localStorage.removeItem('wakil_cloud_story');
            setCloudStory(null);
            finishSwitch();
        }
    };

    // تفاصيل مشروع مختار (من غير ما نغير المفتوح): بنسحب الـ payload ونحسب تفصيلي
    const showDetail = async (p) => {
        if (sel && sel.id === p.id) { setSel(null); return; }
        setBusy(true); setMsg('');
        const r = await sbLoadSnapshot(p.id);
        setBusy(false);
        if (r.error) { setMsg(r.error.message); return; }
        const d = computeProjectDetail((r.data && r.data.payload) || {});
        setSel({ id: p.id, name: p.name, d });
    };

    const tot = (rows || []).reduce((a, s) => ({
        cases: a.cases + s.d.caseCount, bugs: a.bugs + s.d.bugCount, runs: a.runs + s.d.runCount,
        exec: a.exec + s.d.executions, pass: a.pass + s.d.passes, gaps: a.gaps + s.d.gapCount
    }), { cases: 0, bugs: 0, runs: 0, exec: 0, pass: 0, gaps: 0 });
    const passRate = tot.exec ? Math.round((tot.pass / tot.exec) * 100) : 0;
    const statCard = (v, l, cls = '') => (
        <div className={`border rounded-lg p-2 text-center ${cls || 'bg-white border-slate-200'}`}>
            <div className="text-lg font-bold text-slate-800">{v}</div>
            <div className="text-[10px] text-slate-500 uppercase">{l}</div>
        </div>
    );
    const chip = (v, n) => n ? <span key={v} className="text-[10px] bg-white border border-slate-200 rounded-full px-2 py-0.5 text-slate-600">{v}: <b>{n}</b></span> : null;

    // ---------- ملخص المشروع: صفحة كاملة (مش pop-up) ----------
    if (summaryFor) {
        return <ProjectSummaryPage proj={summaryFor} agg={summaryData} onBack={() => setSummaryFor(null)} />;
    }

    return (
        <main className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-slate-800">My Projects</h2>
                    {cloudProject && <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-1 font-semibold">📁 Open: {cloudProject.name}</span>}
                </div>
                {/* الإنشاء هنا في الهيدر بعيد عن محتوى الصفحة اللي بيسكرول */}
                <div className="flex gap-2 items-center">
                    <input className="border border-slate-300 rounded p-2 text-sm bg-white w-56" value={newName} onChange={e => setNewName(e.target.value)} placeholder="New project name..." />
                    <button onClick={doCreate} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 whitespace-nowrap">+ Create</button>
                    <button onClick={load} disabled={busy} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                        ↻ Refresh
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* ---------- Dashboard: كل المشاريع ---------- */}
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Dashboard — all projects</p>
                    {rows === null ? (
                        <p className="text-sm text-slate-400">Loading...</p>
                    ) : (
                        <div className="grid grid-cols-6 gap-2">
                            {statCard(rows.length, 'Projects')}
                            {statCard(tot.cases, 'Test cases')}
                            {statCard(tot.bugs, 'Bugs')}
                            {statCard(tot.runs, 'Runs')}
                            {statCard(tot.exec, 'Executions')}
                            {statCard(passRate + '%', 'Pass rate', 'bg-blue-50 border-blue-200')}
                        </div>
                    )}
                </div>

                {/* ---------- تفاصيل مشروع مختار ---------- */}
                {sel && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 text-sm">📊 <span>Project details</span>: {sel.name}</h3>
                            <button onClick={() => setSel(null)} className="text-slate-500 hover:text-slate-800 text-xs">✕ close</button>
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                            {statCard(sel.d.scenarios, 'Scenarios')}
                            {statCard(sel.d.caseCount, 'Test cases')}
                            {statCard(sel.d.bugCount, 'Bugs', sel.d.bugCount ? 'bg-red-50 border-red-200 text-red-700' : '')}
                            {statCard(sel.d.runCount, 'Runs')}
                            {statCard(sel.d.executions, 'Executions')}
                            {statCard(sel.d.passRate + '%', 'Pass rate', 'bg-blue-50 border-blue-200')}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {chip('Scenarios ✓', sel.d.scenarios)}
                            {chip('Positive', sel.d.scTypes.Positive)}{chip('Negative', sel.d.scTypes.Negative)}{chip('Edge', sel.d.scTypes['Edge Case'])}
                            {chip('Cases ✓', sel.d.caseCount)}
                            {chip('Positive', sel.d.caseTypes.Positive)}{chip('Negative', sel.d.caseTypes.Negative)}{chip('Edge', sel.d.caseTypes['Edge Case'])}
                            {chip('Exec ✓', sel.d.executions)}
                            {chip('Pass', sel.d.passes)}{chip('Fail', sel.d.fails)}{chip('Blocked', sel.d.blocked)}{chip('Skipped', sel.d.skipped)}{chip('Untested', sel.d.untested)}
                            {chip('Bugs ✓', sel.d.bugCount)}
                            {chip('Critical', sel.d.bugSev.Critical)}{chip('High', sel.d.bugSev.High)}{chip('Medium', sel.d.bugSev.Medium)}{chip('Low', sel.d.bugSev.Low)}
                            {chip('Gaps ✓', sel.d.gapCount)}{chip('High gaps', sel.d.gapHigh)}
                        </div>
                        {sel.d.runRows.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs border border-slate-200">
                                    <thead><tr className="bg-blue-600 text-white text-left">
                                        <th className="p-1.5">Run</th><th className="p-1.5">Name</th><th className="p-1.5">Date</th><th className="p-1.5">Build</th>
                                        <th className="p-1.5">Pass</th><th className="p-1.5">Fail</th><th className="p-1.5">Blocked</th><th className="p-1.5">Skipped</th><th className="p-1.5">Untested</th>
                                    </tr></thead>
                                    <tbody>
                                        {sel.d.runRows.map((r, i) => (
                                            <tr key={i} className={i % 2 ? 'bg-white' : 'bg-slate-50'}>
                                                <td className="p-1.5 border-t border-slate-200 font-bold text-blue-700">{r.id}</td>
                                                <td className="p-1.5 border-t border-slate-200">{r.name}</td>
                                                <td className="p-1.5 border-t border-slate-200">{r.date || '—'}</td>
                                                <td className="p-1.5 border-t border-slate-200">{r.build || '—'}</td>
                                                <td className="p-1.5 border-t border-slate-200 text-center text-green-700 font-semibold">{r.pass}</td>
                                                <td className="p-1.5 border-t border-slate-200 text-center text-red-700 font-semibold">{r.fail}</td>
                                                <td className="p-1.5 border-t border-slate-200 text-center text-amber-700 font-semibold">{r.blocked}</td>
                                                <td className="p-1.5 border-t border-slate-200 text-center">{r.skipped}</td>
                                                <td className="p-1.5 border-t border-slate-200 text-center">{r.untested}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <p className="text-[10px] text-slate-400">{tr('These stats are from the last cloud save of the project')} ({cloudProject && cloudProject.id === sel.id ? tr('open now') : tr('not currently open')}).</p>
                    </div>
                )}

                {/* ---------- المشاريع ---------- */}
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2"><span>Your projects</span> ({rows ? rows.length : 0}) — <span>press a project name to open its user stories</span></p>
                    {rows === null ? (
                        <p className="text-sm text-slate-400">Loading...</p>
                    ) : rows.length === 0 ? (
                        <p className="text-sm text-slate-400">No projects yet — create the first one from the header above.</p>
                    ) : (
                        <div className="space-y-1.5">
                            {rows.map(p => {
                                const active = cloudProject && cloudProject.id === p.id;
                                const isOpen = expanded === p.id;
                                const storyList = p.stories || [];
                                return (
                                    <div key={p.id} className={`rounded-lg border text-xs ${active ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200'}`}>
                                        {/* صف المشروع: الاسم clickable (toggle) + الأزرار */}
                                        <div className="p-2.5">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setExpanded(isOpen ? null : p.id)} className="flex-1 flex items-center gap-2 text-left min-w-0" title="Show / hide user stories">
                                                    <span className="text-slate-400 w-3 flex-shrink-0">{isOpen ? '▾' : '▸'}</span>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-slate-800 text-sm truncate">{p.name}{active && <span className="text-blue-600"> (open)</span>}</p>
                                                        <p className="text-[10px] text-slate-400">saved: {p.savedAt ? new Date(p.savedAt).toLocaleString() : 'never'} · {storyList.length} story(ies)</p>
                                                    </div>
                                                </button>
                                                <button onClick={() => showDetail(p)} disabled={busy} className="text-slate-600 border border-slate-200 rounded px-2 py-1 hover:bg-slate-100">📊</button>
                                                <button onClick={() => openProjectSummary(p)} disabled={busy} title="Project summary" className="text-slate-600 border border-slate-200 rounded px-2 py-1 hover:bg-slate-100">📈</button>
                                                <button onClick={() => setShareFor(p)} disabled={busy} title="Share read-only link" className="text-slate-600 border border-slate-200 rounded px-2 py-1 hover:bg-slate-100">🔗</button>
                                                <button onClick={() => doOpen(p)} disabled={busy} className="bg-blue-600 text-white px-2.5 py-1 rounded font-medium hover:bg-blue-700 disabled:opacity-50">Open project</button>
                                                <button onClick={() => doRename(p)} className="text-slate-600 hover:underline">Rename</button>
                                                <button onClick={() => doDelete(p)} className="text-red-600 hover:underline">Delete</button>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                {chip('Cases', p.d.caseCount)}{chip('Bugs', p.d.bugCount)}{chip('Runs', p.d.runCount)}{chip('Exec', p.d.executions)}
                                                {p.d.executions ? chip('Pass rate', Math.round((p.d.passes / p.d.executions) * 100) + '%') : null}
                                            </div>
                                        </div>
                                        {/* ---------- يوزر ستوريز المشروع (Accordion) ---------- */}
                                        {isOpen && (
                                            <div className="border-t border-slate-200 p-2.5 space-y-1.5 bg-slate-50/60">
                                                <p className="text-[10px] font-bold text-slate-500 uppercase">📖 User Stories ({storyList.length})</p>
                                                {storyList.length === 0 && (
                                                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5">No user stories — create the first one from below ⬇</p>
                                                )}
                                                {storyList.map(s => {
                                                    const sActive = active && cloudStory && cloudStory.id === s.id;
                                                    return (
                                                        <div key={s.id} className={`rounded border p-1.5 flex items-center gap-2 text-[11px] text-slate-700 ${sActive ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200'}`}>
                                                            <span className="flex-1 truncate">📖 {s.name}{sActive && <span className="text-blue-600 font-semibold"> (open)</span>}</span>
                                                            <button onClick={() => openStory(p, s)} disabled={busy} className="bg-blue-600 text-white px-2 py-0.5 rounded font-medium hover:bg-blue-700 disabled:opacity-50">Open story</button>
                                                            <button onClick={() => renameStory(p, s)} className="text-slate-600 hover:underline">Rename</button>
                                                            <button onClick={() => deleteStory(p, s)} className="text-red-600 hover:underline">Delete</button>
                                                        </div>
                                                    );
                                                })}
                                                <div className="flex gap-1.5">
                                                    <input className="flex-1 border border-slate-300 rounded p-1 text-[11px] bg-white" value={newStoryFor === p.id ? newStoryName : ''} onChange={e => { setNewStoryFor(p.id); setNewStoryName(e.target.value); }} placeholder="New user story name..." />
                                                    <button onClick={() => createStory(p)} disabled={busy || !(newStoryFor === p.id && newStoryName.trim())} className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded text-[11px] font-medium disabled:opacity-50 whitespace-nowrap">+ New Story</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {msg && <p className={`text-xs rounded p-2 border max-w-2xl ${msg.startsWith('✔') ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-600 bg-red-50 border-red-100'}`}>{msg}</p>}

                {/* ---------- مودال المشاركة (قراءة فقط) ---------- */}
                {shareFor && (
                    <ShareModal
                        project={shareFor}
                        stories={shareFor.stories || []}
                        cloudProject={cloudProject}
                        onClose={() => setShareFor(null)}
                    />
                )}
            </div>
        </main>
    );
}

/* =====================================================================
   ملخص المشروع: نفس صفحة Summary Report بتاعة اليوزر ستوري بالظبط —
   لكن على نطاق المشروع كله: كل اليوزر ستوريز وكل الفيتشرز متجمعين
   (الجابس + السيناريوهات + الكيسز + الجولات + الباجز) والتغطية والتقرير.
   البيانات بتيجي مجهزة ومبصومة (US1-/US2-) من openProjectSummary.
   ===================================================================== */
function ProjectSummaryPage({ proj, agg, onBack }) {
    const gapData = agg ? agg.gapData : null;
    const scData = agg ? agg.scData : [];
    const data = agg ? agg.data : { scenarios: [], testCases: [] };
    const bugs = agg ? agg.bugs : [];
    const runs = agg ? agg.runs : [];
    const [sumBy, setSumBy] = useState(() => localStorage.getItem('wakil_sum_by') || 'QA Team');
    const [src, setSrc] = useState('0');

    useEffect(() => { try { localStorage.setItem('wakil_sum_by', sumBy); } catch (e) { /* ignore */ } }, [sumBy]);
    useEffect(() => { if (runs.length && (Number(src) >= runs.length || Number(src) < 0)) setSrc('0'); }, [runs]);

    const cases = data?.testCases || [];
    const scenarios = (() => {
        const m = new Map();
        [...(scData || []), ...((data?.scenarios) || [])].forEach(sc => { if (sc?.id && !m.has(sc.id)) m.set(sc.id, sc); });
        return [...m.values()];
    })();
    const allGaps = gapData ? flattenGaps(gapData) : [];
    const sourceRun = runs[Number(src)] || null;
    const statusOf = (tc) => sourceRun ? (sourceRun.results[tcRunKey(tc)] || 'Untested') : 'Untested';

    const exec = { Pass: 0, Fail: 0, Blocked: 0, Skipped: 0, Untested: 0 };
    cases.forEach(tc => { const s = statusOf(tc); exec[s] = (exec[s] || 0) + 1; });
    const executed = cases.length - exec.Untested;
    const pct = cases.length ? Math.round((executed / cases.length) * 100) : 0;
    const passRate = executed ? Math.round((exec.Pass / executed) * 100) : 0;

    const gapCount = (fn) => allGaps.filter(fn).length;
    const bugCount = (fn) => bugs.filter(fn).length;
    const openBugs = bugs.filter(b => b.status !== 'Closed' && b.status !== 'Rejected');

    // Coverage: سيناريو → كام كيس → نتايج → باجز (مع عمود اليوزر ستوري)
    const covRows = scenarios.map(sc => {
        const tcs = cases.filter(tc => tc.scenarioId === sc.id);
        const c = { Pass: 0, Fail: 0, Blocked: 0, Skipped: 0, Untested: 0 };
        tcs.forEach(tc => { c[statusOf(tc)] = (c[statusOf(tc)] || 0) + 1; });
        const bugList = bugs.filter(b => tcs.some(tc => b.testCaseId === tc.id));
        const state = !tcs.length ? 'No cases' : ((c.Fail + c.Blocked + c.Untested + c.Skipped) === 0 ? 'All passed' : 'In progress');
        return { sc, n: tcs.length, c, bugs: bugList, state };
    });
    const uncovered = covRows.filter(r => r.n === 0).length;

    const card = (value, label, cls = 'bg-white border-slate-200 text-slate-800') => (
        <div className={'border rounded-lg p-2 text-center text-xs ' + cls}>
            <div className="text-lg font-bold">{value}</div>{label}
        </div>
    );

    /* تقرير Word/PDF — نفس تقرير Summary Report + عمود اليوزر ستوري + اسم المشروع */
    const buildReportHtml = () => {
        const date = new Date().toISOString().slice(0, 10);
        const srcLabel = sourceRun ? `${sourceRun._story || ''} · ${sourceRun.id} — ${escHtml(sourceRun.name)} (${escHtml(sourceRun.date)}${sourceRun.build ? ', ' + escHtml(sourceRun.build) : ''})` : 'No Test Run executed yet';
        const covState = (s) => `<span class="${s === 'All passed' ? 'Pass' : s === 'In progress' ? 'Blocked' : 'Fail'}">${s}</span>`;
        return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><title>Project Test Summary Report</title>
<style>
body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1e293b}
h1{color:#1d4ed8;font-size:22pt;margin-bottom:2pt} h2{color:#1d4ed8;font-size:15pt;border-bottom:1px solid #cbd5e1;padding-bottom:2pt;margin-top:18pt}
table{border-collapse:collapse;width:100%;margin:6pt 0}
td,th{border:1px solid #94a3b8;padding:4pt;vertical-align:top;font-size:9.5pt}
th{background:#2563eb;color:#ffffff;text-align:left}
.meta td{border:none;padding:2pt 6pt 2pt 0;font-size:11pt}
.High{color:#b91c1c;font-weight:bold} .Medium{color:#b45309;font-weight:bold} .Low{color:#15803d;font-weight:bold}
.Critical{color:#7f1d1d;font-weight:bold} .Pass{color:#15803d;font-weight:bold} .Fail{color:#b91c1c;font-weight:bold} .Blocked{color:#b45309;font-weight:bold} .Skipped{color:#64748b} .Untested{color:#94a3b8}
.note{color:#64748b;font-size:9.5pt;font-style:italic}
.sign td{border:none;padding:14pt 18pt 2pt 0;font-size:11pt}
</style></head><body>
<h1>Project Test Summary Report</h1>
<table class="meta">
<tr><td><b>Project:</b></td><td>${escHtml(proj.name || 'N/A')}</td></tr>
<tr><td><b>Prepared by:</b></td><td>${escHtml(sumBy.trim() || 'QA Team')}</td></tr>
<tr><td><b>Date:</b></td><td>${date}</td></tr>
<tr><td><b>Execution source:</b></td><td>${srcLabel}</td></tr>
</table>
<h2>1. Executive Summary</h2>
<p>The project was analyzed and tested end to end: <b>${gapData?.sections?.length || 0}</b> requirement section(s) reviewed with <b>${allGaps.length}</b> gap(s) raised, <b>${scenarios.length}</b> test scenario(s) designed, <b>${cases.length}</b> test case(s) created and <b>${executed}</b> executed (${pct}%). The run pass rate is <b>${passRate}%</b> with <b>${bugs.length}</b> bug(s) reported (${openBugs.length} still open).</p>
<table>
<tr><th>Executed</th><th>% Executed</th><th>Pass</th><th>Fail</th><th>Blocked</th><th>Skipped</th><th>Untested</th><th>Pass Rate</th></tr>
<tr><td>${executed}/${cases.length}</td><td>${pct}%</td><td>${exec.Pass}</td><td>${exec.Fail}</td><td>${exec.Blocked}</td><td>${exec.Skipped}</td><td>${exec.Untested}</td><td><b>${passRate}%</b></td></tr>
</table>
<h2>2. Requirements Analysis Summary</h2>
<table>
<tr><th>Sections analyzed</th><th>Total gaps</th><th>High</th><th>Medium</th><th>Low</th><th>Still open questions</th></tr>
<tr><td>${gapData?.sections?.length || 0}</td><td>${allGaps.length}</td><td>${gapCount(g => g.priority === 'High')}</td><td>${gapCount(g => g.priority === 'Medium')}</td><td>${gapCount(g => g.priority === 'Low')}</td><td>${gapCount(g => g.status === 'Open')}</td></tr>
</table>
${allGaps.length ? `<table><tr><th>Gap ID</th><th>Priority</th><th>Description</th><th>Status</th></tr>${allGaps.map(g => `<tr><td>${escHtml(g.id)}</td><td class="${g.priority}">${escHtml(g.priority)}</td><td>${escHtml(g.description)}</td><td>${escHtml(g.status)}</td></tr>`).join('')}</table>` : '<p class="note">No requirement gap analysis was run for this scope.</p>'}
<h2>3. Test Design Summary</h2>
<table>
<tr><th></th><th>Positive</th><th>Negative</th><th>Edge Case</th><th>Total</th></tr>
<tr><th>Scenarios</th><td>${scenarios.filter(s => s.type === 'Positive').length}</td><td>${scenarios.filter(s => s.type === 'Negative').length}</td><td>${scenarios.filter(s => s.type === 'Edge Case').length}</td><td>${scenarios.length}</td></tr>
<tr><th>Test Cases</th><td>${cases.filter(t => t.type === 'Positive').length}</td><td>${cases.filter(t => t.type === 'Negative').length}</td><td>${cases.filter(t => t.type === 'Edge Case').length}</td><td>${cases.length}</td></tr>
</table>
<p class="note">Scenario coverage: ${scenarios.length - uncovered}/${scenarios.length} scenario(s) have at least one test case${uncovered ? ' — ' + uncovered + ' scenario(s) with NO test case yet' : ''}.</p>
<h2>4. Execution & Coverage</h2>
<table><tr><th>Story</th><th>Scenario</th><th>Cases</th><th>Pass</th><th>Fail</th><th>Blocked</th><th>Untested</th><th>Bugs</th><th>State</th></tr>
${covRows.map(r => `<tr><td>${escHtml(r.sc._story || '-')}</td><td>${escHtml(r.sc.id)}${r.sc.title ? ': ' + escHtml(r.sc.title) : ''}</td><td>${r.n}</td><td>${r.c.Pass}</td><td>${r.c.Fail}</td><td>${r.c.Blocked}</td><td>${r.c.Untested + r.c.Skipped}</td><td>${r.bugs.map(b => escHtml(b.id)).join(', ') || '-'}</td><td>${covState(r.state)}</td></tr>`).join('')}
</table>
<h2>5. Bugs Summary</h2>
<table>
<tr><th>Total</th><th>Critical</th><th>High</th><th>Medium</th><th>Low</th><th>Open (not Closed/Rejected)</th></tr>
<tr><td>${bugs.length}</td><td>${bugCount(b => b.severity === 'Critical')}</td><td>${bugCount(b => b.severity === 'High')}</td><td>${bugCount(b => b.severity === 'Medium')}</td><td>${bugCount(b => b.severity === 'Low')}</td><td>${openBugs.length}</td></tr>
</table>
${bugs.length ? `<table><tr><th>Story</th><th>Bug ID</th><th>Title</th><th>Severity</th><th>Priority</th><th>Status</th><th>Linked TC</th></tr>${bugs.map(b => `<tr><td>${escHtml(b._story || '-')}</td><td>${escHtml(b.id)}</td><td>${escHtml(b.title)}</td><td class="${b.severity}">${escHtml(b.severity)}</td><td class="${b.priority}">${escHtml(b.priority)}</td><td>${escHtml(b.status)}</td><td>${escHtml(b.testCaseId || '-')}</td></tr>`).join('')}</table>` : '<p>No bugs were reported in this cycle.</p>'}
<h2>6. Sign-off</h2>
<table class="sign">
<tr><td>Prepared by (QA):</td><td>________________________</td><td>Date:</td><td>____________</td></tr>
<tr><td>Reviewed by:</td><td>________________________</td><td>Date:</td><td>____________</td></tr>
<tr><td>Approved by:</td><td>________________________</td><td>Date:</td><td>____________</td></tr>
</table>
</body></html>`;
    };

    const downloadSummaryDoc = () => downloadBlob(new Blob(['\uFEFF' + trHtml(buildReportHtml())], { type: 'application/msword;charset=utf-8' }), (proj.name || 'Project').replace(/[\\/:*?"<>|]/g, '_') + '_Project_Summary.doc');

    const downloadSummaryPDF = () => {
        const el = document.createElement('div');
        el.innerHTML = buildReportHtml();
        el.style.cssText = 'font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1e293b;padding:24px;background:#ffffff;';
        document.body.appendChild(el);
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js').then(() => {
            window.html2pdf().from(el).set({
                margin: [10, 10],
                filename: (proj.name || 'Project').replace(/[\\/:*?"<>|]/g, '_') + '_Project_Summary.pdf',
                html2canvas: { scale: 2, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).save().then(() => document.body.removeChild(el));
        }).catch(e => { document.body.removeChild(el); alert('PDF export failed: ' + e.message); });
    };

    const inp = 'w-full border border-slate-300 rounded p-1.5 text-xs bg-white';
    const hasAny = allGaps.length || scenarios.length || cases.length || bugs.length;

    return (
        <main className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <button onClick={onBack} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium">← {tr('Back')}</button>
                    <h2 className="text-lg font-bold text-slate-800">📈 {tr('Project Summary')}: {proj.name}</h2>
                </div>
                <div className="flex gap-2">
                    <button onClick={downloadSummaryPDF} disabled={!hasAny} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">⬇ {tr('Download PDF')}</button>
                    <button onClick={downloadSummaryDoc} disabled={!hasAny} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">⬇ {tr('Download Word')}</button>
                </div>
            </div>
            <div className="flex-1 flex overflow-hidden">
                <div className="w-1/3 border-r border-slate-200 p-4 bg-slate-50 overflow-y-auto space-y-4">
                    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                        <p className="font-bold text-slate-500 uppercase">Report settings</p>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Project:</label>
                            <input className={inp} value={proj.name} readOnly />
                        </div>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Prepared by:</label>
                            <input className={inp} value={sumBy} onChange={e => setSumBy(e.target.value)} placeholder="QA Team" />
                        </div>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Execution source:</label>
                            <select className={inp} value={src} onChange={e => setSrc(e.target.value)}>
                                <option value="">— no runs yet —</option>
                                {runs.map((r, i) => <option key={i} value={String(i)}>{r._story} · {r.id} · {r.name}{r.date ? ' (' + r.date + ')' : ''}</option>)}
                            </select>
                            <p className="text-[10px] text-slate-400 mt-1">{tr('Execution is calculated from a Test Run — create one and log its results first.')}</p>
                        </div>
                    </div>
                    {!hasAny && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
                            <p className="font-bold">{tr('Not enough data for a report yet.')}</p>
                            <p>{tr('The report aggregates from: Requirement Gaps + Test Scenarios + Test Generation + Test Runs + Bug Report — across ALL user stories of the project.')}</p>
                        </div>
                    )}
                </div>
                <div className="w-2/3 p-6 overflow-y-auto space-y-5">
                    {!hasAny ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-center px-8">
                            {tr('The summary is aggregated automatically from all pages of ALL user stories: analysis, scenarios, cases, runs, and bugs.')}
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-5 gap-2">
                                {card(gapData?.sections?.length || 0, tr('Sections analyzed'))}
                                {card(allGaps.length, tr('Gaps'), 'bg-white border-red-200 text-red-700')}
                                {card(gapCount(g => g.status === 'Open'), tr('Open questions'), 'bg-amber-50 border-amber-200 text-amber-700')}
                                {card(scenarios.length, tr('Scenarios'))}
                                {card(cases.length, tr('Test cases'))}
                                {card(`${pct}%`, tr('Executed'), 'bg-blue-50 border-blue-200 text-blue-700')}
                                {card(exec.Pass, tr('Pass'), 'bg-green-50 border-green-200 text-green-700')}
                                {card(exec.Fail, tr('Fail'), 'bg-red-50 border-red-200 text-red-700')}
                                {card(exec.Blocked + exec.Skipped, tr('Blocked/Skipped'), 'bg-amber-50 border-amber-200 text-amber-700')}
                                {card(`${passRate}%`, tr('Pass rate'), 'bg-white border-slate-200')}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                                    <p className="font-bold text-slate-500 uppercase">{tr('Bugs')}</p>
                                    <div className="grid grid-cols-5 gap-1 text-center">
                                        <div><div className="text-base font-bold text-slate-800">{bugs.length}</div><span className="text-slate-400">{tr('Total')}</span></div>
                                        <div><div className="text-base font-bold text-red-900">{bugCount(b => b.severity === 'Critical')}</div><span className="text-slate-400">{tr('Critical')}</span></div>
                                        <div><div className="text-base font-bold text-red-700">{bugCount(b => b.severity === 'High')}</div><span className="text-slate-400">{tr('High')}</span></div>
                                        <div><div className="text-base font-bold text-amber-700">{bugCount(b => b.severity === 'Medium')}</div><span className="text-slate-400">{tr('Medium')}</span></div>
                                        <div><div className="text-base font-bold text-slate-800">{openBugs.length}</div><span className="text-slate-400">{tr('Open')}</span></div>
                                    </div>
                                </div>
                                <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                                    <p className="font-bold text-slate-500 uppercase">{tr('Coverage')}</p>
                                    <p className="text-slate-600">{scenarios.length - uncovered} / {scenarios.length} {tr('scenario(s) have test cases')}</p>
                                    {uncovered > 0 && <p className="text-red-600 font-semibold">⚠ {uncovered} {tr('scenario(s) with NO test case')}</p>}
                                    <p className="text-slate-400">{sourceRun ? tr('Execution source') + ': ' + (sourceRun._story || '') + ' · ' + sourceRun.id + ' — ' + sourceRun.name : tr('Execution source') + ': ' + tr('current saved statuses')}</p>
                                </div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                                <p className="font-bold text-slate-700 text-sm">{tr('Execution & Coverage by Scenario')}</p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs border border-slate-200">
                                        <thead>
                                            <tr className="bg-blue-600 text-white text-left">
                                                <th className="p-2">{tr('Story')}</th><th className="p-2">{tr('Scenario')}</th><th className="p-2">{tr('Cases')}</th><th className="p-2">{tr('Pass')}</th>
                                                <th className="p-2">{tr('Fail')}</th><th className="p-2">{tr('Blocked')}</th><th className="p-2">{tr('Untested')}</th>
                                                <th className="p-2">{tr('Bugs')}</th><th className="p-2">{tr('State')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {covRows.length === 0 && <tr><td colSpan="9" className="p-4 text-center text-slate-400">{tr('No test scenarios yet.')}</td></tr>}
                                            {covRows.map((r, i) => (
                                                <tr key={i} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                                                    <td className="p-2 border-t border-slate-200 text-slate-500">{r.sc._story || '-'}</td>
                                                    <td className="p-2 border-t border-slate-200"><b>{r.sc.id}</b>{r.sc.title ? ': ' + r.sc.title : ''}</td>
                                                    <td className="p-2 border-t border-slate-200 text-center">{r.n}</td>
                                                    <td className="p-2 border-t border-slate-200 text-center text-green-700 font-semibold">{r.c.Pass}</td>
                                                    <td className="p-2 border-t border-slate-200 text-center text-red-700 font-semibold">{r.c.Fail}</td>
                                                    <td className="p-2 border-t border-slate-200 text-center text-amber-700 font-semibold">{r.c.Blocked}</td>
                                                    <td className="p-2 border-t border-slate-200 text-center text-slate-500">{r.c.Untested + r.c.Skipped}</td>
                                                    <td className="p-2 border-t border-slate-200 text-center">{r.bugs.map(b => b.id).join(', ') || '-'}</td>
                                                    <td className={'p-2 border-t border-slate-200 font-semibold ' + (r.state === 'All passed' ? 'text-green-700' : r.state === 'No cases' ? 'text-red-600' : 'text-amber-700')}>{r.state}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            {bugs.length > 0 && (
                                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                                    <p className="font-bold text-slate-700 text-sm">{tr('Bugs')}</p>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs border border-slate-200">
                                            <thead>
                                                <tr className="bg-blue-600 text-white text-left">
                                                    <th className="p-2">{tr('Story')}</th><th className="p-2">{tr('Bug')}</th><th className="p-2">{tr('Title')}</th><th className="p-2">{tr('Severity')}</th>
                                                    <th className="p-2">{tr('Priority')}</th><th className="p-2">{tr('Status')}</th><th className="p-2">TC</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bugs.map((b, i) => (
                                                    <tr key={i} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                                                        <td className="p-2 border-t border-slate-200 text-slate-500">{b._story || '-'}</td>
                                                        <td className="p-2 border-t border-slate-200 font-bold text-blue-700">{b.id}</td>
                                                        <td className="p-2 border-t border-slate-200">{b.title}</td>
                                                        <td className={'p-2 border-t border-slate-200 font-semibold ' + (b.severity === 'Critical' ? 'text-red-900' : b.severity === 'High' ? 'text-red-700' : b.severity === 'Medium' ? 'text-amber-700' : 'text-green-700')}>{b.severity}</td>
                                                        <td className="p-2 border-t border-slate-200">{b.priority}</td>
                                                        <td className="p-2 border-t border-slate-200">{b.status}</td>
                                                        <td className="p-2 border-t border-slate-200">{b.testCaseId || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}
