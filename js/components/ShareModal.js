/* =====================================================================
   components/ShareModal.js
   🔗 مشاركة قراءة فقط: لينك عام يعرض نسخة محفوظة (snapshot) من
   - المشروع كله (كل اليوزر ستوريز)
   - يوزر ستوري واحدة
   - فيتشر واحدة جوه يوزر ستوري
   الزائر ما يقدرش يستخدم أي فيتشر — اللينك بيعرض المحتوى للقراءة بس،
   وإلغاؤه بيتم بحذفه من القايمة تحت.
   ===================================================================== */

function ShareModal({ onClose, project, stories, cloudProject }) {
    const [scope, setScope] = useState('project'); // project | story | feature
    const [storyId, setStoryId] = useState('');
    const [feature, setFeature] = useState('');
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);
    const [link, setLink] = useState('');
    const [copiedId, setCopiedId] = useState('');
    const [list, setList] = useState(null);

    const story = (stories || []).find(s => s.id === storyId) || null;

    useEffect(() => {
        if (!project) return;
        setMsg(''); setLink(''); setCopiedId('');
        // أول قصة فيها داتا تكون مختارة افتراضيًا
        const first = (stories || []).find(s => s.hasData);
        setStoryId(first ? first.id : ((stories || [])[0] || {}).id || '');
        setFeature(SHARE_FEATURES[0] ? SHARE_FEATURES[0].id : '');
        sbListShares(project.id).then(r => {
            if (r.error) { setList([]); return; }
            setList(r.data || []);
        });
    }, [project]);

    if (!project) return null;

    const copyText = (t, id) => {
        try {
            navigator.clipboard.writeText(t);
            setCopiedId(id || '__new__');
            setTimeout(() => setCopiedId(''), 2000);
        } catch (e) { window.prompt('Copy this link:', t); }
    };

    const doCreate = async () => {
        if (scope !== 'project' && !storyId) { setMsg('اختر اليوزر ستوري الأول.'); return; }
        if (scope === 'feature' && !feature) { setMsg('اختر الفيتشر الأول.'); return; }
        setBusy(true); setMsg('');
        // لو المشروع المشارَك هو المفتوح: نحفظ نسخة طازة الأول (فوق الحفظ التلقائي)
        if (cloudProject && cloudProject.id === project.id) {
            const saveResult = await sbSaveSnapshot(project.id);
            if (saveResult.error || saveResult.pending) {
                setBusy(false);
                setMsg(saveResult.error ? saveResult.error.message : 'اتصال الإنترنت غير متاح؛ استنى المزامنة قبل إنشاء رابط المشاركة.');
                return;
            }
        }
        const r0 = await sbLoadSnapshot(project.id);
        if (r0.error) { setBusy(false); setMsg(r0.error.message); return; }
        const payload = sbBuildSharePayload(r0.data && r0.data.payload, scope, storyId, feature);
        if (!payload) { setBusy(false); setMsg('مفيش داتا للستوري دي في السحابة — افتحها واتأكد إنها اتحفظت.'); return; }
        // تحذير (مش منع): لو مفيش أي محتوى wakil_* في النسخة، اللينك هيفتح فاضي — الداتا لازم تتسجل في السحابة الأول
        const hasContent = payload.stories.some(st => st.data && Object.keys(st.data).some(k => k.startsWith('wakil_')));
        const emptyWarn = !hasContent;
        const fDef = SHARE_FEATURES.find(f => f.id === feature);
        const r = await sbCreateShare({
            projectId: project.id,
            projectName: project.name,
            scope,
            storyId: scope !== 'project' ? storyId : null,
            storyName: scope !== 'project' ? (story ? story.name : '') : null,
            feature: scope === 'feature' ? feature : null,
            featureLabel: scope === 'feature' ? (fDef ? fDef.label : feature) : null,
            payload
        });
        setBusy(false);
        if (r.error) { setMsg(r.error.message); return; }
        const url = sbShareLink(r.data.id);
        setLink(url);
        copyText(url);
        if (emptyWarn) setMsg(tr('Link created — but this scope has no saved content in the cloud yet, so it will open empty. Open the story, add your work, and it auto-updates.'));
        // تحديث قايمة اللينكات
        const rl = await sbListShares(project.id);
        if (!rl.error) setList(rl.data || []);
        setMsg(emptyWarn ? tr('Link created — but this scope has no saved content in the cloud yet, so it will open empty. Open the story, add your work, and it auto-updates.') : '');
    };

    const doDelete = async (id) => {
        if (!window.confirm('إبطال اللينك ده؟ أي حد معاه مش هيقدر يفتحه تاني.')) return;
        const r = await sbDeleteShare(id);
        if (r.error) { setMsg(r.error.message); return; }
        setList((list || []).filter(x => x.id !== id));
        if (link && link.indexOf(id) !== -1) setLink('');
    };

    const scopeBtn = (id, label) => (
        <button key={id} onClick={() => { setScope(id); setMsg(''); setLink(''); }}
            className={`flex-1 py-1.5 rounded font-semibold border text-xs ${scope === id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>
            {label}
        </button>
    );
    const scopeBadge = (s) => s === 'project' ? '📁 Project' : s === 'story' ? '📖 Story' : '🧩 Feature';

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="bg-white rounded-xl p-5 w-[480px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-xl space-y-3">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">🔗 Share (read-only)</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800">✕</button>
                </div>
                <p className="text-xs text-slate-500">اللينك بيعرض المحتوى للقراءة فقط — الزائر مش بيقدر يعدّل ولا يستخدم أي فيتشر. اللينك live: بيتحدّث تلقائيًا مع كل حفظ، فالزائر بيشوف دايمًا آخر نسخة من شغلك من غير ما تعمل لينك جديد.</p>

                {/* ---------- اختيار النطاق ---------- */}
                <div className="flex gap-1.5">
                    {scopeBtn('project', '📁 المشروع كله')}
                    {scopeBtn('story', '📖 ستوري واحدة')}
                    {scopeBtn('feature', '🧩 فيتشر من ستوري')}
                </div>

                {(scope === 'story' || scope === 'feature') && (
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">اليوزر ستوري:</label>
                        <select value={storyId} onChange={e => setStoryId(e.target.value)}
                            className="w-full border border-slate-300 rounded p-2 text-sm bg-white">
                            {(stories || []).length === 0 && <option value="">— مفيش يوزر ستوريز في المشروع ده —</option>}
                            {(stories || []).map(s => (
                                <option key={s.id} value={s.id}>{s.name}{s.hasData ? '' : ' (empty)'}</option>
                            ))}
                        </select>
                    </div>
                )}
                {scope === 'feature' && (
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">الفيتشر:</label>
                        <select value={feature} onChange={e => setFeature(e.target.value)}
                            className="w-full border border-slate-300 rounded p-2 text-sm bg-white">
                            {SHARE_FEATURES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                    </div>
                )}

                <button onClick={doCreate} disabled={busy}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50">
                    {busy ? '...' : (link ? '🔁 Create another link' : '🔗 Create link & copy')}
                </button>

                {/* ---------- اللينك الجديد ---------- */}
                {link && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 space-y-1.5">
                        <p className="text-xs text-emerald-800 font-semibold">✔ <span>Link created & copied</span> ({scopeBadge(scope)})</p>
                        <div className="flex gap-1.5">
                            <input readOnly value={link} onFocus={e => e.target.select()}
                                className="flex-1 border border-emerald-200 rounded p-1.5 text-[11px] bg-white text-slate-700 font-mono" />
                            <button onClick={() => copyText(link)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap">
                                {copiedId === '__new__' ? '✔ Copied' : '📋 Copy'}
                            </button>
                        </div>
                    </div>
                )}

                {msg && <p className={`text-xs rounded p-2 border ${msg.startsWith('✔') ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-600 bg-red-50 border-red-100'}`}>{msg}</p>}

                {/* ---------- اللينكات الموجودة ---------- */}
                <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase"><span>Existing links</span> ({list ? list.length : '…'}) — <span>deleting revokes a link immediately</span></p>
                    {list && list.length === 0 && <p className="text-[11px] text-slate-400">مفيش لينكات قديمة.</p>}
                    {(list || []).map(s => (
                        <div key={s.id} className="border border-slate-200 rounded p-1.5 flex items-center gap-2 text-[11px]">
                            <span className="flex-1 min-w-0 truncate">
                                {scopeBadge(s.scope)}{s.story_name ? ` · ${s.story_name}` : ''}{s.feature_label ? ` · ${s.feature_label}` : ''}
                                <span className="text-slate-400"> · {new Date(s.created_at).toLocaleString()}</span>
                            </span>
                            <button onClick={() => copyText(sbShareLink(s.id), s.id)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium whitespace-nowrap">
                                {copiedId === s.id ? '✔' : '📋 Copy'}
                            </button>
                            <button onClick={() => doDelete(s.id)} className="text-red-600 hover:underline whitespace-nowrap">Revoke</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
