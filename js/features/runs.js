/* =====================================================================
   features/runs.js
   ميزة Test Runs: جولات تنفيذ (Build / Date / Environment) + نتيجة كل Test Case
   في كل جولة + مقارنة جولتين (Regression / Fixed) + تقرير تنفيذ (Word / Excel).
   ===================================================================== */

const RUN_STATUSES = ['Untested', 'Pass', 'Fail', 'Blocked', 'Skipped'];

const runStatusColor = (s) => s === 'Pass' ? 'bg-green-100 text-green-700'
    : s === 'Fail' ? 'bg-red-100 text-red-700'
    : s === 'Blocked' ? 'bg-amber-100 text-amber-700'
    : s === 'Skipped' ? 'bg-slate-200 text-slate-500'
    : 'bg-slate-100 text-slate-600';

// مفتاح نتيجة الكيس جوه الجولة (نفس منطق ربط الباجز: id + title)
const tcRunKey = (tc) => `${tc.id}::${tc.title}`;

const sanitizeRuns = (list) => (Array.isArray(list) ? list : [])
    .filter(x => x && typeof x === 'object')
    .map((r, i) => ({
        id: str(r.id) || `RUN-${pad2(i + 1)}`,
        name: str(r.name) || `Round ${i + 1}`,
        date: str(r.date),
        build: str(r.build),
        environment: str(r.environment),
        notes: str(r.notes),
        results: (r.results && typeof r.results === 'object')
            ? Object.fromEntries(Object.entries(r.results).filter(([k, v]) => typeof k === 'string' && RUN_STATUSES.includes(v)))
            : {},
        // Expected/Actual Result لكل كيس جوه الجولة (فاضيين افتراضيًا)
        outputs: (r.outputs && typeof r.outputs === 'object')
            ? Object.fromEntries(Object.entries(r.outputs)
                .filter(([k, v]) => typeof k === 'string' && v && typeof v === 'object')
                .map(([k, v]) => [k, { expected: str(v.expected), actual: str(v.actual) }]))
            : {},
        createdAt: str(r.createdAt)
    }));

const nextRunId = (ids) => {
    const max = Math.max(0, ...ids.map(i => parseInt(String(i || '').replace(/\D/g, ''), 10) || 0));
    return `RUN-${String(max + 1).padStart(2, '0')}`;
};

const runStats = (run, cases) => {
    const counts = { Untested: 0, Pass: 0, Fail: 0, Blocked: 0, Skipped: 0 };
    cases.forEach(tc => { const s = run.results[tcRunKey(tc)] || 'Untested'; counts[s] = (counts[s] || 0) + 1; });
    const executed = cases.length - counts.Untested;
    return {
        counts,
        total: cases.length,
        executed,
        pct: cases.length ? Math.round((executed / cases.length) * 100) : 0,
        passRate: executed ? Math.round((counts.Pass / executed) * 100) : 0
    };
};

// تجميع الكيسز حسب السيناريو (زي الـ Traceability)
const runGroups = (cases, data) => {
    const m = new Map();
    (data?.scenarios || []).forEach(sc => m.set(sc.id, sc.title));
    cases.forEach(tc => { if (tc.scenarioId && !m.has(tc.scenarioId)) m.set(tc.scenarioId, ''); });
    if (m.size === 0) m.set('', '');
    return [...m.entries()].map(([id, title]) => ({ id, title, tcs: cases.filter(tc => (tc.scenarioId || '') === id) }));
};

// مقارنة جولتين: Pass→Fail/Blocked = Regression، Fail/Blocked→Pass = Fixed
const compareRuns = (a, b, cases) => cases.map(tc => {
    const sa = (a && a.results[tcRunKey(tc)]) || 'Untested';
    const sb = (b && b.results[tcRunKey(tc)]) || 'Untested';
    let delta = '';
    if (sa !== sb) {
        if (sa === 'Pass' && (sb === 'Fail' || sb === 'Blocked')) delta = 'Regression';
        else if ((sa === 'Fail' || sa === 'Blocked') && sb === 'Pass') delta = 'Fixed';
        else delta = 'Changed';
    }
    return { tc, a: sa, b: sb, delta };
});

/* ---------- أقسام تقرير مشتركة (Runs + Bugs): سيناريوهات / كيسز / نتايج الجولة ---------- */
function reportScenarioList(scData, data) {
    const m = new Map();
    [...(scData || []), ...((data && data.scenarios) || [])].forEach(sc => { if (sc && sc.id && !m.has(sc.id)) m.set(sc.id, sc); });
    return [...m.values()];
}

function reportScenariosTableHtml(scenarios) {
    if (!scenarios.length) return '<p class="note">No test scenarios available.</p>';
    return `<table><tr><th>Scenario ID</th><th>Title</th><th>Type</th><th>Priority</th></tr>` +
        scenarios.map(sc => `<tr><td><a name="sc-${escHtml(sc.id)}">${escHtml(sc.id)}</a></td><td>${escHtml(sc.title)}</td><td>${escHtml(sc.type || '')}</td><td>${escHtml(sc.priority || '')}</td></tr>`).join('') +
        '</table>';
}

function reportCasesBlocksHtml(cases) {
    if (!cases.length) return '<p class="note">No test cases available.</p>';
    return cases.map(tc =>
        `<table>` +
        `<tr><th style="width:22%">Test Case ID</th><td><a name="tc-${escHtml(tc.id)}">${escHtml(tc.id)}</a></td></tr>` +
        `<tr><th>Scenario</th><td>${tc.scenarioId ? `<a href="#sc-${escHtml(tc.scenarioId)}">${escHtml(tc.scenarioId)}</a>` : 'N/A'}</td></tr>` +
        `<tr><th>Category</th><td>${escHtml(tc.type)}</td></tr>` +
        `<tr><th>Title</th><td>${escHtml(tc.title)}</td></tr>` +
        `<tr><th>Priority</th><td>${escHtml(tc.priority || 'Medium')}</td></tr>` +
        (tc.technique ? `<tr><th>Technique</th><td>${escHtml(tc.technique)}</td></tr>` : '') +
        (tc.preCondition ? `<tr><th>Pre-Condition</th><td>${escHtml(tc.preCondition)}</td></tr>` : '') +
        (tc.testData ? `<tr><th>Test Data</th><td>${escHtml(tc.testData)}</td></tr>` : '') +
        `<tr><th>Steps</th><td>${(tc.steps || []).map((s, i) => escHtml((i + 1) + '. ' + s)).join('<br/>') || 'N/A'}</td></tr>` +
        `<tr><th>Expected Result</th><td>${escHtml(tc.expected)}</td></tr>` +
        `</table><br/>`
    ).join('');
}

// جدول نتايج الجولة (بلينكات: TC → كيسه، العنوان → السيناريو، الباجز → تفاصيلها)
function reportRunResultsTableHtml(run, cases, data, bugs) {
    const groups = runGroups(cases, data);
    const bugsOf = (tc) => bugs.filter(b => b.testCaseId === tc.id && b.testCaseTitle === tc.title);
    const out = (tc) => (run.outputs && run.outputs[tcRunKey(tc)]) || { expected: '', actual: '' };
    const st = (s) => `<span class="${s}">${s}</span>`;
    let html = '';
    groups.forEach(g => {
        const head = g.id ? `<a href="#sc-${escHtml(g.id)}">${escHtml(g.id + (g.title ? ': ' + g.title : ''))}</a>` : 'General';
        html += `<h3>${head}</h3>` +
            `<table><tr><th>TC</th><th>Title</th><th>Type</th><th>Priority</th><th>Expected Result</th><th>Actual Result</th><th>Status</th><th>Bug(s)</th></tr>` +
            g.tcs.map(tc => {
                const o = out(tc);
                const bl = bugsOf(tc);
                return `<tr>` +
                    `<td><a href="#tc-${escHtml(tc.id)}">${escHtml(tc.id)}</a></td>` +
                    `<td>${escHtml(tc.title)}</td>` +
                    `<td>${escHtml(tc.type)}</td>` +
                    `<td>${escHtml(tc.priority || 'Medium')}</td>` +
                    `<td>${escHtml(tc.expected)}</td>` +
                    `<td>${escHtml(o.actual || '—')}</td>` +
                    `<td>${st(run.results[tcRunKey(tc)] || 'Untested')}</td>` +
                    `<td>${bl.map(b => `<a href="#bug-${escHtml(b.id)}">${escHtml(b.id)}</a>`).join(', ') || '-'}</td>` +
                    `</tr>`;
            }).join('') + '</table>';
    });
    return html;
}

/* ---------- تقرير الجولة (Word): Scenarios ← Test Cases ← Run Results ---------- */
function buildRunReportHtml({ run, cases, data, bugs, project, scData }) {
    const stats = runStats(run, cases);
    const scenarios = reportScenarioList(scData, data);
    const bugsOf = (tc) => bugs.filter(b => b.testCaseId === tc.id && b.testCaseTitle === tc.title);
    const out = (tc) => (run.outputs && run.outputs[tcRunKey(tc)]) || { expected: '', actual: '' };
    const st = (s) => `<span class="${s}">${s}</span>`;
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><title>Test Execution Report</title>
<style>
body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1e293b}
h1{color:#1d4ed8;font-size:22pt;margin-bottom:2pt} h2{color:#1d4ed8;font-size:15pt;border-bottom:1px solid #cbd5e1;padding-bottom:2pt;margin-top:18pt} h3{font-size:12pt;color:#0f172a;margin-top:12pt}
table{border-collapse:collapse;width:100%;margin:6pt 0}
td,th{border:1px solid #94a3b8;padding:4pt;vertical-align:top;font-size:9.5pt}
th{background:#2563eb;color:#ffffff;text-align:left}
.meta td{border:none;padding:2pt 6pt 2pt 0;font-size:11pt}
.Pass{color:#15803d;font-weight:bold} .Fail{color:#b91c1c;font-weight:bold} .Blocked{color:#b45309;font-weight:bold} .Skipped{color:#64748b} .Untested{color:#94a3b8}
.note{color:#64748b;font-size:9.5pt;font-style:italic}
a{color:#1d4ed8}
</style></head><body>
<h1>Test Execution Report</h1>
<table class="meta">
<tr><td><b>Project / Feature:</b></td><td>${escHtml(project || 'N/A')}</td></tr>
<tr><td><b>Run:</b></td><td>${escHtml(run.name)} (${escHtml(run.id)})</td></tr>
<tr><td><b>Date:</b></td><td>${escHtml(run.date || 'N/A')}</td></tr>
<tr><td><b>Build:</b></td><td>${escHtml(run.build || 'N/A')}</td></tr>
<tr><td><b>Environment:</b></td><td>${escHtml(run.environment || 'N/A')}</td></tr>
<tr><td><b>Reported by:</b></td><td>QA Team</td></tr>
</table>

<h2>1. Test Scenarios</h2>
${reportScenariosTableHtml(scenarios)}

<h2>2. Test Cases</h2>
${reportCasesBlocksHtml(cases)}

<h2>3. Execution Summary</h2>
<table><tr><th>Total</th><th>Executed</th><th>% Executed</th><th>Pass</th><th>Fail</th><th>Blocked</th><th>Skipped</th><th>Untested</th><th>Pass Rate</th></tr>
<tr><td>${stats.total}</td><td>${stats.executed}</td><td>${stats.pct}%</td><td>${stats.counts.Pass}</td><td>${stats.counts.Fail}</td><td>${stats.counts.Blocked}</td><td>${stats.counts.Skipped}</td><td>${stats.counts.Untested}</td><td><b>${stats.passRate}%</b></td></tr></table>
${run.notes ? `<p class="note">Notes: ${escHtml(run.notes)}</p>` : ''}

<h2>4. Run Results by Scenario</h2>
${reportRunResultsTableHtml(run, cases, data, bugs)}`;

    const failed = [];
    (data && data.testCases || []).forEach(tc => { const s = run.results[tcRunKey(tc)]; if (s === 'Fail' || s === 'Blocked') failed.push(tc); });
    html += `<h2>5. Failed / Blocked Cases</h2>`;
    html += failed.length
        ? `<table><tr><th>TC</th><th>Title</th><th>Expected Result</th><th>Actual Result</th><th>Status</th><th>Linked Bug(s)</th></tr>` +
          failed.map(tc => {
              const o = out(tc);
              return `<tr><td><a href="#tc-${escHtml(tc.id)}">${escHtml(tc.id)}</a></td><td>${escHtml(tc.title)}</td><td>${escHtml(tc.expected)}</td><td>${escHtml(o.actual || '—')}</td><td>${st(run.results[tcRunKey(tc)])}</td><td>${bugsOf(tc).map(b => `<a href="#bug-${escHtml(b.id)}">${escHtml(b.id)}</a>`).join(', ') || 'No bug reported yet'}</td></tr>`;
          }).join('') + '</table>'
        : '<p>No failed or blocked cases in this run.</p>';

    html += `</body></html>`;
    return html;
}

/* ---------- الصفحة ---------- */
function RunsPage({ data, runs, setRuns, bugs, setPage, project, sendToBugs, bugBusy, removeBugForTestCase, scData, viewBug }) {
    const cases = data?.testCases || [];
    const [sel, setSel] = useState(() => (runs.length ? runs[runs.length - 1].id : ''));
    const [tab, setTab] = useState('execute');
    const [flt, setFlt] = useState('');
    const [fltStatus, setFltStatus] = useState('All');
    const [cmpA, setCmpA] = useState('');
    const [cmpB, setCmpB] = useState('');
    const [onlyChanges, setOnlyChanges] = useState(true);
    const [form, setForm] = useState(() => ({
        name: '',
        date: new Date().toISOString().slice(0, 10),
        build: '',
        environment: localStorage.getItem('wakil_run_env') || '',
        notes: ''
    }));

    const run = runs.find(r => r.id === sel) || null;

    // لو الـ run المختار اتحدف نختار آخر واحد
    useEffect(() => {
        if (!runs.some(r => r.id === sel)) setSel(runs.length ? runs[runs.length - 1].id : '');
    }, [runs]);

    // افتراضي للمقارنة: آخر جولتين
    useEffect(() => {
        if (runs.length >= 2) { setCmpA(runs[runs.length - 2].id); setCmpB(runs[runs.length - 1].id); }
        else { setCmpA(''); setCmpB(runs.length ? runs[0].id : ''); }
    }, [runs.length]);

    const startRun = () => {
        if (!cases.length) { alert('مفيش Test Cases. ولّد الكيسز الأول في صفحة Test Generation وبعدين سجّل الجولات من هنا.'); return; }
        const newRun = {
            id: nextRunId(runs.map(r => r.id)),
            name: form.name.trim() || `Round ${runs.length + 1}`,
            date: form.date || new Date().toISOString().slice(0, 10),
            build: form.build.trim(),
            environment: form.environment,
            notes: form.notes.trim(),
            results: {},
            outputs: {},
            createdAt: new Date().toISOString()
        };
        setRuns(prev => [...prev, newRun]);
        try { localStorage.setItem('wakil_run_env', form.environment); } catch (e) { /* ignore */ }
        setSel(newRun.id);
        setTab('execute');
        setForm(f => ({ ...f, name: '', notes: '' }));
    };

    const deleteRun = (id) => {
        if (!window.confirm(`Delete run ${id}?`)) return;
        setRuns(prev => prev.filter(r => r.id !== id));
    };

    const setResult = (runId, tc, status) => {
        setRuns(prev => prev.map(r => {
            if (r.id !== runId) return r;
            return { ...r, results: { ...r.results, [tcRunKey(tc)]: status } };
        }));
        // الحالة هنا هي اللي بتتحكم في الباج: خرج الكيس من Fail ⇒ الباج بتاعه يتشال من صفحة Bug Report
        if (status !== 'Fail' && bugOf(tc)) removeBugForTestCase(tc);
    };

    // Expected/Actual Result بتاع الكيس جوه الجولة (فاضيين افتراضيًا)
    const runOutput = (r, tc) => (r.outputs && r.outputs[tcRunKey(tc)]) || { expected: '', actual: '' };
    const setOutput = (runId, tc, field, value) => setRuns(prev => prev.map(r => {
        if (r.id !== runId) return r;
        const cur = (r.outputs && r.outputs[tcRunKey(tc)]) || { expected: '', actual: '' };
        return { ...r, outputs: { ...(r.outputs || {}), [tcRunKey(tc)]: { ...cur, [field]: value } } };
    }));

    const bugOf = (tc) => bugs.find(b => b.testCaseId === tc.id && b.testCaseTitle === tc.title);

    // الكيسز الـ Fail في الجولة المفتوحة من غير باج — جاهزة للإرسال للباجز (بنفس سلوك الزرار الأحمر القديم)
    const failedInRun = run ? cases
        .filter(tc => (run.results[tcRunKey(tc)] || 'Untested') === 'Fail' && !bugOf(tc))
        .map(tc => ({ ...tc, actualResult: runOutput(run, tc).actual }))
    : [];

    const visibleCases = (r) => {
        const q = flt.trim().toLowerCase();
        return cases.filter(tc => {
            const s = r.results[tcRunKey(tc)] || 'Untested';
            if (fltStatus !== 'All' && s !== fltStatus) return false;
            if (q && !(`${tc.id} ${tc.title} ${tc.scenarioId || ''}`.toLowerCase().includes(q))) return false;
            return true;
        });
    };

    const markVisible = (r, status) => {
        const list = visibleCases(r);
        if (!list.length) return;
        if (!window.confirm(`Set ${list.length} visible case(s) to ${status}?`)) return;
        setRuns(prev => prev.map(x => {
            if (x.id !== r.id) return x;
            const results = { ...x.results };
            list.forEach(tc => { results[tcRunKey(tc)] = status; });
            return { ...x, results };
        }));
        if (status !== 'Fail') list.forEach(tc => { if (bugOf(tc)) removeBugForTestCase(tc); });
    };

    /* ---------- تصدير ---------- */
    const downloadRunDoc = () => {
        if (!run) return;
        const html = buildRunReportHtml({ run, cases, data, bugs, project, scData });
        downloadBlob(new Blob(['\uFEFF' + trHtml(html)], { type: 'application/msword;charset=utf-8' }), `${run.id}_Execution_Report.doc`);
    };

    const downloadRunXlsx = async () => {
        if (!run) return;
        try {
            await loadScript('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js');
        } catch (e) {
            alert('تعذر تحميل مكتبة Excel. حمّل تقرير Word بدلها.');
            return;
        }
        const XLSX = window.XLSX;
        const thin = { style: 'thin', color: { rgb: 'CBD5E1' } };
        const border = { top: thin, bottom: thin, left: thin, right: thin };
        const styleSheet = (ws) => {
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
        const scenarios = reportScenarioList(scData, data);
        const rowOfSc = {}, rowOfTc = {};

        // 1) Scenarios
        const wsSc = styleSheet(XLSX.utils.aoa_to_sheet(trAoa([
            ['Scenario ID', 'Title', 'Type', 'Priority'],
            ...scenarios.map(sc => [sc.id, sc.title, sc.type || '', sc.priority || ''])
        ])));
        wsSc['!cols'] = [12, 70, 12, 10].map(w => ({ wch: w }));
        scenarios.forEach((sc, i) => { rowOfSc[sc.id] = i + 2; });

        // 2) Test Cases (بنفس تفاصيلها) + لينك كل سيناريو لصفه
        const wsTc = styleSheet(XLSX.utils.aoa_to_sheet(trAoa([
            ['Test Case ID', 'Scenario ID', 'Category', 'Title', 'Priority', 'Technique', 'Pre-Condition', 'Test Data', 'Steps', 'Expected Result'],
            ...cases.map(tc => [
                tc.id, tc.scenarioId || 'N/A', tc.type, tc.title, tc.priority || 'Medium', tc.technique,
                tc.preCondition, tc.testData,
                (tc.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n'), tc.expected
            ])
        ])));
        wsTc['!cols'] = [9, 11, 12, 46, 10, 22, 28, 26, 50, 40].map(w => ({ wch: w }));
        cases.forEach((tc, i) => { rowOfTc[tc.id] = i + 2; });
        cases.forEach((tc, i) => {
            const cell = wsTc[XLSX.utils.encode_cell({ r: i + 1, c: 1 })];
            if (cell && rowOfSc[tc.scenarioId]) cell.l = { Target: `#'Test Scenarios'!A${rowOfSc[tc.scenarioId]}` };
        });

        // 3) Run Results (بالـ Expected والـ Actual) + لينكات TC/Scenario — من غير خانة الـ Bug (دي بتاعة تقرير الـ Bug Report)
        const wsRun = styleSheet(XLSX.utils.aoa_to_sheet(trAoa([
            ['Test Case ID', 'Scenario', 'Type', 'Priority', 'Title', 'Expected Result', 'Actual Result', 'Status'],
            ...cases.map(tc => {
                const o = runOutput(run, tc);
                return [tc.id, tc.scenarioId || 'N/A', tc.type, tc.priority || 'Medium', tc.title, tc.expected, o.actual, run.results[tcRunKey(tc)] || 'Untested'];
            })
        ])));
        wsRun['!cols'] = [9, 11, 12, 10, 46, 38, 38, 14].map(w => ({ wch: w }));
        cases.forEach((tc, i) => {
            const tcCell = wsRun[XLSX.utils.encode_cell({ r: i + 1, c: 0 })];
            if (tcCell && rowOfTc[tc.id]) tcCell.l = { Target: `#'Test Cases'!A${rowOfTc[tc.id]}` };
            const scCell = wsRun[XLSX.utils.encode_cell({ r: i + 1, c: 1 })];
            if (scCell && rowOfSc[tc.scenarioId]) scCell.l = { Target: `#'Test Scenarios'!A${rowOfSc[tc.scenarioId]}` };
        });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsSc, 'Test Scenarios');
        XLSX.utils.book_append_sheet(wb, wsTc, 'Test Cases');
        XLSX.utils.book_append_sheet(wb, wsRun, 'Run Results');
        XLSX.writeFile(wb, `${run.id}_Results.xlsx`);
    };

    /* ---------- عرض ---------- */
    const stats = run ? runStats(run, cases) : null;
    const inp = 'w-full border border-slate-300 rounded p-1.5 text-xs bg-white';

    const runA = runs.find(r => r.id === cmpA) || null;
    const runB = runs.find(r => r.id === cmpB) || null;
    const cmpRows = (runA && runB && runA.id !== runB.id) ? compareRuns(runA, runB, cases) : [];
    const deltaColor = (d) => d === 'Regression' ? 'bg-red-100 text-red-700'
        : d === 'Fixed' ? 'bg-green-100 text-green-700'
        : d === 'Changed' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500';

    return (
        <main className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
                <h2 className="text-lg font-bold text-slate-800">Test Runs</h2>
                <div className="flex gap-2">
                    {failedInRun.length > 0 && (
                        <button onClick={() => sendToBugs(failedInRun)} disabled={bugBusy} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                            {bugBusy ? 'Creating bugs...' : `🐞 Send failed to Bugs (${failedInRun.length})`}
                        </button>
                    )}
                    {run && cases.length > 0 && (
                        <button onClick={downloadRunXlsx} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                            Excel (.xlsx)
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="w-1/3 border-r border-slate-200 p-4 bg-slate-50 overflow-y-auto space-y-4">
                    {/* ---------- New Run ---------- */}
                    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                        <p className="font-bold text-slate-500 uppercase">New Run</p>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Run name:</label>
                                <input className={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={`Round ${runs.length + 1}`} />
                            </div>
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Date:</label>
                                <input type="date" className={inp} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                            </div>
                        </div>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Build / Version:</label>
                            <input className={inp} value={form.build} onChange={e => setForm({ ...form, build: e.target.value })} placeholder="e.g. v2.3.1, Staging" />
                        </div>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Environment:</label>
                            <EnvPicker className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white" value={form.environment} onChange={v => setForm({ ...form, environment: v })} />
                        </div>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Notes:</label>
                            <textarea className={inp} rows="2" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Scope, special instructions..."></textarea>
                        </div>
                        <button onClick={startRun} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm">
                            Start Run
                        </button>
                    </div>

                    {/* ---------- Runs list ---------- */}
                    <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-500 uppercase">Runs ({runs.length})</p>
                        {runs.length === 0 && <p className="text-xs text-slate-400">لسه مفيش جولات. ابدأ واحدة من فوق.</p>}
                        {[...runs].reverse().map(r => {
                            const rs = runStats(r, cases);
                            const active = r.id === sel;
                            return (
                                <div key={r.id} onClick={() => { setSel(r.id); setTab('execute'); }}
                                    className={`cursor-pointer rounded-lg p-2.5 border text-xs space-y-1 ${active ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-blue-700">{r.id}</span>
                                        <span className="font-semibold text-slate-800">{r.name}</span>
                                        <div className="flex-1"></div>
                                        <button onClick={(e) => { e.stopPropagation(); deleteRun(r.id); }} className="text-red-600 hover:underline">Delete</button>
                                    </div>
                                    <div className="text-slate-500">
                                        {r.date || '—'}{r.build ? ' | ' + r.build : ''}{r.environment ? ' | ' + r.environment : ''}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px]">
                                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-600" style={{ width: rs.pct + '%' }}></div>
                                        </div>
                                        <span className="text-slate-500">{rs.executed}/{rs.total} · {rs.pct}%</span>
                                        {rs.counts.Fail > 0 && <span className="text-red-600 font-bold">{rs.counts.Fail} fail</span>}
                                        {rs.counts.Blocked > 0 && <span className="text-amber-600 font-bold">{rs.counts.Blocked} blocked</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="w-2/3 p-6 overflow-y-auto space-y-4">
                    {!cases.length ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center gap-3">
                            <p>مفيش Test Cases لسه. ولّد الكيسز الأول في صفحة Test Generation وبعدين ارجع هنا تسجّل جولات التنفيذ.</p>
                            <button onClick={() => setPage('generation')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Go to Test Generation →</button>
                        </div>
                    ) : !run ? (
                        <div className="h-full flex items-center justify-center text-slate-400">ابدأ جولة من ال panel اللي على الشمال عشان تسجّل نتايج التنفيذ.</div>
                    ) : (
                        <>
                            <div className="flex gap-2 border-b border-slate-200 pb-2">
                                <button onClick={() => setTab('execute')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === 'execute' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}>▶ Execute</button>
                                <button onClick={() => setTab('compare')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === 'compare' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}>⇄ Compare</button>
                                <span className="ml-auto text-xs text-slate-400 self-center">{run.id} · {run.name}{run.build ? ' · ' + run.build : ''}</span>
                            </div>

                            {tab === 'execute' && (
                                <>
                                    <div className="grid grid-cols-6 gap-2 text-center text-xs">
                                        <div className="bg-white border border-slate-200 rounded-lg p-2"><div className="text-lg font-bold text-slate-800">{stats.total}</div>Total</div>
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2"><div className="text-lg font-bold text-blue-700">{stats.pct}%</div>Executed</div>
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-2"><div className="text-lg font-bold text-green-700">{stats.counts.Pass}</div>Pass</div>
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-2"><div className="text-lg font-bold text-red-700">{stats.counts.Fail}</div>Fail</div>
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2"><div className="text-lg font-bold text-amber-700">{stats.counts.Blocked}</div>Blocked</div>
                                        <div className="bg-white border border-slate-200 rounded-lg p-2"><div className="text-lg font-bold text-slate-800">{stats.passRate}%</div>Pass rate</div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <input className="flex-1 min-w-[160px] border border-slate-300 rounded p-1.5 bg-white" value={flt} onChange={e => setFlt(e.target.value)} placeholder="Filter by TC / title / scenario..." />
                                        <select className="border border-slate-300 rounded p-1.5 bg-white" value={fltStatus} onChange={e => setFltStatus(e.target.value)}>
                                            <option value="All">All statuses</option>
                                            {RUN_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <select value="" onChange={e => { if (e.target.value) markVisible(run, e.target.value); }} className="border border-slate-300 rounded p-1.5 bg-white">
                                            <option value="">Mark visible as…</option>
                                            {RUN_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>

                                    {runGroups(visibleCases(run), data).map((g, gi) => (
                                        <div key={gi} className="space-y-1.5">
                                            <div className="px-3 py-1 rounded border font-bold text-xs uppercase bg-slate-100 text-slate-600 border-slate-200">
                                                {g.id ? `${g.id}${g.title ? ': ' + g.title : ''}` : 'General'} ({g.tcs.length})
                                            </div>
                                            {g.tcs.map(tc => {
                                                const s = run.results[tcRunKey(tc)] || 'Untested';
                                                const bg = s === 'Fail' ? bugOf(tc) : null; // البادج بيتبع الحالة: مفيش Fail ⇒ مفيش باج
                                                const out = runOutput(run, tc);
                                                return (
                                                    <div key={tc.id} className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm space-y-2 text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-0.5 rounded font-semibold">{tc.id}</span>
                                                            <span className="flex-1 text-slate-800">{tc.title}</span>
                                                            <span className="text-[10px] text-slate-400 uppercase">{tc.type}</span>
                                                            {bg && (
                                                                <button
                                                                    onClick={() => viewBug(bg.id)}
                                                                    className="text-[10px] bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5 font-bold hover:bg-red-100 cursor-pointer"
                                                                    title="Go to this bug in Bug Report"
                                                                >🐞 {bg.id}</button>
                                                            )}
                                                            <label className="font-bold text-slate-500">Status:</label>
                                                            <select
                                                                className={`border rounded px-1.5 py-1 font-bold ${runStatusColor(s)}`}
                                                                value={s}
                                                                onChange={e => setResult(run.id, tc, e.target.value)}
                                                            >
                                                                {RUN_STATUSES.map(x => <option key={x} value={x}>{x}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Expected Result</label>
                                                                <p className="border border-slate-200 bg-slate-50 rounded p-1.5 text-slate-700">{tc.expected || '—'}</p>
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Actual Result</label>
                                                                <input
                                                                    className="w-full border border-slate-300 rounded p-1.5 bg-white"
                                                                    value={out.actual}
                                                                    onChange={e => setOutput(run.id, tc, 'actual', e.target.value)}
                                                                    placeholder="Actual result..."
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                    {visibleCases(run).length === 0 && <p className="text-xs text-slate-400 text-center py-4">مفيش كيسز مطابقة للفلتر.</p>}
                                </>
                            )}

                            {tab === 'compare' && (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <select className="border border-slate-300 rounded p-1.5 bg-white" value={cmpA} onChange={e => setCmpA(e.target.value)}>
                                            <option value="">— Run A —</option>
                                            {runs.map(r => <option key={r.id} value={r.id}>{r.id} · {r.name}{r.date ? ' (' + r.date + ')' : ''}</option>)}
                                        </select>
                                        <span className="text-slate-400">→</span>
                                        <select className="border border-slate-300 rounded p-1.5 bg-white" value={cmpB} onChange={e => setCmpB(e.target.value)}>
                                            <option value="">— Run B —</option>
                                            {runs.map(r => <option key={r.id} value={r.id}>{r.id} · {r.name}{r.date ? ' (' + r.date + ')' : ''}</option>)}
                                        </select>
                                        <label className="flex items-center gap-1 text-slate-600">
                                            <input type="checkbox" checked={onlyChanges} onChange={e => setOnlyChanges(e.target.checked)} />
                                            Show only changes
                                        </label>
                                    </div>

                                    {!cmpRows.length ? (
                                        <p className="text-xs text-slate-400 text-center py-4">اختار جولتين مختلفتين للمقارنة (محتاج جولتين على الأقل).</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs border border-slate-200">
                                                <thead>
                                                    <tr className="bg-blue-600 text-white text-left">
                                                        <th className="p-2">TC</th><th className="p-2">Title</th>
                                                        <th className="p-2">{runA ? runA.id : 'A'}</th>
                                                        <th className="p-2">{runB ? runB.id : 'B'}</th>
                                                        <th className="p-2">Delta</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {cmpRows.filter(x => !onlyChanges || x.delta).map((x, i) => (
                                                        <tr key={i} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                                                            <td className="p-2 border-t border-slate-200 font-bold text-blue-700">{x.tc.id}</td>
                                                            <td className="p-2 border-t border-slate-200">{x.tc.title}</td>
                                                            <td className={`p-2 border-t border-slate-200 font-semibold ${runStatusColor(x.a)}`}>{x.a}</td>
                                                            <td className={`p-2 border-t border-slate-200 font-semibold ${runStatusColor(x.b)}`}>{x.b}</td>
                                                            <td className="p-2 border-t border-slate-200">
                                                                {x.delta
                                                                    ? <span className={`rounded px-1.5 py-0.5 font-bold ${deltaColor(x.delta)}`}>{x.delta}</span>
                                                                    : <span className="text-slate-300">—</span>}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {cmpRows.filter(x => !onlyChanges || x.delta).length === 0 && (
                                                        <tr><td colSpan="5" className="p-4 text-center text-slate-400">مفيش تغييرات بين الجولتين ✔</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}
