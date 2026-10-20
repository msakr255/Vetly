/* =====================================================================
   features/share.js
   👁 ShareViewer — صفحة قراءة فقط لينكات المشاركة (?share=<id>).
   - بتشتغل من غير تسجيل دخول (قراءة عامة من public_shares)
   - مفيش أي فيتشر من الموقع هنا: عرض بس — جداول وكروت ثابتة
   - اللينك LIVE: بيتحدّث تلقائيًا مع كل حفظ لصاحب المشروع
   - التخطيط زي التطبيق: هيدر ثابت فوق + منطقة سكرول تحته
     (عشان فوتر الموقع يفضل في آخر الصفحة مش في نص المحتوى)
   - التنقل كله أكورديون (توجل يفتح/يقفل بسهم بيدور) جوه المحتوى:
     📚 User Stories (2) ← 📖 ستوري ← 🧩 فيتشرزها — كله مقفول افتراضيًا
   - الخط كبير + مبدّل لغة (AR/EN/DE) في الهيدر
   ===================================================================== */

const _svParse = (v, fb) => { try { const x = (typeof v === 'string') ? JSON.parse(v) : v; return x ?? fb; } catch (e) { return fb; } };
// حماية من داتا ناقصة جوه النسخة المشتركة: أي عنصر null/مش كائن ميتقروش
const svList = (v) => (Array.isArray(v) ? v : []);
const svArr = (v) => svList(v).filter(x => x && typeof x === 'object');

const _svLevelCls = (v) => ({
    Critical: 'bg-red-100 text-red-700 border-red-200',
    High: 'bg-orange-100 text-orange-700 border-orange-200',
    Medium: 'bg-amber-100 text-amber-700 border-amber-200',
    Low: 'bg-slate-100 text-slate-600 border-slate-200'
}[v] || 'bg-slate-100 text-slate-600 border-slate-200');

const _svStatusCls = (v) => ({
    Pass: 'bg-green-100 text-green-700 border-green-200',
    Fail: 'bg-red-100 text-red-700 border-red-200',
    Blocked: 'bg-amber-100 text-amber-700 border-amber-200',
    Fixed: 'bg-green-100 text-green-700 border-green-200',
    Closed: 'bg-slate-100 text-slate-600 border-slate-200'
}[v] || 'bg-blue-50 text-blue-700 border-blue-200');

function SvBadge({ v }) {
    if (!v) return null;
    return <span className={`text-xs border rounded-full px-2.5 py-0.5 font-semibold whitespace-nowrap ${_svLevelCls(v)}`}>{v}</span>;
}
function SvStatus({ v }) {
    if (!v) return null;
    return <span className={`text-xs border rounded-full px-2.5 py-0.5 font-semibold whitespace-nowrap ${_svStatusCls(v)}`}>{v}</span>;
}
function SvText({ text }) {
    const s = String(text || '').trim();
    if (!s) return null;
    return <p dir="auto" className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words bg-white border border-slate-200 rounded-lg p-3">{s}</p>;
}
function SvEmpty() {
    return <p className="text-sm text-slate-400">— empty —</p>;
}
function SvTable({ headers, rows }) {
    if (!rows || !rows.length) return <SvEmpty />;
    return (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
                <thead><tr className="bg-slate-100 text-slate-600 text-left">
                    {headers.map((h, i) => <th key={i} className="p-2 border-b border-slate-200 font-semibold whitespace-nowrap">{h}</th>)}
                </tr></thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={i} className={i % 2 ? 'bg-white' : 'bg-slate-50/60'}>
                            {r.map((c, j) => <td key={j} className="p-2 border-t border-slate-100 align-top" dir="auto">{c}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ---------- الأقسام بتاعة كل ستوري (بالترتيب الطبيعي للشغل) ----------
function svHas(d, k) { d = d || {}; return d[k] != null && d[k] !== '' && !(Array.isArray(d[k]) && !d[k].length); }
// ---------- الأقسام بتاعة كل ستوري: الـ 7 فيتشرز دايمًا ظاهرة (سواء فيها داتا أو فاضية) ----------
function svSections(onlyFeature) {
    const all = [
        { id: 'requirements', icon: '📋', label: 'Requirements' },
        { id: 'gaps', icon: '🔍', label: 'Requirement Gaps' },
        { id: 'scenarios', icon: '🧪', label: 'Test Scenarios' },
        { id: 'cases', icon: '✅', label: 'Test Cases' },
        { id: 'bugs', icon: '🐞', label: 'Bugs' },
        { id: 'runs', icon: '🏃', label: 'Test Runs' },
        { id: 'summary', icon: '📊', label: 'Summary Report' }
    ];
    return onlyFeature ? all.filter(s => s.id === onlyFeature) : all;
}

// تجميع الكيسز/السيناريوهات بالأنواع (Positive / Negative / Edge Case) — كل نوع بعنوانه
const SV_TYPES = ['Positive', 'Negative', 'Edge Case'];
function svGroupByType(list) {
    const groups = SV_TYPES.map(t => ({ type: t, items: list.filter(x => (x.type || '') === t) })).filter(g => g.items.length);
    const rest = list.filter(x => !SV_TYPES.includes(x.type || ''));
    if (rest.length) groups.push({ type: 'Other', items: rest });
    return groups;
}

// عدد العناصر جوه كل قسم (يظهر بين قوسين جنب اسم التاب)
function svSecCount(d, id) {
    d = d || {};
    if (id === 'requirements') {
        const files = svArr(_svParse(d.wakil_req_files, []));
        return files.length || null;
    }
    if (id === 'gaps') {
        const g = d.wakil_gap_data ? _svParse(d.wakil_gap_data, null) : null;
        if (!g) return null;
        const n = svArr(g.sections).reduce((a, s) => a + svArr(s.gaps).length, 0) + svArr(g.cross).length;
        return n || null;
    }
    if (id === 'scenarios') {
        const sc = svArr(_svParse(d.wakil_sc_data, [])); const lk = svArr(_svParse(d.wakil_linked, []));
        return sc.length || lk.length || null;
    }
    if (id === 'cases') { const a = _svParse(d.wakil_ai_data, null); return svArr(a && a.testCases).length || null; }
    if (id === 'bugs') { return svArr(_svParse(d.wakil_bugs, [])).length || null; }
    if (id === 'runs') { return svArr(_svParse(d.wakil_runs, [])).length || null; }
    return null;
}

// ---------- عنصر الأكورديون: سهم بيدور + العنوان + العدد بين قوسين ----------
function SvItem({ icon, title, count, defaultOpen, children }) {
    return (
        <details className="sv-acc border border-slate-200 rounded-lg bg-white" open={!!defaultOpen}>
            <summary className="flex items-center gap-2.5 p-3 hover:bg-slate-50 rounded-lg select-none">
                <span className="sv-chev text-slate-400">▶</span>
                <span className="text-sm font-semibold text-slate-800 flex-1 min-w-0" dir="auto">
                    {icon ? icon + ' ' : ''}{title}
                    {count != null ? <span className="text-slate-400 font-normal"> ({count})</span> : null}
                </span>
            </summary>
            <div className="px-3 pb-3 pt-1 ml-2 border-l-2 border-blue-100 space-y-2">{children}</div>
        </details>
    );
}

// ---------- محتوى كل قسم ----------
function SvGapsContent({ d }) {
    const gapData = d.wakil_gap_data ? _svParse(d.wakil_gap_data, null) : null;
    const sections = svArr(gapData && gapData.sections);
    const cross = svArr(gapData && gapData.cross);
    return (
        <div className="space-y-4">
            {sections.map((sec, i) => (
                <div key={i} className="border border-slate-200 rounded-lg bg-white p-3 space-y-2">
                    <p dir="auto" className="text-base font-semibold text-slate-800">{sec.title || ('Section ' + (i + 1))}</p>
                    {sec.summary && <p dir="auto" className="text-sm text-slate-600">{sec.summary}</p>}
                    {svList(sec.keyPoints).length > 0 && (
                        <ul className="list-disc ml-6 text-sm text-slate-600 space-y-1" dir="auto">
                            {svList(sec.keyPoints).map((k, j) => <li key={j}>{String(k)}</li>)}
                        </ul>
                    )}
                    {svArr(sec.gaps).length > 0 && (
                        <SvTable
                            headers={['ID', 'Gap', 'Priority', 'Status']}
                            rows={svArr(sec.gaps).map(g => [
                                <span className="font-bold text-blue-700">{g.id}</span>,
                                <span dir="auto">{g.description || '—'}</span>,
                                <SvBadge v={g.priority} />,
                                <SvStatus v={g.status} />
                            ])}
                        />
                    )}
                </div>
            ))}
            {cross.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-600">Cross-requirement gaps</p>
                    <SvTable
                        headers={['ID', 'Gap', 'Priority', 'Status']}
                        rows={cross.map(g => [
                            <span className="font-bold text-blue-700">{g.id}</span>,
                            <span dir="auto">{g.description || '—'}</span>,
                            <SvBadge v={g.priority} />,
                            <SvStatus v={g.status} />
                        ])}
                    />
                </div>
            )}
            {!sections.length && !cross.length && <SvEmpty />}
        </div>
    );
}

function SvScenarioGroups({ list }) {
    if (!svArr(list).length) return <SvEmpty />;
    return (
        <div className="space-y-4">
            {svGroupByType(list).map(gr => (
                <div key={gr.type} className="space-y-2">
                    <p className="text-sm font-bold text-slate-700">
                        <span>{gr.type}</span> <span className="text-slate-400 font-normal">({gr.items.length})</span>
                    </p>
                    <SvTable
                        headers={['ID', 'Title', 'Priority']}
                        rows={gr.items.map(sc => [
                            <span className="font-bold text-blue-700">{sc.id || '—'}</span>,
                            <span dir="auto">{sc.title || '—'}</span>,
                            <SvBadge v={sc.priority} />
                        ])}
                    />
                </div>
            ))}
        </div>
    );
}

function SvScenariosContent({ d }) {
    const scList = svArr(_svParse(d.wakil_sc_data, []));
    const linked = svArr(_svParse(d.wakil_linked, []));
    return (
        <div className="space-y-4">
            {svHas(d, 'wakil_sc_data') && <SvScenarioGroups list={scList} />}
            {svHas(d, 'wakil_linked') && (
                <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-600">Linked Scenarios</p>
                    <SvScenarioGroups list={linked} />
                </div>
            )}
        </div>
    );
}

function SvCasesContent({ d }) {
    const data = d.wakil_ai_data ? _svParse(d.wakil_ai_data, null) : null;
    const cases = svArr(data && data.testCases);
    const scTitles = {};
    svArr(data && data.scenarios).forEach(sc => { if (sc.id) scTitles[sc.id] = sc.title; });
    if (!cases.length) return <SvEmpty />;
    return (
        <div className="space-y-4">
            {svGroupByType(cases).map(gr => (
                <div key={gr.type} className="space-y-2">
                    <p className="text-sm font-bold text-slate-700">
                        <span>{gr.type}</span> <span className="text-slate-400 font-normal">({gr.items.length})</span>
                    </p>
                    {gr.items.map((tc, ti) => (
                        <details key={tc.id || ('TC-' + (ti + 1))} className="sv-acc border border-slate-200 rounded-lg bg-white">
                            <summary className="p-2.5 text-sm flex items-center gap-2.5 flex-wrap select-none">
                                <span className="sv-chev text-slate-400">▶</span>
                                <span className="font-bold text-blue-700">{tc.id || ('TC-' + (ti + 1))}</span>
                                <span dir="auto" className="flex-1 min-w-0">{tc.title}</span>
                                <SvBadge v={tc.priority} />
                            </summary>
                            <div className="px-3 pb-3 space-y-1.5 text-sm text-slate-700 border-t border-slate-100 pt-2">
                                {tc.technique && <p><span className="text-slate-400">Technique:</span> {tc.technique}</p>}
                                {scTitles[tc.scenarioId] && <p><span className="text-slate-400">Scenario:</span> <span dir="auto">{scTitles[tc.scenarioId]}</span></p>}
                                {tc.preCondition && <p><span className="text-slate-400">Pre-condition:</span> <span dir="auto">{tc.preCondition}</span></p>}
                                {tc.testData && <p><span className="text-slate-400">Test data:</span> <span dir="auto">{tc.testData}</span></p>}
                                {svList(tc.steps).length > 0 && (
                                    <div>
                                        <p className="text-slate-400 mb-1">Steps:</p>
                                        <ol className="list-decimal ml-6 space-y-1" dir="auto">
                                            {svList(tc.steps).map((s, i) => <li key={i}>{String(s)}</li>)}
                                        </ol>
                                    </div>
                                )}
                                {tc.expected && <p><span className="text-slate-400">Expected:</span> <span dir="auto">{tc.expected}</span></p>}
                            </div>
                        </details>
                    ))}
                </div>
            ))}
        </div>
    );
}

function SvBugsContent({ d }) {
    const arr = svArr(_svParse(d.wakil_bugs, []));
    if (!arr.length) return <SvEmpty />;
    return (
        <div className="space-y-2">
            {arr.map((b, bi) => (
                <details key={b.id || ('BUG-' + (bi + 1))} className="sv-acc border border-slate-200 rounded-lg bg-white">
                    <summary className="p-2.5 text-sm flex items-center gap-2.5 flex-wrap select-none">
                        <span className="sv-chev text-slate-400">▶</span>
                        <span className="font-bold text-red-700">{b.id || ('BUG-' + (bi + 1))}</span>
                        <span dir="auto" className="flex-1 min-w-0">{b.title}</span>
                        <SvBadge v={b.severity} /><SvBadge v={b.priority} /><SvStatus v={b.status} />
                    </summary>
                    <div className="px-3 pb-3 space-y-1.5 text-sm text-slate-700 border-t border-slate-100 pt-2">
                        {b.module && <p><span className="text-slate-400">Module:</span> <span dir="auto">{b.module}</span></p>}
                        {b.environment && <p><span className="text-slate-400">Environment:</span> <span dir="auto">{b.environment}</span></p>}
                        {(b.scenarioId || b.testCaseId) && (
                            <p className="text-slate-400">Trace: {b.scenarioId ? `${b.scenarioId} → ` : ''}{b.testCaseId || 'manual'}</p>
                        )}
                        {b.steps && <div><p className="text-slate-400 mb-1">Steps:</p><p dir="auto" className="whitespace-pre-wrap">{b.steps}</p></div>}
                        {b.testData && <p><span className="text-slate-400">Test data:</span> <span dir="auto">{b.testData}</span></p>}
                        {b.expected && <p><span className="text-slate-400">Expected:</span> <span dir="auto">{b.expected}</span></p>}
                        {b.actual && <p><span className="text-slate-400">Actual:</span> <span dir="auto">{b.actual}</span></p>}
                        {svList(b.attachments).length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {svList(b.attachments).map((src, i) => <img key={i} src={src} alt={'bug ' + (b.id || '')} className="w-28 h-28 object-cover rounded border border-slate-200" />)}
                            </div>
                        )}
                    </div>
                </details>
            ))}
        </div>
    );
}

// ---------- Requirements (الخامة الخام: نص + صور + ملفات — كلها قابلة للمعاينة) ----------
function SvRequirementsContent({ d, onOpen }) {
    const files = svArr(_svParse(d.wakil_req_files, []));
    const images = files.filter(f => f.kind === 'image');
    const others = files.filter(f => f.kind !== 'image');
    return (
        <div className="space-y-4">
            <SvText text={d.wakil_req_text} />
            {images.length > 0 && (
                <div>
                    <p className="text-sm font-semibold text-slate-600 mb-2">Screenshots</p>
                    <div className="flex flex-wrap gap-2">
                        {images.map((f, i) => (
                            <button key={i} onClick={() => onOpen && onOpen(f)} className="text-left" title={f.name}>
                                <img src={f.data} alt={f.name} className="w-32 h-24 object-cover rounded border border-slate-200 hover:border-blue-400 cursor-zoom-in" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {others.length > 0 && (
                <SvTable
                    headers={['File', 'Type', 'Action']}
                    rows={others.map((f, i) => [
                        <span dir="auto">{f.name || 'file'}</span>,
                        <span>{f.kind === 'pdf' ? 'PDF' : f.kind === 'text' ? 'Text' : 'File'}</span>,
                        <span className="flex gap-1.5">
                            <button onClick={() => onOpen && onOpen(f)} className="text-blue-700 font-semibold hover:underline">{tr('Preview')}</button>
                            <a href={f.data} download={f.name || ('file' + i)} className="text-blue-700 font-semibold">{tr('Download')}</a>
                        </span>
                    ])}
                />
            )}
            {!d.wakil_req_text && !files.length && <SvEmpty />}
        </div>
    );
}

function SvRunsContent({ d, titles }) {
    const arr = svArr(_svParse(d.wakil_runs, []));
    if (!arr.length) return <SvEmpty />;
    const caseTitles = titles || {};
    return (
        <div className="space-y-2.5">
            {arr.map((run, ri) => {
                const results = (run.results && typeof run.results === 'object' && !Array.isArray(run.results)) ? run.results : {};
                const entries = Object.entries(results);
                const count = {}; let total = 0;
                entries.forEach(([, st]) => { count[st] = (count[st] || 0) + 1; total++; });
                return (
                    <details key={run.id || ('RUN-' + (ri + 1))} className="sv-acc border border-slate-200 rounded-lg bg-white">
                        <summary className="p-2.5 text-sm flex items-center gap-2.5 flex-wrap select-none">
                            <span className="sv-chev text-slate-400">▶</span>
                            <span className="font-bold text-blue-700">{run.id}</span>
                            <span dir="auto" className="flex-1 min-w-0">{run.name}</span>
                            {run.date && <span className="text-slate-400 text-xs">{run.date}</span>}
                            {total ? <span className="text-slate-600 font-semibold">✅ {count.Pass || 0}/{total}</span> : null}
                        </summary>
                        <div className="px-3 pb-3 space-y-2 text-sm text-slate-700 border-t border-slate-100 pt-2">
                            <div className="flex flex-wrap gap-1.5">
                                {['Pass', 'Fail', 'Blocked', 'Skipped', 'Untested'].map(st => count[st] ? (
                                    <span key={st} className={`border rounded-full px-2.5 py-0.5 font-semibold text-xs ${_svStatusCls(st)}`}>{st}: {count[st]}</span>
                                ) : null)}
                            </div>
                            {run.build && <p><span className="text-slate-400">Build:</span> {run.build}</p>}
                            {run.environment && <p><span className="text-slate-400">Environment:</span> <span dir="auto">{run.environment}</span></p>}
                            {run.notes && <p dir="auto" className="whitespace-pre-wrap"><span className="text-slate-400">Notes: </span>{run.notes}</p>}
                            {entries.length > 0 && (
                                <SvTable
                                    headers={['Title', 'Result']}
                                    rows={entries.map(([k, st]) => {
                                        const id = String(k).split('::')[0] || '';
                                        return [<span dir="auto">{caseTitles[id] || id}</span>, <SvStatus v={st} />];
                                    })}
                                />
                            )}
                        </div>
                    </details>
                );
            })}
        </div>
    );
}

// ---------- Summary Report (تقرير ملخص لكل ستوري) ----------
const SUM_STATUSES = ['Pass', 'Fail', 'Blocked', 'Skipped', 'Untested'];
function flattenGaps(gapData) {
    const out = [];
    (((gapData && gapData.sections) || [])).forEach(s => (((s && s.gaps) || [])).forEach(g => out.push(g)));
    (((gapData && gapData.cross) || [])).forEach(g => out.push(g));
    return out;
}
function tcRunKey(tc) { return (tc.scenarioId || '') + '::' + (tc.id || ''); }

// ---------- تحميل التقارير من الشير: نفس تقارير التطبيق لكن مبنية من داتا اللينك المشترك ----------
// ملخص الستوري (Word) — زي downloadSummaryDoc في features/summary.js
function svStoryReportHtml(d, storyName, projectName) {
    const gapData = d.wakil_gap_data ? _svParse(d.wakil_gap_data, null) : null;
    const scData = svArr(_svParse(d.wakil_sc_data, []));
    const aiData = d.wakil_ai_data ? _svParse(d.wakil_ai_data, null) : null;
    const bugs = svArr(_svParse(d.wakil_bugs, []));
    const runs = svArr(_svParse(d.wakil_runs, []));

    const cases = (aiData && aiData.testCases) || [];
    const scenarios = (() => {
        const m = new Map();
        [...scData, ...((aiData && aiData.scenarios) || [])].forEach(sc => { if (sc && sc.id && !m.has(sc.id)) m.set(sc.id, sc); });
        return [...m.values()];
    })();
    const allGaps = gapData ? flattenGaps(gapData) : [];
    const sourceRun = runs.length ? runs[runs.length - 1] : null;
    const statusOf = (tc) => sourceRun ? ((sourceRun.results && sourceRun.results[tcRunKey(tc)]) || 'Untested') : 'Untested';

    const exec = { Pass: 0, Fail: 0, Blocked: 0, Skipped: 0, Untested: 0 };
    cases.forEach(tc => { const s = statusOf(tc); exec[s] = (exec[s] || 0) + 1; });
    const executed = cases.length - exec.Untested;
    const pct = cases.length ? Math.round((executed / cases.length) * 100) : 0;
    const passRate = executed ? Math.round((exec.Pass / executed) * 100) : 0;

    const gapCount = (fn) => allGaps.filter(fn).length;
    const bugCount = (fn) => bugs.filter(fn).length;
    const openBugs = bugs.filter(b => b.status !== 'Closed' && b.status !== 'Rejected');

    const covRows = scenarios.map(sc => {
        const tcs = cases.filter(tc => tc.scenarioId === sc.id);
        const c = { Pass: 0, Fail: 0, Blocked: 0, Skipped: 0, Untested: 0 };
        tcs.forEach(tc => { c[statusOf(tc)] = (c[statusOf(tc)] || 0) + 1; });
        const bugList = bugs.filter(b => tcs.some(tc => b.testCaseId === tc.id));
        const state = !tcs.length ? 'No cases' : ((c.Fail + c.Blocked + c.Untested + c.Skipped) === 0 ? 'All passed' : 'In progress');
        return { sc, n: tcs.length, c, bugs: bugList, state };
    });
    const uncovered = covRows.filter(r => r.n === 0).length;

    const date = new Date().toISOString().slice(0, 10);
    // إعدادات صاحب المشروع المحفوظة مع الستوري (زي صفحة Summary Report في التطبيق)
    const preparedBy = (typeof d.wakil_sum_by === 'string' && d.wakil_sum_by.trim()) ? d.wakil_sum_by.trim() : 'QA Team';
    const preparedProject = (typeof d.wakil_sum_project === 'string' && d.wakil_sum_project.trim()) ? d.wakil_sum_project.trim() : ((projectName ? projectName + ' — ' : '') + (storyName || 'Story'));
    const srcLabel = sourceRun ? `${sourceRun.id} — ${escHtml(sourceRun.name)} (${escHtml(sourceRun.date || '')}${sourceRun.build ? ', ' + escHtml(sourceRun.build) : ''})` : 'No Test Run executed yet';
    const covState = (s) => `<span class="${s === 'All passed' ? 'Pass' : s === 'In progress' ? 'Blocked' : 'Fail'}">${s}</span>`;
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><title>Test Summary Report</title>
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
<tr><td><b>Project / Feature:</b></td><td>${escHtml(preparedProject)}</td></tr>
<tr><td><b>Prepared by:</b></td><td>${escHtml(preparedBy)}</td></tr>
<tr><td><b>Date:</b></td><td>${date}</td></tr>
<tr><td><b>Execution source:</b></td><td>${srcLabel}</td></tr>
</table>

<h2>1. Executive Summary</h2>
<p>The feature was analyzed and tested end to end: <b>${gapData ? svArr(gapData.sections).length : 0}</b> requirement section(s) reviewed with <b>${allGaps.length}</b> gap(s) raised, <b>${scenarios.length}</b> test scenario(s) designed, <b>${cases.length}</b> test case(s) created and <b>${executed}</b> of them executed (${pct}%). The run pass rate is <b>${passRate}%</b> with <b>${bugs.length}</b> bug(s) reported (${openBugs.length} still open).</p>
<table>
<tr><th>Executed</th><th>% Executed</th><th>Pass</th><th>Fail</th><th>Blocked</th><th>Skipped</th><th>Untested</th><th>Pass Rate</th></tr>
<tr><td>${executed}/${cases.length}</td><td>${pct}%</td><td>${exec.Pass}</td><td>${exec.Fail}</td><td>${exec.Blocked}</td><td>${exec.Skipped}</td><td>${exec.Untested}</td><td><b>${passRate}%</b></td></tr>
</table>

<h2>2. Requirements Analysis Summary</h2>
<table>
<tr><th>Sections analyzed</th><th>Total gaps</th><th>High</th><th>Medium</th><th>Low</th><th>Still open questions</th></tr>
<tr><td>${gapData ? svArr(gapData.sections).length : 0}</td><td>${allGaps.length}</td><td>${gapCount(g => g.priority === 'High')}</td><td>${gapCount(g => g.priority === 'Medium')}</td><td>${gapCount(g => g.priority === 'Low')}</td><td>${gapCount(g => g.status === 'Open')}</td></tr>
</table>
${allGaps.length ? `<table><tr><th>Gap ID</th><th>Priority</th><th>Description</th><th>Status</th></tr>${allGaps.map(g => `<tr><td>${escHtml(g.id)}</td><td class="${escHtml(g.priority)}">${escHtml(g.priority)}</td><td>${escHtml(g.description)}</td><td>${escHtml(g.status)}</td></tr>`).join('')}</table>` : '<p class="note">No requirement gap analysis was run for this scope.</p>'}

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
${bugs.length ? `<table><tr><th>Bug ID</th><th>Title</th><th>Severity</th><th>Priority</th><th>Status</th><th>Linked TC</th></tr>${bugs.map(b => `<tr><td>${escHtml(b.id)}</td><td>${escHtml(b.title)}</td><td class="${escHtml(b.severity)}">${escHtml(b.severity)}</td><td class="${escHtml(b.priority)}">${escHtml(b.priority)}</td><td>${escHtml(b.status)}</td><td>${escHtml(b.testCaseId || '-')}</td></tr>`).join('')}</table>` : '<p>No bugs were reported in this cycle.</p>'}

<h2>6. Sign-off</h2>
<table class="sign">
<tr><td>Prepared by (QA):</td><td>________________________</td><td>Date:</td><td>____________</td></tr>
<tr><td>Reviewed by:</td><td>________________________</td><td>Date:</td><td>____________</td></tr>
<tr><td>Approved by:</td><td>________________________</td><td>Date:</td><td>____________</td></tr>
</table>
</body></html>`;
}

function svDownloadStoryDoc(d, storyName, projectName) {
    const safe = String(storyName || 'Story').replace(/[\\/:*?"<>|]/g, '_');
    downloadBlob(new Blob(['\uFEFF' + trHtml(svStoryReportHtml(d || {}, storyName, projectName))], { type: 'application/msword;charset=utf-8' }), safe + '_Test_Summary_Report.doc');
}

// ملخص المشروع (Word + PDF) — زي buildReportHtml في features/projects.js مع عمود اليوزر ستوري
function svProjectReportHtml(stories, projectName) {
    const scRaw = [], linkedRaw = [], aiScRaw = [], cases = [], bugs = [], runs = [];
    let gapSections = 0; let allGaps = [];
    svArr(stories).forEach(st => {
        const d = (st && st.data) || {};
        const sn = st.name || 'Story';
        const gapData = d.wakil_gap_data ? _svParse(d.wakil_gap_data, null) : null;
        if (gapData) {
            gapSections += svArr(gapData.sections).length;
            allGaps = allGaps.concat(flattenGaps(gapData));
        }
        svArr(_svParse(d.wakil_sc_data, [])).forEach(sc => scRaw.push({ ...sc, _story: sn }));
        svArr(_svParse(d.wakil_linked, [])).forEach(sc => linkedRaw.push({ ...sc, _story: sn }));
        const aiData = d.wakil_ai_data ? _svParse(d.wakil_ai_data, null) : null;
        if (aiData) {
            svArr(aiData.scenarios).forEach(sc => aiScRaw.push({ ...sc, _story: sn }));
            svArr(aiData.testCases).forEach(tc => cases.push({ ...tc, _story: sn }));
        }
        svArr(_svParse(d.wakil_bugs, [])).forEach(b => bugs.push({ ...b, _story: sn }));
        svArr(_svParse(d.wakil_runs, [])).forEach(r => runs.push({ ...r, _story: sn }));
    });

    // نفس تجميع SvProjectSummaryContent (dedupe أول ظهور) عشان أرقام التقرير تطابق الظاهر على الشاشة
    const scenarios = (() => {
        const m = new Map();
        [...scRaw, ...linkedRaw, ...aiScRaw].forEach(sc => { if (sc && sc.id && !m.has(sc.id)) m.set(sc.id, sc); });
        return [...m.values()];
    })();

    const sourceRun = runs.length ? runs[runs.length - 1] : null;
    const statusOf = (tc) => sourceRun ? ((sourceRun.results && sourceRun.results[tcRunKey(tc)]) || 'Untested') : 'Untested';

    const exec = { Pass: 0, Fail: 0, Blocked: 0, Skipped: 0, Untested: 0 };
    cases.forEach(tc => { const s = statusOf(tc); exec[s] = (exec[s] || 0) + 1; });
    const executed = cases.length - exec.Untested;
    const pct = cases.length ? Math.round((executed / cases.length) * 100) : 0;
    const passRate = executed ? Math.round((exec.Pass / executed) * 100) : 0;

    const gapCount = (fn) => allGaps.filter(fn).length;
    const bugCount = (fn) => bugs.filter(fn).length;
    const openBugs = bugs.filter(b => b.status !== 'Closed' && b.status !== 'Rejected');

    const covRows = scenarios.map(sc => {
        const tcs = cases.filter(tc => tc.scenarioId === sc.id);
        const c = { Pass: 0, Fail: 0, Blocked: 0, Skipped: 0, Untested: 0 };
        tcs.forEach(tc => { c[statusOf(tc)] = (c[statusOf(tc)] || 0) + 1; });
        const bugList = bugs.filter(b => tcs.some(tc => b.testCaseId === tc.id));
        const state = !tcs.length ? 'No cases' : ((c.Fail + c.Blocked + c.Untested + c.Skipped) === 0 ? 'All passed' : 'In progress');
        return { sc, n: tcs.length, c, bugs: bugList, state };
    });
    const uncovered = covRows.filter(r => r.n === 0).length;

    const date = new Date().toISOString().slice(0, 10);
    // "Prepared by" من إعدادات صاحب المشروع المحفوظة مع أي ستوري (أول قيمة متاحة)
    const preparedBy = (() => {
        for (const st of svArr(stories)) {
            const v = st && st.data && st.data.wakil_sum_by;
            if (typeof v === 'string' && v.trim()) return v.trim();
        }
        return 'QA Team';
    })();
    const srcLabel = sourceRun ? `${escHtml(sourceRun._story || '')} · ${sourceRun.id} — ${escHtml(sourceRun.name)} (${escHtml(sourceRun.date || '')}${sourceRun.build ? ', ' + escHtml(sourceRun.build) : ''})` : 'No Test Run executed yet';
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
<tr><td><b>Project:</b></td><td>${escHtml(projectName || 'N/A')}</td></tr>
<tr><td><b>Prepared by:</b></td><td>${escHtml(preparedBy)}</td></tr>
<tr><td><b>Date:</b></td><td>${date}</td></tr>
<tr><td><b>Execution source:</b></td><td>${srcLabel}</td></tr>
</table>
<h2>1. Executive Summary</h2>
<p>The project was analyzed and tested end to end: <b>${gapSections}</b> requirement section(s) reviewed with <b>${allGaps.length}</b> gap(s) raised, <b>${scenarios.length}</b> test scenario(s) designed, <b>${cases.length}</b> test case(s) created and <b>${executed}</b> executed (${pct}%). The run pass rate is <b>${passRate}%</b> with <b>${bugs.length}</b> bug(s) reported (${openBugs.length} still open).</p>
<table>
<tr><th>Executed</th><th>% Executed</th><th>Pass</th><th>Fail</th><th>Blocked</th><th>Skipped</th><th>Untested</th><th>Pass Rate</th></tr>
<tr><td>${executed}/${cases.length}</td><td>${pct}%</td><td>${exec.Pass}</td><td>${exec.Fail}</td><td>${exec.Blocked}</td><td>${exec.Skipped}</td><td>${exec.Untested}</td><td><b>${passRate}%</b></td></tr>
</table>
<h2>2. Requirements Analysis Summary</h2>
<table>
<tr><th>Sections analyzed</th><th>Total gaps</th><th>High</th><th>Medium</th><th>Low</th><th>Still open questions</th></tr>
<tr><td>${gapSections}</td><td>${allGaps.length}</td><td>${gapCount(g => g.priority === 'High')}</td><td>${gapCount(g => g.priority === 'Medium')}</td><td>${gapCount(g => g.priority === 'Low')}</td><td>${gapCount(g => g.status === 'Open')}</td></tr>
</table>
${allGaps.length ? `<table><tr><th>Gap ID</th><th>Priority</th><th>Description</th><th>Status</th></tr>${allGaps.map(g => `<tr><td>${escHtml(g.id)}</td><td class="${escHtml(g.priority)}">${escHtml(g.priority)}</td><td>${escHtml(g.description)}</td><td>${escHtml(g.status)}</td></tr>`).join('')}</table>` : '<p class="note">No requirement gap analysis was run for this scope.</p>'}
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
${bugs.length ? `<table><tr><th>Story</th><th>Bug ID</th><th>Title</th><th>Severity</th><th>Priority</th><th>Status</th><th>Linked TC</th></tr>${bugs.map(b => `<tr><td>${escHtml(b._story || '-')}</td><td>${escHtml(b.id)}</td><td>${escHtml(b.title)}</td><td class="${escHtml(b.severity)}">${escHtml(b.severity)}</td><td class="${escHtml(b.priority)}">${escHtml(b.priority)}</td><td>${escHtml(b.status)}</td><td>${escHtml(b.testCaseId || '-')}</td></tr>`).join('')}</table>` : '<p>No bugs were reported in this cycle.</p>'}
<h2>6. Sign-off</h2>
<table class="sign">
<tr><td>Prepared by (QA):</td><td>________________________</td><td>Date:</td><td>____________</td></tr>
<tr><td>Reviewed by:</td><td>________________________</td><td>Date:</td><td>____________</td></tr>
<tr><td>Approved by:</td><td>________________________</td><td>Date:</td><td>____________</td></tr>
</table>
</body></html>`;
}

function svDownloadProjectDoc(stories, projectName) {
    const safe = String(projectName || 'Project').replace(/[\\/:*?"<>|]/g, '_');
    downloadBlob(new Blob(['\uFEFF' + trHtml(svProjectReportHtml(stories, projectName))], { type: 'application/msword;charset=utf-8' }), safe + '_Project_Summary.doc');
}

function svDownloadProjectPDF(stories, projectName) {
    const safe = String(projectName || 'Project').replace(/[\\/:*?"<>|]/g, '_');
    const el = document.createElement('div');
    el.innerHTML = svProjectReportHtml(stories, projectName);
    el.style.cssText = 'font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1e293b;padding:24px;background:#ffffff;';
    document.body.appendChild(el);
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js').then(() => {
        window.html2pdf().from(el).set({
            margin: [10, 10],
            filename: safe + '_Project_Summary.pdf',
            html2canvas: { scale: 2, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).save().then(() => document.body.removeChild(el));
    }).catch(e => { document.body.removeChild(el); alert(tr('PDF export failed') + ': ' + e.message); });
}

function SvSummaryContent({ d, storyName, projectName }) {
    const gapData = d.wakil_gap_data ? _svParse(d.wakil_gap_data, null) : null;
    const scData = svArr(_svParse(d.wakil_sc_data, []));
    const linked = svArr(_svParse(d.wakil_linked, []));
    const aiData = d.wakil_ai_data ? _svParse(d.wakil_ai_data, null) : null;
    const bugs = svArr(_svParse(d.wakil_bugs, []));
    const runs = svArr(_svParse(d.wakil_runs, []));
    
    const cases = aiData?.testCases || [];
    const scenarios = (() => {
        const m = new Map();
        [...scData, ...(aiData?.scenarios || [])].forEach(sc => { if (sc?.id && !m.has(sc.id)) m.set(sc.id, sc); });
        return [...m.values()];
    })();
    const allGaps = gapData ? flattenGaps(gapData) : [];
    const sourceRun = runs.length ? runs[runs.length - 1] : null;
    const statusOf = (tc) => sourceRun ? (sourceRun.results?.[tcRunKey(tc)] || 'Untested') : 'Untested';
    
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
    const hasAny = allGaps.length || scenarios.length || cases.length || bugs.length;
    
    if (!hasAny) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 space-y-2">
                <p className="font-bold">{tr('Not enough data for the summary report yet.')}</p>
                <p>{tr('The report aggregates from: Requirement Gaps + Test Scenarios + Test Generation + Test Runs + Bug Report.')}</p>
            </div>
        );
    }

    const card = (value, label, cls = 'bg-white border-slate-200 text-slate-800') => (
        <div className={`border rounded-lg p-2 text-center text-xs ${cls}`}>
            <div className="text-lg font-bold">{value}</div>{label}
        </div>
    );

    const covStateCls = (s) => s === 'All passed' ? 'text-green-700' : s === 'No cases' ? 'text-red-600' : 'text-amber-700';

    return (
        <div className="space-y-4">
            {/* Header + زر تحميل تقرير Word */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                    <p className="font-bold text-blue-800">📊 Summary Report — {storyName || 'Story'}</p>
                    <p className="text-xs text-blue-600 mt-1">{tr('Automatic summary of all work outputs (Gaps + Scenarios + Cases + Runs + Bugs)')}</p>
                </div>
                <button onClick={() => svDownloadStoryDoc(d, storyName, projectName)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0">⬇ {tr('Download Word')}</button>
            </div>
            
            {/* KPI Cards */}
            <div className="grid grid-cols-5 gap-2">
                {card(gapData?.sections?.length || 0, 'Sections')}
                {card(allGaps.length, 'Gaps', 'bg-white border-red-200 text-red-700')}
                {card(gapCount(g => g.status === 'Open'), 'Open', 'bg-amber-50 border-amber-200 text-amber-700')}
                {card(scenarios.length, 'Scenarios')}
                {card(cases.length, 'Test Cases')}
                {card(`${pct}%`, 'Executed', 'bg-blue-50 border-blue-200 text-blue-700')}
                {card(exec.Pass, 'Pass', 'bg-green-50 border-green-200 text-green-700')}
                {card(exec.Fail, 'Fail', 'bg-red-50 border-red-200 text-red-700')}
                {card(exec.Blocked + exec.Skipped, 'Blocked/Skip', 'bg-amber-50 border-amber-200 text-amber-700')}
                {card(`${passRate}%`, 'Pass Rate', 'bg-white border-slate-200 font-semibold')}
            </div>
            
            {/* Bugs Summary */}
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
                    <p className="text-slate-400">{sourceRun ? `Source: ${sourceRun.id} — ${sourceRun.name}` : 'Source: latest run'}</p>
                </div>
            </div>
            
            {/* Execution & Coverage by Scenario */}
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
                                    <td className={`p-2 border-t border-slate-200 font-semibold ${covStateCls(r.state)}`}>{r.state}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* Bugs Table */}
            {bugs.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                    <p className="font-bold text-slate-700 text-sm">Bugs</p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs border border-slate-200">
                            <thead>
                                <tr className="bg-blue-600 text-white text-left">
                                    <th className="p-2">Bug</th><th className="p-2">Title</th><th className="p-2">Severity</th>
                                    <th className="p-2">Priority</th><th className="p-2">Status</th><th className="p-2">Linked TC</th>
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
        </div>
    );
}

function SvSectionContent({ sec, d, titles, onOpen, projectName }) {
    if (sec.id === 'requirements') return <SvRequirementsContent d={d} onOpen={onOpen} />;
    if (sec.id === 'gaps') return <SvGapsContent d={d} />;
    if (sec.id === 'scenarios') return (svHas(d, 'wakil_sc_data') || svHas(d, 'wakil_linked')) ? <SvScenariosContent d={d} /> : <SvEmpty />;
    if (sec.id === 'cases') return <SvCasesContent d={d} />;
    if (sec.id === 'bugs') return <SvBugsContent d={d} />;
    if (sec.id === 'runs') return <SvRunsContent d={d} titles={titles} />;
    if (sec.id === 'summary') return <SvSummaryContent d={d} storyName={titles.storyName || 'Story'} projectName={projectName} />;
    return null;
}

// عنصر ستوري جوه الأكورديون: جواه تابات (توجل) لكل فيتشر
function SvStoryItem({ st, defaultOpen, onOpen, onlyFeature, projectName }) {
    const secs = svSections(onlyFeature);
    // خريطة عناوين الكيسز (ID ⇒ عنوان) — لعرض نتايج الجولات بالعنوان الحالي
    const aiData = st.data && st.data.wakil_ai_data ? _svParse(st.data.wakil_ai_data, null) : null;
    const titles = { storyName: st.name || 'Story' };
    svArr(aiData && aiData.testCases).forEach(tc => { if (tc.id) titles[tc.id] = tc.title; });
    return (
        <SvItem icon="📖" title={st.name || 'Story'} count={secs.length || null} defaultOpen={defaultOpen}>
            {secs.map(sec => (
                <SvItem key={sec.id} icon={sec.icon} title={sec.label} count={svSecCount(st.data, sec.id)} defaultOpen={false}>
                    <SvSectionContent sec={sec} d={st.data || {}} titles={titles} onOpen={onOpen} projectName={projectName} />
                </SvItem>
            ))}
        </SvItem>
    );
}

// ---------- Project Summary (تقرير ملخص للمشروع كله — يجمع كل الستوريز) ----------
function SvProjectSummaryContent({ stories, projectName }) {
    // نجمع كل الداتا من كل الستوريز
    let allGapData = { sections: [], cross: [] };
    let allScData = [];
    let allLinked = [];
    let allAiData = { testCases: [], scenarios: [] };
    let allBugs = [];
    let allRuns = [];
    
    stories.forEach(st => {
        const d = st.data || {};
        const gapData = d.wakil_gap_data ? _svParse(d.wakil_gap_data, null) : null;
        if (gapData) {
            allGapData.sections.push(...svArr(gapData.sections));
            allGapData.cross.push(...svArr(gapData.cross));
        }
        allScData.push(...svArr(_svParse(d.wakil_sc_data, [])));
        allLinked.push(...svArr(_svParse(d.wakil_linked, [])));
        const aiData = d.wakil_ai_data ? _svParse(d.wakil_ai_data, null) : null;
        if (aiData) {
            allAiData.testCases.push(...svArr(aiData.testCases));
            allAiData.scenarios.push(...svArr(aiData.scenarios));
        }
        allBugs.push(...svArr(_svParse(d.wakil_bugs, [])));
        allRuns.push(...svArr(_svParse(d.wakil_runs, [])));
    });
    
    const cases = allAiData.testCases;
    const scenarios = (() => {
        const m = new Map();
        [...allScData, ...allLinked, ...allAiData.scenarios].forEach(sc => { if (sc?.id && !m.has(sc.id)) m.set(sc.id, sc); });
        return [...m.values()];
    })();
    
    function flattenGaps(gapData) {
        const out = [];
        (gapData.sections || []).forEach(s => (s.gaps || []).forEach(g => out.push(g)));
        (gapData.cross || []).forEach(g => out.push(g));
        return out;
    }
    const allGaps = flattenGaps(allGapData);
    
    function tcRunKey(tc) { return (tc.scenarioId || '') + '::' + (tc.id || ''); }
    
    // نأخذ أحدث جولة من كل الستوريز
    const sourceRun = allRuns.length ? allRuns[allRuns.length - 1] : null;
    const statusOf = (tc) => sourceRun ? (sourceRun.results?.[tcRunKey(tc)] || 'Untested') : 'Untested';
    
    const exec = { Pass: 0, Fail: 0, Blocked: 0, Skipped: 0, Untested: 0 };
    cases.forEach(tc => { const s = statusOf(tc); exec[s] = (exec[s] || 0) + 1; });
    const executed = cases.length - exec.Untested;
    const pct = cases.length ? Math.round((executed / cases.length) * 100) : 0;
    const passRate = executed ? Math.round((exec.Pass / executed) * 100) : 0;
    
    const gapCount = (fn) => allGaps.filter(fn).length;
    const bugCount = (fn) => allBugs.filter(fn).length;
    const openBugs = allBugs.filter(b => b.status !== 'Closed' && b.status !== 'Rejected');
    
    // Coverage: سيناريو → كام كيس → نتايج → باجز
    const covRows = scenarios.map(sc => {
        const tcs = cases.filter(tc => tc.scenarioId === sc.id);
        const c = { Pass: 0, Fail: 0, Blocked: 0, Skipped: 0, Untested: 0 };
        tcs.forEach(tc => { c[statusOf(tc)] = (c[statusOf(tc)] || 0) + 1; });
        const bugList = allBugs.filter(b => tcs.some(tc => b.testCaseId === tc.id));
        const state = !tcs.length ? 'No cases' : ((c.Fail + c.Blocked + c.Untested + c.Skipped) === 0 ? 'All passed' : 'In progress');
        return { sc, n: tcs.length, c, bugs: bugList, state };
    });
    const uncovered = covRows.filter(r => r.n === 0).length;
    const hasAny = allGaps.length || scenarios.length || cases.length || allBugs.length;
    
    if (!hasAny) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 space-y-2">
                <p className="font-bold">{tr('Not enough data for the project summary report yet.')}</p>
                <p>{tr('The report aggregates from all user stories: Requirement Gaps + Test Scenarios + Test Generation + Test Runs + Bug Report.')}</p>
            </div>
        );
    }

    const card = (value, label, cls = 'bg-white border-slate-200 text-slate-800') => (
        <div className={`border rounded-lg p-2 text-center text-xs ${cls}`}>
            <div className="text-lg font-bold">{value}</div>{label}
        </div>
    );

    const covStateCls = (s) => s === 'All passed' ? 'text-green-700' : s === 'No cases' ? 'text-red-600' : 'text-amber-700';

    return (
        <div className="space-y-4">
            {/* Header + زرا تحميل التقرير (Word + PDF) زي صفحة Project Summary في التطبيق */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                    <p className="font-bold text-emerald-800">📈 Project Summary Report — {projectName || 'Project'}</p>
                    <p className="text-xs text-emerald-600 mt-1">{tr('Aggregated summary from all user stories ({n} stories)', { n: stories.length })}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => svDownloadProjectPDF(stories, projectName)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap">⬇ {tr('Download PDF')}</button>
                    <button onClick={() => svDownloadProjectDoc(stories, projectName)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap">⬇ {tr('Download Word')}</button>
                </div>
            </div>
            
            {/* KPI Cards */}
            <div className="grid grid-cols-5 gap-2">
                {card(allGapData.sections.length, 'Sections')}
                {card(allGaps.length, 'Gaps', 'bg-white border-red-200 text-red-700')}
                {card(gapCount(g => g.status === 'Open'), 'Open', 'bg-amber-50 border-amber-200 text-amber-700')}
                {card(scenarios.length, 'Scenarios')}
                {card(cases.length, 'Test Cases')}
                {card(`${pct}%`, 'Executed', 'bg-blue-50 border-blue-200 text-blue-700')}
                {card(exec.Pass, 'Pass', 'bg-green-50 border-green-200 text-green-700')}
                {card(exec.Fail, 'Fail', 'bg-red-50 border-red-200 text-red-700')}
                {card(exec.Blocked + exec.Skipped, 'Blocked/Skip', 'bg-amber-50 border-amber-200 text-amber-700')}
                {card(`${passRate}%`, 'Pass Rate', 'bg-white border-slate-200 font-semibold')}
            </div>
            
            {/* Bugs Summary */}
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                    <p className="font-bold text-slate-500 uppercase">Bugs</p>
                    <div className="grid grid-cols-5 gap-1 text-center">
                        <div><div className="text-base font-bold text-slate-800">{allBugs.length}</div><span className="text-slate-400">Total</span></div>
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
                    <p className="text-slate-400">{sourceRun ? `Source: ${sourceRun.id} — ${sourceRun.name}` : 'Source: latest run'}</p>
                </div>
            </div>
            
            {/* Execution & Coverage by Scenario */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                <p className="font-bold text-slate-700 text-sm">Execution & Coverage by Scenario</p>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-slate-200">
                        <thead>
                            <tr className="bg-emerald-600 text-white text-left">
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
                                    <td className={`p-2 border-t border-slate-200 font-semibold ${covStateCls(r.state)}`}>{r.state}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* Bugs Table */}
            {allBugs.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                    <p className="font-bold text-slate-700 text-sm">Bugs</p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs border border-slate-200">
                            <thead>
                                <tr className="bg-emerald-600 text-white text-left">
                                    <th className="p-2">Bug</th><th className="p-2">Title</th><th className="p-2">Severity</th>
                                    <th className="p-2">Priority</th><th className="p-2">Status</th><th className="p-2">Linked TC</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allBugs.map((b, i) => (
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
        </div>
    );
}

// ---------- الصفحة نفسها ----------
function ShareViewer({ shareId }) {
    const [share, setShare] = useState(null);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(true);
    const [lang, setLang] = useLang();
    const [viewFile, setViewFile] = useState(null); // عارض ملفات Requirements في الشير (صورة/PDF/نص)
    const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

    // زرار الدارك مود في هيدر الشير — نفس نظام الثيم بتاع الموقع (vetly_theme)
    const toggleTheme = () => {
        const next = !document.documentElement.classList.contains('dark');
        document.documentElement.classList.toggle('dark', next);
        try { localStorage.setItem('vetly_theme', next ? 'dark' : 'light'); } catch (e) { /* ignore */ }
        setDark(next);
    };

    // أول تحميل + فحص دوري كل 10 ثواني: اللينك live — لو صاحب المشروع حذف/أضاف
    // حاجة والحفظ التلقائي جدّد اللينك، الأرقام والمحتوى هنا بيتحدثوا لوحدهم
    useEffect(() => {
        let alive = true;
        const fetchShare = () => {
            sbGetShare(shareId).then(r => {
                if (!alive) return;
                if (r.error) { setErr(r.error.message); setLoading(false); return; }
                if (!r.data) { setErr('هذا اللينك ملغي أو مش موجود — اطلب لينك جديد من صاحب المشروع.'); setLoading(false); return; }
                setErr('');
                setLoading(false);
                setShare(prev => {
                    // من غير إعادة رسم لو المحتوى متغيرش (عشان فتح/قفل التابات يفضل زي ما هو)
                    if (prev && JSON.stringify(prev.payload || {}) === JSON.stringify(r.data.payload || {})) return prev;
                    return r.data;
                });
            }).catch(() => { /* فحص فاشل — نعيد المحاولة في الدورة الجاية */ });
        };
        fetchShare();
        const t = setInterval(fetchShare, 10000);
        return () => { alive = false; clearInterval(t); };
    }, [shareId]);

    const pay = share ? share.payload : null;
    const viewStories = ((pay && pay._v === 2 && Array.isArray(pay.stories)) ? pay.stories : (pay ? [{ name: share.story_name || 'Story', data: pay }] : []))
        .filter(st => st && typeof st === 'object');
    // شير فيتشر واحدة ⇒ قسم واحد بس — مشروع/ستوري ⇒ الـ 7 فيتشرز كلها (حتى الفاضية)
    const onlyFeature = (share && share.scope === 'feature') ? (share.feature || null) : null;
    // آخر تحديث وصل للينك (أحدث timestamp بين الستوريز المعروضة)
    const lastUpdated = (() => {
        const ts = viewStories.map(st => st.updated).filter(Boolean).sort();
        return ts.length ? new Date(ts[ts.length - 1]).toLocaleString() : '';
    })();

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
            {/* الهيدر: تعريف بس — كل التنقل أكورديون تحت في المحتوى */}
            <div className="bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
                <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-slate-800">👁 Vetly · <span>Shared view</span></span>
                    <span className="text-xs bg-blue-500/10 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5 font-semibold">Read-only</span>
                    {share && <span className="text-xs text-slate-500 truncate max-w-full"><ScopeLine share={share} /></span>}
                    {lastUpdated && <span className="text-[11px] text-slate-400">· Last update: {lastUpdated}</span>}
                    <div className="ml-auto flex items-center gap-2">
                        {/* زرار الدارك مود: زي الموقع بالظبط */}
                        <button onClick={toggleTheme} title={dark ? 'Light mode' : 'Dark mode'} className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 text-sm leading-none">{dark ? '☀️' : '🌙'}</button>
                        {/* مبدّل اللغة: الزائر يختار اللي يريحه */}
                        <div className="flex gap-0.5" dir="ltr">
                            {LANGS.map(l => (
                                <button key={l.id} onClick={() => setLang(l.id)}
                                    className={`px-2 py-1 rounded text-xs font-bold ${lang === l.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                    {l.id.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => { window.location.href = window.location.origin + window.location.pathname; }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium">Open Vetly</button>
                    </div>
                </div>
            </div>

            {/* منطقة المحتوى: سكرول داخلي والفوتر بره تحتها */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto p-4 pb-8 space-y-2.5">
                    {loading && <p className="text-sm text-slate-400">Loading shared view…</p>}
                    {!loading && err && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{err}</div>}
                    {!loading && share && !viewStories.length && <p className="text-sm text-slate-400">— empty —</p>}
                    {!loading && share && viewStories.length > 1 && (
                        /* مشروع كامل: توجل واحد لكل اليوزر ستوريز — وجواه الستوريز واحدة واحدة */
                        <SvItem icon="📚" title="User Stories" count={viewStories.length} defaultOpen={false}>
                            {viewStories.map(st => <SvStoryItem key={st.id || st.name || 'story'} st={st} defaultOpen={false} onOpen={setViewFile} onlyFeature={onlyFeature} projectName={share.project_name} />)}
                        </SvItem>
                    )}
                    {/* Project Summary — أكورديون زي الستوريز (يفتح/يُقفل بسهم بيدور) — يظهر لما يكون شير مشروع كامل (مش فيتشر واحدة) */}
                    {!loading && share && viewStories.length > 1 && !onlyFeature && (
                        <SvItem icon="📈" title="Project Summary Report" defaultOpen={false}>
                            <SvProjectSummaryContent stories={viewStories} projectName={share.project_name} />
                        </SvItem>
                    )}
                    {!loading && share && viewStories.length === 1 && (
                        /* ستوري واحدة (شير ستوري أو فيتشر): الستوري هي التوجل الأساسي */
                        (() => {
                            const st = viewStories[0];
                            const single = !!onlyFeature; // شير فيتشر واحدة ⇒ افتحها على طول
                            return <SvStoryItem st={st} defaultOpen={single} onOpen={setViewFile} onlyFeature={onlyFeature} projectName={share.project_name} />;
                        })()
                    )}
                    {!loading && share && (
                        <p className="text-xs text-slate-400 text-center pt-3 pb-1">
                            This view is read-only and updates automatically with every save by the project owner — editing and running the features are available to the owner only after signing in.
                        </p>
                    )}
                </div>
            </div>

            {/* عارض ملفات Requirements: صور/PDF/نص + تنزيل — زي عارض التطبيق */}
            {viewFile && (
                <div onClick={() => setViewFile(null)} className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-4">
                    <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl w-full max-w-[92vw] max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
                        <div className="flex justify-between items-center p-3 border-b border-slate-200 gap-2">
                            <p className="text-sm font-bold text-slate-800 truncate" dir="auto">{viewFile.name}</p>
                            <div className="flex gap-2 items-center">
                                {viewFile.kind !== 'text' && <a href={viewFile.data} download={viewFile.name} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded font-medium">⬇ {tr('Download')}</a>}
                                <button onClick={() => setViewFile(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-full w-8 h-8 text-base font-bold leading-none">✕</button>
                            </div>
                        </div>
                        <div className="overflow-auto p-3 flex-1 bg-slate-50">
                            {viewFile.kind === 'image' && <img src={viewFile.data} alt={viewFile.name} className="max-w-full max-h-[72vh] object-contain mx-auto rounded" />}
                            {viewFile.kind === 'pdf' && <iframe src={viewFile.data} title={viewFile.name} className="w-full h-[72vh] rounded border border-slate-200" />}
                            {viewFile.kind === 'text' && <pre dir="auto" className="text-xs whitespace-pre-wrap break-words bg-white border border-slate-200 rounded p-3">{viewFile.data}</pre>}
                            {viewFile.kind === 'file' && <p className="text-sm text-slate-500 text-center py-8">{tr('Preview is not available for this file type — download it to view.')}</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// سطر التعريف بالنطاق (بيقرا من صف اللينك نفسه) — الترتيب: المشروع ثم الستوري ثم الفيتشر
// (كل كلمة لوحدها عشان نظام الترجمة يترجمها حسب لغة الزائر)
function ScopeLine({ share }) {
    const proj = share.project_name || '—';
    const story = share.story_name || '—';
    if (share.scope === 'project') {
        return <span>📁 <span>Project</span>: {proj} · <span>All user stories</span></span>;
    }
    if (share.scope === 'story') {
        return <span>📁 <span>Project</span>: {proj} — 📖 <span>Story</span>: {story}</span>;
    }
    return <span>📁 <span>Project</span>: {proj} — 📖 <span>Story</span>: {story} — {share.feature_label || '🧩 Feature'}</span>;
}
