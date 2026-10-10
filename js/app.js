/* =====================================================================
   app.js
   نقطة البداية: الحالة المشتركة بين الميزات + التنقل + التخطيط. (مفيش ميزة هنا، كل ميزة في features/).
   ===================================================================== */

function App() {
    const [page, setPage] = useState('generation');
    const [scHandoff, setScHandoff] = useState(null); // نص جاي من Requirement Gaps لصفحة Test Scenarios
    const [showSettings, setShowSettings] = useState(false);
    const { keys, setKeys, models, setModels } = useApiSettings();

    // الحالة المشتركة بين أكتر من ميزة
    const [data, setData] = useState(() => { const d = safeJSON('wakil_ai_data', null); return d ? sanitizeSuite(d) : null; });
    const [scData, setScData] = useState(() => { const d = safeJSON('wakil_sc_data', null); return d ? sanitizeScenarioList(d) : null; });
    const [linked, setLinked] = useState(() => sanitizeScenarioList(safeJSON('wakil_linked', [])));
    const [gapData, setGapData] = useState(() => sanitizeGapResult(safeJSON('wakil_gap_data', null)));

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

            <div className="flex flex-1 min-h-0 overflow-hidden">
                <Sidebar page={page} setPage={setPage} bugsCount={bugStore.bugs.length} />

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
                        bugFor={bugStore.bugFor} failedWithoutBug={bugStore.failedWithoutBug}
                        sendToBugs={bugStore.sendToBugs} bugBusy={bugStore.bugBusy} viewBug={bugStore.viewBug}
                        setPage={setPage}
                    />
                </div>

                <div className={slot('bugs')}>
                    <BugsPage store={bugStore} data={data} setShowSettings={setShowSettings} />
                </div>
            </div>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>);
