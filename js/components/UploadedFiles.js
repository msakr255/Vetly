/* =====================================================================
   components/UploadedFiles.js
   عرض الملفات المرفوعة تحت خانة الرفع (بدل ما محتواها يتكتب جوه الـ textarea).
   بيتستخدم في Requirement Gaps و Test Scenarios و Test Generation.
   ===================================================================== */

function UploadedFiles({ files = [], images = [], status = '', onRemoveFile, onRemoveImage }) {
    const total = files.length + images.length;
    const chip = 'text-[10px] bg-white border border-slate-200 rounded px-2 py-1 flex items-center gap-1';
    return (
        <div className="space-y-1.5">
            {status && <p className="text-xs text-blue-600">{status}</p>}
            {total > 0 && !status && (
                <p className="text-xs text-emerald-700 font-semibold">
                    ✔ {total > 1 ? `تم رفع ${total} ملفات` : 'تم رفع الملف'}
                </p>
            )}
            {total > 0 && (
                <div className="flex flex-wrap gap-1">
                    {files.map((f, i) => (
                        <span key={'f' + i} className={chip}>
                            📄 {f.name}
                            <button onClick={() => onRemoveFile(i)} className="text-red-500">✕</button>
                        </span>
                    ))}
                    {images.map((img, i) => (
                        <span key={'i' + i} className={chip}>
                            🖼 {img.name}
                            <button onClick={() => onRemoveImage(i)} className="text-red-500">✕</button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

// بيجمّع النص المكتوب + نصوص الملفات المرفوعة في نص واحد يتبعت للـ AI
function joinWithFiles(text, files) {
    return [
        String(text || '').trim(),
        ...(files || []).map(f => `--- Content from ${f.name} ---\n${f.text}`)
    ].filter(Boolean).join('\n\n');
}
