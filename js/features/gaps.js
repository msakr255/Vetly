/* =====================================================================
   features/gaps.js
   ميزة Requirement Gaps: المرجعية (KB) + تحليل المتطلبات + التقرير. بتتعدل هنا بس.
   ===================================================================== */

// المرجعية اللي الـ AI بيشتغل بيها (مستخرجة من ملف Session 5: Requirements Deep-Dive)
const GAP_KB = `KNOWLEDGE BASE - REQUIREMENT REVIEW METHODOLOGY (use ONLY this methodology and taxonomy):

A. Requirement document levels
- BRD (Business Requirement Document): high-level "WHY" - business problem, goals, scope, regulations, ROI. Used for scope validation (UAT).
- SRS (Software Requirement Specification): "WHAT" the system must do - functional + non-functional (performance, security, usability). Used for test strategy and scenarios.
- FRS (Functional Requirement Specification): "HOW exactly" - field-level rules, screen flow, system responses. Used for detailed test case design.
- User stories / acceptance criteria are small-scale requirements: judge them mainly for testable Given/When/Then conditions.
- All levels should tell one consistent story; check consistency between them.

B. Components a COMPLETE requirement should contain (check each one):
1. Preconditions - state that must be true before the feature starts.
2. Business Rules - policies, constraints, limits independent of any screen.
3. Field Validations - data type, format, length, range, mandatory/optional, error text per input field.
4. Assumptions - unstated conditions taken for granted.
5. Dependencies - other systems/features/teams the requirement relies on.
6. Acceptance Criteria - specific, testable Given/When/Then pass conditions.
7. Exception Handling - defined behavior for failure and negative paths, not just the happy path.
8. UI / Screen Flow - screen sequence, wireframes, on-screen messages and labels.
9. Data Requirements - what must be stored, logged, or mapped between systems.
10. Out of Scope - what is explicitly excluded.

C. The nine gap types (use EXACTLY these names):
1. Missing requirement - a scenario is not addressed at all.
2. Ambiguous requirement - wording allows multiple interpretations (e.g. "respond quickly" with no threshold).
3. Incomplete requirement - partially defined logic (e.g. a limit is stated but its reset time is not).
4. Conflicting requirement - statements or documents disagree (e.g. one place says limit 10,000, another says 5,000).
5. Assumed / implicit requirement - expected behavior that was never written down.
6. Non-functional gap - missing performance, security, or usability requirement.
7. UI/UX & error-message gap - screen flow or exact error text is not specified.
8. Negative scenario gap - failure paths are not defined.
9. Business rule gap - rules are incomplete for edge cases.

D. How to find gaps:
- Check consistency line by line; look for requirements with no counterpart (traceability).
- Apply test design techniques (Boundary Value Analysis, Equivalence Partitioning, Decision Tables): gaps surface when you try to design test cases.
- Imagine the process as a flowchart: missing branches are gaps.
- Ask deliberate "what if" and negative questions for every step.
- Testability check: if you cannot write a pass/fail test for it, it is a gap.
- SMART filter: Specific, Measurable, Achievable, Relevant, Time-bound.

E. A gap log entry includes: Gap ID, Requirement reference (exact document/section), Description (clear factual statement), Type, Example/scenario (concrete case showing the impact), Question to BA/PO (the exact decision needed), Priority/Impact (High/Medium/Low), Status and Owner.

F. Best practices: be specific and cite the exact section; always attach a concrete example; priority High = affects a core transaction path, money or data integrity, security, legal/regulatory compliance, or blocks test design.

G. Style illustration (NOT part of the input, never copy it): Description "No requirement defines the behavior when the system cannot fulfil the exact requested amount using the available note denominations." Scenario "Customer requests 150 EGP but the machine only holds 100 and 500 notes." Question "Should the transaction be rejected, rounded down, or should the customer choose a fulfillable amount? What message is displayed?"`;

const GAP_TYPES = ['Missing requirement', 'Ambiguous requirement', 'Incomplete requirement', 'Conflicting requirement', 'Assumed / implicit requirement', 'Non-functional gap', 'UI/UX & error-message gap', 'Negative scenario gap', 'Business rule gap'];
const GAP_COMPONENTS = ['Preconditions', 'Business Rules', 'Field Validations', 'Assumptions', 'Dependencies', 'Acceptance Criteria', 'Exception Handling', 'UI / Screen Flow', 'Data Requirements', 'Out of Scope'];

const normalizeGapType = (v) => {
    const t = str(v).toLowerCase().trim();
    const exact = GAP_TYPES.find(x => x.toLowerCase() === t);
    if (exact) return exact;
    if (t.includes('negative')) return 'Negative scenario gap';
    if (t.includes('conflict') || t.includes('contradict')) return 'Conflicting requirement';
    if (t.includes('ambig') || t.includes('vague')) return 'Ambiguous requirement';
    if (t.includes('incomplete') || t.includes('partial')) return 'Incomplete requirement';
    if (t.includes('assum') || t.includes('implicit')) return 'Assumed / implicit requirement';
    if (t.includes('non-func') || t.includes('nonfunc') || t.includes('performance') || t.includes('security') || t.includes('usability')) return 'Non-functional gap';
    if (t.includes('ui') || t.includes('ux') || t.includes('message') || t.includes('screen')) return 'UI/UX & error-message gap';
    if (t.includes('business rule') || t.includes('rule')) return 'Business rule gap';
    return 'Missing requirement';
};

const gapPriority = (v) => { const p = normPriority(v); return p === 'Critical' ? 'High' : (p === 'Low' ? 'Low' : (p === 'High' ? 'High' : 'Medium')); };
const gapStatus = (v) => ['Open', 'Answered', 'Closed'].includes(str(v)) ? str(v) : 'Open';

const sanitizeGap = (g) => ({
    id: '',
    type: normalizeGapType(g.type),
    requirementRef: str(g.requirementRef || g.ref || g.reference),
    description: str(g.description),
    evidence: str(g.evidence),
    scenario: str(g.scenario || g.example),
    question: str(g.question || g.questionToBA),
    priority: gapPriority(g.priority),
    status: 'Open'
});

const sanitizeGapList = (list) => (Array.isArray(list) ? list : [])
    .filter(x => x && typeof x === 'object')
    .map(sanitizeGap)
    .filter(g => g.description);

const normalizeCoverage = (c) => {
    const out = {};
    GAP_COMPONENTS.forEach(k => {
        const v = str(c && typeof c === 'object' ? c[k] : '').toLowerCase();
        out[k] = v.startsWith('pres') ? 'Present' : v.startsWith('part') ? 'Partial' : v.startsWith('miss') ? 'Missing' : 'N/A';
    });
    return out;
};

const sanitizeGapSection = (p) => {
    if (!p || typeof p !== 'object' || !Array.isArray(p.gaps)) return null;
    return {
        sectionType: str(p.sectionType),
        summary: str(p.summary),
        keyPoints: (Array.isArray(p.keyPoints) ? p.keyPoints : []).map(str).filter(Boolean).slice(0, 10),
        coverage: normalizeCoverage(p.componentsCoverage || p.coverage),
        gaps: sanitizeGapList(p.gaps)
    };
};

// بينضّف الداتا المحفوظة في المتصفح (يحافظ على الـ ID والحالة)
const sanitizeGapResult = (d) => {
    if (!d || typeof d !== 'object') return null;
    const keep = (list) => (Array.isArray(list) ? list : [])
        .filter(x => x && typeof x === 'object')
        .map(g => ({ ...sanitizeGap(g), id: str(g.id), status: gapStatus(g.status) }))
        .filter(g => g.description);
    return {
        sections: (Array.isArray(d.sections) ? d.sections : []).filter(x => x && typeof x === 'object').map(sec => ({
            title: str(sec.title), doc: str(sec.doc), sectionType: str(sec.sectionType), summary: str(sec.summary),
            keyPoints: (Array.isArray(sec.keyPoints) ? sec.keyPoints : []).map(str),
            coverage: normalizeCoverage(sec.coverage), gaps: keep(sec.gaps), error: str(sec.error)
        })),
        cross: keep(d.cross),
        createdAt: str(d.createdAt)
    };
};

const assignGapIds = (sections, cross) => {
    let n = 0;
    const next = () => `GAP-${String(++n).padStart(3, '0')}`;
    return {
        sections: sections.map(sec => ({ ...sec, gaps: sec.gaps.map(g => ({ ...g, id: next() })) })),
        cross: cross.map(g => ({ ...g, id: next() }))
    };
};

/* ---------- تقسيم المستند لسكاشن حسب العناوين ---------- */
const GAP_MAX_CHUNK = 9000;
const GAP_MIN_SECTION = 300;

function splitIntoSections(text) {
    const lines = text.replace(/\r/g, '').split('\n');
    const isFileMarker = (t) => /^---\s*Content from .+---$/.test(t);
    const isHeading = (l) => {
        const t = l.trim();
        if (!t || t.length > 110) return false;
        if (isFileMarker(t)) return true;
        if (/^#{1,6}\s+\S/.test(t)) return true;
        const words = t.split(/\s+/).length;
        const noEnd = !/[.!?؟:;,]$/.test(t);
        if (/^\d+(\.\d+){0,4}[.)]?\s+\S/.test(t) && noEnd && words <= 12) return true;
        if (/^(section|chapter|epic|feature|module|user story|story|use case)\b/i.test(t) && noEnd && words <= 14) return true;
        if (/^(US|REQ|FR|NFR|BR|AC|SRS|BRD|FRS)[-_ ]?\d+/i.test(t) && words <= 16) return true;
        if (t === t.toUpperCase() && /[A-Z]{3}/.test(t) && noEnd && words <= 10) return true;
        return false;
    };

    let doc = 'Pasted text';
    let cur = { title: 'Document start', doc, body: [] };
    const raw = [];
    for (const line of lines) {
        const t = line.trim();
        if (isHeading(line)) {
            if (cur.body.join('\n').trim() || raw.length === 0 && cur.title !== 'Document start') raw.push(cur);
            else if (cur.body.join('\n').trim()) raw.push(cur);
            const m = /^---\s*Content from (.+?)\s*---$/.exec(t);
            if (m) { doc = m[1]; cur = { title: 'File: ' + m[1], doc, body: [] }; }
            else cur = { title: t.replace(/^#{1,6}\s+/, ''), doc, body: [] };
        } else {
            cur.body.push(line);
        }
    }
    if (cur.body.join('\n').trim()) raw.push(cur);

    let secs = raw.map(x => ({ title: x.title, doc: x.doc, text: x.body.join('\n').trim() })).filter(x => x.text);
    if (secs.length === 0) return [];

    // دمج الأقسام الصغيرة جداً مع اللي بعدها
    const merged = [];
    let carry = '';
    let carryTitles = [];
    for (let i = 0; i < secs.length; i++) {
        const sec = secs[i];
        const body = (carry ? carry + '\n\n' : '') + sec.text;
        if (body.length < GAP_MIN_SECTION && i < secs.length - 1) {
            carry = (carry ? carry + '\n\n' : '') + `${sec.title}\n${sec.text}`;
            carryTitles.push(sec.title);
            continue;
        }
        let title = [...carryTitles, sec.title].join(' + ');
        if (title.length > 110) title = title.slice(0, 107) + '...';
        merged.push({ title, doc: sec.doc, text: body });
        carry = '';
        carryTitles = [];
    }

    // تقسيم الأقسام الكبيرة جداً حسب الفقرات
    const out = [];
    for (const sec of merged) {
        if (sec.text.length <= GAP_MAX_CHUNK) { out.push(sec); continue; }
        const paras = sec.text.split(/\n\s*\n/);
        const parts = [];
        let buf = '';
        for (const p of paras) {
            if ((buf + '\n\n' + p).length > GAP_MAX_CHUNK && buf) { parts.push(buf); buf = p; }
            else buf = buf ? buf + '\n\n' + p : p;
            while (buf.length > GAP_MAX_CHUNK * 1.5) { parts.push(buf.slice(0, GAP_MAX_CHUNK)); buf = buf.slice(GAP_MAX_CHUNK); }
        }
        if (buf) parts.push(buf);
        parts.forEach((txt, i) => out.push({ title: `${sec.title} (part ${i + 1}/${parts.length})`, doc: sec.doc, text: txt }));
    }
    return out;
}

function buildGapChunks(text, images) {
    let chunks = text.trim() ? splitIntoSections(text) : [];
    if (chunks.length === 0 && text.trim()) chunks = [{ title: 'Requirement text', doc: 'Pasted text', text: text.trim() }];
    if (images.length) chunks.push({ title: 'Uploaded images', doc: 'Images', text: '(The requirements for this section are in the attached image(s).)', images });
    return chunks;
}

const buildSectionPrompt = (chunk, idx, total) => `You are a Senior QA Engineer and Acting QC Lead performing a REQUIREMENT REVIEW. Your only job is to find requirement GAPS in the section below, using the methodology in the KNOWLEDGE BASE.

${GAP_KB}

DOCUMENT: "${chunk.doc}"
SECTION ${idx + 1} of ${total}: "${chunk.title}"

RULES:
1. Base every gap ONLY on what is written (or conspicuously missing) in THIS section. Never invent requirements, numbers or systems that are not in the text.
2. Every gap needs: the exact requirement reference (use the IDs/headings/numbering found in the text), a short verbatim evidence quote of at most 25 words (use "Not stated" when the gap is something missing), a concrete scenario showing the impact, and the exact question the BA/PO must answer.
3. "type" must be EXACTLY one of the nine gap types listed in the knowledge base.
4. "priority" must be "High", "Medium" or "Low".
5. For the 10 components in section B, report "Present", "Partial", "Missing" or "N/A" (N/A only when the component is irrelevant for this kind of section, e.g. field validations in a business-vision paragraph).
6. Do not pad. If the section is clear and testable, return an empty gaps list. Quality over quantity (typically 0-8 gaps per section).
7. "sectionType" is your best judgement of the content level: "BRD", "SRS", "FRS", "User Story", "Acceptance Criteria" or "Other".
8. "keyPoints": up to 8 short statements of the key requirements stated in this section (used later for a cross-section consistency check).
9. ${langRule()}

Return ONLY a valid JSON object, no markdown and no extra text, exactly in this structure:
{"sectionType":"SRS","summary":"1-2 sentences describing what this section specifies","keyPoints":["..."],"componentsCoverage":{"Preconditions":"Present","Business Rules":"Missing","Field Validations":"Partial","Assumptions":"N/A","Dependencies":"N/A","Acceptance Criteria":"Missing","Exception Handling":"Missing","UI / Screen Flow":"N/A","Data Requirements":"N/A","Out of Scope":"Missing"},"gaps":[{"type":"Missing requirement","requirementRef":"Section 3.2","description":"Clear factual gap statement","evidence":"short quote or Not stated","scenario":"Concrete example showing impact","question":"The exact decision needed from the BA/PO","priority":"High"}]}

SECTION TEXT:
"""
${chunk.text}
"""`;

const buildCrossPrompt = (sections) => `You are a Senior QA Engineer and Acting QC Lead. Below are condensed digests of every section of one requirements document set. Using the KNOWLEDGE BASE, find ONLY CROSS-SECTION gaps: conflicting requirements between sections or documents, inconsistent numbers/limits/terminology, higher-level requirements (e.g. BRD goals) with no matching lower-level requirement (SRS/FRS), and missing traceability. Do NOT repeat gaps that belong to a single section.

${GAP_KB}

RULES:
1. Use only what is in the digests. Do not invent facts.
2. "requirementRef" must name the sections involved (e.g. "Section 2 vs Section 5").
3. "type" must be EXACTLY one of the nine gap types. "priority" is "High", "Medium" or "Low".
4. If there are no cross-section gaps, return an empty list. ${langRule()}

Return ONLY valid JSON: {"gaps":[{"type":"Conflicting requirement","requirementRef":"...","description":"...","evidence":"short quote or Not stated","scenario":"...","question":"...","priority":"High"}]}

SECTION DIGESTS:
${sections.map((sec, i) => `[${i + 1}] ${sec.title} (${sec.doc}, ${sec.sectionType || 'n/a'}): ${sec.summary}\n   Key points: ${sec.keyPoints.join(' | ') || 'none'}`).join('\n')}`;

/* ---------- التقرير ---------- */

const flattenGaps = (d) => {
    const out = [];
    (d?.sections || []).forEach(sec => sec.gaps.forEach(g => out.push({ ...g, section: sec.title, doc: sec.doc })));
    (d?.cross || []).forEach(g => out.push({ ...g, section: 'Cross-section', doc: 'All documents' }));
    return out;
};


function buildGapReportHtml({ gapData, assignee, recipient, project }) {
    const all = flattenGaps(gapData);
    const count = (fn) => all.filter(fn).length;
    const date = new Date().toISOString().slice(0, 10);
    const who = escHtml(assignee) + (recipient.trim() ? ' - ' + escHtml(recipient.trim()) : '');
    const prio = (p) => `<span class="${p}">${p}</span>`;
    const gapTable = (gaps) => `<table><tr><th>Gap ID</th><th>Type</th><th>Priority</th><th>Requirement Ref.</th><th>Description</th><th>Scenario</th><th>Question to ${escHtml(assignee)}</th><th>Status</th></tr>` +
        gaps.map(g => `<tr><td>${escHtml(g.id)}</td><td>${escHtml(g.type)}</td><td>${prio(g.priority)}</td><td>${escHtml(g.requirementRef)}</td><td>${escHtml(g.description)}${g.evidence && g.evidence !== 'Not stated' ? `<br/><i>Evidence: ${escHtml(g.evidence)}</i>` : ''}</td><td>${escHtml(g.scenario)}</td><td>${escHtml(g.question)}</td><td>${escHtml(g.status)}</td></tr>`).join('') + '</table>';

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><title>Requirement Gap Analysis Report</title>
<style>
body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1e293b}
h1{color:#1d4ed8;font-size:22pt;margin-bottom:2pt} h2{color:#1d4ed8;font-size:15pt;border-bottom:1px solid #cbd5e1;padding-bottom:2pt;margin-top:18pt}
h3{font-size:12pt;color:#0f172a;margin-top:12pt}
table{border-collapse:collapse;width:100%;margin:6pt 0}
td,th{border:1px solid #94a3b8;padding:4pt;vertical-align:top;font-size:9.5pt}
th{background:#2563eb;color:#ffffff;text-align:left}
.meta td{border:none;padding:2pt 6pt 2pt 0;font-size:11pt}
.High{color:#b91c1c;font-weight:bold} .Medium{color:#b45309;font-weight:bold} .Low{color:#15803d;font-weight:bold}
.Present{color:#15803d} .Partial{color:#b45309} .Missing{color:#b91c1c;font-weight:bold}
.note{color:#64748b;font-size:9.5pt}
</style></head><body>
<h1>Requirement Gap Analysis Report</h1>
<table class="meta">
<tr><td><b>Project / Feature:</b></td><td>${escHtml(project.trim() || 'N/A')}</td></tr>
<tr><td><b>Prepared for:</b></td><td>${who}</td></tr>
<tr><td><b>Prepared by:</b></td><td>QA Team</td></tr>
<tr><td><b>Date:</b></td><td>${date}</td></tr>
<tr><td><b>Source documents:</b></td><td>${escHtml([...new Set((gapData.sections || []).map(s => s.doc))].join(', '))}</td></tr>
</table>

<h2>1. Executive Summary</h2>
<p>The requirements were reviewed section by section against a structured gap-analysis methodology (completeness of requirement components, testability, consistency, and the standard gap types). A total of <b>${all.length}</b> gaps were identified across <b>${gapData.sections.length}</b> section(s), including cross-section checks.</p>
<table><tr><th>High</th><th>Medium</th><th>Low</th><th>Total</th></tr><tr><td>${count(g => g.priority === 'High')}</td><td>${count(g => g.priority === 'Medium')}</td><td>${count(g => g.priority === 'Low')}</td><td>${all.length}</td></tr></table>
<h3>Gaps by type</h3>
<table><tr><th>Gap type</th><th>Count</th></tr>${GAP_TYPES.map(t => `<tr><td>${escHtml(t)}</td><td>${count(g => g.type === t)}</td></tr>`).join('')}</table>
<p class="note">Please review each item below and provide the requested decisions. Each gap includes the exact requirement reference, a concrete scenario showing the impact, and the specific question that needs an answer.</p>

<h2>2. Findings by Section</h2>`;

    gapData.sections.forEach((sec, i) => {
        html += `<h3>2.${i + 1} ${escHtml(sec.title)}</h3><p class="note">Document: ${escHtml(sec.doc)}${sec.sectionType ? ' | Level: ' + escHtml(sec.sectionType) : ''}</p>`;
        if (sec.error) { html += `<p class="High">This section could not be analyzed: ${escHtml(sec.error)}</p>`; return; }
        if (sec.summary) html += `<p>${escHtml(sec.summary)}</p>`;
        html += `<table><tr><th>Requirement component</th><th>Coverage</th></tr>${GAP_COMPONENTS.map(c => `<tr><td>${c}</td><td class="${sec.coverage[c] === 'N/A' ? '' : sec.coverage[c]}">${sec.coverage[c]}</td></tr>`).join('')}</table>`;
        html += sec.gaps.length ? gapTable(sec.gaps) : '<p>No gaps identified in this section.</p>';
    });

    html += `<h2>3. Cross-Section Findings</h2>`;
    html += (gapData.cross || []).length ? gapTable(gapData.cross) : '<p>No cross-section gaps identified.</p>';

    const byPrio = ['High', 'Medium', 'Low'].map(p => ({ p, items: all.filter(g => g.priority === p && g.question) }));
    html += `<h2>4. Questions Requiring a Decision from the ${escHtml(assignee)}</h2>`;
    byPrio.forEach(({ p, items }) => {
        if (!items.length) return;
        html += `<h3>${p} priority</h3><ol>${items.map(g => `<li><b>${escHtml(g.id)}</b> (${escHtml(g.requirementRef || g.section)}): ${escHtml(g.question)}</li>`).join('')}</ol>`;
    });

    html += `<h2>5. Consolidated Gap Log</h2>` + (all.length ? gapTable(all) : '<p>No gaps identified.</p>');
    html += `<p class="note">Status values: Open / Answered / Closed. Owner: ${escHtml(assignee)}${recipient.trim() ? ' (' + escHtml(recipient.trim()) + ')' : ''}.</p></body></html>`;
    return html;
}


function GapsPage({ keys, models, setShowSettings, gapData, setGapData, sendToScenarios }) {
    const [gapText, setGapText] = useState(() => localStorage.getItem('wakil_gap_text') || '');
    const [gapImages, setGapImages] = useState([]);
    const [gapFiles, setGapFiles] = useState([]); // الملفات المرفوعة (بتتحلل من غير ما تتكتب في الـ textarea)
    const [gapProviders, setGapProviders] = useState([]);
    const [gapLoading, setGapLoading] = useState(false);
    const [gapProgress, setGapProgress] = useState('');
    const [gapErrors, setGapErrors] = useState([]);
    const [gapUploadStatus, setGapUploadStatus] = useState('');
    const [gapProject, setGapProject] = useState(() => localStorage.getItem('wakil_gap_project') || '');
    const [gapAssignee, setGapAssignee] = useState('Business Analyst');
    const [gapRecipient, setGapRecipient] = useState(() => localStorage.getItem('wakil_gap_recipient') || '');
    const gapCancel = React.useRef(false);

    useEffect(() => {
        localStorage.setItem('wakil_gap_text', gapText);
        localStorage.setItem('wakil_gap_project', gapProject);
        localStorage.setItem('wakil_gap_recipient', gapRecipient);
    }, [gapText, gapProject, gapRecipient]);

    /* ---------- Requirement Gaps page logic ---------- */
    const handleGapFileUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setGapUploadStatus('Reading file...');
        for (const file of files) {
            try {
                const r = await readUploadedFile(file);
                if (r.image) setGapImages(prev => [...prev, r.image]);
                else setGapFiles(prev => [...prev, { name: file.name, text: r.text }]);
            } catch (err) {
                console.error(err);
                alert(`${file.name}: ${err.message}`);
            }
        }
        setGapUploadStatus('');
        e.target.value = '';
    };

    const analyzeGaps = async () => {
        if (!gapText.trim() && gapFiles.length === 0 && gapImages.length === 0) { alert('Please paste requirements or upload a file first!'); return; }
        if (!PROVIDERS.some(p => (keys[p.id] || '').trim())) {
            alert('مفيش ولا API key. افتح Settings وحط مفتاح واحد على الأقل.');
            setShowSettings(true);
            return;
        }
        gapCancel.current = false;
        setGapLoading(true);
        setGapErrors([]);
        setGapData(null);

        const chunks = buildGapChunks(joinWithFiles(gapText, gapFiles), gapImages);
        const used = new Set();
        const sections = [];
        const errs = [];
        const show = (secs, cross) => setGapData({ ...assignGapIds(secs, cross), createdAt: new Date().toISOString() });

        for (let i = 0; i < chunks.length; i++) {
            if (gapCancel.current) break;
            const chunk = chunks[i];
            setGapProgress(`Analyzing section ${i + 1} of ${chunks.length}: ${chunk.title}`);
            const r = await runProviders({
                keys, models,
                prompt: buildSectionPrompt(chunk, i, chunks.length),
                images: chunk.images || [],
                validate: sanitizeGapSection
            });
            if (r.data) {
                used.add(r.provider);
                sections.push({ title: chunk.title, doc: chunk.doc, error: '', ...r.data });
            } else {
                const msg = r.errors.join(' | ') || 'No provider available';
                sections.push({ title: chunk.title, doc: chunk.doc, sectionType: '', summary: '', keyPoints: [], coverage: normalizeCoverage({}), gaps: [], error: msg });
                errs.push(`${chunk.title}: ${msg}`);
            }
            show(sections, []);
        }

        let cross = [];
        const okSections = sections.filter(sec => !sec.error);
        if (!gapCancel.current && okSections.length >= 2) {
            setGapProgress('Cross-checking consistency between sections...');
            const r = await runProviders({
                keys, models,
                prompt: buildCrossPrompt(okSections),
                images: [],
                validate: (p) => (p && Array.isArray(p.gaps)) ? sanitizeGapList(p.gaps) : null
            });
            if (r.data) { cross = r.data; used.add(r.provider); }
            else errs.push('Cross-section check failed: ' + r.errors.join(' | '));
        }

        show(sections, cross);
        setGapProviders([...used].filter(Boolean));
        setGapErrors(errs);
        setGapProgress(gapCancel.current ? 'Stopped.' : '');
        setGapLoading(false);
    };

    const updateGap = (si, gi, field, value) => setGapData(d => si === 'cross'
        ? { ...d, cross: d.cross.map((g, i) => i === gi ? { ...g, [field]: value } : g) }
        : { ...d, sections: d.sections.map((sec, i) => i === si ? { ...sec, gaps: sec.gaps.map((g, j) => j === gi ? { ...g, [field]: value } : g) } : sec) });

    const deleteGap = (si, gi) => setGapData(d => si === 'cross'
        ? { ...d, cross: d.cross.filter((_, i) => i !== gi) }
        : { ...d, sections: d.sections.map((sec, i) => i === si ? { ...sec, gaps: sec.gaps.filter((_, j) => j !== gi) } : sec) });

    const clearGaps = () => {
        gapCancel.current = true;
        setGapText('');
        setGapImages([]);
        setGapFiles([]);
        setGapProviders([]);
        setGapData(null);
        setGapErrors([]);
        setGapProgress('');
        localStorage.removeItem('wakil_gap_text');
        localStorage.removeItem('wakil_gap_data');
    };

    // بيجمّع النص الأصلي (المكتوب + محتوى الملفات) + الـ Gaps كنقاط Acceptance Criteria منظمة، وينقلهم لصفحة Test Scenarios
    const gapsAsCriteriaText = () => {
        const bySection = new Map();
        flattenGaps(gapData).forEach(g => {
            const key = g.section || 'General';
            if (!bySection.has(key)) bySection.set(key, []);
            bySection.get(key).push(g);
        });
        const clean = (v) => { const t = String(v || '').trim(); return t && t !== 'Not stated' ? t : ''; };
        const lines = ['=== ADDITIONAL ACCEPTANCE CRITERIA (from Requirement Gap Analysis) ==='];
        bySection.forEach((gaps, section) => {
            lines.push('', `[${section}]`);
            gaps.forEach(g => {
                let line = `- ${g.id} (${g.priority} | ${g.type}): ${clean(g.description)}`;
                if (clean(g.question)) line += ` | Clarify: ${clean(g.question)}`;
                if (clean(g.scenario)) line += ` | Example: ${clean(g.scenario)}`;
                lines.push(line);
            });
        });
        return lines.join('\n');
    };

    const sendGapsToScenarios = () => {
        if (!gapData) return;
        const base = joinWithFiles(gapText, gapFiles);
        const hasGaps = flattenGaps(gapData).length > 0;
        const text = hasGaps ? [base, gapsAsCriteriaText()].filter(Boolean).join('\n\n') : base;
        sendToScenarios(text, gapImages);
    };

    const downloadGapReport = () => {
        if (!gapData) return;
        const html = buildGapReportHtml({ gapData, assignee: gapAssignee, recipient: gapRecipient, project: gapProject });
        downloadBlob(new Blob(['\uFEFF' + trHtml(html)], { type: 'application/msword;charset=utf-8' }), 'Requirement_Gap_Report.doc');
    };

    const downloadGapLog = async () => {
        if (!gapData) return;
        try {
            await loadScript('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js');
        } catch (e) {
            alert('تعذر تحميل مكتبة Excel. حمّل التقرير (Word) بدلها.');
            return;
        }
        const XLSX = window.XLSX;
        const headers = ['Gap ID', 'Section', 'Requirement Ref.', 'Type', 'Priority', 'Description', 'Evidence', 'Scenario', `Question to ${gapAssignee}`, 'Status', 'Owner'];
        const widths = [10, 28, 24, 26, 10, 50, 36, 40, 44, 11, 22];
        const owner = gapAssignee + (gapRecipient.trim() ? ` - ${gapRecipient.trim()}` : '');
        const rows = flattenGaps(gapData).map(g => [g.id, g.section, g.requirementRef, g.type, g.priority, g.description, g.evidence, g.scenario, g.question, g.status, owner].map(v => String(v ?? '')));
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
        XLSX.utils.book_append_sheet(wb, ws, 'Gap Log');
        XLSX.writeFile(wb, 'Requirement_Gap_Log.xlsx');
    };

    const allGapsFlat = flattenGaps(gapData);
    const gapCount = (fn) => allGapsFlat.filter(fn).length;
    const covColor = (v) => v === 'Present' ? 'bg-green-50 text-green-700 border-green-200'
        : v === 'Partial' ? 'bg-amber-50 text-amber-700 border-amber-200'
        : v === 'Missing' ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-slate-50 text-slate-400 border-slate-200';

    const renderGap = (g, si, gi) => (
        <div key={`${si}-${gi}-${g.id}`} className="border border-slate-200 rounded-lg p-3 bg-white space-y-1.5 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-0.5 rounded font-semibold">{g.id}</span>
                <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded font-semibold">{g.type}</span>
                <span className="text-slate-500">Ref: {g.requirementRef || 'N/A'}</span>
                <div className="flex-1"></div>
                <select className={`border rounded px-1 py-0.5 font-bold ${g.priority === 'High' ? 'text-red-700 bg-red-50' : g.priority === 'Medium' ? 'text-amber-700 bg-amber-50' : 'text-green-700 bg-green-50'}`} value={g.priority} onChange={e => updateGap(si, gi, 'priority', e.target.value)}>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                </select>
                <select className="border rounded px-1 py-0.5 bg-slate-50" value={g.status} onChange={e => updateGap(si, gi, 'status', e.target.value)}>
                    <option value="Open">Open</option>
                    <option value="Answered">Answered</option>
                    <option value="Closed">Closed</option>
                </select>
                <button onClick={() => deleteGap(si, gi)} className="text-red-600 hover:underline">Delete</button>
            </div>
            <p className="text-slate-800"><strong>Gap:</strong> {g.description}</p>
            {g.evidence && <p className="text-slate-500 italic"><strong className="not-italic">Evidence:</strong> {g.evidence}</p>}
            <p className="text-slate-600"><strong>Scenario:</strong> {g.scenario}</p>
            <p className="text-blue-800 bg-blue-50 border border-blue-100 rounded p-1.5"><strong>Question to {gapAssignee}:</strong> {g.question}</p>
        </div>
    );

    return (
        <main className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-slate-800">Requirement Gaps</h2>
                    {gapProviders.length > 0 && !gapLoading && (
                        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-1 font-semibold">✔ AI: {gapProviders.join(', ')}</span>
                    )}
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowSettings(true)} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                        ⚙ Settings
                    </button>
                    <button onClick={clearGaps} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                        Clear Data
                    </button>
                    {gapData && (
                        <button onClick={downloadGapLog} className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300">
                            Gap Log (.xlsx)
                        </button>
                    )}
                 
                    {gapData && (
                        <button onClick={downloadGapReport} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
                            Download Report (Word)
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="w-1/3 border-r border-slate-200 p-4 bg-slate-50 overflow-y-auto space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Requirements (User Story / AC / BRD / SRS / FRS)</label>
                        <textarea
                            className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                            rows="10"
                            value={gapText}
                            onChange={e => setGapText(e.target.value)}
                            placeholder="Paste requirements or upload file(s)..."
                        ></textarea>

                        <div className="mt-3 space-y-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Or Upload File(s) (PDF/Word/Image/Text)</label>
                            <input
                                type="file"
                                multiple
                                onChange={handleGapFileUpload}
                                className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-200 rounded-lg p-1 bg-white"
                            />
                            <UploadedFiles
                                files={gapFiles} images={gapImages} status={gapUploadStatus}
                                onRemoveFile={(i) => setGapFiles(gapFiles.filter((_, j) => j !== i))}
                                onRemoveImage={(i) => setGapImages(gapImages.filter((_, j) => j !== i))}
                            />
                        </div>

                        <div className="mt-3 bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                            <p className="font-bold text-slate-500 uppercase">Report settings</p>
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Project / Feature name:</label>
                                <input className="w-full border p-1.5 rounded bg-white" value={gapProject} onChange={e => setGapProject(e.target.value)} placeholder="e.g. Cash Withdrawal" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block font-bold text-slate-600 mb-1">Assign to:</label>
                                    <select className="w-full border p-1.5 rounded bg-white" value={gapAssignee} onChange={e => setGapAssignee(e.target.value)}>
                                        <option value="Business Analyst">Business Analyst</option>
                                        <option value="Product Owner">Product Owner</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-600 mb-1">Name (optional):</label>
                                    <input className="w-full border p-1.5 rounded bg-white" value={gapRecipient} onChange={e => setGapRecipient(e.target.value)} placeholder="Recipient name" />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={analyzeGaps}
                            disabled={gapLoading}
                            className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm flex justify-center items-center gap-2 disabled:opacity-50"
                        >
                            {gapLoading ? 'Analyzing...' : 'Analyze Requirements'}
                        </button>
                        {gapLoading && (
                            <button onClick={() => { gapCancel.current = true; }} className="w-full mt-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-2 rounded-lg text-sm">
                                Stop
                            </button>
                        )}
                        {gapProgress && <p className="mt-2 text-xs text-blue-700">{gapProgress}</p>}
                        {gapErrors.length > 0 && (
                            <div className="mt-2 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded p-2 space-y-1">
                                {gapErrors.map((m, i) => <div key={i}>{m}</div>)}
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-2/3 p-6 overflow-y-auto space-y-5">
                    {!gapData ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-center px-8">
                            Paste or upload the requirements and click Analyze Requirements. Each section is analyzed separately, then a cross-section check runs at the end.
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-5 gap-2 text-center text-xs">
                                <div className="bg-white border border-slate-200 rounded-lg p-2"><div className="text-lg font-bold text-slate-800">{allGapsFlat.length}</div>Total gaps</div>
                                <div className="bg-red-50 border border-red-200 rounded-lg p-2"><div className="text-lg font-bold text-red-700">{gapCount(g => g.priority === 'High')}</div>High</div>
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2"><div className="text-lg font-bold text-amber-700">{gapCount(g => g.priority === 'Medium')}</div>Medium</div>
                                <div className="bg-green-50 border border-green-200 rounded-lg p-2"><div className="text-lg font-bold text-green-700">{gapCount(g => g.priority === 'Low')}</div>Low</div>
                                <div className="bg-white border border-slate-200 rounded-lg p-2"><div className="text-lg font-bold text-slate-800">{gapData.sections.length}</div>Sections</div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {GAP_TYPES.map(t => {
                                    const n = gapCount(g => g.type === t);
                                    return n ? <span key={t} className="text-[11px] bg-white border border-slate-200 rounded-full px-2 py-0.5 text-slate-600">{t}: <b>{n}</b></span> : null;
                                })}
                            </div>

                            {gapData.sections.map((sec, si) => (
                                <div key={si} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-bold text-slate-800 text-sm">{si + 1}. {sec.title}</h3>
                                        {sec.sectionType && <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 font-bold">{sec.sectionType}</span>}
                                        <span className="text-[10px] text-slate-400">{sec.doc}</span>
                                        <div className="flex-1"></div>
                                        <span className="text-xs text-slate-500">{sec.gaps.length} gap(s)</span>
                                    </div>
                                    {sec.error ? (
                                        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2">Analysis failed: {sec.error}</p>
                                    ) : (
                                        <>
                                            {sec.summary && <p className="text-xs text-slate-600">{sec.summary}</p>}
                                            <div className="flex flex-wrap gap-1">
                                                {GAP_COMPONENTS.map(c => (
                                                    <span key={c} className={`text-[10px] border rounded px-1.5 py-0.5 ${covColor(sec.coverage[c])}`}>{c}: {sec.coverage[c]}</span>
                                                ))}
                                            </div>
                                            {sec.gaps.length === 0
                                                ? <p className="text-xs text-green-700">No gaps found in this section.</p>
                                                : <div className="space-y-2">{sec.gaps.map((g, gi) => renderGap(g, si, gi))}</div>}
                                        </>
                                    )}
                                </div>
                            ))}

                            {gapData.cross.length > 0 && (
                                <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-3">
                                    <h3 className="font-bold text-slate-800 text-sm">Cross-section gaps ({gapData.cross.length})</h3>
                                    <div className="space-y-2">{gapData.cross.map((g, gi) => renderGap(g, 'cross', gi))}</div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}
