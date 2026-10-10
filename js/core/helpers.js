/* =====================================================================
   core/helpers.js
   دوال مساعدة مشتركة: قراءة الملفات (PDF/Word/Image)، تنضيف الداتا، تحميل الملفات.
   ===================================================================== */

/* =====================================================================
   1) HELPERS: تحميل المكتبات + قراءة الملفات (PDF / Word / Image)
   ===================================================================== */

const loadScript = (src) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
});

const readAsDataURL = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
});

const readAsText = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsText(file);
});

const readAsArrayBuffer = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsArrayBuffer(file);
});

async function extractPdfText(file) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await window.pdfjsLib.getDocument({ data: await readAsArrayBuffer(file) }).promise;
    let out = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        let line = '', lastY = null;
        for (const it of content.items) {
            const y = it.transform ? it.transform[5] : 0;
            if (lastY !== null && Math.abs(y - lastY) > 2) { out += line.trim() + '\n'; line = ''; }
            line += it.str + ' ';
            lastY = y;
        }
        out += line.trim() + '\n\n';
    }
    return out;
}

async function extractDocxText(file) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
    const result = await window.mammoth.extractRawText({ arrayBuffer: await readAsArrayBuffer(file) });
    return result.value;
}


const safeJSON = (key, fallback) => {
    try {
        const v = JSON.parse(localStorage.getItem(key));
        return v ?? fallback;
    } catch (e) {
        return fallback;
    }
};

// بيوحّد اسم النوع (لو الموديل كتب "Edge case" أو "Boundary" أو "negative" بأي شكل)
const normalizeType = (t) => {
    const s = String(t || '').toLowerCase();
    if (s.includes('edge') || s.includes('boundary') || s.includes('corner') || s.includes('grenz') || s.includes('حدي')) return 'Edge Case';
    if (s.includes('neg') || s.includes('سلب')) return 'Negative';
    return 'Positive';
};
/* =====================================================================
   SANITIZE: بيحوّل أي رد من الموديل لشكل آمن للعرض (عشان مفيش شاشة بيضا)
   ===================================================================== */
function str(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map(str).filter(Boolean).join(', ');
    if (typeof v === 'object') return Object.values(v).map(str).filter(Boolean).join(' ');
    return String(v);
}

const toSteps = (v) => {
    if (Array.isArray(v)) return v.map(x => str(x).trim()).filter(Boolean);
    if (typeof v === 'string') return v.split(/\r?\n/).map(x => x.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
    return [];
};

const normPriority = (v) => {
    const s = str(v).toLowerCase();
    if (s.startsWith('crit') || s.startsWith('krit') || s.startsWith('حرج')) return 'Critical';
    if (s.startsWith('high') || s.startsWith('hoch') || s.startsWith('عال')) return 'High';
    if (s.startsWith('low') || s.startsWith('niedrig') || s.startsWith('منخفض')) return 'Low';
    return 'Medium';
};

const normStatus = (v) => {
    const s = str(v).toLowerCase();
    if (s === 'pass') return 'Pass';
    if (s === 'fail') return 'Fail';
    return 'Untested';
};

const pad2 = (n) => String(n).padStart(2, '0');

const sanitizeScenarioList = (list) => (Array.isArray(list) ? list : [])
    .filter(x => x && typeof x === 'object')
    .map((sc, i) => ({
        id: str(sc.id) || `TS-${pad2(i + 1)}`,
        type: normalizeType(sc.type),
        title: str(sc.title),
        priority: normPriority(sc.priority)
    }));

const sanitizeSuite = (d) => ({
    scenarios: (Array.isArray(d?.scenarios) ? d.scenarios : [])
        .filter(x => x && typeof x === 'object')
        .map((sc, i) => ({ id: str(sc.id) || `TS-${pad2(i + 1)}`, title: str(sc.title) })),
    testCases: (Array.isArray(d?.testCases) ? d.testCases : [])
        .filter(x => x && typeof x === 'object')
        .map((tc, i) => ({
            id: str(tc.id) || `TC-${pad2(i + 1)}`,
            scenarioId: str(tc.scenarioId),
            type: normalizeType(tc.type),
            title: str(tc.title),
            technique: str(tc.technique),
            priority: normPriority(tc.priority),
            preCondition: str(tc.preCondition),
            testData: str(tc.testData),
            steps: toSteps(tc.steps),
            expected: str(tc.expected),
            actualResult: str(tc.actualResult),
            status: normStatus(tc.status)
        }))
});


// بيطلّع الرقم التالي (TS-05 أو TC-12) بناءً على أكبر رقم موجود
const nextId = (ids, prefix) => {
    const max = Math.max(0, ...ids.map(i => parseInt(String(i || '').replace(/\D/g, ''), 10) || 0));
    return `${prefix}-${String(max + 1).padStart(2, '0')}`;
};

/* ---------- HTML / Download helpers ---------- */
const escHtml = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const downloadBlob = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

async function readUploadedFile(file) {
    const name = file.name.toLowerCase();
    if (file.type.startsWith('image/')) return { image: { name: file.name, dataUrl: await readAsDataURL(file) } };
    if (name.endsWith('.pdf')) return { text: await extractPdfText(file) };
    if (name.endsWith('.docx')) return { text: await extractDocxText(file) };
   if (name.endsWith('.doc')) throw new Error(tr('Old .doc files are not supported. Save as .docx and upload again.'));
if (name.endsWith('.pptx') || name.endsWith('.xlsx')) throw new Error(tr('This format is not supported here. Save it as PDF or Word, or copy the text.'));;
    return { text: await readAsText(file) };
}


/* ---------- تصدير صريح: بيضمن إن الدوال دي ظاهرة لكل الملفات التانية (حتى لو Babel عزل الـ const) ---------- */
Object.assign(window, {
    str, toSteps, normPriority, normStatus, normalizeType, pad2, nextId, safeJSON,
    sanitizeScenarioList, sanitizeSuite, escHtml, downloadBlob,
    loadScript, readAsDataURL, readAsText, readAsArrayBuffer
});
