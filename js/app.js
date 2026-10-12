/* =====================================================================
   app.js
   نقطة البداية: الحالة المشتركة بين الميزات + التنقل + التخطيط. (مفيش ميزة هنا، كل ميزة في features/).
   ===================================================================== */

function App() {
    // آخر صفحة بتتحفظ: بعد حذف مشروع مفتوح والرجوع لـ My Projects، الصفحة تفضل مفتوحة
    const [page, setPage] = useState(() => localStorage.getItem('wakil_last_page') || 'generation');
    useEffect(() => { try { localStorage.setItem('wakil_last_page', page); } catch (e) { /* ignore */ } }, [page]);
    const [scHandoff, setScHandoff] = useState(null); // نص جاي من Requirement Gaps لصفحة Test Scenarios
    const [showSettings, setShowSettings] = useState(false);
    const { keys, setKeys, models, setModels } = useApiSettings();

    // الحالة المشتركة بين أكتر من ميزة
    const [data, setData] = useState(() => { const d = safeJSON('wakil_ai_data', null); return d ? sanitizeSuite(d) : null; });
    const [scData, setScData] = useState(() => { const d = safeJSON('wakil_sc_data', null); return d ? sanitizeScenarioList(d) : null; });
    const [linked, setLinked] = useState(() => sanitizeScenarioList(safeJSON('wakil_linked', [])));
    const [gapData, setGapData] = useState(() => sanitizeGapResult(safeJSON('wakil_gap_data', null)));
    const [runs, setRuns] = useState(() => sanitizeRuns(safeJSON('wakil_runs', [])));
    const [cloudOpen, setCloudOpen] = useState(false);
    const [cloudProject, setCloudProject] = useState(() => safeJSON('wakil_cloud_project', null));
    const [cloudStatus, setCloudStatus] = useState(''); // '' | 'saving' | 'saved' | 'error'
    const [cloudUser, setCloudUser] = useState(null); // بيتحدّث من Supabase auth — التطبيق مقفول من غيره

    useEffect(() => {
        localStorage.setItem('wakil_cloud_project', JSON.stringify(cloudProject));
    }, [cloudProject]);

    // الحفظ التلقائي للسحابة: أول ما الداتا المحلية تتغير والحساب داخل وفي مشروع مفتوح
    useEffect(() => {
        if (!sbConfigured()) return;
        sbStartAutoSave((status) => setCloudStatus(status));
    }, []);

    // متابعة حالة الدخول: من غير Log in التطبيق كله مقفول غير الـ Settings
    useEffect(() => {
        if (!sbConfigured()) return;
        sbGetSessionUser().then(u => setCloudUser(u));
        return sbWatchAuth(u => setCloudUser(u));
    }, []);

    useEffect(() => {
        document.title = `${APP_NAME} - ${tr(APP_TAGLINE)}`;
    }, []);

    useEffect(() => {
        if (data) localStorage.setItem('wakil_ai_data', JSON.stringify(data));
    }, [data]);

    useEffect(() => {
        if (scData) localStorage.setItem('wakil_sc_data', JSON.stringify(scData));
    }, [scData]);

    useEffect(() => {
        localStorage.setItem('wakil_linked', JSON.stringify(linked));
    }, [linked]);

    useEffect(() => {
        if (gapData) localStorage.setItem('wakil_gap_data', JSON.stringify(gapData));
    }, [gapData]);

    useEffect(() => {
        localStorage.setItem('wakil_runs', JSON.stringify(runs));
    }, [runs]);

    const knownScenarios = () => {
        const map = new Map();
        [...(scData || []), ...linked, ...(data?.scenarios || [])].forEach(sc => { if (sc?.id && !map.has(sc.id)) map.set(sc.id, sc); });
        return [...map.values()];
    };

    const sendToScenarios = (text, images) => {
        setScHandoff({ text, images, t: Date.now() });
        setPage('scenarios');
    };

    const bugStore = useBugStore({ data, keys, models, knownScenarios, setPage });

    // أرقام الـ Sidebar لكل ميزة
    const gapsCount = gapData ? flattenGaps(gapData).length : 0;
    const scenariosCount = knownScenarios().length;
    const casesCount = (data && data.testCases) ? data.testCases.length : 0;
    let sbExec = 0, sbPass = 0;
    runs.forEach(r => Object.values(r.results || {}).forEach(s => { sbExec++; if (s === 'Pass') sbPass++; }));
    const summaryBadge = sbExec ? Math.round((sbPass / sbExec) * 100) + '%' : '';

    // Toast: إشعار صغير في الجنب بيختفي لوحده
    const [toast, setToast] = useState('');
    const notify = (m) => { setToast(m); setTimeout(() => setToast(''), 4000); };

    // كل الصفحات متحمّلة دايماً وبنخفي اللي مش مفتوحة (عشان الشغل الجاري ما يضيعش لما تغيّر الصفحة)
    const slot = (id) => page === id ? 'flex flex-1 min-w-0 min-h-0' : 'hidden';

    return (
        <div className="flex flex-col flex-1 min-h-0 bg-slate-50 overflow-hidden" >
            <SettingsModal
                open={showSettings}
                onClose={() => setShowSettings(false)}
                keys={keys} setKeys={setKeys}
                models={models} setModels={setModels}
            />

            <CloudModal
                open={cloudOpen}
                onClose={() => setCloudOpen(false)}
                cloudUser={cloudUser}
                cloudProject={cloudProject} setCloudProject={setCloudProject}
                onSignedIn={() => { setCloudOpen(false); notify('✔ Signed in successfully — welcome!'); setPage('projects'); }}
            />

            {toast && (
                <div className="fixed bottom-4 right-4 z-[60] bg-emerald-600 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
                    {toast}
                </div>
            )}

            <div className="flex flex-1 min-h-0 overflow-hidden">
                <Sidebar page={page} setPage={setPage} bugsCount={bugStore.bugs.length} runsCount={runs.length} onOpenCloud={() => setCloudOpen(true)} cloudProject={cloudProject} cloudStatus={cloudStatus} cloudUser={cloudUser} onOpenSettings={() => setShowSettings(true)} gapsCount={gapsCount} scenariosCount={scenariosCount} casesCount={casesCount} summaryBadge={summaryBadge} />

                {!cloudUser ? (
                    // ===== بوابة اللوجين: من غير حساب مفيش استخدام خالص غير الـ Settings =====
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8 bg-slate-50">
                        <AppLogo size={56} />
                        <h2 className="text-lg font-bold text-slate-800">Sign in to start working</h2>
                        <p className="text-sm text-slate-500 max-w-sm">
                            الحساب بيتيقي شغلك في السحابة: مشاريع منفصلة، حفظ تلقائي، وفتح من أي جهاز.
                            اعمل حساب جديد أو ادخل بحسابك.
                        </p>
                        <button onClick={() => setCloudOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg text-sm">
                            ☁ Sign in / Create account
                        </button>
                        <button onClick={() => setShowSettings(true)} className="text-xs text-slate-500 hover:underline">
                            ⚙ API keys settings
                        </button>
                    </div>
                ) : (
                    <>
                        {cloudProject ? (
                            // ===== الميزات بتشتغل جوه مشروع مفتوح بس =====
                            <>
                                <div className={slot('gaps')}>
                                    <GapsPage keys={keys} models={models} setShowSettings={setShowSettings} gapData={gapData} setGapData={setGapData} sendToScenarios={sendToScenarios} />
                                </div>

                                <div className={slot('scenarios')}>
                                    <ScenariosPage keys={keys} models={models} setShowSettings={setShowSettings} scData={scData} setScData={setScData} setLinked={setLinked} setPage={setPage} scHandoff={scHandoff} />
                                </div>

                                <div className={slot('generation')}>
                                    <GenerationPage
                                        keys={keys} models={models} setShowSettings={setShowSettings}
                                        data={data} setData={setData} linked={linked} setLinked={setLinked}
                                        knownScenarios={knownScenarios}
                                    />
                                </div>

                                <div className={slot('bugs')}>
                                    <BugsPage store={bugStore} data={data} runs={runs} scData={scData} setShowSettings={setShowSettings} />
                                </div>

                                <div className={slot('runs')}>
                                    <RunsPage
                                        data={data} runs={runs} setRuns={setRuns} bugs={bugStore.bugs}
                                        setPage={setPage} project={bugStore.bugProject}
                                        sendToBugs={bugStore.sendToBugs} bugBusy={bugStore.bugBusy}
                                        removeBugForTestCase={bugStore.removeBugForTestCase} scData={scData}
                                        viewBug={bugStore.viewBug}
                                    />
                                </div>

                                <div className={slot('summary')}>
                                    <SummaryPage gapData={gapData} scData={scData} data={data} bugs={bugStore.bugs} runs={runs} setPage={setPage} />
                                </div>
                            </>
                        ) : page !== 'projects' && (
                            // ===== مفيش مشروع مفتوح: مفيش أي ميزة شغالة =====
                            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8 bg-slate-50">
                                <span className="text-5xl">📁</span>
                                <h2 className="text-lg font-bold text-slate-800">No open project</h2>
                                <p className="text-sm text-slate-500 max-w-sm">
                                    كل الميزات بتشتغل جوه مشروع. افتح مشروع موجود أو اعمل واحد جديد من My Projects.
                                </p>
                                <button onClick={() => setPage('projects')} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg text-sm">
                                    📁 Go to My Projects
                                </button>
                            </div>
                        )}

                        <div className={slot('projects')}>
                            <ProjectsPage cloudProject={cloudProject} setCloudProject={setCloudProject} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>);
