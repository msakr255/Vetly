/* =====================================================================
   components/SettingsModal.js
   نافذة الـ Settings: مفاتيح الـ API وأسماء الموديلات وزرار Test all keys.
   ===================================================================== */

// بيحفظ المفاتيح والموديلات في المتصفح
function useApiSettings() {
    const [keys, setKeys] = useState(() => safeJSON('wakil_keys', { openrouter: '', openai: '', anthropic: '', gemini: '' }));
    const [models, setModels] = useState(() => safeJSON('wakil_models', {}));

    useEffect(() => {
        localStorage.setItem('wakil_keys', JSON.stringify(keys));
    }, [keys]);

    useEffect(() => {
        localStorage.setItem('wakil_models', JSON.stringify(models));
    }, [models]);

    return { keys, setKeys, models, setModels };
}

/* =====================================================================
   قسم المزوّدات المخصصة: أي API بصيغة OpenAI-compatible يضيفه المستخدم
   (التعريف في wakil_custom_providers والمفتاح في wakil_keys — محليين على الجهاز)
   ===================================================================== */
function CustomProvidersSection({ keys, setKeys, models }) {
    const [list, setList] = useState(() => safeJSON('wakil_custom_providers', []));
    const [form, setForm] = useState(null); // null مغلق — أو { id?, name, baseUrl, model, key }
    const [testRes, setTestRes] = useState({});
    const [modelInputs, setModelInputs] = useState({}); // حقل "Add Model" لكل بروفايدر
    const persist = (next) => { setList(next); try { localStorage.setItem('wakil_custom_providers', JSON.stringify(next)); } catch (e) { /* ignore */ } };

    // إضافة/حذف موديل لبروفايدر موجود — كل الموديلات بيشتغلوا على نفس الـ API والإعدادات
    const addModel = (id) => {
        const name = String(modelInputs[id] || '').trim();
        if (!name) return;
        persist(list.map(c => c.id === id
            ? { ...c, models: [...(c.models || []), name].filter((m, i, a) => a.indexOf(m) === i) }
            : c));
        setModelInputs(t => ({ ...t, [id]: '' }));
    };
    const removeModel = (id, name) => {
        persist(list.map(c => c.id === id ? { ...c, models: (c.models || []).filter(m => m !== name) } : c));
    };

    const save = () => {
        const f = form || {};
        if (!f.name.trim() || !f.baseUrl.trim() || !f.key.trim()) { alert(tr('Name + Base URL + API key are required.')); return; }
        if (f.id) {
            persist(list.map(c => c.id === f.id ? { ...c, name: f.name.trim(), baseUrl: f.baseUrl.trim(), model: f.model.trim() } : c));
            setKeys({ ...keys, [f.id]: f.key.trim() });
        } else {
            const id = 'custom-' + Date.now().toString(36);
            persist([...list, { id, name: f.name.trim(), baseUrl: f.baseUrl.trim(), model: f.model.trim() }]);
            setKeys({ ...keys, [id]: f.key.trim() });
        }
        setForm(null);
    };

    const del = (id) => {
        if (!window.confirm('Delete this custom provider?')) return;
        persist(list.filter(c => c.id !== id));
        const k = { ...keys }; delete k[id]; setKeys(k);
        setTestRes(t => ({ ...t, [id]: undefined }));
    };

    const test = async (c) => {
        const key = (keys[c.id] || '').trim();
        if (!key) { setTestRes(t => ({ ...t, [c.id]: { ok: false, msg: 'No API key' } })); return; }
        setTestRes(t => ({ ...t, [c.id]: { busy: true } }));
        const p = getCustomProviders().find(x => x.id === c.id);
        try {
            await callProvider(p, key, 'Return exactly this JSON and nothing else: {"status":"ok"}', [], (models[c.id] || '').trim() || c.model || '', { noFallback: true });
            const wm = getWorkingModel(c.id);
            setTestRes(t => ({ ...t, [c.id]: { ok: true, msg: 'Works ✔' + (wm ? ` (model: ${wm})` : '') } }));
        } catch (e) {
            setTestRes(t => ({ ...t, [c.id]: { ok: false, msg: e.message } }));
        }
    };

    const inp = 'w-full border border-slate-300 rounded p-1.5 text-xs bg-white';
    return (
        <div className="border-t border-slate-200 pt-3 space-y-2">
            <div className="flex justify-between items-center">
                <p className="text-xs font-bold text-slate-600">➕ Custom Providers (OpenAI-compatible)</p>
                {!form && <button onClick={() => setForm({ name: '', baseUrl: '', model: '', key: '' })} className="bg-blue-600 text-white px-2.5 py-1 rounded text-xs font-medium hover:bg-blue-700">+ Add</button>}
            </div>
            <p className="text-[11px] text-slate-500">
                {tr('Any OpenAI-compatible API: put the Base URL ending with {b} (e.g. https://api.deepseek.com/v1) — the app completes the rest of the path automatically, and it appears immediately in the Model list.', { b: '/v1' })}
            </p>
            {list.length > 0 && (
                <div className="space-y-1.5">
                    {list.map(c => {
                        const res = testRes[c.id];
                        return (
                            <div key={c.id} className="bg-slate-50 border border-slate-200 rounded p-2 text-xs space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-800 flex-1">{c.name}</span>
                                    <button onClick={() => test(c)} disabled={res && res.busy} className="bg-emerald-600 text-white px-2 py-0.5 rounded font-medium hover:bg-emerald-700 disabled:opacity-50">Test</button>
                                    <button onClick={() => setForm({ ...c, key: (keys[c.id] || '') })} className="text-blue-600 hover:underline">Edit</button>
                                    <button onClick={() => del(c.id)} className="text-red-600 hover:underline">Delete</button>
                                </div>
                                <p className="text-[10px] text-slate-400 break-all">{c.baseUrl}{c.model ? ' · ' + c.model : ''}</p>
                                {/* موديلات البروفايدر المتعددة: chips + زرار Add Model — كلها على نفس الـ API */}
                                {(c.models || []).length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {(c.models || []).map(m => (
                                            <span key={m} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 flex items-center gap-1">
                                                {m}
                                                <button onClick={() => removeModel(c.id, m)} className="text-red-500 font-bold leading-none" title="Remove model">✕</button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-1.5 items-center">
                                    <input
                                        className="flex-1 border border-slate-200 rounded px-1.5 py-1 text-[10px]"
                                        placeholder="Add a model to this provider…"
                                        value={modelInputs[c.id] || ''}
                                        onChange={e => setModelInputs(t => ({ ...t, [c.id]: e.target.value }))}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addModel(c.id); } }}
                                    />
                                    <button onClick={() => addModel(c.id)} className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-medium hover:bg-blue-700 whitespace-nowrap">+ Add Model</button>
                                </div>
                                {res && <p className={`text-[10px] ${res.busy ? 'text-slate-500' : res.ok ? 'text-emerald-700' : 'text-red-600'}`}>{res.busy ? 'Testing…' : res.msg}</p>}
                            </div>
                        );
                    })}
                </div>
            )}
            {form && (
                <div className="bg-blue-50/50 border border-blue-100 rounded p-2 space-y-1.5">
                    <input className={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Name (e.g. DeepSeek)" />
                    <input className={inp} value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })} placeholder="Base URL (e.g. https://api.deepseek.com/v1)" />
                    <input className={inp} value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="Model (optional — empty = auto-detect)" />
                    <input className={inp} type="password" value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} placeholder="API key" />
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setForm(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1 rounded font-medium">Cancel</button>
                        <button onClick={save} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded font-medium">Save</button>
                    </div>
                </div>
            )}
        </div>
    );
}

function SettingsModal({ open, onClose, keys, setKeys, models, setModels }) {
    const [testResults, setTestResults] = useState({});
    const [testing, setTesting] = useState(false);
    const [backupNote, setBackupNote] = useState('');
    const backupFileRef = React.useRef(null);

    /* ---------- Backup / Restore: كل داتا المتصفح (wakil_* + vetly_*) في ملف JSON واحد ---------- */
    const exportBackup = () => {
        setBackupNote('');
        const dump = {};
        Object.assign(dump, sbWorkspaceDump());
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith('wakil_') || k.startsWith('vetly_'))) dump[k] = localStorage.getItem(k);
        }
        const name = `Vetly_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        downloadBlob(new Blob([JSON.stringify({ app: APP_NAME, version: 1, exportedAt: new Date().toISOString(), data: dump }, null, 2)], { type: 'application/json' }), name);
    };

    const importBackup = async (file) => {
        setBackupNote('');
        if (!file) return;
        try {
            const j = JSON.parse(await file.text());
            if (!j || typeof j.data !== 'object' || !j.data) throw new Error(tr('Invalid backup file'));
            if (!window.confirm(tr('Restoring will replace ALL current data (including keys) with this backup. Continue?'))) return;

            const workspace = {};
            Object.keys(j.data).forEach(k => {
                if (!(k.startsWith('wakil_') || k.startsWith('vetly_'))) return;
                if (wkIsDataKey(k)) workspace[k] = String(j.data[k]);
            });
            const importedProject = j.data.wakil_cloud_project ? JSON.parse(j.data.wakil_cloud_project) : null;
            const importedStory = j.data.wakil_cloud_story ? JSON.parse(j.data.wakil_cloud_story) : null;
            const currentProject = sbGetOpenProject();
            const currentStory = sbGetOpenStory();
            const selectionChanges = !currentProject || !currentStory ||
                currentProject.id !== (importedProject && importedProject.id) ||
                currentStory.id !== (importedStory && importedStory.id);
            if (importedProject && importedProject.id && importedStory && importedStory.id) {
                const snapshot = await sbLoadSnapshot(importedProject.id);
                if (snapshot.error) throw snapshot.error;
            }

            const currentKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (k.startsWith('wakil_') || k.startsWith('vetly_'))) currentKeys.push(k);
            }
            currentKeys.forEach(k => localStorage.removeItem(k));
            sbWorkspaceClear();
            Object.keys(j.data).forEach(k => {
                if (!(k.startsWith('wakil_') || k.startsWith('vetly_'))) return;
                if (!wkIsDataKey(k)) localStorage.setItem(k, String(j.data[k]));
            });
            sbWorkspaceReplace(workspace);
            window._sbLastSyncedFingerprint = null;
            window._sbRestorePending = selectionChanges && !!(importedProject && importedProject.id && importedStory && importedStory.id);
            setKeys(safeJSON('wakil_keys', { openrouter: '', openai: '', anthropic: '', gemini: '' }));
            setModels(safeJSON('wakil_models', {}));
            setLang(getLang());
            window.applyTheme(localStorage.getItem('vetly_theme'));
            window.dispatchEvent(new Event('vetly_cloud_selection_changed'));
            if (window._sbSchedule) window._sbSchedule();
            setBackupNote(tr('Restored ✔ Changes will sync when a project is open and connected.'));
        } catch (err) {
            alert(tr('Restore failed: {e}', { e: err.message || tr('Invalid file') }));
        }
    };

    /* ---------- Test Connections: بيجرب كل مفتاح ويقولك شغال ولا لأ (متوازي — كل المزوّدين مع بعض) ---------- */
   const testConnections = async () => {
        setTesting(true);
        setTestResults({});
        const testOne = async (p) => {
            const key = (keys[p.id] || '').trim();
            const model = (models[p.id] || '').trim() || p.model;
            if (!key && !p.noAuth) { setTestResults(t => ({ ...t, [p.id]: { ok: false, msg: tr('No key (skipped)'), model } })); return; }
            // تشخيص: بيعرض أول حروف المفتاح وطوله (من غير ما يكشفه) وينبّه لو فيه مسافات أو حروف مش إنجليزي
            const info = key ? tr('Key: {k}... ({n} chars)', { k: key.slice(0, 8), n: key.length }) : 'noAuth';
            if (key && /[^\x21-\x7E]/.test(key)) {
                setTestResults(t => ({ ...t, [p.id]: { ok: false, msg: `${info}\n${tr('The key contains spaces or non-English characters. Delete it and paste it again with nothing extra.')}`, model } }));
                return;
            }
            const t0 = Date.now();
            try {
                // noFallback: موديل واحد بس — النتيجة الحقيقية للموديل المختار بسرعة من غير سلسلة تجارب طويلة
                const text = await callProvider(p, key, 'Return exactly this JSON and nothing else: {"status":"ok"}', [], model, { noFallback: true });
                if (!text) throw new Error(tr('Empty response'));
                let extra = '';
                if (p.modelsUrl) {
                    try {
                        const names = await listModels(p, key);
                        if (names.length) extra = '\n' + tr('Available models:') + ' ' + names.slice(0, 15).join(', ');
                    } catch (e) { /* ignore */ }
                }
                // المزوّدين اللي مالهمش موديل محدد في Settings (زي CodeCraft):
                // نثبّت الموديل اللي نجح فعليًا في خانة الـ Model عشان التوليد يستخدمه هو بالظبط
                if (p.type === 'openai-compat' && !((models[p.id] || '').trim())) {
                    const wm = getWorkingModel(p.id);
                    if (wm) setModels(m => ({ ...m, [p.id]: wm }));
                }
                setTestResults(t => ({ ...t, [p.id]: { ok: true, msg: tr('Works ✔ ({s}s)', { s: ((Date.now() - t0) / 1000).toFixed(1) }) + extra, model: model || 'auto' } }));
            } catch (err) {
                let msg = err.message;
                if (p.type === 'gemini') {
                    try {
                        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
                        if (r.ok) {
                            const j = await r.json();
                            const names = (j.models || [])
                                .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
                                .map(m => m.name.replace('models/', ''))
                                .filter(n => n.includes('flash'))
                                .slice(0, 8);
                            if (names.length) msg += '\n' + tr('Available models for your key:') + ' ' + names.join(', ');
                        }
                    } catch (e) { /* ignore */ }
                }
                setTestResults(t => ({ ...t, [p.id]: { ok: false, msg: `${info}\n${msg}`, model } }));
            }
        };
        // كل المزوّدين بيتاختبروا في نفس الوقت — النتيجة بتيجي كلها في زمن أبطأ مزوّد واحد
        // بدل مجموع أزمنتهم (كان 3 دقايق مع الريلي)
        await Promise.all(getAllProviders().map(p => testOne(p)));
        setTesting(false);
    };

    const showSettings = open;

    return (
        <>
            {/* ---------- Settings Modal ---------- */}
            {showSettings && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-xl p-5 w-[480px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-xl space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">API Keys Settings</h3>
                            <button onClick={() => onClose()} className="text-slate-500 hover:text-slate-800">✕</button>
                        </div>
                        <p className="text-xs text-slate-500">
                            الأولوية: OpenRouter ← ChatGPT ← Claude ← Gemini. بيتخطى أي واحد مفتاحه فاضي.
                            المفاتيح بتتخزن في متصفحك بس (localStorage).
                        </p>
                        {PROVIDERS.map(p => (
                            <div key={p.id}>
                                <label className="block text-xs font-bold text-slate-600 mb-1">{p.name} key:</label>
                                <input
                                    type={p.noAuth ? 'text' : 'password'}
                                    className="w-full border border-slate-300 rounded p-1.5 text-xs"
                                    value={keys[p.id] || ''}
                                    onChange={e => setKeys({ ...keys, [p.id]: e.target.value })}
                                    placeholder={p.noAuth ? 'Optional — works free without a key' : `${p.name} API key`}
                                />
                                <input
                                    type="text"
                                    className="w-full border border-slate-200 rounded p-1.5 text-xs mt-1 text-slate-600"
                                    value={models[p.id] || ''}
                                    onChange={e => setModels({ ...models, [p.id]: e.target.value })}
                                    placeholder={tr('Model (optional, default: {m})', { m: p.model || tr('first available model') })}
                                />
                                {testResults[p.id] && (
                                    <p className={`text-[11px] mt-1 whitespace-pre-wrap break-words ${testResults[p.id].ok ? 'text-emerald-700' : 'text-red-600'}`}>
                                        {testResults[p.id].ok ? '✅' : '❌'} {testResults[p.id].model}: {testResults[p.id].msg}
                                    </p>
                                )}
                            </div>
                        ))}
                        <CustomProvidersSection keys={keys} setKeys={setKeys} models={models} />
                        <div className="border-t border-slate-200 pt-3 space-y-2">
                            <p className="text-xs font-bold text-slate-600">Backup &amp; Restore</p>
                            <p className="text-[11px] text-slate-500">
                                نزّل نسخة من كل حاجة (التحليل + الكيسز + الجولات + الباجز + المفاتيح) في ملف JSON واحد،
                                أو استرجعها على أي متصفح/جهاز تاني. الاسترجاع بيستبدل الداتا الحالية.
                            </p>
                            <div className="flex gap-2">
                                <button onClick={exportBackup} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium">
                                    ⬇ Export Backup (.json)
                                </button>
                                <button onClick={() => backupFileRef.current && backupFileRef.current.click()} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded text-xs font-medium">
                                    ⬆ Import Backup
                                </button>
                                <input
                                    ref={backupFileRef}
                                    type="file"
                                    accept="application/json,.json"
                                    className="hidden"
                                    onChange={e => { importBackup(e.target.files && e.target.files[0]); e.target.value = ''; }}
                                />
                            </div>
                            {backupNote && <p className="text-[11px] text-emerald-700 font-semibold">{backupNote}</p>}
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <button onClick={testConnections} disabled={testing} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50">
                                {testing ? 'Testing...' : 'Test all keys'}
                            </button>
                            <button onClick={() => onClose()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium">Done</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
