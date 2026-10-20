/* =====================================================================
   features/bugs.js
   ميزة Bug Report: القالب الثابت + الإنشاء التلقائي من الـ Fail + Traceability Matrix + التقرير.
   ===================================================================== */

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
    attachments: (Array.isArray(b.attachments) ? b.attachments : []).filter(x => typeof x === 'string' && x.startsWith('data:image'))
});

const sanitizeBugs = (list) => (Array.isArray(list) ? list : [])
    .filter(x => x && typeof x === 'object')
    .map(sanitizeBug);

const bugTraceNote = (b) => `This bug traces back to ${b.scenarioId ? `Scenario ${b.scenarioId} → ` : ''}${b.testCaseId ? `Test Case ${b.testCaseId}` : 'a manually reported defect'} — caught during execution.`;

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
5.${langRule()}

Return ONLY valid JSON with no markdown: {"title":"...","module":"...","severity":"High","priority":"High"}`;

// صفوف الـ Traceability: Scenario ← Test Case ← Bug
const buildTraceRows = (data, bugs) => {
    const rows = [];
    const cases = data?.testCases || [];
    const scMap = new Map();
    (data?.scenarios || []).forEach(sc => scMap.set(sc.id, sc.title));
    cases.forEach(tc => { if (tc.scenarioId && !scMap.has(tc.scenarioId)) scMap.set(tc.scenarioId, ''); });
    const bugsOf = (tc) => bugs.filter(b => b.testCaseId === tc.id);
    scMap.forEach((title, scId) => {
        const tcs = cases.filter(tc => tc.scenarioId === scId);
        if (!tcs.length) rows.push({ scenarioId: scId, scenarioTitle: title, tc: null, bugs: [] });
        tcs.forEach(tc => rows.push({ scenarioId: scId, scenarioTitle: title, tc, bugs: bugsOf(tc) }));
    });
    const linked = new Set(rows.flatMap(r => r.bugs.map(b => b.id)));
    bugs.filter(b => !linked.has(b.id)).forEach(b => rows.push({ scenarioId: b.scenarioId, scenarioTitle: '', tc: null, bugs: [b], unlinked: true }));
    return rows;
};

function buildBugReportHtml({ bugs, project, env, data, scData, run, onImage }) {
    const date = new Date().toISOString().slice(0, 10);
    const count = (fn) => bugs.filter(fn).length;
    const nl = (t) => escHtml(t).replace(/\n/g, '<br/>');
    const lv = (p) => `<span class="${p}">${p}</span>`;
    const rows = buildTraceRows(data, bugs);
    const scenarios = reportScenarioList(scData, data);
    const cases = data?.testCases || [];

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><title>Bug Report</title>
<style>
body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1e293b}
h1{color:#1d4ed8;font-size:22pt;margin-bottom:2pt} h2{color:#1d4ed8;font-size:15pt;border-bottom:1px solid #cbd5e1;padding-bottom:2pt;margin-top:18pt} h3{font-size:12pt;color:#0f172a;margin-top:12pt}
table{border-collapse:collapse;width:100%;margin:6pt 0}
td,th{border:1px solid #cbd5e1;padding:5pt;vertical-align:top;font-size:10pt}
th{background:#2563eb;color:#ffffff;text-align:left}
th.l{background:#1e293b;color:#ffffff;text-align:left;width:22%}
.meta td{border:none;padding:2pt 6pt 2pt 0;font-size:11pt}
.Critical{color:#7f1d1d;font-weight:bold} .High{color:#b91c1c;font-weight:bold} .Medium{color:#b45309;font-weight:bold} .Low{color:#15803d;font-weight:bold}
.Pass{color:#15803d;font-weight:bold} .Fail{color:#b91c1c;font-weight:bold} .Blocked{color:#b45309;font-weight:bold} .Skipped{color:#64748b} .Untested{color:#94a3b8}
.note{color:#64748b;font-size:9.5pt;font-style:italic}
a{color:#1d4ed8}
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

<h2>2. Test Scenarios</h2>
${reportScenariosTableHtml(scenarios)}

<h2>3. Test Cases</h2>
${reportCasesBlocksHtml(cases)}

<h2>4. Test Run${run ? ` (${escHtml(run.id)} — ${escHtml(run.name)})` : ''}</h2>
${run
        ? reportRunResultsTableHtml(run, cases, data, bugs)
        : '<p class="note">No test run available yet.</p>'}

<h2>5. Bug Details</h2>`;

    bugs.forEach(b => {
        const r = (label, val) => `<tr><th class="l">${label}</th><td>${val}</td></tr>`;
        html += `<p class="note">${escHtml(bugTraceNote(b))}</p><table>` +
            r('Bug ID', `<a name="bug-${escHtml(b.id)}">${escHtml(b.id)}</a>`) + r('Title', escHtml(b.title)) + r('Module', escHtml(b.module)) +
            r('Severity', lv(b.severity)) + r('Priority', lv(b.priority)) + r('Environment', escHtml(b.environment || env)) +
            r('Steps to Reproduce', nl(b.steps)) + r('Test Data', nl(b.testData)) + r('Expected Result', nl(b.expected)) +
            r('Actual Result', nl(b.actual)) + r('Status', escHtml(b.status)) +
            r('Linked Test Case', b.testCaseId ? `<a href="#tc-${escHtml(b.testCaseId)}">${escHtml(`${b.testCaseId} - ${b.testCaseTitle}`)}</a>` : 'N/A') +
            r('Linked Scenario', b.scenarioId ? `<a href="#sc-${escHtml(b.scenarioId)}">${escHtml(b.scenarioId)}</a>` : 'N/A') +
            (onImage && b.attachments && b.attachments.length
                ? r('Screenshots', b.attachments.map(d => `<img src="cid:${onImage(d)}" style="max-width:430px;border:1px solid #cbd5e1;margin:2pt 0"/>`).join('<br/>'))
                : '') +
            '</table><br/>';
    });
    if (!bugs.length) html += '<p>No bugs reported.</p>';

    html += `<h2>6. Traceability Matrix</h2><table><tr><th class="h">Scenario</th><th class="h">Test Case</th><th class="h">Type</th><th class="h">Bug(s)</th></tr>` +
        rows.map(x => `<tr>` +
            `<td>${x.scenarioId ? `<a href="#sc-${escHtml(x.scenarioId)}">${escHtml(x.scenarioId)}</a>` : '-'}${x.scenarioTitle ? ': ' + escHtml(x.scenarioTitle) : ''}</td>` +
            `<td>${x.tc ? `<a href="#tc-${escHtml(x.tc.id)}">${escHtml(`${x.tc.id} - ${x.tc.title}`)}</a>` : '-'}</td>` +
            `<td>${x.tc ? escHtml(x.tc.type) : '-'}</td>` +
            `<td>${x.bugs.map(b => `<a href="#bug-${escHtml(b.id)}">${escHtml(b.id)}</a>`).join(', ') || '-'}</td>` +
            `</tr>`).join('') + '</table></body></html>';
    return html;
}


/* ---------- Environment: اختيارات جاهزة (Web / Mobile) + Other ---------- */
const ENV_GROUPS = [
    { label: 'Web - Windows', items: ['Chrome on Windows', 'Edge on Windows', 'Firefox on Windows'] },
    { label: 'Web - macOS', items: ['Chrome on macOS', 'Safari on macOS', 'Firefox on macOS'] },
    { label: 'Web - Linux', items: ['Chrome on Linux', 'Firefox on Linux'] },
    { label: 'Mobile - Android', items: ['Chrome on Android (Mobile Web)', 'Samsung Internet on Android', 'Android Native App'] },
    { label: 'Mobile - iOS', items: ['Safari on iOS (Mobile Web)', 'Chrome on iOS', 'iOS Native App'] },
    { label: 'Tablet', items: ['Safari on iPadOS', 'Chrome on Android Tablet'] }
];

function EnvPicker({ value, onChange, className }) {
    const all = ENV_GROUPS.flatMap(g => g.items);
    const [custom, setCustom] = useState(() => !!value && !all.includes(value));
    const selectValue = custom ? '__other__' : (value || '');
    const handleSelect = (v) => {
        if (v === '__other__') { setCustom(true); onChange(''); }
        else { setCustom(false); onChange(v); }
    };
    return (
        <div className="space-y-1">
            <select className={className} value={selectValue} onChange={e => handleSelect(e.target.value)}>
                <option value="">— Select environment —</option>
                {ENV_GROUPS.map(g => (
                    <optgroup key={g.label} label={g.label}>
                        {g.items.map(it => <option key={it} value={it}>{it}</option>)}
                    </optgroup>
                ))}
                <option value="__other__">Other (type manually)</option>
            </select>
            {custom && (
                <input className={className} value={value || ''} onChange={e => onChange(e.target.value)} placeholder="e.g. Build v2.3.1, Staging, Chrome 126 on Windows 11" />
            )}
        </div>
    );
}

/* ---------- سكرين شوتس للباجز: ضغط قبل التخزين (عشان localStorage) ---------- */
const compressBugImage = (file, maxW = 1100, quality = 0.72) => new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
        try {
            const scale = Math.min(1, maxW / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) {
            resolve(null);
        }
        URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
});

// عارض الصور الشامل: أي سكرين شوت — كليك يفتحها بحجم كامل (Esc أو كليك يقفل)
function vetlyViewImage(src) { try { window.dispatchEvent(new CustomEvent('vetly-view-image', { detail: src })); } catch (e) { /* ignore */ } }

function ImageViewerHost() {
    const [src, setSrc] = useState(null);
    useEffect(() => {
        const open = (e) => setSrc(e.detail || null);
        const esc = (e) => { if (e.key === 'Escape') setSrc(null); };
        window.addEventListener('vetly-view-image', open);
        window.addEventListener('keydown', esc);
        return () => { window.removeEventListener('vetly-view-image', open); window.removeEventListener('keydown', esc); };
    }, []);
    if (!src) return null;
    return (
        <div onClick={() => setSrc(null)} className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-6 cursor-zoom-out">
            <img src={src} className="max-w-[94vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" alt="screenshot" />
            <button className="absolute top-4 right-4 bg-white/90 hover:bg-white text-slate-800 rounded-full w-9 h-9 text-lg font-bold leading-none shadow-lg">✕</button>
        </div>
    );
}

// عرض + رفع + حذف سكرين شوتس الباج (اللصق Ctrl+V متظبط على كارت الباج كله)
function BugAttachments({ bug, onChange }) {
    const fileRef = React.useRef(null);
    const add = async (files) => {
        const urls = [];
        for (const f of files) {
            const u = await compressBugImage(f);
            if (u) urls.push(u);
        }
        if (urls.length) onChange([...(bug.attachments || []), ...urls]);
    };
    return (
        <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
                {(bug.attachments || []).map((u, i) => (
                    <span key={i} className="relative inline-block border border-slate-200 rounded overflow-hidden">
                        <img src={u} onClick={() => vetlyViewImage(u)} className="h-16 w-24 object-cover cursor-zoom-in" alt={`screenshot ${i + 1}`} />
                        <button onClick={(e) => { e.stopPropagation(); onChange(bug.attachments.filter((_, j) => j !== i)); }} className="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-1 leading-4">✕</button>
                    </span>
                ))}
            </div>
            <div className="flex items-center gap-2">
                <button type="button" onClick={() => fileRef.current && fileRef.current.click()} className="text-[11px] bg-blue-50 text-blue-700 border border-blue-100 rounded px-2 py-1 hover:bg-blue-100">📷 + Screenshot</button>
                <span className="text-[10px] text-slate-400">أو Ctrl+V للصق سكرين شوت</span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { add(Array.from(e.target.files || [])); e.target.value = ''; }} />
        </div>
    );
}

// كل منطق الباجز المشترك (الحالة + الإنشاء التلقائي من الـ Fail) في مكان واحد
function useBugStore({ data, keys, models, knownScenarios, setPage }) {
    const [bugs, setBugs] = useState(() => sanitizeBugs(safeJSON('wakil_bugs', [])));
    const [bugTab, setBugTab] = useState('bugs');
    const [bugEnv, setBugEnv] = useState(() => localStorage.getItem('wakil_bug_env') || '');
    const [bugProject, setBugProject] = useState(() => localStorage.getItem('wakil_bug_project') || '');
    const [bugBusy, setBugBusy] = useState(false);
    const [bugNote, setBugNote] = useState('');
    const [focusBug, setFocusBug] = useState(null); // الباج اللي لازم الصفحة تروح له مباشرة
    const quotaWarned = React.useRef(false);

    useEffect(() => {
        try {
            const s = JSON.stringify(bugs);
            // كتابة شرطية + رفع إصدار المحتوى عند أي تغيير فعلي (عشان كاش الترجمة يعرف إنه قديم)
            if (localStorage.getItem('wakil_bugs') !== s) {
                localStorage.setItem('wakil_bugs', s);
                if (typeof _trBumpVer === 'function') _trBumpVer('wakil_bugs');
            }
        } catch (e) {
            // السكرين شوتس ممكن تملّي مساحة المتصفح (~5MB): ننبّه مرة واحدة من غير سبام
            if (!quotaWarned.current) {
                quotaWarned.current = true;
                alert(tr('Browser storage is full. Download a Backup from Settings and remove old bug screenshots.'));
            }
        }
        localStorage.setItem('wakil_bug_env', bugEnv);
        localStorage.setItem('wakil_bug_project', bugProject);
    }, [bugs, bugEnv, bugProject]);

    const bugFor = (tc) => bugs.find(b => b.testCaseId === tc.id);

    // بيتصلّ من Test Runs: لما حالة الكيس تخرج من Fail، الباج بتاعه يتشال
    const removeBugForTestCase = (tc) => setBugs(prev => prev.filter(b => !(b.testCaseId === tc.id)));

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
            attachments: []
        };
    };

    // بيعمل باج ريبورت تلقائي من الكيسز الـ Fail في الجولات (والـ AI بيصيغ العنوان والـ module والـ severity لو في مفتاح)
    const sendToBugs = async (tcs) => {
        const todo = tcs.filter(tc => !bugFor(tc));
        if (!todo.length) { setPage('bugs'); return; }
        const missing = todo.filter(tc => !(tc.actualResult || '').trim());
        if (missing.length) {
            alert(tr('Write the Actual Result first in Test Runs before sending to Bug Report:\n{list}', { list: missing.map(tc => tc.id).join(', ') }));
            return;
        }
        // **إنشاء فوري**: الباجز بتتسجل على طول من بيانات الكيس — والـ AI بيصقلها في الخلفية
        // (قبل كده كان الزرار بيقعد دقايق مستني استدعاء AI لكل كيس ورا بعض)
        const allIds = bugs.map(b => b.id);
        const created = todo.map(tc => { const id = nextBugId(allIds); allIds.push(id); return baseBugFromTc(tc, id); });
        setBugs(prev => [...prev, ...created]);
        setBugTab('bugs');
        setFocusBug({ id: created[0].id, t: Date.now() });
        setPage('bugs');

        // صقل بالـ AI في الخلفية (عنوان/module/severity) — لو فيه مفتاح، وكل باج بيتحدث مكان أول ما يجهز
        const hasKeys = getAllProviders().some(p => providerUsable(p, keys));
        if (!hasKeys) return;
        setBugBusy(true);
        setBugNote(created.length > 1
            ? tr('Enhancing {n} bug reports with AI…', { n: created.length })
            : `Enhancing bug report for ${created[0].id}...`);
        await Promise.all(todo.map(async (tc, i) => {
            try {
                const r = await runProviders({
                    keys, models,
                    prompt: buildBugPrompt(tc, created[i].module),
                    images: [],
                    validate: (p) => (p && typeof p === 'object' && str(p.title)) ? p : null,
                    contentKey: 'wakil_bugs'
                });
                if (r.data) {
                    setBugs(prev => prev.map(b => b.id === created[i].id ? {
                        ...b,
                        title: str(r.data.title) || b.title,
                        module: str(r.data.module) || b.module,
                        severity: normPriority(r.data.severity || b.severity),
                        priority: normPriority(r.data.priority || b.priority)
                    } : b));
                }
            } catch (e) { /* فشل الصقل ⇒ الباج الأساسي فاضل مكانه */ }
        }));
        setBugNote('');
        setBugBusy(false);
    };

    // بيفتح صفحة الباجز وينزل على الباج ده بالظبط
    const viewBug = (id) => {
        setBugTab('bugs');
        setFocusBug({ id, t: Date.now() });
        setPage('bugs');
    };

    return { bugs, setBugs, bugTab, setBugTab, bugEnv, setBugEnv, bugProject, setBugProject, bugBusy, bugNote, bugFor, removeBugForTestCase, sendToBugs, viewBug, focusBug };
}

function BugsPage({ store, data, runs, scData, setShowSettings }) {
    const { bugs, setBugs, bugTab, setBugTab, bugEnv, setBugEnv, bugProject, setBugProject, bugNote, focusBug } = store;

    // لما نيجي من زرار في Test Runs: نروح للباج نفسه ونعمله highlight
    const [flashId, setFlashId] = useState(null);
    useEffect(() => {
        if (!focusBug) return;
        const t = setTimeout(() => {
            const el = document.getElementById('bug-' + focusBug.id);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setFlashId(focusBug.id);
                setTimeout(() => setFlashId(null), 2500);
            }
        }, 150);
        return () => clearTimeout(t);
    }, [focusBug]);

    const updateBug = (id, field, value) => setBugs(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
    const deleteBug = (id) => setBugs(prev => prev.filter(b => b.id !== id));

    // Ctrl+V في أي مكان جوه كارت الباج يلصق صورة كسكرين شوت (لو الحافظة فيها نص بيفضل يلزق طبيعي)
    const pasteBugImages = async (e, bug) => {
        const files = Array.from((e.clipboardData && e.clipboardData.items) || [])
            .filter(i => i.type && i.type.startsWith('image/'))
            .map(i => i.getAsFile())
            .filter(Boolean);
        if (!files.length) return;
        e.preventDefault();
        const urls = [];
        for (const f of files) { const u = await compressBugImage(f); if (u) urls.push(u); }
        if (urls.length) updateBug(bug.id, 'attachments', [...(bug.attachments || []), ...urls]);
    };

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
            testCaseId: '', testCaseTitle: '', scenarioId: '', attachments: []
        }]);
        setBugTab('bugs');
    };

    const clearBugs = () => {
        if (bugs.length && !window.confirm(tr('Delete all bugs?'))) return;
        setBugs([]);
        localStorage.removeItem('wakil_bugs');
    };

    // لو في سكرين شوتس: الصور بتتحط في ملف MHTML بـ cid عشان Word يعرضهم
    const downloadBugReport = () => {
        let n = 0;
        const images = [];
        const onImage = (dataUrl) => {
            const cid = `ATT-${String(++n).padStart(3, '0')}`;
            images.push({ cid, dataUrl });
            return cid;
        };
        const latestRun = runs.length ? runs[runs.length - 1] : null;
        const html = buildBugReportHtml({ bugs, project: bugProject, env: bugEnv, data, scData, run: latestRun, onImage });
        downloadBlob(buildWordBlob(html, images), 'Bug_Report.doc');
    };

    /* ---------- تصدير Excel: Scenarios / Test Cases / Run Results / Bugs / Traceability بلينكات ---------- */
    /* ---------- تصدير Excel (ExcelJS): نفس الأوراق واللينكات + السكرين شوتس مدموجة كصور حقيقية في شيت الباجز ---------- */
    const downloadBugsXlsx = async () => {
        try {
            await loadScript('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js');
        } catch (e) {
            alert(tr('Excel library failed to load. Download the (Word) report instead.'));
            return;
        }
        const ExcelJS = window.ExcelJS;
        const thin = { style: 'thin', color: { argb: 'FFCBD5E1' } };
        const borders = { top: thin, bottom: thin, left: thin, right: thin };
        const trRow = (r) => r.map(v => (typeof v === 'string') ? tr(v) : v);
        const wb = new ExcelJS.Workbook();

        // ورقة: هيدرز + صفوف + تنسيق موحد (هيدر أزرق، حدود، التفاف نص، تجميد الصف الأول، فلتر)
        const mkSheet = (name, headers, rows, widths) => {
            const ws = wb.addWorksheet(name);
            ws.addRow(trRow(headers));
            rows.forEach(r => ws.addRow(trRow(r)));
            widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
            ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
            ws.views = [{ state: 'frozen', ySplit: 1 }];
            ws.eachRow((row, rn) => row.eachCell(cell => {
                cell.border = borders;
                if (rn === 1) {
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
                    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                } else cell.alignment = { vertical: 'top', wrapText: true };
            }));
            return ws;
        };
        // لينك داخلي بين الشيتات
        const link = (ws, r, c, text, target) => {
            const cell = ws.getCell(r, c);
            cell.value = { text: String(text), hyperlink: { hash: target, tooltip: target } };
            cell.font = { color: { argb: 'FF2563EB' }, underline: true };
        };

        const scenarios = reportScenarioList(scData, data);
        const cases = data?.testCases || [];
        const latestRun = runs.length ? runs[runs.length - 1] : null;
        const rowOfSc = {}, rowOfTc = {}, rowOfBug = {};

        // 1) Test Scenarios
        const wsSc = mkSheet('Test Scenarios', ['Scenario ID', 'Title', 'Type', 'Priority'],
            scenarios.map(sc => [sc.id, sc.title, sc.type || '', sc.priority || '']), [12, 70, 12, 10]);
        scenarios.forEach((sc, i) => { rowOfSc[sc.id] = i + 2; });

        // 2) Test Cases + لينك السيناريو لصفه
        const wsTc = mkSheet('Test Cases', ['Test Case ID', 'Scenario ID', 'Category', 'Title', 'Priority', 'Technique', 'Pre-Condition', 'Test Data', 'Steps', 'Expected Result'],
            cases.map(tc => [
                tc.id, tc.scenarioId || 'N/A', tc.type, tc.title, tc.priority || 'Medium', tc.technique,
                tc.preCondition, tc.testData,
                (tc.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n'), tc.expected
            ]), [9, 11, 12, 46, 10, 22, 28, 26, 50, 40]);
        cases.forEach((tc, i) => { rowOfTc[tc.id] = i + 2; });
        cases.forEach((tc, i) => { if (rowOfSc[tc.scenarioId]) link(wsTc, i + 2, 2, tc.scenarioId || 'N/A', `#'Test Scenarios'!A${rowOfSc[tc.scenarioId]}`); });

        // 3) Run Results (آخر جولة) + لينكات
        if (latestRun) {
            const wsRun = mkSheet('Run Results', ['Test Case ID', 'Scenario', 'Type', 'Priority', 'Title', 'Expected Result', 'Actual Result', 'Status', 'Bug(s)'],
                cases.map(tc => {
                    const o = (latestRun.outputs && latestRun.outputs[tcRunKey(tc)]) || { expected: '', actual: '' };
                    const bg = bugs.find(b => b.testCaseId === tc.id);
                    return [tc.id, tc.scenarioId || 'N/A', tc.type, tc.priority || 'Medium', tc.title, tc.expected, o.actual, latestRun.results[tcRunKey(tc)] || 'Untested', bg ? bg.id : ''];
                }), [9, 11, 12, 10, 46, 38, 38, 14, 10]);
            cases.forEach((tc, i) => {
                if (rowOfTc[tc.id]) link(wsRun, i + 2, 1, tc.id, `#'Test Cases'!A${rowOfTc[tc.id]}`);
                if (tc.scenarioId && rowOfSc[tc.scenarioId]) link(wsRun, i + 2, 2, tc.scenarioId, `#'Test Scenarios'!A${rowOfSc[tc.scenarioId]}`);
                const bg = bugs.find(b => b.testCaseId === tc.id);
                if (bg && rowOfBug[bg.id]) link(wsRun, i + 2, 9, bg.id, `#'Bugs'!A${rowOfBug[bg.id]}`);
            });
        }

        // 4) Bugs + **السكرين شوتس مدموجة** كصور حقيقية قابلة للعرض والريفيو جوه الملف
        const wsBugs = mkSheet('Bugs',
            ['Bug ID', 'Title', 'Module', 'Severity', 'Priority', 'Environment', 'Steps to Reproduce', 'Test Data', 'Expected Result', 'Actual Result', 'Status', 'Test Case', 'Scenario', 'Screenshots'],
            bugs.map(b => [b.id, b.title, b.module, b.severity, b.priority, b.environment || bugEnv, b.steps, b.testData, b.expected, b.actual, b.status, b.testCaseId, b.scenarioId, (b.attachments || []).length ? (b.attachments.length + ' screenshot(s)') : '']),
            [10, 40, 26, 10, 10, 22, 44, 28, 32, 32, 12, 12, 12, 28]);
        bugs.forEach((b, i) => { rowOfBug[b.id] = i + 2; });
        bugs.forEach((b, i) => {
            if (rowOfTc[b.testCaseId]) link(wsBugs, i + 2, 12, b.testCaseId, `#'Test Cases'!A${rowOfTc[b.testCaseId]}`);
            if (b.scenarioId && rowOfSc[b.scenarioId]) link(wsBugs, i + 2, 13, b.scenarioId, `#'Test Scenarios'!A${rowOfSc[b.scenarioId]}`);
            // الصور: بتتحط عائمة في عمود Screenshots — متكدسة رأسيًا وارتفاع الصف بيتظبط على عددها
            const atts = (b.attachments || []).filter(u => /^data:image\/(png|jpeg|jpg|gif);base64,/.test(u));
            if (!atts.length) return;
            const IMG_W = 230, IMG_H = 150, GAP = 10;
            const row = wsBugs.getRow(i + 2);
            const rowH = Math.max(row.height || 15, atts.length * (IMG_H + GAP) * 0.75 + 6); // pt
            row.height = rowH;
            atts.forEach((u, j) => {
                const m = /^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/.exec(u);
                if (!m) return;
                const ext = m[1] === 'jpg' ? 'jpeg' : m[1];
                const imgId = wb.addImage({ base64: m[2], extension: ext });
                const offsetRows = (j * (IMG_H + GAP)) / ((rowH * 4) / 3); // بكسل ⇒ صفوف
                wsBugs.addImage(imgId, { tl: { col: 13.05, row: i + 0.98 + offsetRows }, ext: { width: IMG_W, height: IMG_H } });
            });
        });

        // 5) Traceability + لينكات للاتجاهين
        const traceRows = buildTraceRows(data, bugs);
        const wsTr = mkSheet('Traceability', ['Scenario', 'Test Case', 'Type', 'Bug(s)'],
            traceRows.map(x => [
                `${x.scenarioId || '-'}${x.scenarioTitle ? ': ' + x.scenarioTitle : ''}`,
                x.tc ? `${x.tc.id} - ${x.tc.title}` : '-', x.tc ? x.tc.type : '-',
                x.bugs.map(b => b.id).join(', ') || '-'
            ]), [40, 46, 12, 16]);
        traceRows.forEach((x, i) => {
            if (x.scenarioId && rowOfSc[x.scenarioId]) link(wsTr, i + 2, 1, String(x.scenarioId), `#'Test Scenarios'!A${rowOfSc[x.scenarioId]}`);
            if (x.tc && rowOfTc[x.tc.id]) link(wsTr, i + 2, 2, `${x.tc.id} - ${x.tc.title}`, `#'Test Cases'!A${rowOfTc[x.tc.id]}`);
            if (x.bugs.length && rowOfBug[x.bugs[0].id]) link(wsTr, i + 2, 4, x.bugs.map(b => b.id).join(', '), `#'Bugs'!A${rowOfBug[x.bugs[0].id]}`);
        });

        const buf = await wb.xlsx.writeBuffer();
        downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Bug_Report.xlsx');
    };

    /* ---------- تصدير Jira CSV (Summary / Issue Type / Priority / Components / Description) ---------- */
    const downloadJiraCSV = () => {
        if (!bugs.length) return;
        const jiraPrio = { Critical: 'Highest', High: 'High', Medium: 'Medium', Low: 'Low' };
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const rows = bugs.map(b => {
            const desc = [
                'Environment: ' + (b.environment || bugEnv || 'N/A'),
                b.module ? 'Module: ' + b.module : '',
                'Severity: ' + b.severity,
                '',
                'Steps to Reproduce:',
                b.steps || 'N/A',
                b.testData ? '\nTest Data:\n' + b.testData : '',
                '\nExpected Result:\n' + (b.expected || 'N/A'),
                '\nActual Result:\n' + (b.actual || 'N/A'),
                (b.testCaseId || b.scenarioId) ? '\nTraceability: ' + [b.scenarioId, b.testCaseId].filter(Boolean).join(' → ') + (b.testCaseTitle ? ' — ' + b.testCaseTitle : '') : '',
                (b.attachments && b.attachments.length) ? `\n(${b.attachments.length} screenshot(s) attached in the QA Word report)` : ''
            ].filter(Boolean).join('\n');
            return [b.id + ': ' + b.title, 'Bug', jiraPrio[b.priority] || 'Medium', b.module, desc].map(esc).join(',');
        });
        const csv = '\uFEFF' + [['Summary', 'Issue Type', 'Priority', 'Components', 'Description'].map(h => esc(h)).join(','), ...rows].join('\r\n');
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'Jira_Bugs_Import.csv');
    };

    const levelColor = (v) => v === 'Critical' ? 'text-red-900 bg-red-100' : v === 'High' ? 'text-red-700 bg-red-50' : v === 'Medium' ? 'text-amber-700 bg-amber-50' : 'text-green-700 bg-green-50';
    const bugRow = (label, content, i) => (
        <tr key={label} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
            <th className="w-40 bg-slate-800 text-white text-left font-semibold px-3 py-2 align-top text-xs">{label}</th>
            <td className="px-3 py-1.5 text-xs">{content}</td>
        </tr>
    );
    const inp = 'w-full border border-slate-200 rounded p-1.5 bg-white';

    const renderBug = (b) => {
        const tcIndex = (data?.testCases || []).findIndex(tc => tc.id === b.testCaseId && tc.title === b.testCaseTitle);
        const rows = [
            ['Bug ID', <span className="font-bold">{b.id}</span>],
            ['Title', <input className={inp + ' font-semibold'} value={b.title} onChange={e => updateBug(b.id, 'title', e.target.value)} placeholder="Bug title" />],
            ['Module', <input className={inp} value={b.module} onChange={e => updateBug(b.id, 'module', e.target.value)} placeholder="Feature / screen" />],
            ['Severity', <select className={`border rounded p-1 font-bold ${levelColor(b.severity)}`} value={b.severity} onChange={e => updateBug(b.id, 'severity', e.target.value)}>{LEVELS.map(l => <option key={l} value={l}>{l}</option>)}</select>],
            ['Priority', <select className={`border rounded p-1 font-bold ${levelColor(b.priority)}`} value={b.priority} onChange={e => updateBug(b.id, 'priority', e.target.value)}>{LEVELS.map(l => <option key={l} value={l}>{l}</option>)}</select>],
            ['Environment', <EnvPicker className={inp} value={b.environment} onChange={v => updateBug(b.id, 'environment', v)} />],
            ['Steps to Reproduce', <textarea className={inp} rows="4" value={b.steps} onChange={e => updateBug(b.id, 'steps', e.target.value)} placeholder="1. ... 2. ..."></textarea>],
            ['Test Data', <textarea className={inp} rows="2" value={b.testData} onChange={e => updateBug(b.id, 'testData', e.target.value)}></textarea>],
            ['Expected Result', <textarea className={inp} rows="2" value={b.expected} onChange={e => updateBug(b.id, 'expected', e.target.value)}></textarea>],
            ['Actual Result', <textarea className={inp} rows="2" value={b.actual} onChange={e => updateBug(b.id, 'actual', e.target.value)}></textarea>],
            ['Screenshots', <BugAttachments bug={b} onChange={(atts) => updateBug(b.id, 'attachments', atts)} />],
            ['Status', <select className="border rounded p-1 bg-slate-50 font-semibold" value={b.status} onChange={e => updateBug(b.id, 'status', e.target.value)}>{BUG_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}</select>],
            ['Linked Test Case', <select className={inp} value={tcIndex >= 0 ? String(tcIndex) : ''} onChange={e => linkBugToTestCase(b.id, e.target.value)}>
                <option value="">— none —</option>
                {(data?.testCases || []).map((tc, i) => <option key={i} value={String(i)}>{tc.id} - {tc.title}</option>)}
                {tcIndex < 0 && b.testCaseId && <option value="" disabled>{b.testCaseId} (not in current test cases)</option>}
            </select>],
            ['Linked Scenario', <input className={inp} value={b.scenarioId} onChange={e => updateBug(b.id, 'scenarioId', e.target.value)} placeholder="TS-01" />]
        ];
        return (
            <div key={b.id} id={'bug-' + b.id} onPaste={e => pasteBugImages(e, b)} className={`space-y-1.5 rounded-lg transition ${flashId === b.id ? 'ring-2 ring-red-400 bg-red-50/40 p-1' : ''}`}>
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

    return (
        <main className="flex-1 flex flex-col overflow-hidden">
            <ImageViewerHost />
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
                <h2 className="text-lg font-bold text-slate-800">Bug Report</h2>
                <div className="flex gap-2">
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
                        <button onClick={downloadJiraCSV} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300" title="Jira CSV import format (Summary, Issue Type, Priority, Components, Description)">
                            Jira CSV
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
                            <EnvPicker className="w-full border p-1.5 rounded bg-white" value={bugEnv} onChange={setBugEnv} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="bg-white border border-slate-200 rounded-lg p-2"><div className="text-lg font-bold text-slate-800">{bugs.length}</div><span className="text-[11px] text-slate-600">Total bugs</span></div>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-2"><div className="text-lg font-bold text-red-700">{bugs.filter(b => b.severity === 'Critical' || b.severity === 'High').length}</div><span className="text-[11px] text-slate-600">Critical / High</span></div>
                    </div>
                </div>

                <div className="w-2/3 p-6 overflow-y-auto space-y-5">
                    {bugNote && <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded p-2">{bugNote}</p>}
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
                                        <th className="p-2">Scenario</th><th className="p-2">Test Case</th><th className="p-2">Type</th><th className="p-2">Bug(s)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {traceRows.length === 0 && (
                                        <tr><td colSpan="4" className="p-4 text-center text-slate-400">لسه مفيش test cases أو باجز تتربط.</td></tr>
                                    )}
                                    {traceRows.map((x, i) => (
                                        <tr key={i} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                                            <td className="p-2 border-t border-slate-200 align-top"><b>{x.scenarioId || '-'}</b>{x.scenarioTitle ? ': ' + x.scenarioTitle : ''}</td>
                                            <td className="p-2 border-t border-slate-200 align-top">{x.tc ? `${x.tc.id} - ${x.tc.title}` : '-'}</td>
                                            <td className="p-2 border-t border-slate-200 align-top">{x.tc ? x.tc.type : '-'}</td>
                                            <td className="p-2 border-t border-slate-200 align-top">{x.bugs.map(b => b.id).join(', ') || '-'}</td>
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
}
