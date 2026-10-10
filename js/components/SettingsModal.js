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

function SettingsModal({ open, onClose, keys, setKeys, models, setModels }) {
    const [testResults, setTestResults] = useState({});
    const [testing, setTesting] = useState(false);

    /* ---------- Test Connections: بيجرب كل مفتاح ويقولك شغال ولا لأ ---------- */
   const testConnections = async () => {
        setTesting(true);
        const results = {};
        for (const p of PROVIDERS) {
            const key = (keys[p.id] || '').trim();
            const model = (models[p.id] || '').trim() || p.model;
            if (!key) { results[p.id] = { ok: false, msg: tr('No key (skipped)'), model }; continue; }
            // تشخيص: بيعرض أول حروف المفتاح وطوله (من غير ما يكشفه) وينبّه لو فيه مسافات أو حروف مش إنجليزي
            const info = tr('Key: {k}... ({n} chars)', { k: key.slice(0, 8), n: key.length });
            if (/[^\x21-\x7E]/.test(key)) {
                results[p.id] = { ok: false, msg: `${info}\n${tr('The key contains spaces or non-English characters. Delete it and paste it again with nothing extra.')}`, model };
                setTestResults({ ...results });
                continue;
            }
            const t0 = Date.now();
            try {
                const text = await callProvider(p, key, 'Return exactly this JSON and nothing else: {"status":"ok"}', [], model);
                if (!text) throw new Error(tr('Empty response'));
                let extra = '';
                if (p.modelsUrl) {
                    try {
                        const names = await listModels(p, key);
                        if (names.length) extra = '\n' + tr('Available models:') + ' ' + names.slice(0, 15).join(', ');
                    } catch (e) { /* ignore */ }
                }
                results[p.id] = { ok: true, msg: tr('Works ✔ ({s}s)', { s: ((Date.now() - t0) / 1000).toFixed(1) }) + extra, model: model || 'auto' };
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
                results[p.id] = { ok: false, msg: `${info}\n${msg}`, model };
            }
            setTestResults({ ...results });
        }
        setTestResults(results);
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
                                    type="password"
                                    className="w-full border border-slate-300 rounded p-1.5 text-xs"
                                    value={keys[p.id] || ''}
                                    onChange={e => setKeys({ ...keys, [p.id]: e.target.value })}
                                    placeholder={`${p.name} API key`}
                                />
                                <input
                                    type="text"
                                    className="w-full border border-slate-200 rounded p-1.5 text-xs mt-1 text-slate-600"
                                    value={models[p.id] || ''}
                                    onChange={e => setModels({ ...models, [p.id]: e.target.value })}
                                    placeholder={`Model (اختياري، الافتراضي: ${p.model || 'أول موديل متاح'})`}
                                />
                                {testResults[p.id] && (
                                    <p className={`text-[11px] mt-1 whitespace-pre-wrap break-words ${testResults[p.id].ok ? 'text-emerald-700' : 'text-red-600'}`}>
                                        {testResults[p.id].ok ? '✅' : '❌'} {testResults[p.id].model}: {testResults[p.id].msg}
                                    </p>
                                )}
                            </div>
                        ))}
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
