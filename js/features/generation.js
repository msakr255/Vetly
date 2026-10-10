/* =====================================================================
   features/generation.js
   ميزة Test Generation: توليد الـ Test Cases + التعديل + التصدير (xlsx/csv) + إرسال الـ Fail للباجز.
   ===================================================================== */

function GenerationPage({ keys, models, setShowSettings, data, setData, linked, setLinked, knownScenarios, bugFor, failedWithoutBug, sendToBugs, bugBusy, viewBug, setPage }) {
    const [story, setStory] = useState(() => localStorage.getItem('wakil_story') || '');
    const [loading, setLoading] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [images, setImages] = useState([]);
    const [files, setFiles] = useState([]); // الملفات المرفوعة (نصها بيتبعت للـ AI من غير ما يتكتب في الـ textarea)
    const [uploadStatus, setUploadStatus] = useState('');
    const [lastProvider, setLastProvider] = useState('');
    const [errorsLog, setErrorsLog] = useState([]);
    const [showAddTc, setShowAddTc] = useState(false);
    const emptyTc = { scenarioId: '', type: 'Positive', priority: 'Medium', title: '', technique: '', preCondition: '', testData: '', stepsText: '', expected: '' };
    const [addTcForm, setAddTcForm] = useState(emptyTc);

    useEffect(() => {
        localStorage.setItem('wakil_story', story);
    }, [story]);

    /* ---------- Add يدوي ---------- */
    const openAddTestCase = () => {
        setAddTcForm(emptyTc);
        setShowAddTc(true);
    };

    const saveNewTestCase = () => {
        const f = addTcForm;
        if (!f.title.trim()) { alert('اكتب عنوان التيست كيس الأول.'); return; }
        if (!f.scenarioId.trim()) { alert('اختار أو اكتب رقم السيناريو (مثلاً TS-01).'); return; }
        const base = data || { scenarios: [], testCases: [] };
        const cases = base.testCases || [];
        const scId = f.scenarioId.trim();
        const newCase = {
            id: nextId(cases.map(x => x.id), 'TC'),
            scenarioId: scId,
            type: f.type,
            title: f.title.trim(),
            technique: f.technique.trim(),
            priority: f.priority,
            preCondition: f.preCondition.trim(),
            testData: f.testData.trim(),
            steps: f.stepsText.split('\n').map(x => x.trim()).filter(Boolean),
            expected: f.expected.trim(),
            actualResult: '',
            status: 'Untested'
        };
        let scenarios = base.scenarios || [];
        const known = knownScenarios().find(sc => sc.id === scId);
        if (known && !scenarios.some(sc => sc.id === scId)) scenarios = [...scenarios, { id: known.id, title: known.title }];
        setData({ ...base, scenarios, testCases: [...cases, newCase] });
        setShowAddTc(false);
    };

    /* ---------- Clear ---------- */
    const handleClear = () => {
        setStory('');
        setData(null);
        setImages([]);
        setFiles([]);
        setErrorsLog([]);
        setLastProvider('');
        localStorage.removeItem('wakil_story');
        localStorage.removeItem('wakil_ai_data');
    };

    /* ---------- File upload (txt / PDF / Word / Image) ---------- */
    const handleFileUpload = async (e) => {
        const list = Array.from(e.target.files || []);
        if (!list.length) return;
        setUploadStatus('Reading file...');
        for (const file of list) {
            try {
                const r = await readUploadedFile(file);
                if (r.image) setImages(prev => [...prev, r.image]);
                else setFiles(prev => [...prev, { name: file.name, text: r.text }]);
            } catch (err) {
                console.error(err);
                alert(`${file.name}: ${err.message}`);
            }
        }
        setUploadStatus('');
        e.target.value = '';
    };

    /* ---------- Generate with AI (fallback بين كل الـ providers) ---------- */
    const generateWithAI = async () => {
        if (!story.trim() && files.length === 0 && images.length === 0 && linked.length === 0) { alert('Please enter a User Story or upload a file first!'); return; }

        const available = PROVIDERS.filter(p => (keys[p.id] || '').trim());
        if (available.length === 0) {
            alert('مفيش ولا API key. افتح Settings وحط مفتاح واحد على الأقل.');
            setShowSettings(true);
            return;
        }

        setLoading(true);
        setErrorsLog([]);
        let parsedData = null;
        const errors = [];
        let fallback = null, fallbackName = '';

        // لو في سيناريوهات متربطة من صفحة Test Scenarios، بنولّد الكيسز بناءً عليها
        const linkedText = linked.length
            ? `\n\nLINKED TEST SCENARIOS (already reviewed by the user). Generate the test cases for THESE scenarios. Use their exact ids in "scenarioId". Do NOT invent new scenarios and do NOT rename them. Each scenario below shows its own type; create test cases of the matching type for it (you may add extra Negative/Edge Case test cases under the most relevant scenario). Every test case "type" must be exactly "Positive", "Negative" or "Edge Case".\n` + linked.map(sc => `${sc.id} [${sc.type}] ${sc.title}`).join('\n')
            : '';
        const required = linked.length ? [...new Set(linked.map(sc => sc.type))] : ['Positive', 'Negative', 'Edge Case'];

        const prompt = `You are an expert Senior QA Engineer. Analyze the provided requirements thoroughly.
        Generate a comprehensive, robust test suite. You MUST return ONLY a valid JSON object matching this exact structure without any markdown code blocks or extra text:
        {
          "scenarios": [
            {"id": "TS-01", "title": "Comprehensive description for scenario 1"}
          ],
          "testCases": [
            {
              "id": "TC-01",
              "scenarioId": "TS-01",
              "type": "Positive" | "Negative" | "Edge Case",
              "title": "Clear test case title",
              "technique": "Boundary Value Analysis / Equivalence Partitioning / etc.",
              "priority": "Critical" | "High" | "Medium" | "Low",
              "preCondition": "Required pre-conditions",
              "testData": "Specific test data or input values",
              "steps": ["Step 1 description", "Step 2 description"],
              "expected": "Expected result outcome",
              "actualResult": "",
              "status": "Untested"
            }
          ]
        }
        Instructions: 
        1. The JSON above only shows the FORMAT with one sample item. Do NOT limit yourself to one or any fixed number. The number of scenarios and test cases must be driven ONLY by the size and complexity of the input: a small story may need around 5-8 test cases, a large one 20, 30 or more. Cover every requirement, field, rule, validation, role and flow mentioned.
        2. Extract as many distinct Test Scenarios (TS-01, TS-02, ...) as needed to completely cover all requirements.
        3. Create detailed Test Cases (TC-01, TC-02, ...) mapped correctly to their scenarios via 'scenarioId'.
        4. MANDATORY: the output MUST contain all three types: Positive, Negative, AND Edge Case. Every scenario should have at least one Positive and one Negative case, and the suite as a whole MUST include several Edge Case tests (boundary values, min/max length, empty/whitespace, special characters, very large input, unusual sequences, duplicate submissions, timeouts, etc.).
        5. The "type" field must be EXACTLY one of these strings: "Positive", "Negative", "Edge Case".
        6. Use accurate priorities (including Critical where applicable).
        7.${langRule()}
        Input text: "${joinWithFiles(story, files)}"${linkedText}`;

        for (const p of available) {
            try {
                const text = await callProvider(p, keys[p.id].trim(), prompt, images, (models[p.id] || '').trim());
                const parsed = await parseLoose(text, p.name);
                if (!parsed?.testCases?.length) throw new Error(`${p.name}: response has no testCases`);
                Object.assign(parsed, sanitizeSuite(parsed));
                // نرتّب بنفس ترتيب العرض (Positive ← Negative ← Edge Case) وبعدين نرقّم من TC-01 ورا بعض من غير تخطي
                    const typeOrder = ['Positive', 'Negative', 'Edge Case'];
                    parsed.testCases = [...parsed.testCases]
                        .sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type))
                        .map((tc, i) => ({ ...tc, id: `TC-${pad2(i + 1)}` }));
                if (linked.length) parsed.scenarios = linked.map(sc => ({ id: sc.id, title: sc.title }));
                const types = new Set(parsed.testCases.map(tc => tc.type));
                if (required.every(t => types.has(t))) {
                    parsedData = parsed;
                    setLastProvider(p.name);
                    break;
                }
                // الرد ناقص (مثلاً مفيش Edge Case): نحتفظ بيه ونجرب الموديل اللي بعده
                if (!fallback) { fallback = parsed; fallbackName = p.name; }
                throw new Error(`${p.name}: response missing some test types, trying next provider...`);
            } catch (err) {
                console.warn(err.message);
                errors.push(err.message);
            }
        }

        if (!parsedData && fallback) {
            parsedData = fallback;
            setLastProvider(fallbackName + ' ' + tr('(incomplete: not all types present, try Generate again)'));
        }

        setLoading(false);
        setErrorsLog(errors);
        if (parsedData) {
            setData(parsedData);
        } else {
            alert('كل الـ APIs فشلت. التفاصيل ظاهرة تحت زر Generate.');
        }
    };

    /* ---------- Edit / Delete (بدون mutation) ---------- */
    const updateTestCaseField = (index, field, value) => {
        const updatedCases = data.testCases.map((tc, i) => i === index ? { ...tc, [field]: value } : tc);
        setData({ ...data, testCases: updatedCases });
    };

    const deleteTestCase = (index) => {
        const updatedCases = data.testCases.filter((_, i) => i !== index);
        setData({ ...data, testCases: updatedCases });
    };

    const startEditing = (index, tc) => {
        setEditingIndex(index);
        setEditForm({
            ...tc,
            stepsText: Array.isArray(tc.steps) ? tc.steps.join('\n') : (tc.steps || '')
        });
    };

    const saveEditing = (index) => {
        const formattedSteps = editForm.stepsText
            ? editForm.stepsText.split('\n').map(s => s.trim()).filter(Boolean)
            : [];
        const { stepsText, ...rest } = editForm;
        const updatedCases = data.testCases.map((tc, i) => i === index ? { ...rest, steps: formattedSteps } : tc);
        setData({ ...data, testCases: updatedCases });
        setEditingIndex(null);
    };

    /* ---------- Export CSV (كل حقل في عمود مستقل) ---------- */
    const exportToXLSX = async () => {
        if (!data?.testCases) return;
        try {
            await loadScript('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js');
        } catch (e) {
            alert('تعذر تحميل مكتبة Excel، هيتم التصدير كـ CSV.');
            exportToCSV();
            return;
        }
        const XLSX = window.XLSX;
        const headers = ['ID', 'Scenario ID', 'Category', 'Title', 'Priority', 'Technique', 'Pre-Condition', 'Test Data', 'Steps', 'Expected', 'Actual Result', 'Status'];
        const widths = [9, 11, 12, 38, 10, 22, 30, 28, 50, 38, 25, 11];
        const rows = data.testCases.map(r => [
            r.id,
            r.scenarioId || 'N/A',
            r.type,
            r.title,
            r.priority || 'Medium',
            r.technique,
            r.preCondition,
            r.testData,
            (r.steps || []).map((s, idx) => `${idx + 1}. ${s}`).join('\n'),
            r.expected,
            r.actualResult || '',
            r.status || 'Untested'
        ].map(v => String(v ?? '')));

        const ws = XLSX.utils.aoa_to_sheet(trAoa([headers, ...rows]));
        ws['!cols'] = widths.map(w => ({ wch: w }));
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
        XLSX.utils.book_append_sheet(wb, ws, 'Test Cases');

        if (data.scenarios?.length) {
            const ws2 = XLSX.utils.aoa_to_sheet(trAoa([['Scenario ID', 'Title'], ...data.scenarios.map(s => [String(s.id ?? ''), String(s.title ?? '')])]));
            ws2['!cols'] = [{ wch: 12 }, { wch: 90 }];
            XLSX.utils.book_append_sheet(wb, ws2, 'Scenarios');
        }

        XLSX.writeFile(wb, 'Advanced_TestCases_Report.xlsx');
    };

    const exportToCSV = () => {
        if (!data?.testCases) return;
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const headers = ['ID', 'Scenario ID', 'Category', 'Title', 'Priority', 'Technique', 'Pre-Condition', 'Test Data', 'Steps', 'Expected', 'Actual Result', 'Status'];
        const rows = data.testCases.map(r => [
            r.id,
            r.scenarioId || 'N/A',
            r.type,
            r.title,
            r.priority || 'Medium',
            r.technique,
            r.preCondition,
            r.testData,
            (r.steps || []).map((s, idx) => `${idx + 1}. ${s}`).join('\n'),
            r.expected,
            r.actualResult || '',
            r.status || 'Untested'
        ].map(v => esc(tr(v))).join(','));

        const csv = '\uFEFF' + [headers.map(h => esc(tr(h))).join(','), ...rows].join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Advanced_TestCases_Report.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <>
            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-slate-800">Test Case Management Workbench</h2>
                        {lastProvider && !loading && (
                            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-1 font-semibold">✔ AI: {lastProvider}</span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {failedWithoutBug().length > 0 && (
                            <button onClick={() => sendToBugs(failedWithoutBug())} disabled={bugBusy} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                                {bugBusy ? 'Creating bugs...' : `🐞 Send failed to Bugs (${failedWithoutBug().length})`}
                            </button>
                        )}
                        <button onClick={openAddTestCase} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                            + Add
                        </button>
                        <button onClick={() => setShowSettings(true)} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                            ⚙ Settings
                        </button>
                        <button onClick={handleClear} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                            Clear Data
                        </button>
                        {data?.testCases && (
                            <button onClick={exportToXLSX} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
                                Export Excel (.xlsx)
                            </button>
                        )}
                        {data?.testCases && (
                            <button onClick={exportToCSV} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                                CSV
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <div className="w-1/3 border-r border-slate-200 p-4 bg-slate-50 overflow-y-auto space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">User Story / Acceptance Criteria</label>
                            <textarea
                                className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                                rows="10"
                                value={story}
                                onChange={e => setStory(e.target.value)}
                                placeholder="Paste requirements or upload file..."
                            ></textarea>

                            <div className="mt-3 space-y-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Or Upload File (PDF/Word/Image/Text)</label>
                                <input
                                    type="file"
                                    multiple
                                    onChange={handleFileUpload}
                                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-200 rounded-lg p-1 bg-white"
                                />
                                <UploadedFiles
                                    files={files} images={images} status={uploadStatus}
                                    onRemoveFile={(i) => setFiles(files.filter((_, j) => j !== i))}
                                    onRemoveImage={(i) => setImages(images.filter((_, j) => j !== i))}
                                />
                            </div>

                            <button
                                onClick={generateWithAI}
                                disabled={loading}
                                className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                {loading ? 'Analyzing Requirements...' : 'Generate Test Cases'}
                            </button>

                            {lastProvider && !loading && (
                                <p className="mt-2 text-xs text-emerald-700">✔ Generated using {lastProvider}</p>
                            )}
                            {errorsLog.length > 0 && (
                                <div className="mt-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded p-2 space-y-1">
                                    {errorsLog.map((m, i) => <div key={i}>{m}</div>)}
                                </div>
                            )}
                        </div>

                        {linked.length > 0 && (
                            <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 shadow-sm">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-xs font-bold text-blue-700 uppercase">Linked Scenarios ({linked.length})</h3>
                                    <button onClick={() => setLinked([])} className="text-[11px] text-red-600 hover:underline">Remove link</button>
                                </div>
                                <p className="text-[11px] text-slate-500 mb-2">Generate Test Cases هيبني الكيسز على السيناريوهات دي.</p>
                                <ul className="space-y-1.5">
                                    {linked.map(sc => (
                                        <li key={sc.id} className="text-xs bg-white p-2 rounded border border-blue-100">
                                            <span className="font-bold text-blue-600">{sc.id}</span>
                                            <span className="text-[10px] text-slate-400"> [{sc.type}] </span>
                                            {sc.title}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {data?.scenarios && (
                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Test Scenarios</h3>
                                <ul className="space-y-1.5">
                                    {data.scenarios.map(sc => (
                                        <li key={sc.id} className="text-xs bg-slate-50 p-2 rounded border border-slate-100">
                                            <span className="font-bold text-blue-600">{sc.id}:</span> {sc.title}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="w-2/3 p-6 overflow-y-auto space-y-6">
                        {!data?.testCases ? (
                            <div className="h-full flex items-center justify-center text-slate-400">
                                Provide inputs and click Generate to start testing.
                            </div>
                        ) : (
                            ['Positive', 'Negative', 'Edge Case'].map(cat => {
                                const items = data.testCases.map((t, idx) => ({ ...t, originalIndex: idx })).filter(t => t.type === cat);
                                if (items.length === 0) return null;
                                let catColor = cat === 'Positive' ? 'text-green-700 bg-green-50 border-green-200' :
                                               cat === 'Negative' ? 'text-red-700 bg-red-50 border-red-200' :
                                               'text-amber-700 bg-amber-50 border-amber-200';
                                return (
                                    <div key={cat} className="space-y-3">
                                        <div className={`px-3 py-1 rounded border font-bold text-xs uppercase ${catColor}`}>{`${cat} Cases (${items.length})`}</div>
                                        {items.map((tc) => {
                                            const idx = tc.originalIndex;
                                            const isEditing = editingIndex === idx;
                                            return (
                                                <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3 text-xs">
                                                    {isEditing ? (
                                                        <div className="space-y-3 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                                                            <div className="flex justify-between items-center font-bold text-blue-800">
                                                                <span>Editing Test Case: {editForm.id}</span>
                                                            </div>
                                                            <div>
                                                                <label className="block font-bold text-slate-600 mb-1">Scenario ID:</label>
                                                                <input className="w-full border p-1.5 rounded bg-white" value={editForm.scenarioId || ''} onChange={e => setEditForm({ ...editForm, scenarioId: e.target.value })} placeholder="Scenario ID (e.g. TS-01)" />
                                                            </div>
                                                            <div>
                                                                <label className="block font-bold text-slate-600 mb-1">Title:</label>
                                                                <input className="w-full border p-1.5 rounded font-bold bg-white" value={editForm.title || ''} onChange={e => setEditForm({ ...editForm, title: e.target.value })} placeholder="Title" />
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-2">
                                                                <div>
                                                                    <label className="block font-bold text-slate-600 mb-1">Type:</label>
                                                                    <select className="w-full border p-1.5 rounded bg-white" value={editForm.type || 'Positive'} onChange={e => setEditForm({ ...editForm, type: e.target.value })}>
                                                                        <option value="Positive">Positive</option>
                                                                        <option value="Negative">Negative</option>
                                                                        <option value="Edge Case">Edge Case</option>
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="block font-bold text-slate-600 mb-1">Priority:</label>
                                                                    <select className="w-full border p-1.5 rounded bg-white" value={editForm.priority || 'Medium'} onChange={e => setEditForm({ ...editForm, priority: e.target.value })}>
                                                                        <option value="Critical">Critical</option>
                                                                        <option value="High">High</option>
                                                                        <option value="Medium">Medium</option>
                                                                        <option value="Low">Low</option>
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="block font-bold text-slate-600 mb-1">Technique:</label>
                                                                    <input className="w-full border p-1.5 rounded bg-white" value={editForm.technique || ''} onChange={e => setEditForm({ ...editForm, technique: e.target.value })} placeholder="Technique" />
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <label className="block font-bold text-slate-600 mb-1">Pre-Condition:</label>
                                                                    <input className="w-full border p-1.5 rounded bg-white" value={editForm.preCondition || ''} onChange={e => setEditForm({ ...editForm, preCondition: e.target.value })} placeholder="Pre-condition" />
                                                                </div>
                                                                <div>
                                                                    <label className="block font-bold text-slate-600 mb-1">Test Data:</label>
                                                                    <input className="w-full border p-1.5 rounded bg-white" value={editForm.testData || ''} onChange={e => setEditForm({ ...editForm, testData: e.target.value })} placeholder="Test data" />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block font-bold text-slate-600 mb-1">Steps (one step per line):</label>
                                                                <textarea className="w-full border p-1.5 rounded bg-white" rows="3" value={editForm.stepsText || ''} onChange={e => setEditForm({ ...editForm, stepsText: e.target.value })} placeholder="Enter each step on a new line"></textarea>
                                                            </div>
                                                            <div>
                                                                <label className="block font-bold text-slate-600 mb-1">Expected Result:</label>
                                                                <input className="w-full border p-1.5 rounded bg-white" value={editForm.expected || ''} onChange={e => setEditForm({ ...editForm, expected: e.target.value })} placeholder="Expected result" />
                                                            </div>
                                                            <div className="flex gap-2 pt-2">
                                                                <button onClick={() => saveEditing(idx)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded font-medium">Save Changes</button>
                                                                <button onClick={() => setEditingIndex(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded font-medium">Cancel</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <div className="flex justify-between items-center">
                                                                <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                                    <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2.5 py-1 rounded-md shadow-sm font-semibold tracking-wide flex items-center gap-1">
                                                                        <span className="text-[10px] opacity-75">🔗</span> {tc.scenarioId || 'TS-01'}
                                                                    </span>
                                                                    <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200 font-semibold">
                                                                        {tc.id}
                                                                    </span>
                                                                    <span className="text-slate-800">{tc.title}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <select
                                                                        className="border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-700 bg-slate-50"
                                                                        value={tc.priority || 'Medium'}
                                                                        onChange={(e) => updateTestCaseField(idx, 'priority', e.target.value)}
                                                                    >
                                                                        <option value="Critical">Priority: Critical</option>
                                                                        <option value="High">Priority: High</option>
                                                                        <option value="Medium">Priority: Med</option>
                                                                        <option value="Low">Priority: Low</option>
                                                                    </select>
                                                                    <button onClick={() => startEditing(idx, tc)} className="text-blue-600 hover:underline">Edit</button>
                                                                    <button onClick={() => deleteTestCase(idx)} className="text-red-600 hover:underline">Delete</button>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4 text-slate-600 mt-2">
                                                                <div>
                                                                    <p><strong className="text-slate-700">Pre-Condition:</strong> {tc.preCondition}</p>
                                                                    <p className="mt-1"><strong className="text-slate-700">Test Data:</strong> {tc.testData}</p>
                                                                </div>
                                                                <div>
                                                                    <strong className="text-slate-700">Steps:</strong>
                                                                    <ol className="list-decimal list-inside">{(tc.steps || []).map((s, i) => <li key={i}>{s}</li>)}</ol>
                                                                </div>
                                                            </div>
                                                            <div className="pt-2 border-t border-slate-100 text-emerald-700 font-medium">
                                                                <strong>Expected:</strong> {tc.expected}
                                                            </div>
                                                            {tc.technique && (
                                                                <div className="pt-1.5 text-slate-600">
                                                                    <strong className="text-slate-700">Technique:</strong>{' '}
                                                                    <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 rounded px-2 py-0.5 text-[11px] font-semibold">{tc.technique}</span>
                                                                </div>
                                                            )}
                                                            <div className="pt-2 mt-2 border-t border-slate-100 bg-slate-50 p-2 rounded">
                                                                <div className="flex items-end gap-3">
                                                                    <div className="flex-1">
                                                                        <label className="block font-bold text-slate-500 mb-1">Actual Result:</label>
                                                                        <input
                                                                            type="text"
                                                                            className="w-full h-8 border border-slate-300 rounded px-2 text-xs bg-white"
                                                                            value={tc.actualResult || ''}
                                                                            onChange={(e) => updateTestCaseField(idx, 'actualResult', e.target.value)}
                                                                            placeholder="Enter actual result..."
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block font-bold text-slate-500 mb-1">Status:</label>
                                                                        <select
                                                                            className={`h-8 border rounded px-2 text-xs font-bold ${tc.status === 'Pass' ? 'bg-green-100 text-green-700' : tc.status === 'Fail' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'}`}
                                                                            value={tc.status || 'Untested'}
                                                                            onChange={(e) => updateTestCaseField(idx, 'status', e.target.value)}
                                                                        >
                                                                            <option value="Untested">Untested</option>
                                                                            <option value="Pass">Pass</option>
                                                                            <option value="Fail">Fail</option>
                                                                        </select>
                                                                    </div>
                                                                    {(tc.status === 'Fail' || bugFor(tc)) && (
                                                                        <div>
                                                                            {bugFor(tc) ? (
                                                                                <button onClick={() => viewBug(bugFor(tc).id)} className="h-8 bg-red-50 text-red-700 border border-red-200 px-3 rounded font-semibold hover:bg-red-100 whitespace-nowrap">🐞 {bugFor(tc).id} · View</button>
                                                                            ) : (
                                                                                <button onClick={() => sendToBugs([tc])} disabled={bugBusy} className="h-8 bg-red-600 text-white px-3 rounded font-semibold hover:bg-red-700 disabled:opacity-50 whitespace-nowrap">{bugBusy ? '...' : '🐞 Send to Bug Report'}</button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {tc.status === 'Fail' && !bugFor(tc) && !(tc.actualResult || '').trim() && (
                                                                    <p className="text-[11px] text-red-600 mt-1">اكتب الـ Actual Result الأول عشان تقدر تبعت للـ Bug Report.</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </main>

            {/* ---------- Add Test Case Modal ---------- */}
            {showAddTc && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-xl p-5 w-[620px] max-w-[95vw] max-h-[92vh] overflow-y-auto shadow-xl space-y-3 text-xs">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 text-sm">Add Test Case</h3>
                            <button onClick={() => setShowAddTc(false)} className="text-slate-500 hover:text-slate-800">✕</button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Type (هينزل في أنهي قسم):</label>
                                <select className="w-full border p-1.5 rounded bg-white" value={addTcForm.type} onChange={e => setAddTcForm({ ...addTcForm, type: e.target.value })}>
                                    <option value="Positive">Positive</option>
                                    <option value="Negative">Negative</option>
                                    <option value="Edge Case">Edge Case</option>
                                </select>
                            </div>
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Priority:</label>
                                <select className="w-full border p-1.5 rounded bg-white" value={addTcForm.priority} onChange={e => setAddTcForm({ ...addTcForm, priority: e.target.value })}>
                                    <option value="Critical">Critical</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Scenario ID:</label>
                                <input list="known-scenarios" className="w-full border p-1.5 rounded bg-white" value={addTcForm.scenarioId} onChange={e => setAddTcForm({ ...addTcForm, scenarioId: e.target.value })} placeholder="TS-01" />
                                <datalist id="known-scenarios">
                                    {knownScenarios().map(sc => <option key={sc.id} value={sc.id}>{sc.title}</option>)}
                                </datalist>
                            </div>
                        </div>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Title:</label>
                            <input className="w-full border p-1.5 rounded bg-white font-bold" value={addTcForm.title} onChange={e => setAddTcForm({ ...addTcForm, title: e.target.value })} placeholder="Test case title" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Technique:</label>
                                <input className="w-full border p-1.5 rounded bg-white" value={addTcForm.technique} onChange={e => setAddTcForm({ ...addTcForm, technique: e.target.value })} placeholder="e.g. Boundary Value Analysis" />
                            </div>
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Pre-Condition:</label>
                                <input className="w-full border p-1.5 rounded bg-white" value={addTcForm.preCondition} onChange={e => setAddTcForm({ ...addTcForm, preCondition: e.target.value })} placeholder="Pre-condition" />
                            </div>
                        </div>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Test Data:</label>
                            <input className="w-full border p-1.5 rounded bg-white" value={addTcForm.testData} onChange={e => setAddTcForm({ ...addTcForm, testData: e.target.value })} placeholder="Test data" />
                        </div>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Steps (one step per line):</label>
                            <textarea className="w-full border p-1.5 rounded bg-white" rows="4" value={addTcForm.stepsText} onChange={e => setAddTcForm({ ...addTcForm, stepsText: e.target.value })} placeholder="Enter each step on a new line"></textarea>
                        </div>
                        <div>
                            <label className="block font-bold text-slate-600 mb-1">Expected Result:</label>
                            <input className="w-full border p-1.5 rounded bg-white" value={addTcForm.expected} onChange={e => setAddTcForm({ ...addTcForm, expected: e.target.value })} placeholder="Expected result" />
                        </div>
                        <div className="flex gap-2 pt-1 justify-end">
                            <button onClick={() => setShowAddTc(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded font-medium">Cancel</button>
                            <button onClick={saveNewTestCase} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded font-medium">Add Test Case</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
