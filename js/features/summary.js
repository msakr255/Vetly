/* =====================================================================
   features/summary.js
   ميزة Summary Report: تجميع كل مخرجات الأداة (Gaps + Scenarios + Test Cases
   + Execution + Bugs) في Dashboard واحد + تقرير ملخص نهائي (Word).
   ===================================================================== */

const SUM_STATUSES = ['Pass', 'Fail', 'Blocked', 'Skipped', 'Untested'];

function SummaryPage({ gapData, scData, data, bugs, runs, setPage }) {
    const [sumProject, setSumProject] = useState(() => localStorage.getItem('wakil_sum_project') || '');
    const [sumBy, setSumBy] = useState(() => localStorage.getItem('wakil_sum_by') || 'QA Team');
    const [src, setSrc] = useState(() => (runs.length ? runs[runs.length - 1].id : ''));

    useEffect(() => {
        localStorage.setItem('wakil_sum_project', sumProject);
        localStorage.setItem('wakil_sum_by', sumBy);
    }, [sumProject, sumBy]);

    // لو الجولة المختارة اتحدفت (أو أول ما تيجي والصفحة مفتوحة) نختار آخر جولة
    useEffect(() => {
        if (runs.length && !runs.some(r => r.id === src)) setSrc(runs[runs.length - 1].id);
    }, [runs]);

    const cases = data?.testCases || [];
    const scenarios = (() => {
        const m = new Map();
        [...(scData || []), ...((data?.scenarios) || [])].forEach(sc => { if (sc?.id && !m.has(sc.id)) m.set(sc.id, sc); });
        return [...m.values()];
    })();
    const allGaps = gapData ? flattenGaps(gapData) : [];
    const sourceRun = runs.find(r => r.id === src) || null;
    // نتايج التنفيذ بتيجي من جولة Test Runs (مفيش status على الكيس نفسه)
    const statusOf = (tc) => sourceRun ? (sourceRun.results[tcRunKey(tc)] || 'Untested') : 'Untested';

    const exec = { Pass: 0, Fail: 0, Blocked: 0, Skipped: 0, Untested: 0 };
    cases.forEach(tc => { const s = statusOf(tc); exec[s] = (exec[s] || 0) + 1; });
    const executed = cases.length - exec.Untested;
    const pct = cases.length ? Math.round((executed / cases.length) * 100) : 0;
    const passRate = executed ? Math.round((exec.Pass / executed) * 100) : 0;

    const gapCount = (fn) => allGaps.filter(fn).length;
    const bugCount = (fn) => bugs.filter(fn).length;
    const openBugs = bugs.filter(b => b.status !== 'Closed' && b.status !== 'Rejected');

    // Coverage: سيناريو → كام كيس → نتايج → باجز
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
        <div className={`border rounded-lg p-2 text-center text-xs ${cls}`}>
            <div className="text-lg font-bold">{value}</div>{label}
        </div>
    );

    /* ---------- تقرير Word ---------- */
    const downloadSummaryDoc = () => {
        const date = new Date().toISOString().slice(0, 10);
        const srcLabel = sourceRun ? `${sourceRun.id} — ${escHtml(sourceRun.name)} (${escHtml(sourceRun.date)}${sourceRun.build ? ', ' + escHtml(sourceRun.build) : ''})` : 'No Test Run executed yet';
        const covState = (s) => `<span class="${s === 'All passed' ? 'Pass' : s === 'In progress' ? 'Blocked' : 'Fail'}">${s}</span>`;
        let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><title>Test Summary Report</title>
<style>
body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1e293b}
h1{color:#1d4ed8;font-size:22pt;margin-bottom:2pt} h2{color:#1d4ed8;font-size:15pt;border-bottom:1px solid #cbd5e1;padding-bottom:2pt;margin-top:18pt} h3{font-size:12pt;color:#0f172a;margin-top:12pt}
table{border-collapse:collapse;width:100%;margin:6pt 0}
td,th{border:1px solid #94a3b8;padding:4pt;vertical-align:top;font-size:9.5pt}
th{background:#2563eb;color:#ffffff;text-align:left}
.meta td{border:none;padding:2pt 6pt 2pt 0;font-size:11pt}
.High{color:#b91c1c;font-weight:bold} .Medium{color:#b45309;font-weight:bold} .Low{color:#15803d;font-weight:bold}
.Critical{color:#7f1d1d;font-weight:bold} .Pass{color:#15803d;font-weight:bold} .Fail{color:#b91c1c;font-weight:bold} .Blocked{color:#b45309;font-weight:bold} .Skipped{color:#64748b} .Untested{color:#94a3b8}
.note{color:#64748b;font-size:9.5pt;font-style:italic}
.sign td{border:none;padding:14pt 18pt 2pt 0;font-size:11pt}
</style></head><body>
<h1>Test Summary Report</h1>
<table class="meta">
<tr><td><b>Project / Feature:</b></td><td>${escHtml(sumProject.trim() || 'N/A')}</td></tr>
<tr><td><b>Prepared by:</b></td><td>${escHtml(sumBy.trim() || 'QA Team')}</td></tr>
<tr><td><b>Date:</b></td><td>${date}</td></tr>
<tr><td><b>Execution source:</b></td><td>${srcLabel}</td></tr>
</table>

<h2>1. Executive Summary</h2>
<p>The feature was analyzed and tested end to end: <b>${gapData?.sections?.length || 0}</b> requirement section(s) reviewed with <b>${allGaps.length}</b> gap(s) raised, <b>${scenarios.length}</b> test scenario(s) designed, <b>${cases.length}</b> test case(s) created and <b>${executed}</b> of them executed (${pct}%). The run pass rate is <b>${passRate}%</b> with <b>${bugs.length}</b> bug(s) reported (${openBugs.length} still open).</p>
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
<table><tr><th>Scenario</th><th>Cases</th><th>Pass</th><th>Fail</th><th>Blocked</th><th>Untested</th><th>Bugs</th><th>State</th></tr>
${covRows.map(r => `<tr><td>${escHtml(r.sc.id)}${r.sc.title ? ': ' + escHtml(r.sc.title) : ''}</td><td>${r.n}</td><td>${r.c.Pass}</td><td>${r.c.Fail}</td><td>${r.c.Blocked}</td><td>${r.c.Untested + r.c.Skipped}</td><td>${r.bugs.map(b => escHtml(b.id)).join(', ') || '-'}</td><td>${covState(r.state)}</td></tr>`).join('')}
</table>

<h2>5. Bugs Summary</h2>
<table>
<tr><th>Total</th><th>Critical</th><th>High</th><th>Medium</th><th>Low</th><th>Open (not Closed/Rejected)</th></tr>
<tr><td>${bugs.length}</td><td>${bugCount(b => b.severity === 'Critical')}</td><td>${bugCount(b => b.severity === 'High')}</td><td>${bugCount(b => b.severity === 'Medium')}</td><td>${bugCount(b => b.severity === 'Low')}</td><td>${openBugs.length}</td></tr>
</table>
${bugs.length ? `<table><tr><th>Bug ID</th><th>Title</th><th>Severity</th><th>Priority</th><th>Status</th><th>Linked TC</th></tr>${bugs.map(b => `<tr><td>${escHtml(b.id)}</td><td>${escHtml(b.title)}</td><td class="${b.severity}">${escHtml(b.severity)}</td><td class="${b.priority}">${escHtml(b.priority)}</td><td>${escHtml(b.status)}</td><td>${escHtml(b.testCaseId || '-')}</td></tr>`).join('')}</table>` : '<p>No bugs were reported in this cycle.</p>'}

<h2>6. Sign-off</h2>
<table class="sign">
<tr><td>Prepared by (QA):</td><td>________________________</td><td>Date:</td><td>____________</td></tr>
<tr><td>Reviewed by:</td><td>________________________</td><td>Date:</td><td>____________</td></tr>
<tr><td>Approved by:</td><td>________________________</td><td>Date:</td><td>____________</td></tr>
</table>
</body></html>`;
        downloadBlob(new Blob(['\uFEFF' + trHtml(html)], { type: 'application/msword;charset=utf-8' }), 'Test_Summary_Report.doc');
    };

    const inp = 'w-full border border-slate-300 rounded p-1.5 text-xs bg-white';
    const hasAny = allGaps.length || scenarios.length || cases.length || bugs.length;

    return (
        <main className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
                <h2 className="text-lg font-bold text-slate-800">Summary Report</h2>
                <div className="flex gap-2">
                    <button onClick={downloadSummaryDoc} disabled={!hasAny} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                        Download Report (Word)
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="w-1/3 border-r border-slate-200 p-4 bg-slate-50 overflow-y-auto space-y-4">
                    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                        <p className="font-bold text-slate-500 uppercase">Report settings</p>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Project / Feature name:</label>
                            <input className={inp} value={sumProject} onChange={e => setSumProject(e.target.value)} placeholder="e.g. ATM Balance Inquiry" />
                        </div>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Prepared by:</label>
                            <input className={inp} value={sumBy} onChange={e => setSumBy(e.target.value)} placeholder="QA Team" />
                        </div>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Execution source:</label>
                            <select className={inp} value={src} onChange={e => setSrc(e.target.value)}>
                                <option value="">— no runs yet —</option>
                                {runs.map(r => <option key={r.id} value={r.id}>{r.id} · {r.name}{r.date ? ' (' + r.date + ')' : ''}</option>)}
                            </select>
                            <p className="text-[10px] text-slate-400 mt-1">التنفيذ بيتحسب من جولة Test Runs — اعمل جولة وسجّل نتايجها هناك الأول.</p>
                        </div>
                    </div>

                    {!hasAny && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
                            <p className="font-bold">لسه مفيش داتا كفاية لتقرير.</p>
                            <p>التقرير بيجمّع من: Requirement Gaps + Test Scenarios + Test Generation + Test Runs + Bug Report. املا اللي متاح وأنزل التقرير.</p>
                        </div>
                    )}
                </div>

                <div className="w-2/3 p-6 overflow-y-auto space-y-5">
                    {!hasAny ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-center px-8">
                            التقرير الملخص بيتجمع تلقائي من كل الصفحات: التحليل، السيناريوهات، الكيسز، جولات التنفيذ، والباجز.
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-5 gap-2">
                                {card(gapData?.sections?.length || 0, 'Sections analyzed')}
                                {card(allGaps.length, 'Gaps', 'bg-white border-red-200 text-red-700')}
                                {card(gapCount(g => g.status === 'Open'), 'Open questions', 'bg-amber-50 border-amber-200 text-amber-700')}
                                {card(scenarios.length, 'Scenarios')}
                                {card(cases.length, 'Test cases')}
                                {card(`${pct}%`, 'Executed', 'bg-blue-50 border-blue-200 text-blue-700')}
                                {card(exec.Pass, 'Pass', 'bg-green-50 border-green-200 text-green-700')}
                                {card(exec.Fail, 'Fail', 'bg-red-50 border-red-200 text-red-700')}
                                {card(exec.Blocked + exec.Skipped, 'Blocked/Skipped', 'bg-amber-50 border-amber-200 text-amber-700')}
                                {card(`${passRate}%`, 'Pass rate', 'bg-white border-slate-200')}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                                    <p className="font-bold text-slate-500 uppercase">Bugs</p>
                                    <div className="grid grid-cols-5 gap-1 text-center">
                                        <div><div className="text-base font-bold text-slate-800">{bugs.length}</div><span className="text-slate-400">Total</span></div>
                                        <div><div className="text-base font-bold text-red-900">{bugCount(b => b.severity === 'Critical')}</div><span className="text-slate-400">Critical</span></div>
                                        <div><div className="text-base font-bold text-red-700">{bugCount(b => b.severity === 'High')}</div><span className="text-slate-400">High</span></div>
                                        <div><div className="text-base font-bold text-amber-700">{bugCount(b => b.severity === 'Medium')}</div><span className="text-slate-400">Medium</span></div>
                                        <div><div className="text-base font-bold text-slate-800">{openBugs.length}</div><span className="text-slate-400">Open</span></div>
                                    </div>
                                </div>
                                <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                                    <p className="font-bold text-slate-500 uppercase">Coverage</p>
                                    <p className="text-slate-600">{scenarios.length - uncovered} / {scenarios.length} scenario(s) have test cases</p>
                                    {uncovered > 0 && <p className="text-red-600 font-semibold">⚠ {uncovered} scenario(s) with NO test case</p>}
                                    <p className="text-slate-400">{sourceRun ? `Execution source: ${sourceRun.id} — ${sourceRun.name}` : 'Execution source: current saved statuses'}</p>
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                                <p className="font-bold text-slate-700 text-sm">Execution & Coverage by Scenario</p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs border border-slate-200">
                                        <thead>
                                            <tr className="bg-blue-600 text-white text-left">
                                                <th className="p-2">Scenario</th><th className="p-2">Cases</th><th className="p-2">Pass</th>
                                                <th className="p-2">Fail</th><th className="p-2">Blocked</th><th className="p-2">Untested</th>
                                                <th className="p-2">Bugs</th><th className="p-2">State</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {covRows.length === 0 && <tr><td colSpan="8" className="p-4 text-center text-slate-400">لسه مفيش سيناريوهات.</td></tr>}
                                            {covRows.map((r, i) => (
                                                <tr key={i} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                                                    <td className="p-2 border-t border-slate-200"><b>{r.sc.id}</b>{r.sc.title ? ': ' + r.sc.title : ''}</td>
                                                    <td className="p-2 border-t border-slate-200 text-center">{r.n}</td>
                                                    <td className="p-2 border-t border-slate-200 text-center text-green-700 font-semibold">{r.c.Pass}</td>
                                                    <td className="p-2 border-t border-slate-200 text-center text-red-700 font-semibold">{r.c.Fail}</td>
                                                    <td className="p-2 border-t border-slate-200 text-center text-amber-700 font-semibold">{r.c.Blocked}</td>
                                                    <td className="p-2 border-t border-slate-200 text-center text-slate-500">{r.c.Untested + r.c.Skipped}</td>
                                                    <td className="p-2 border-t border-slate-200 text-center">{r.bugs.map(b => b.id).join(', ') || '-'}</td>
                                                    <td className={`p-2 border-t border-slate-200 font-semibold ${r.state === 'All passed' ? 'text-green-700' : r.state === 'No cases' ? 'text-red-600' : 'text-amber-700'}`}>{r.state}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {bugs.length > 0 && (
                                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                                    <p className="font-bold text-slate-700 text-sm">Bugs</p>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs border border-slate-200">
                                            <thead>
                                                <tr className="bg-blue-600 text-white text-left">
                                                    <th className="p-2">Bug</th><th className="p-2">Title</th><th className="p-2">Severity</th>
                                                    <th className="p-2">Priority</th><th className="p-2">Status</th><th className="p-2">TC</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bugs.map((b, i) => (
                                                    <tr key={i} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                                                        <td className="p-2 border-t border-slate-200 font-bold text-blue-700">{b.id}</td>
                                                        <td className="p-2 border-t border-slate-200">{b.title}</td>
                                                        <td className={`p-2 border-t border-slate-200 font-semibold ${b.severity === 'Critical' ? 'text-red-900' : b.severity === 'High' ? 'text-red-700' : b.severity === 'Medium' ? 'text-amber-700' : 'text-green-700'}`}>{b.severity}</td>
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
