/* =====================================================================
   features/requirements.js
   📋 Requirements — أول فيتشر: الخامة الخام (يوزر ستوري / SRS / BRD / أي حاجة).
   - نص حر + رفع ملفات وصور + معاينة (صور/نصوص/PDF) وتنزيل
   - الداتا ثابتة: localStorage لكل ستوري (+ مزامنة سحابة تلقائية عبر wakil_*)
   - إرسال النص/الملفات إلى: 🔍 Requirement Analysis · 📋 Test Scenarios · ⚡ Test Generation
   - تدخل في نظام المشاركة (الـ 3 أنواع) والترجمة (ليبلات الواجهة)
   ===================================================================== */

// بيبني File object من الـ dataURL المخزّن — عشان دوال استخراج النص (pdf.js/mammoth) تقدر تقراه
const dataUrlToFile = (dataUrl, name, mime) => {
    const base64 = String(dataUrl || '').split(',')[1] || '';
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name || 'file', { type: mime || 'application/octet-stream' });
};

function RequirementsPage({ onSendGaps, onSendScenarios, onSendGeneration }) {
    const [reqText, setReqText] = useState(() => localStorage.getItem('wakil_req_text') || '');
    const [reqFiles, setReqFiles] = useState(() => safeJSON('wakil_req_files', []));
    const [viewFile, setViewFile] = useState(null);
    const fileRef = React.useRef(null);

    // ---------- حفظ دائم (كل تغيير يتكتب فورًا — المفتاح جزء من مساحة العمل/السحابة) ----------
    useEffect(() => { try { localStorage.setItem('wakil_req_text', reqText); } catch (e) { /* ignore */ } }, [reqText]);
    useEffect(() => {
        try { localStorage.setItem('wakil_req_files', JSON.stringify(reqFiles)); }
        catch (e) { alert(tr('Browser storage is full — remove some files.')); }
    }, [reqFiles]);

    // ---------- إضافة ملفات: صور (ضغط) / نصوص (محتوى) / PDF وأي ملف (dataURL للمعاينة والتنزيل) ----------
    const addFiles = async (list) => {
        const added = [];
        for (const f of list) {
            try {
                if (f.type.startsWith('image/')) {
                    const u = await compressBugImage(f);
                    if (u) added.push({ name: f.name, kind: 'image', mime: 'image/jpeg', data: u });
                } else if (f.type.startsWith('text/') || /\.(txt|md|json|csv|log|xml|yml|yaml|feature|gherkin)$/i.test(f.name)) {
                    added.push({ name: f.name, kind: 'text', mime: f.type || 'text/plain', data: await readAsText(f) });
                } else {
                    added.push({ name: f.name, kind: f.type === 'application/pdf' ? 'pdf' : 'file', mime: f.type || 'application/octet-stream', data: await readAsDataURL(f) });
                }
            } catch (e) { /* تجاهل ملف فاشل */ }
        }
        if (added.length) setReqFiles(prev => [...prev, ...added]);
    };

    const removeFile = (i) => setReqFiles(prev => prev.filter((_, j) => j !== i));

    const imageObjs = reqFiles.filter(f => f.kind === 'image').map(f => ({ name: f.name, dataUrl: f.data }));
    const textFiles = reqFiles.filter(f => f.kind === 'text');
    const hasAny = reqText.trim() || reqFiles.length;

    // ---------- الإرسال للفيتشرز التانية (handoff بنفس معمارية الموقع) ----------
    // الملفات بتتحول لمحتوى فعلي هنا: pdf/docx بيستخرج نصهم (نفس اللي بتعمله الصفحات المستقبِدة
    // لما ترفع الملف بنفسها) عشان يوصلك المحتوى للتحليل/التوليد مش للعرض بس
    const sendTo = async (target) => {
        if (!hasAny) { alert(tr('Paste or upload requirements first!')); return; }
        const files = [];
        const skipped = [];
        for (const f of reqFiles) {
            if (f.kind === 'text') { files.push({ name: f.name, kind: 'text', data: f.data }); continue; }
            if (f.kind === 'pdf' || f.kind === 'file') {
                try {
                    const r = await readUploadedFile(dataUrlToFile(f.data, f.name, f.mime));
                    if (r && r.text && String(r.text).trim()) files.push({ name: f.name, kind: 'text', data: String(r.text) });
                    else skipped.push(f.name);
                } catch (e) { skipped.push(f.name); }
            }
        }
        if (skipped.length) alert(tr('Some files could not be read and were not sent:') + '\n' + skipped.join('\n'));
        const payload = { text: reqText, images: imageObjs, files };
        if (target === 'gaps') onSendGaps && onSendGaps(payload);
        else if (target === 'scenarios') onSendScenarios && onSendScenarios(payload);
        else if (target === 'generation') onSendGeneration && onSendGeneration(payload);
    };

    const sendBtn = 'flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed';

    return (
        <main className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-slate-800">📋 {tr('Requirements')}</h2>
                    <span className="text-[10px] bg-blue-500/10 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">{tr('Raw input — feeds the other features')}</span>
                </div>
                {/* إرسال الخامة للفيتشرز التانية */}
                <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => sendTo('gaps')} disabled={!hasAny} className={sendBtn + ' bg-white border-slate-300 text-slate-700 hover:bg-slate-100'} title={tr('Send the text and files to Requirement Analysis')}>🔍 {tr('Send to Requirement Analysis')}</button>
                    <button onClick={() => sendTo('scenarios')} disabled={!hasAny} className={sendBtn + ' bg-white border-slate-300 text-slate-700 hover:bg-slate-100'} title={tr('Send the text and files to Test Scenarios')}>🧪 {tr('Send to Test Scenarios')}</button>
                    <button onClick={() => sendTo('generation')} disabled={!hasAny} className={sendBtn + ' bg-white border-slate-300 text-slate-700 hover:bg-slate-100'} title={tr('Send the text and files to Test Generation')}>⚡ {tr('Send to Test Generation')}</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* ---------- مربع النص ---------- */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{tr('Requirements (User Story / SRS / BRD / anything)')}</label>
                    <textarea
                        value={reqText}
                        onChange={e => setReqText(e.target.value)}
                        rows={12}
                        dir="auto"
                        placeholder={tr('Paste or write the requirements here (User Story / SRS / BRD / anything)…')}
                        className="w-full border border-slate-300 rounded-xl p-3 text-sm bg-white resize-y outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">{tr('Saved automatically — the content stays in this story and syncs to the cloud.')}</p>
                </div>

                {/* ---------- رفع الملفات والصور ---------- */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{tr('Files & images')}</label>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => fileRef.current && fileRef.current.click()} className="text-[11px] bg-blue-50 text-blue-700 border border-blue-100 rounded px-2.5 py-1.5 hover:bg-blue-100 font-semibold">📎 + {tr('Add files or images')}</button>
                        <span className="text-[10px] text-slate-400">{tr('Images, text files, PDFs — preview them here and send them with the requirements.')}</span>
                    </div>
                    <input ref={fileRef} type="file" multiple className="hidden" accept="image/*,.txt,.md,.json,.csv,.log,.xml,.yml,.yaml,.pdf,.docx,.doc" onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
                </div>

                {/* ---------- الملفات: معاينة وتنزيل وحذف ---------- */}
                {reqFiles.length === 0 ? (
                    <p className="text-sm text-slate-400">{tr('No files yet — add files or images to preview them here.')}</p>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {reqFiles.map((f, i) => (
                            <div key={i} className="relative bg-white border border-slate-200 rounded-lg overflow-hidden group">
                                <button onClick={() => setViewFile(f)} className="w-full text-left block">
                                    {f.kind === 'image' ? (
                                        <img src={f.data} alt={f.name} className="w-full h-28 object-cover" />
                                    ) : (
                                        <div className="h-28 flex items-center justify-center bg-slate-50 text-3xl">{f.kind === 'pdf' ? '📕' : f.kind === 'text' ? '📄' : '📎'}</div>
                                    )}
                                    <div className="p-2">
                                        <p className="text-[11px] font-semibold text-slate-700 truncate" dir="auto">{f.name}</p>
                                        <p className="text-[10px] text-blue-600">{tr('Click to preview')}</p>
                                    </div>
                                </button>
                                <button onClick={() => removeFile(i)} className="absolute top-1.5 right-1.5 bg-red-600 text-white text-[10px] w-5 h-5 rounded-full leading-none shadow">✕</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ---------- عارض المعاينة: صور / نص / PDF + تنزيل ---------- */}
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
        </main>
    );
}
