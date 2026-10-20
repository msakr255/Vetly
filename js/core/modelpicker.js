/* =====================================================================
   core/modelpicker.js
   اختيار على مستويين: Provider (المزوّدين اللي معاهم مفتاح بس)
   ← Model (موديلات المزوّد المختار من /models بتاعته، مع كاش).
   لو قايمة الموديلات فشلت ⇒ يظهر (default) فقط + تنبيه صغير.
   value بتتخزن في الصفحة نفسها: provider::model
   ===================================================================== */

// موديلات OpenRouter مئات — بنقّلها لمزوّدين معروفين عشان القايمة تفضل مفهومة
const MODEL_VENDORS_PREF = ['anthropic/', 'openai/', 'google/', 'meta-llama/', 'deepseek/', 'qwen/', 'mistralai/', 'x-ai/', 'moonshotai/', 'z-ai/', 'amazon/', 'cohere/', 'microsoft/'];

// جلب موديلات مزوّد واحد بأي شكل API (متخزنة cache لكل مزوّد/مفتاح/قايمة يدوية)
async function fetchProviderModels(p, key) {
    window._vetlyModelCache = window._vetlyModelCache || {};
    // الموديلات اللي المستخدم ضافها يدويًا (Add Model في Settings) — أول القايمة دايمًا،
    // وحتى لو جلب /models فشل (404/CORS) بيبقوا هما القايمة كلها فالكستوم بروفايدر يشتغل
    const manual = (Array.isArray(p.models) ? p.models : []).map(m => String(m || '').trim()).filter(Boolean);
    const cacheKey = p.id + '|' + String(key || '').slice(-8) + '|' + manual.join(',').length;
    if (window._vetlyModelCache[cacheKey]) return window._vetlyModelCache[cacheKey];
    let list = [];
    try {
        if (p.type === 'openai-compat') {
            const r = await fetchT(p.modelsUrl, { headers: { 'Authorization': `Bearer ${key}` } }, 15000);
            if (r.ok) {
                const j = await r.json();
                list = (j.data || []).map(m => m.id).filter(Boolean);
                if (p.id === 'openai') list = list.filter(id => /^(gpt|o\d|chatgpt)/.test(id));
                list.sort();
                if (p.id === 'openrouter') {
                    const pref = list.filter(id => MODEL_VENDORS_PREF.some(v => id.startsWith(v)) || id.includes(':free'));
                    list = (pref.length ? pref : list).slice(0, 60);
                } else {
                    list = list.slice(0, 50);
                }
            }
        } else if (p.type === 'anthropic') {
            const r = await fetchT('https://api.anthropic.com/v1/models?limit=100', {
                headers: {
                    'x-api-key': key,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                }
            }, 15000);
            if (r.ok) {
                const j = await r.json();
                list = (j.data || []).map(m => m.id).filter(Boolean).sort();
            }
        } else if (p.type === 'gemini') {
            const r = await fetchT(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=200`, null, 15000);
            if (r.ok) {
                const j = await r.json();
                list = (j.models || [])
                    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
                    .map(m => m.name.replace('models/', ''))
                    .filter(n => !/embedding|aqa|imagen|veo|tts|learnlm/.test(n))
                    .sort();
            }
        }
    } catch (e) { /* الجلب فشل ⇒ قايمة فاضية (يظهر default بس) */ }
    list = manual.filter(m => !list.includes(m)).concat(list);
    window._vetlyModelCache[cacheKey] = list;
    return list;
}

// كومبوننت القائمتين: Provider + Model
function ProviderModelPicker({ provider, model, onProvider, onModel, keys }) {
    const keyed = getAllProviders().filter(p => providerUsable(p, keys));

    // لو القيمة المحفوظة مش من المتاحين ⇒ أول مزوّد تلقائيًا
    useEffect(() => {
        if (keyed.length && !keyed.some(p => p.id === provider)) onProvider(keyed[0].id);
    }, [keys, provider]);

    const current = keyed.find(p => p.id === provider) || null;
    const [models, setModels] = useState(null); // null = جارٍ الجلب
    useEffect(() => {
        let alive = true;
        setModels(null);
        if (!current) return;
        fetchProviderModels(current, (keys[current.id] || '').trim()).then(list => { if (alive) setModels(list); });
        return () => { alive = false; };
    }, [provider, keys]);

    return (
        <div>
            <div className="grid grid-cols-2 gap-2">
                <select
                    value={provider}
                    onChange={e => { onProvider(e.target.value); onModel(''); }}
                    className="w-full border border-slate-300 rounded p-2 text-sm bg-white"
                    title="Provider"
                >
                    {keyed.length === 0 && <option value="">— no API keys —</option>}
                    {keyed.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select
                    value={model}
                    onChange={e => onModel(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 text-sm bg-white"
                    title="Model"
                >
                    <option value="">(default{current && current.model ? `: ${current.model}` : ''})</option>
                    {(models || []).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>
            {models !== null && models.length === 0 && (
                <p className="text-[10px] text-slate-400 mt-0.5">⚠ قايمة موديلات {current ? current.name : ''} مش متاحة حاليًا — هيستخدم الافتراضي.</p>
            )}
        </div>
    );
}
