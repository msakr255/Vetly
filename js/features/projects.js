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

// إحصائيات مفصلة من payload مشروع واحد
function computeProjectDetail(pay) {
    const cases = parseJ(pay.wakil_ai_data, { scenarios: [], testCases: [] });
    const scPage = parseJ(pay.wakil_sc_data, []);
    const casesArr = cases.testCases || [];
    const scMap = new Map();
    (scPage || []).forEach(s => { if (s && s.id && !scMap.has(s.id)) scMap.set(s.id, s); });
    ((cases && cases.scenarios) || []).forEach(s => { if (s && s.id && !scMap.has(s.id)) scMap.set(s.id, s); });
    const scenarios = [...scMap.values()];
    const bugs = parseJ(pay.wakil_bugs, []);
    const runs = parseJ(pay.wakil_runs, []);
    const gaps = parseJ(pay.wakil_gap_data, null);

    const countBy = (arr, key, values) => {
        const m = {}; values.forEach(v => { m[v] = 0; });
        (arr || []).forEach(x => { const k = x[key] || values[0]; m[k] = (m[k] || 0) + 1; });
        return m;
    };
    const caseTypes = countBy(casesArr, 'type', ['Positive', 'Negative', 'Edge Case']);
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

    const gapRows = gaps && gaps.sections
        ? gaps.sections.reduce((a, sec) => a + ((sec.gaps && sec.gaps.length) || 0), 0) + ((gaps.cross && gaps.cross.length) || 0)
        : 0;
    const gapHigh = gaps ? [].concat(...(gaps.sections || []).map(s => s.gaps || []), gaps.cross || []).filter(g => g.priority === 'High').length : 0;

    return {
        scenarios: scenarios.length,
        scTypes: countBy(scenarios, 'type', ['Positive', 'Negative', 'Edge Case']),
        caseCount: casesArr.length,
        caseTypes,
        bugCount: bugs.length, bugSev, bugStatus,
        runCount: runs.length, runRows,
        executions, passes, fails, blocked, skipped, untested,
        passRate: executions ? Math.round((passes / executions) * 100) : 0,
        gapCount: gapRows, gapHigh
    };
}

function ProjectsPage({ cloudProject, setCloudProject }) {
    const [rows, setRows] = useState(null);   // إحصائيات كل المشاريع (Dashboard)
    const [sel, setSel] = useState(null);      // تفاصيل مشروع مختار { id, name, d }
    const [newName, setNewName] = useState('');
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);

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
            const pay = (s && s.payload) || {};
            const d = computeProjectDetail(pay);
            return { id: p.id, name: p.name, savedAt: s ? s.updated_at : null, d };
        }));
    };

    useEffect(() => { load(); }, []);

    // حفظ المشروع المفتوح حاليًا قبل أي تبديل (ضمانة فوق الحفظ التلقائي)
    const saveCurrent = async () => {
        if (cloudProject && cloudProject.id) await sbSaveSnapshot(cloudProject.id);
    };

    // فتح مشروع: فضّي الشغل المحلي الأول، وبعدين طبّق داتا المشروع لو فيها.
    // كل مشروع بيبقى عالم منفصل: جديد = فاضي، قديم = داتاه هو بس.
    const doOpen = async (p) => {
        setBusy(true); setMsg('');
        await saveCurrent();
        const r = await sbLoadSnapshot(p.id);
        if (r.error) { setBusy(false); setMsg(r.error.message); return; }
        const payload = (r.data && r.data.payload) || null;
        if (!payload) {
            // مشروع فاضي في السحابة: لو على الجهاز ده شغل محلي لسه متربطش بأي مشروع ⇒ اعرض رفعه
            if (sbWorkspaceHasContent() && (!cloudProject || !cloudProject.id)) {
                if (!window.confirm('المشروع فاضي في السحابة، وعلى الجهاز ده شغل محلي لسه من غير مشروع.\nتحب ترفعه وتربطه بالمشروع ده؟')) {
                    sbWorkspaceClear();
                    localStorage.setItem('wakil_cloud_project', JSON.stringify({ id: p.id, name: p.name }));
                    setCloudProject({ id: p.id, name: p.name });
                    location.reload();
                    return;
                }
                const up = await sbSaveSnapshot(p.id);
                if (up.error) { setBusy(false); setMsg(up.error.message); return; }
                localStorage.setItem('wakil_cloud_project', JSON.stringify({ id: p.id, name: p.name }));
                setCloudProject({ id: p.id, name: p.name });
                location.reload();
                return;
            }
            sbWorkspaceClear();
        } else {
            sbWorkspaceClear();
            sbWorkspaceApply(payload);
        }
        localStorage.setItem('wakil_cloud_project', JSON.stringify({ id: p.id, name: p.name }));
        setCloudProject({ id: p.id, name: p.name });
        location.reload();
    };

    const doCreate = async () => {
        if (!newName.trim()) { setMsg('Write a project name first.'); return; }
        setBusy(true); setMsg('');
        const r = await sbCreateProject(newName.trim());
        if (r.error) { setBusy(false); setMsg(r.error.message); return; }
        const p = { id: r.data.id, name: r.data.name };
        // لو مفيش مشروع مفتوح وعلى الجهاز ده شغل محلي من غير ربط ⇒ اعرض رفعه على الجديد
        if (!cloudProject && sbWorkspaceHasContent()) {
            if (window.confirm('عندك شغل محلي على الجهاز ده من غير مشروع مفتوح.\nتحب ترفعه وتربطه بالمشروع الجديد "' + p.name + '"؟')) {
                await sbSaveSnapshot(p.id);
                localStorage.setItem('wakil_cloud_project', JSON.stringify(p));
                setCloudProject(p);
                location.reload();
                return;
            }
        }
        await saveCurrent();
        // مشروع جديد = فاضي: فضّي كل الميزات وابدأ صفحة نظيفة
        sbWorkspaceClear();
        localStorage.setItem('wakil_cloud_project', JSON.stringify(p));
        setCloudProject(p);
        location.reload();
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
            setCloudProject(null);
            // لو لسه في مشاريع تانية: الهبوط يكون على صفحة My Projects على طول
            if (rows && rows.length > 1) localStorage.setItem('wakil_last_page', 'projects');
            location.reload();
            return;
        }
        await load();
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

    return (
        <main className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm flex-wrap gap-2">
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
                            <h3 className="font-bold text-slate-800 text-sm">📊 Project details: {sel.name}</h3>
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
                        <p className="text-[10px] text-slate-400">الإحصائيات دي من آخر نسخة محفوظة في السحابة للمشروع ({cloudProject && cloudProject.id === sel.id ? 'المفتوح دلوقتي' : 'مش مفتوح حاليًا'}).</p>
                    </div>
                )}

                {/* ---------- المشاريع ---------- */}
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Your projects ({rows ? rows.length : 0})</p>
                    {rows === null ? (
                        <p className="text-sm text-slate-400">Loading...</p>
                    ) : rows.length === 0 ? (
                        <p className="text-sm text-slate-400">مفيش مشاريع لسه — اعمل أول واحد من تحت.</p>
                    ) : (
                        <div className="space-y-1.5">
                            {rows.map(p => {
                                const active = cloudProject && cloudProject.id === p.id;
                                return (
                                    <div key={p.id} className={`rounded-lg border p-2.5 text-xs ${active ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200'}`}>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <p className="font-semibold text-slate-800 text-sm">{p.name}{active && <span className="text-blue-600"> (open)</span>}</p>
                                                <p className="text-[10px] text-slate-400">saved: {p.savedAt ? new Date(p.savedAt).toLocaleString() : 'never'}</p>
                                            </div>
                                            <button onClick={() => showDetail(p)} disabled={busy} className="text-slate-600 border border-slate-200 rounded px-2 py-1 hover:bg-slate-100">📊 Stats</button>
                                            <button onClick={() => doOpen(p)} disabled={busy} className="bg-blue-600 text-white px-2.5 py-1 rounded font-medium hover:bg-blue-700 disabled:opacity-50">Open</button>
                                            <button onClick={() => doRename(p)} className="text-slate-600 hover:underline">Rename</button>
                                            <button onClick={() => doDelete(p)} className="text-red-600 hover:underline">Delete</button>
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            {chip('Cases', p.d.caseCount)}{chip('Bugs', p.d.bugCount)}{chip('Runs', p.d.runCount)}{chip('Exec', p.d.executions)}
                                            {p.d.executions ? chip('Pass rate', Math.round((p.d.passes / p.d.executions) * 100) + '%') : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {msg && <p className={`text-xs rounded p-2 border max-w-2xl ${msg.startsWith('✔') ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-600 bg-red-50 border-red-100'}`}>{msg}</p>}
            </div>
        </main>
    );
}
