/* =====================================================================
   features/scenarios.js
   ميزة Test Scenarios: توليد السيناريوهات (Positive / Negative / Edge) وإرسالها للـ Test Generation.
   ===================================================================== */

function ScenariosPage({ keys, models, setShowSettings, scData, setScData, setLinked, setPage, scHandoff }) {
    const [scStory, setScStory] = useState(() => localStorage.getItem('wakil_sc_story') || '');
    const [scImages, setScImages] = useState([]);
    const [scFiles, setScFiles] = useState([]); // الملفات المرفوعة (بتتبعت للـ AI من غير ما تتكتب في الـ textarea)
    const [scLoading, setScLoading] = useState(false);
    const [scErrors, setScErrors] = useState([]);
    const [scProvider, setScProvider] = useState('');
    const [scUploadStatus, setScUploadStatus] = useState('');
    const [showAddSc, setShowAddSc] = useState(false);
    const [addScForm, setAddScForm] = useState({ type: 'Positive', title: '', priority: 'Medium' });

    useEffect(() => {
        localStorage.setItem('wakil_sc_story', scStory);
    }, [scStory]);

    // لما نيجي من صفحة Requirement Gaps: النص الأصلي + الـ Gaps كـ Acceptance Criteria بيتحطوا في الـ textarea
    useEffect(() => {
        if (!scHandoff) return;
        setScStory(scHandoff.text || '');
        setScFiles([]);
        setScImages(scHandoff.images || []);
    }, [scHandoff]);

    /* ---------- Test Scenarios page logic ---------- */
    const handleScFileUpload = async (e) => {
        const list = Array.from(e.target.files || []);
        if (!list.length) return;
        setScUploadStatus('Reading file...');
        for (const file of list) {
            try {
                const r = await readUploadedFile(file);
                if (r.image) setScImages(prev => [...prev, r.image]);
                else setScFiles(prev => [...prev, { name: file.name, text: r.text }]);
            } catch (err) {
                console.error(err);
                alert(`${file.name}: ${err.message}`);
            }
        }
        setScUploadStatus('');
        e.target.value = '';
    };

    const generateScenarios = async () => {
        if (!scStory.trim() && scFiles.length === 0 && scImages.length === 0) { alert('Please enter requirements or upload a file first!'); return; }
        if (!PROVIDERS.some(p => (keys[p.id] || '').trim())) {
            alert('مفيش ولا API key. افتح Settings وحط مفتاح واحد على الأقل.');
            setShowSettings(true);
            return;
        }
        setScLoading(true);
        setScErrors([]);
        const prompt = `You are an expert Senior QA Engineer. Analyze the requirements below and produce TEST SCENARIOS only (high-level situations to verify, with NO steps and NO test data).
        Return ONLY a valid JSON object with no markdown and no extra text, in exactly this structure:
        {"scenarios":[{"id":"TS-01","type":"Positive" | "Negative" | "Edge Case","title":"One clear sentence describing what is verified","priority":"Critical" | "High" | "Medium" | "Low"}]}
        Rules:
        1. The number of scenarios must be driven ONLY by the size and complexity of the input (it can be 5, 12, 30 or more). Cover every requirement, rule, field, role and flow.
        2. Positive = valid/happy-path behavior. Negative = invalid input, errors, missing data, unauthorized access, failures.
        3. Edge Case = boundary or unusual conditions (limits, empty/very large input, special characters, concurrency, interruptions, etc.). Include Edge Case scenarios ONLY where they genuinely apply to these requirements; if none apply, include none.
        4. "type" must be EXACTLY one of: "Positive", "Negative", "Edge Case".
        5.${langRule()}
        Requirements text: "${joinWithFiles(scStory, scFiles)}"`;

        const { data: res, provider, errors } = await runProviders({
            keys, models, prompt, images: scImages,
            validate: (p) => (Array.isArray(p?.scenarios) && p.scenarios.length)
                ? p.scenarios.map((sc, i) => ({
                    id: `TS-${String(i + 1).padStart(2, '0')}`,
                    type: normalizeType(sc.type),
                    title: str(sc.title),
                    priority: normPriority(sc.priority)
                }))
                : null
        });
        setScLoading(false);
        setScErrors(errors);
        if (res) {
            setScData(res);
            setScProvider(provider);
        } else {
            alert('كل الـ APIs فشلت. التفاصيل ظاهرة تحت زر Generate.');
        }
    };

    const updateScenario = (index, field, value) => {
        setScData(scData.map((sc, i) => i === index ? { ...sc, [field]: value } : sc));
    };

    const deleteScenario = (index) => {
        setScData(scData.filter((_, i) => i !== index));
    };

    const scenariosAsText = () => ['Positive', 'Negative', 'Edge Case']
        .map(cat => {
            const items = (scData || []).filter(sc => sc.type === cat);
            return items.length ? `${cat} Scenarios:\n` + items.map(sc => `${sc.id}: ${sc.title}`).join('\n') : '';
        })
        .filter(Boolean)
        .join('\n\n');

    const copyScenarios = async () => {
        try {
            await navigator.clipboard.writeText(scenariosAsText());
            alert('تم نسخ السيناريوهات ✔');
        } catch (e) {
            window.prompt('انسخ السيناريوهات من هنا:', scenariosAsText());
        }
    };

    /* ---------- Export: Excel / Word ---------- */
    const SC_TYPES = ['Positive', 'Negative', 'Edge Case'];

    const downloadScenariosXlsx = async () => {
        if (!scData?.length) return;
        try {
            await loadScript('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js');
        } catch (e) {
            alert('تعذر تحميل مكتبة Excel. استخدم تصدير Word بدلها.');
            return;
        }
        const XLSX = window.XLSX;
        const rows = scData.map(sc => [sc.id, sc.type, sc.title, sc.priority || 'Medium'].map(v => String(v ?? '')));
        const ws = XLSX.utils.aoa_to_sheet(trAoa([['Scenario ID', 'Type', 'Title', 'Priority'], ...rows]));
        ws['!cols'] = [12, 13, 90, 10].map(w => ({ wch: w }));
        ws['!autofilter'] = { ref: ws['!ref'] };
        const thin = { style: 'thin', color: { rgb: 'CBD5E1' } };
        const border = { top: thin, bottom: thin, left: thin, right: thin };
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
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Test Scenarios');
        XLSX.writeFile(wb, 'Test_Scenarios.xlsx');
    };

    const downloadScenariosDoc = () => {
        if (!scData?.length) return;
        const date = new Date().toISOString().slice(0, 10);
        const section = (cat) => {
            const items = scData.filter(sc => sc.type === cat);
            if (!items.length) return '';
            return `<h2>${cat} Scenarios (${items.length})</h2><table><tr><th style="width:12%">ID</th><th>Scenario</th><th style="width:12%">Priority</th></tr>` +
                items.map(sc => `<tr><td>${escHtml(sc.id)}</td><td>${escHtml(sc.title)}</td><td>${escHtml(sc.priority || 'Medium')}</td></tr>`).join('') + '</table>';
        };
        const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><title>Test Scenarios</title>
<style>
body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1e293b}
h1{color:#1d4ed8;font-size:22pt;margin-bottom:2pt} h2{color:#1d4ed8;font-size:15pt;border-bottom:1px solid #cbd5e1;padding-bottom:2pt;margin-top:18pt}
table{border-collapse:collapse;width:100%;margin:6pt 0}
td,th{border:1px solid #94a3b8;padding:4pt;vertical-align:top;font-size:10pt}
th{background:#2563eb;color:#ffffff;text-align:left}
</style></head><body>
<h1>Test Scenarios</h1><p>Date: ${date} &nbsp;|&nbsp; Total scenarios: ${scData.length}</p>
${SC_TYPES.map(section).join('')}
</body></html>`;
        downloadBlob(new Blob(['\uFEFF' + trHtml(html)], { type: 'application/msword;charset=utf-8' }), 'Test_Scenarios.doc');
    };

    const sendToGeneration = () => {
        if (!scData?.length) return;
        setLinked(scData.map(({ id, type, title }) => ({ id, type, title })));
        setPage('generation');
    };

    const clearScenarios = () => {
        setScStory('');
        setScData(null);
        setScImages([]);
        setScFiles([]);
        setScErrors([]);
        setScProvider('');
        localStorage.removeItem('wakil_sc_story');
        localStorage.removeItem('wakil_sc_data');
    };

    /* ---------- Add يدوي ---------- */
    const openAddScenario = () => {
        setAddScForm({ type: 'Positive', title: '', priority: 'Medium' });
        setShowAddSc(true);
    };

    const saveNewScenario = () => {
        if (!addScForm.title.trim()) { alert('اكتب عنوان السيناريو الأول.'); return; }
        const list = scData || [];
        setScData([...list, {
            id: nextId(list.map(x => x.id), 'TS'),
            type: addScForm.type,
            title: addScForm.title.trim(),
            priority: addScForm.priority
        }]);
        setShowAddSc(false);
    };

    const scenariosMain = (
        <main className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-slate-800">Test Scenarios</h2>
                    {scProvider && !scLoading && (
                        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-1 font-semibold">✔ AI: {scProvider}</span>
                    )}
                </div>
                <div className="flex gap-2">
                    <button onClick={openAddScenario} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                        + Add
                    </button>
                    <button onClick={() => setShowSettings(true)} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                        ⚙ Settings
                    </button>
                    <button onClick={clearScenarios} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                        Clear Data
                    </button>
                    {scData?.length > 0 && (
                        <button onClick={copyScenarios} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                            Copy
                        </button>
                    )}
                    {scData?.length > 0 && (
                        <button onClick={downloadScenariosXlsx} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                            Excel (.xlsx)
                        </button>
                    )}
                    {scData?.length > 0 && (
                        <button onClick={downloadScenariosDoc} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                            Word (.doc)
                        </button>
                    )}
                    {scData?.length > 0 && (
                        <button onClick={sendToGeneration} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
                            Send to Test Generation →
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="w-1/3 border-r border-slate-200 p-4 bg-slate-50 overflow-y-auto space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Requirements / User Story</label>
                        <textarea
                            className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                            rows="10"
                            value={scStory}
                            onChange={e => setScStory(e.target.value)}
                            placeholder="Paste requirements or upload file..."
                        ></textarea>

                        <div className="mt-3 space-y-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Or Upload File (PDF/Word/Image/Text)</label>
                            <input
                                type="file"
                                multiple
                                onChange={handleScFileUpload}
                                className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-200 rounded-lg p-1 bg-white"
                            />
                            <UploadedFiles
                                files={scFiles} images={scImages} status={scUploadStatus}
                                onRemoveFile={(i) => setScFiles(scFiles.filter((_, j) => j !== i))}
                                onRemoveImage={(i) => setScImages(scImages.filter((_, j) => j !== i))}
                            />
                        </div>

                        <button
                            onClick={generateScenarios}
                            disabled={scLoading}
                            className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm flex justify-center items-center gap-2 disabled:opacity-50"
                        >
                            {scLoading ? 'Analyzing Requirements...' : 'Generate Scenarios'}
                        </button>

                        {scProvider && !scLoading && (
                            <p className="mt-2 text-xs text-emerald-700">✔ Generated using {scProvider}</p>
                        )}
                        {scErrors.length > 0 && (
                            <div className="mt-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded p-2 space-y-1">
                                {scErrors.map((m, i) => <div key={i}>{m}</div>)}
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-2/3 p-6 overflow-y-auto space-y-6">
                    {!scData?.length ? (
                        <div className="h-full flex items-center justify-center text-slate-400">
                            Provide requirements and click Generate Scenarios.
                        </div>
                    ) : (
                        <>
                            {['Positive', 'Negative', 'Edge Case'].map(cat => {
                                const items = scData.map((sc, idx) => ({ ...sc, originalIndex: idx })).filter(sc => sc.type === cat);
                                const catColor = cat === 'Positive' ? 'text-green-700 bg-green-50 border-green-200' :
                                                 cat === 'Negative' ? 'text-red-700 bg-red-50 border-red-200' :
                                                 'text-amber-700 bg-amber-50 border-amber-200';
                                if (items.length === 0) {
                                    return (
                                        <div key={cat} className={`px-3 py-1 rounded border text-xs ${catColor} opacity-70`}>
                                            {`${cat} Scenarios (0)`} — No scenarios of this type in the requirements
                                        </div>
                                    );
                                }
                                return (
                                    <div key={cat} className="space-y-2">
                                        <div className={`px-3 py-1 rounded border font-bold text-xs uppercase ${catColor}`}>{`${cat} Scenarios (${items.length})`}</div>
                                        {items.map(sc => (
                                            <div key={sc.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex items-center gap-2 text-xs">
                                                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2.5 py-1 rounded-md font-semibold">{sc.id}</span>
                                                <input
                                                    className="flex-1 border border-slate-200 rounded p-1.5 text-slate-800"
                                                    value={sc.title}
                                                    onChange={e => updateScenario(sc.originalIndex, 'title', e.target.value)}
                                                />
                                                <select
                                                    className="border border-slate-300 rounded px-1 py-1 text-xs bg-slate-50"
                                                    value={sc.type}
                                                    onChange={e => updateScenario(sc.originalIndex, 'type', e.target.value)}
                                                >
                                                    <option value="Positive">Positive</option>
                                                    <option value="Negative">Negative</option>
                                                    <option value="Edge Case">Edge Case</option>
                                                </select>
                                                <select
                                                    className="border border-slate-300 rounded px-1 py-1 text-xs font-bold bg-slate-50"
                                                    value={sc.priority || 'Medium'}
                                                    onChange={e => updateScenario(sc.originalIndex, 'priority', e.target.value)}
                                                >
                                                    <option value="Critical">Critical</option>
                                                    <option value="High">High</option>
                                                    <option value="Medium">Medium</option>
                                                    <option value="Low">Low</option>
                                                </select>
                                                <button onClick={() => deleteScenario(sc.originalIndex)} className="text-red-600 hover:underline">Delete</button>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            </div>
        </main>
    );

    return (
        <>
            {scenariosMain}

            {/* ---------- Add Scenario Modal ---------- */}
            {showAddSc && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-xl p-5 w-[460px] max-w-[95vw] shadow-xl space-y-3 text-xs">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 text-sm">Add Test Scenario</h3>
                            <button onClick={() => setShowAddSc(false)} className="text-slate-500 hover:text-slate-800">✕</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Type (هينزل في أنهي قسم):</label>
                                <select className="w-full border p-1.5 rounded bg-white" value={addScForm.type} onChange={e => setAddScForm({ ...addScForm, type: e.target.value })}>
                                    <option value="Positive">Positive</option>
                                    <option value="Negative">Negative</option>
                                    <option value="Edge Case">Edge Case</option>
                                </select>
                            </div>
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Priority:</label>
                                <select className="w-full border p-1.5 rounded bg-white" value={addScForm.priority} onChange={e => setAddScForm({ ...addScForm, priority: e.target.value })}>
                                    <option value="Critical">Critical</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Title:</label>
                            <input className="w-full border p-1.5 rounded bg-white" value={addScForm.title} onChange={e => setAddScForm({ ...addScForm, title: e.target.value })} placeholder="Scenario title" />
                        </div>
                        <div className="flex gap-2 pt-1 justify-end">
                            <button onClick={() => setShowAddSc(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded font-medium">Cancel</button>
                            <button onClick={saveNewScenario} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded font-medium">Add Scenario</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
