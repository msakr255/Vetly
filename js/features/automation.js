/* =====================================================================
   features/automation.js
   🤖 Automation Generator: تحويل الـ Test Cases إلى سكريبتات أتميشن
   - Playwright (JavaScript) أو Selenium WebDriver (Java/TestNG)
   - اختياري: App URL + HTML snippet من صفحة التطبيق (selectors حقيقية)
   - الناتج: Copy لكل TC + Download ملف واحد أو ZIP لكل الملفات
   الموديل من نفس نظام الـ ModelPicker (provider::model — والكود بدون json mode)
   ===================================================================== */

// ---------- vetly-automation-system-prompt ----------
// الـ System Prompt الافتراضي اللي بيتبعت للموديل المختار (قابل للتعديل والتطفي)
const AUTO_SYSTEM_PROMPT_DEFAULT = `# vetly-automation-system-prompt
ROLE: You are Vetly Auto — a Senior QA Automation Architect with 10+ years of hands-on experience in Selenium WebDriver and Playwright. You convert manual test cases into production-grade automation code.

HARD RULES:
1. Follow the requested framework, language, and test runner EXACTLY (imports, annotations, naming).
2. Output ONLY the code artifact in a single code block. No explanations, no plans, no apologies.
3. Keep a 1:1 mapping: every numbered manual step appears as a comment immediately above the code that implements it.
4. Every test MUST end with assertions verifying the expected result — never end with a silent action.

SELECTORS (priority order):
1) data-testid  2) id  3) name  4) label/placeholder text  5) role (getByRole)  6) CSS  7) XPath (last resort).
Use ONLY selectors that exist in the provided HTML snippet. If no snippet is provided, use the most semantic guess and add: // TODO: verify selector.

RELIABILITY:
- Never use fixed sleeps; use the framework's auto-waiting / expected conditions.
- Unique, meaningful variable names; no magic strings without a constant.
- Never swallow failures with try/catch — verify outcomes with explicit assertions.

STYLE:
- DRY: repeated flows become private helpers within the same file.
- One action per line; group Arrange / Act / Assert with comments.

DATA:
- Use the provided test data literally. If you must invent extra data, mark it with: // GENERATED DATA.`;

// ---------- مساعدات تسمية ----------
function tcSlug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'test'; }
function tcDigits(id) { const m = String(id || '').match(/\d+/g); return m ? m.join('').padStart(2, '0') : '00'; }
function javaClassName(tc) {
    const words = tcSlug(tc.title).split('-').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join('');
    return ('TC' + tcDigits(tc.id) + words).replace(/[^A-Za-z0-9]/g, '').slice(0, 60) || 'GeneratedTest';
}
function automationFileName(tc, framework) {
    return framework === 'selenium-java' ? javaClassName(tc) + '.java' : 'TC' + tcDigits(tc.id) + '-' + tcSlug(tc.title) + '.spec.js';
}
// استخراج الكود من رد الموديل (بيشيل أسوار الماركداون لو موجودة)
function extractCodeBlock(text) {
    const m = /```[a-zA-Z]*\s*\n([\s\S]*?)```/.exec(text || '');
    return (m ? m[1] : (text || '')).trim();
}

// ---------- بناء البرومبت ----------
function tcAutomationBlock(tc) {
    return [
        `TEST CASE ${tc.id}:`,
        `- Title: ${tc.title}`,
        `- Steps:\n${(tc.steps || []).map((s, j) => `  ${j + 1}. ${s}`).join('\n') || '  (none listed)'}`,
        `- Test data: ${tc.testData || 'as per steps'}`,
        `- Expected result: ${tc.expected || 'as per title'}`,
        `- Pre-conditions: ${tc.preCondition || 'none mentioned'}`
    ].join('\n');
}

function buildAutomationPrompt(tcs, framework, opts) {
    const multi = tcs.length > 1;
    const htmlBlock = opts.html ? `\n\nHTML SNIPPET OF THE APPLICATION PAGE (use these REAL selectors — prefer data-testid, then id, then name, then visible text):\n\`\`\`html\n${opts.html}\n\`\`\`` : '';
    const urlLine = opts.appUrl ? `Application base URL: ${opts.appUrl}` : 'Application base URL: not provided — define a BASE_URL constant at the top with a // TODO comment.';

    if (framework === 'playwright-js') {
        return `You are a Senior QA Automation Engineer. Convert the following manual test case(s) into an automated test script using **Playwright with JavaScript** (@playwright/test).
${urlLine}
${multi ? `Generate ONE spec file containing ONE test block for EACH test case below, in the same order, with the test case id at the start of each test title (e.g. "[TC-01] ..."). Total: ${tcs.length} test(s).` : 'Generate ONE test block for the single test case below.'}
STRICT RULES:
1. Output ONLY code — no explanations before or after. Wrap the whole code in one \`\`\`javascript block.
2. Start with: import { test, expect } from '@playwright/test';
3. Inside each test body: list every manual step as a numbered comment, with the automation code for that step right under it.
4. Selectors: prefer data-testid, then id, then name attribute, then getByLabel/getByPlaceholder, then getByRole. ${opts.html ? 'Use the REAL selectors from the HTML snippet below.' : 'The DOM is not provided, so use reasonable role/label selectors and add // TODO: verify selector where unsure.'}
5. End each test with expect() assertions verifying the expected result.
6. Use realistic waits; avoid hardcoded timeouts unless strictly necessary.

TEST CASES:
${tcs.map(tcAutomationBlock).join('\n\n')}${htmlBlock}`;
    }

    // selenium-java
    const className = multi ? 'GeneratedTests' : javaClassName(tcs[0]);
    return `You are a Senior QA Automation Engineer. Convert the following manual test case(s) into an automated test class using **Selenium WebDriver with Java and TestNG**.
${urlLine}
${multi ? `Generate ONE Java class named ${className} containing ONE @Test method for EACH test case below, in the same order, with the test case id in the method name (e.g. tc01_...). Total: ${tcs.length} test(s).` : `Generate ONE Java class named ${className} with a single @Test method.`}
STRICT RULES:
1. Output ONLY Java code — no explanations before or after. Wrap the whole code in one \`\`\`java block.
2. No package line (add a // TODO package comment instead). Use TestNG: @BeforeClass/@AfterClass for WebDriver setup/teardown, @Test per case.
3. Inside each @Test: list every manual step as a numbered comment, with the automation code for that step right under it.
4. Locators: prefer By.id, By.name, By.cssSelector("[data-testid='...']"), then visible-text XPaths. ${opts.html ? 'Use the REAL selectors from the HTML snippet below.' : 'The DOM is not provided, so use reasonable locators and add // TODO: verify locator where unsure.'}
5. Use TestNG Assert to verify the expected result of each test.

TEST CASES:
${tcs.map(tcAutomationBlock).join('\n\n')}${htmlBlock}`;
}

function automationReadme(framework) {
    if (framework === 'playwright-js') {
        return [
            'PLAYWRIGHT (JavaScript) — how to run',
            '===================================',
            '1. npm init -y',
            '2. npm i -D @playwright/test',
            '3. npx playwright install',
            '4. Put the .spec.js files in a "tests" folder (or adjust playwright.config.js).',
            '5. npx playwright test',
            '',
            'NOTES:',
            '- Replace the BASE_URL / // TODO selectors with the real ones from your application.',
            '- The numbered comments inside each test are the original manual steps.'
        ].join('\n');
    }
    return [
        'SELENIUM WEBDRIVER (Java + TestNG) — how to run',
        '===============================================',
        'Maven dependencies:',
        '  - org.seleniumhq.selenium:selenium-java:4.x',
        '  - org.testng:testng:7.x',
        '  - io.github.bonigarcia:webdrivermanager:5.x (optional, manages the driver)',
        '',
        '1. Put the .java files in src/test/java.',
        '2. Run with testng.xml or: mvn test',
        '',
        'NOTES:',
        '- Replace // TODO locators with the real ones from your application.',
        '- The numbered comments inside each @Test are the original manual steps.'
    ].join('\n');
}

// ---------- المودال ----------
function AutomationModal({ open, onClose, tcs, keys }) {
    const [framework, setFramework] = useState('playwright-js');
    const [structure, setStructure] = useState('per-file'); // per-file | combined
    const [appUrl, setAppUrl] = useState(() => localStorage.getItem('wakil_auto_url') || '');
    const [html, setHtml] = useState(() => localStorage.getItem('wakil_auto_html') || '');
    const [autoProvider, setAutoProvider] = useState(() => (localStorage.getItem('wakil_model_automation') || '').split('::')[0]);
    const [autoModel, setAutoModel] = useState(() => (localStorage.getItem('wakil_model_automation') || '').split('::')[1] || '');
    const [skillsOn, setSkillsOn] = useState(() => localStorage.getItem('wakil_auto_skills_on') !== '0');
    const [skillsText, setSkillsText] = useState(() => localStorage.getItem('wakil_auto_skills_text') || AUTO_SYSTEM_PROMPT_DEFAULT);
    const [skillsOpen, setSkillsOpen] = useState(false);
    const [results, setResults] = useState([]); // [{ tcId, title, code, file }]
    const [steps, setSteps] = useState([]);
    const [busy, setBusy] = useState(false);

    useEffect(() => { try { localStorage.setItem('wakil_auto_skills_on', skillsOn ? '1' : '0'); } catch (e) { /* ignore */ } }, [skillsOn]);
    useEffect(() => { try { localStorage.setItem('wakil_auto_skills_text', skillsText); } catch (e) { /* ignore */ } }, [skillsText]);

    useEffect(() => { try { localStorage.setItem('wakil_auto_url', appUrl); } catch (e) { /* ignore */ } }, [appUrl]);
    useEffect(() => { try { localStorage.setItem('wakil_auto_html', html); } catch (e) { /* ignore */ } }, [html]);
    useEffect(() => { try { localStorage.setItem('wakil_model_automation', autoProvider + '::' + autoModel); } catch (e) { /* ignore */ } }, [autoProvider, autoModel]);

    const step = (line) => setSteps(prev => [...prev.slice(-8), line]);

    const generate = async () => {
        const list = tcs || [];
        if (!list.length) { step('⚠️ No test cases selected.'); return; }
        if (!autoProvider) { step('⚠️ حط مفتاح API واحد على الأقل في Settings الأول.'); return; }
        const p = getAllProviders().find(x => x.id === autoProvider);
        if (!p) { step('⚠️ Provider not found.'); return; }
        setBusy(true); setResults([]); setSteps([]);
        const opts = { jsonMode: false, systemPrompt: (skillsOn && skillsText.trim()) ? skillsText : '' }; // الكود مش JSON — نطفي response_format + نبعث الـ system prompt
        try {
            if (structure === 'combined') {
                step(`📝 Generating ONE combined ${framework === 'playwright-js' ? 'Playwright spec' : 'TestNG class'} for ${list.length} test case(s)…`);
                const prompt = buildAutomationPrompt(list, framework, { appUrl, html });
                const text = await callProvider(p, (keys[p.id] || '').trim(), prompt, [], autoModel, opts);
                const code = extractCodeBlock(text);
                const file = framework === 'playwright-js' ? 'automation-suite.spec.js' : 'GeneratedTests.java';
                setResults([{ tcId: 'ALL', title: `Combined suite (${list.length} test cases)`, code, file }]);
                step(`✅ Combined script ready (${Math.round(code.length / 1024 * 10) / 10} KB)`);
            } else {
                let done = 0;
                for (const tc of list) {
                    step(`🤖 ${tc.id}: generating script…`);
                    const prompt = buildAutomationPrompt([tc], framework, { appUrl, html });
                    try {
                        const text = await callProvider(p, (keys[p.id] || '').trim(), prompt, [], autoModel, opts);
                        const code = extractCodeBlock(text);
                        setResults(prev => [...prev, { tcId: tc.id, title: tc.title, code, file: automationFileName(tc, framework) }]);
                        done++;
                        step(`✅ ${tc.id}: script ready (${Math.round(code.length / 1024 * 10) / 10} KB)`);
                    } catch (e) {
                        step(`❌ ${tc.id}: ${e.message}`);
                    }
                }
                step(`🏁 Done — ${done}/${list.length} script(s) generated.`);
            }
        } finally {
            setBusy(false);
        }
    };

    const copyOne = async (code) => {
        try { await navigator.clipboard.writeText(code); alert('تم نسخ الكود ✔'); }
        catch (e) { window.prompt('انسخ الكود من هنا:', code); }
    };
    const downloadOne = (r) => downloadBlob(new Blob([r.code], { type: 'text/plain;charset=utf-8' }), r.file);
    const downloadCombined = () => {
        if (framework === 'playwright-js') {
            // دمج بسيط: بنشيل أسطر الاستيراد المكررة ونجمع البلوكات
            const body = results.map(r => r.code.replace(/^import[\s\S]*?from '@playwright\/test';\s*/m, '')).join('\n\n');
            const header = "import { test, expect } from '@playwright/test';\n\n";
            downloadBlob(new Blob([header + body], { type: 'text/plain;charset=utf-8' }), 'automation-suite.spec.js');
        } else {
            const joined = results.map(r => r.code).join('\n\n');
            downloadBlob(new Blob([joined], { type: 'text/plain;charset=utf-8' }), 'GeneratedTests.java');
        }
    };
    const downloadZip = async () => {
        try { await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'); }
        catch (e) { alert('تعذر تحميل مكتبة الضغط. نزّل الملفات واحدة واحدة.'); return; }
        const zip = new window.JSZip();
        results.forEach(r => zip.file(r.file, r.code));
        zip.file('README.txt', automationReadme(framework));
        const blob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(blob, framework === 'playwright-js' ? 'playwright-tests.zip' : 'selenium-tests.zip');
    };

    if (!open) return null;
    const inp = 'w-full border border-slate-300 rounded p-2 text-sm bg-white';
    const sel = 'border border-slate-300 rounded p-2 text-sm bg-white';

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="bg-white rounded-xl p-5 w-[720px] max-w-[95vw] max-h-[92vh] overflow-y-auto shadow-xl space-y-3">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">🤖 Automation Generator</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800">✕</button>
                </div>

                {/* الإعدادات */}
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Framework</label>
                            <select className={sel + ' w-full'} value={framework} onChange={e => setFramework(e.target.value)}>
                                <option value="playwright-js">Playwright (JavaScript)</option>
                                <option value="selenium-java">Selenium (Java / TestNG)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Provider &amp; Model</label>
                            <ProviderModelPicker provider={autoProvider} model={autoModel} onProvider={setAutoProvider} onModel={setAutoModel} keys={keys} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">App URL (optional)</label>
                            <input className={inp} value={appUrl} onChange={e => setAppUrl(e.target.value)} placeholder="https://your-app.com" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Output</label>
                            <select className={sel + ' w-full'} value={structure} onChange={e => setStructure(e.target.value)}>
                                <option value="per-file">One file per test case (ZIP)</option>
                                <option value="combined">One combined file for the suite</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            HTML snippet (optional — للـ selectors الحقيقية)
                        </label>
                        <textarea className={inp} rows="3" value={html} onChange={e => setHtml(e.target.value)}
                            placeholder="من DevTools: كليك يمين على الصفحة → Copy → Copy outerHTML والصقه هنا…" />
                    </div>
                    {/* ---------- vetly-automation-system-prompt ---------- */}
                    <div className="border border-slate-200 rounded-lg p-2 space-y-1.5">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                            <input type="checkbox" checked={skillsOn} onChange={e => setSkillsOn(e.target.checked)} />
                            <span>🧠 Skills — send <b>vetly-automation-system-prompt</b> to the model</span>
                        </label>
                        {skillsOn && (
                            <>
                                <textarea
                                    className="w-full border border-slate-300 rounded p-2 text-[11px] font-mono bg-white"
                                    rows="9"
                                    value={skillsText}
                                    onChange={e => setSkillsText(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <button onClick={() => setSkillsText(AUTO_SYSTEM_PROMPT_DEFAULT)} className="text-[11px] text-slate-600 border border-slate-200 rounded px-2 py-1 hover:bg-slate-100">↺ Reset to default</button>
                                    <span className="text-[10px] text-slate-400 self-center">بيتبعت للموديل كسجل system حقيقي — عدّله بأسلوبك وسكيلزك</span>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex gap-2 items-center">
                        <button onClick={generate} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                            {busy ? '⏳ Generating…' : `🤖 Generate scripts (${(tcs || []).length} test case(s))`}
                        </button>
                        {results.length > 0 && structure === 'per-file' && (
                            <button onClick={downloadZip} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg text-sm">
                                ⬇ Download ZIP ({results.length})
                            </button>
                        )}
                        {results.length > 0 && structure === 'combined' && (
                            <button onClick={downloadCombined} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg text-sm">
                                ⬇ Download file
                            </button>
                        )}
                    </div>
                </div>

                {/* الخطوات */}
                {steps.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded p-2 text-[11px] space-y-0.5 max-h-36 overflow-y-auto">
                        {steps.map((s, i) => <div key={i} className={s.startsWith('❌') ? 'text-red-600' : s.startsWith('✅') ? 'text-emerald-700' : s.startsWith('⚠️') ? 'text-amber-700' : 'text-slate-600'}>{s}</div>)}
                    </div>
                )}

                {/* النتائج */}
                {results.map(r => (
                    <div key={r.file + r.tcId} className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="bg-slate-100 px-3 py-2 flex items-center gap-2 text-xs">
                            <span className="font-bold text-blue-700">{r.tcId === 'ALL' ? '📦' : r.tcId}</span>
                            <span className="flex-1 text-slate-700 truncate">{r.title}</span>
                            <button onClick={() => copyOne(r.code)} className="text-blue-600 hover:underline">Copy</button>
                            <button onClick={() => downloadOne(r)} className="text-slate-600 hover:underline">⬇ {r.file}</button>
                        </div>
                        <pre className="bg-slate-900 text-slate-100 text-[11px] p-3 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre">{r.code}</pre>
                    </div>
                ))}
            </div>
        </div>
    );
}
