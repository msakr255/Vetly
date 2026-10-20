/* =====================================================================
   app.js
   نقطة البداية: الحالة المشتركة بين الميزات + التنقل + التخطيط. (مفيش ميزة هنا، كل ميزة في features/).
   ===================================================================== */

function App() {
    // آخر صفحة بتتحفظ: بعد حذف مشروع مفتوح والرجوع لـ My Projects، الصفحة تفضل مفتوحة
    const [page, setPage] = useState(() => localStorage.getItem('wakil_last_page') || 'generation');
    useEffect(() => { try { localStorage.setItem('wakil_last_page', page); } catch (e) { /* ignore */ } }, [page]);
    const [scHandoff, setScHandoff] = useState(null); // نص جاي من Requirement Gaps لصفحة Test Scenarios
    const [gapHandoff, setGapHandoff] = useState(null); // نص/ملفات جايين من Requirements لصفحة Requirement Analysis
    const [genHandoff, setGenHandoff] = useState(null); // نص/ملفات جايين من Requirements لصفحة Test Generation
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
    const [cloudStory, setCloudStory] = useState(() => safeJSON('wakil_cloud_story', null));
    const [cloudStatus, setCloudStatus] = useState(''); // '' | 'saving' | 'saved' | 'error'
    const [cloudUser, setCloudUser] = useState(null); // بيتحدّث من Supabase auth — التطبيق مقفول من غيره
    const [recoveryMode, setRecoveryMode] = useState(false); // لينك "نسيت كلمة السر" اتفتح من الإيميل ⇒ شاشة باسورد جديد

    useEffect(() => {
        localStorage.setItem('wakil_cloud_project', JSON.stringify(cloudProject));
    }, [cloudProject]);

    useEffect(() => {
        localStorage.setItem('wakil_cloud_story', JSON.stringify(cloudStory));
    }, [cloudStory]);

    // الحفظ التلقائي للسحابة: أول ما الداتا المحلية تتغير والحساب داخل وفي مشروع مفتوح
    useEffect(() => {
        if (!sbConfigured()) return;
        sbStartAutoSave((status) => setCloudStatus(status));
    }, []);

    // متابعة حالة الدخول: من غير Log in التطبيق كله مقفول غير الـ Settings
    useEffect(() => {
        if (!sbConfigured()) return;
        sbGetSessionUser().then(u => setCloudUser(u));
        return sbWatchAuth((u, event) => {
            setCloudUser(u);
            // المستخدم فتح لينك الاسترجاع من إيميله ⇒ نفتح شاشة كلمة السر الجديدة على طول
            if (event === 'PASSWORD_RECOVERY') { setRecoveryMode(true); setCloudOpen(true); }
        });
    }, []);

    useEffect(() => {
        if (!cloudUser || !cloudProject || !cloudProject.id || !cloudStory || !cloudStory.id) return;
        let cancelled = false;
        let stopWatching = null;
        const projectId = cloudProject.id;
        const storyId = cloudStory.id;
        const pendingKey = sbPendingSnapshotKey(projectId, storyId);
        const readStory = async (isRealtime) => {
            const result = await sbLoadSnapshot(projectId);
            if (cancelled) return;
            if (result.error) {
                setCloudStatus('error');
                console.error('Failed to load cloud workspace:', result.error);
                return;
            }
            const story = result.data.payload.stories.find(item => item.id === storyId);
            if (isRealtime && window._sbLastSyncedFingerprint && _sbFingerprint() !== window._sbLastSyncedFingerprint) {
                setCloudStatus('conflict');
                return;
            }
            sbWorkspaceReplace(story && story.data ? story.data : {});
            setCloudStatus('saved');
        };
        readStory(false).then(() => {
            if (cancelled) return;
            stopWatching = sbWatchSnapshot(projectId, () => {
                if (localStorage.getItem(pendingKey) ||
                    (window._sbLastSyncedFingerprint && _sbFingerprint() !== window._sbLastSyncedFingerprint)) {
                    setCloudStatus('conflict');
                    return;
                }
                readStory(true);
            }, status => setCloudStatus(status));
        });
        return () => {
            cancelled = true;
            if (stopWatching) stopWatching();
        };
    }, [cloudUser && cloudUser.id, cloudProject && cloudProject.id, cloudStory && cloudStory.id]);

    useEffect(() => {
        document.title = `${APP_NAME} - ${tr(APP_TAGLINE)}`;
    }, []);

    // الحفظ المحلي + رفع إصدار المحتوى عند أي تغيير فعلي (عشان كاش الترجمة يعرف إنه قديم)
    useEffect(() => {
        if (!data) return;
        const s = JSON.stringify(data);
        if (localStorage.getItem('wakil_ai_data') !== s) { localStorage.setItem('wakil_ai_data', s); _trBumpVer('wakil_ai_data'); }
    }, [data]);

    useEffect(() => {
        if (!scData) return;
        const s = JSON.stringify(scData);
        if (localStorage.getItem('wakil_sc_data') !== s) { localStorage.setItem('wakil_sc_data', s); _trBumpVer('wakil_sc_data'); }
    }, [scData]);

    useEffect(() => {
        const s = JSON.stringify(linked);
        if (localStorage.getItem('wakil_linked') !== s) { localStorage.setItem('wakil_linked', s); _trBumpVer('wakil_linked'); }
    }, [linked]);

    useEffect(() => {
        if (!gapData) return;
        const s = JSON.stringify(gapData);
        if (localStorage.getItem('wakil_gap_data') !== s) { localStorage.setItem('wakil_gap_data', s); _trBumpVer('wakil_gap_data'); }
    }, [gapData]);

    useEffect(() => {
        const s = JSON.stringify(runs);
        if (localStorage.getItem('wakil_runs') !== s) { localStorage.setItem('wakil_runs', s); _trBumpVer('wakil_runs'); }
    }, [runs]);

    const knownScenarios = () => {
        const map = new Map();
        [...(scData || []), ...linked, ...(data?.scenarios || [])].forEach(sc => { if (sc?.id && !map.has(sc.id)) map.set(sc.id, sc); });
        return [...map.values()];
    };

    const sendToScenarios = (text, images, files) => {
        setScHandoff({ text, images, files, t: Date.now() });
        setPage('scenarios');
    };

    // ---------- إرسال خامة Requirements للفيتشرز التانية ----------
    const sendReqToGaps = (payload) => { setGapHandoff({ ...payload, t: Date.now() }); setPage('gaps'); };
    const sendReqToScenarios = (payload) => sendToScenarios(payload.text, payload.images, payload.files);
    const sendReqToGeneration = (payload) => { setGenHandoff({ ...payload, t: Date.now() }); setPage('generation'); };

    const bugStore = useBugStore({ data, keys, models, knownScenarios, setPage });

    // إعادة تهيئة حالات الميزات المشتركة من الـ localStorage (بعد تبديل مشروع/ستوري — بدون reload)
    const resetFeatureStates = () => {
        const d = safeJSON('wakil_ai_data', null);
        setData(d ? sanitizeSuite(d) : null);
        setScData(sanitizeScenarioList(safeJSON('wakil_sc_data', [])));
        setLinked(sanitizeScenarioList(safeJSON('wakil_linked', [])));
        setGapData(sanitizeGapResult(safeJSON('wakil_gap_data', null)));
        setRuns(sanitizeRuns(safeJSON('wakil_runs', [])));
        bugStore.setBugs(sanitizeBugs(safeJSON('wakil_bugs', [])));
    };

    // الأيجنت بيبعت عناصر للفيتشرز (Send to feature): كتابة مباشرة في localStorage + حدث
    // ⇒ إعادة قراءة فورية هنا. الحفظ للسحابة بيجي تلقائي من الـ auto-save بعد تغيّر البصمة.
    useEffect(() => {
        const h = () => resetFeatureStates();
        window.addEventListener('vetly_feature_data_changed', h);
        return () => window.removeEventListener('vetly_feature_data_changed', h);
    }, []);

    // أرقام الـ Sidebar لكل ميزة
    const gapsCount = gapData ? flattenGaps(gapData).length : 0;
    const scenariosCount = Array.isArray(scData) ? scData.length : 0;
    const casesCount = (data && data.testCases) ? data.testCases.length : 0;
    let sbExec = 0, sbPass = 0;
    runs.forEach(r => Object.values(r.results || {}).forEach(s => { sbExec++; if (s === 'Pass') sbPass++; }));
    const summaryBadge = sbExec ? Math.round((sbPass / sbExec) * 100) + '%' : '';

    // Toast: إشعار صغير في الجنب بيختفي لوحده
    const [toast, setToast] = useState('');
    const notify = (m) => { setToast(m); setTimeout(() => setToast(''), 4000); };
    const [translating, setTranslating] = useState(false); // شاشة انتظار الترجمة الأولى: لوجو فيترلي في منتصف الشاشة

    // ---------- كاش الترجمة: تبديل لغة المحتوى المولّد (فوري من الكاش / خلفية لأول مرة) ----------
    const [lang] = useLang();
    useEffect(() => {
        const applyFeature = (key, data) => {
            if (key === 'wakil_ai_data') setData(data);
            else if (key === 'wakil_sc_data') setScData(data);
            else if (key === 'wakil_linked') setLinked(data);
            else if (key === 'wakil_gap_data') setGapData(data);
            else if (key === 'wakil_bugs') bugStore.setBugs(data);
        };
        let cancelled = false;
        aiSwapContentLang(lang, {
            begin: n => { if (!cancelled && n > 0) { setTranslating(true); notify(tr('Translating your generated content…')); } },
            step: label => { if (!cancelled) notify(tr('Translating: {f}…', { f: label })); },
            feature: applyFeature
        }).then(res => {
            if (cancelled || res.noop) return;
            setTranslating(false);
            if (res.busy) { notify(tr('Translation already in progress — one moment…')); return; }
            if (res.noKey) { notify(tr('Add at least one API key in Settings first.')); return; } // المحتوى ما اتلمسش — يعيد المحاولة عند التبديل الجاي
            if (res.failed.length) notify(tr('Translation partially failed: {f} — switch the language again to retry.', { f: res.failed.join(', ') }));
            else if (res.done.length) notify(tr('✔ Content language updated.'));
        });
        return () => { cancelled = true; setTranslating(false); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lang]);

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
                recovery={recoveryMode}
                onResetDone={() => { setRecoveryMode(false); setCloudOpen(false); notify('✔ Password updated — you are signed in.'); setPage('projects'); }}
                onResetCancel={() => setRecoveryMode(false)}
            />

            {toast && (
                <div className="fixed bottom-4 right-4 z-[60] bg-emerald-600 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
                    {toast}
                </div>
            )}

            {/* شاشة انتظار الترجمة الأولى: لوجو فيترلي في منتصف الشاشة بفيد إن/آوت — غير مانعة للاستخدام */}
            {translating && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
                    <div className="vetly-fade-loop flex flex-col items-center gap-1 bg-white/95 border border-slate-200 rounded-xl px-5 py-3 shadow-2xl">
                        <AppLogo size={38} />
                        <span className="text-sm font-bold text-slate-800 leading-tight">Vetly</span>
                        <span className="text-[11px] text-slate-500 leading-none">{tr('Translating…')}</span>
                    </div>
                </div>
            )}

            {/* مفتاح مساحة العمل: أي فتح/تبديل مشروع أو ستوري يعيد تهيئة كل الفيتشرز من الـ localStorage — من غير reload */}
            <div key={(cloudProject ? cloudProject.id : '-') + '|' + (cloudStory ? cloudStory.id : '-')} className="flex flex-1 min-h-0 overflow-hidden">
                <Sidebar page={page} setPage={setPage} bugsCount={bugStore.bugs.length} runsCount={runs.length} onOpenCloud={() => setCloudOpen(true)} onOpenAgent={() => { setPage('agent'); }} cloudProject={cloudProject} cloudStory={cloudStory} cloudStatus={cloudStatus} cloudUser={cloudUser} onOpenSettings={() => setShowSettings(true)} gapsCount={gapsCount} scenariosCount={scenariosCount} casesCount={casesCount} summaryBadge={summaryBadge} />

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
                        {(cloudProject && cloudStory) ? (
                            // ===== الميزات بتشتغل جوه مشروع مفتوح + قصة مفتوحة بس =====
                            <>
                                <div className={slot('requirements')}>
                                    <RequirementsPage onSendGaps={sendReqToGaps} onSendScenarios={sendReqToScenarios} onSendGeneration={sendReqToGeneration} />
                                </div>

                                <div className={slot('gaps')}>
                                    <GapsPage keys={keys} models={models} setShowSettings={setShowSettings} gapData={gapData} setGapData={setGapData} sendToScenarios={sendToScenarios} gapHandoff={gapHandoff} />
                                </div>

                                <div className={slot('scenarios')}>
                                    <ScenariosPage keys={keys} models={models} setShowSettings={setShowSettings} scData={scData} setScData={setScData} setLinked={setLinked} setPage={setPage} scHandoff={scHandoff} data={data} setData={setData} />
                                </div>

                                <div className={slot('generation')}>
                                    <GenerationPage
                                        keys={keys} models={models} setShowSettings={setShowSettings}
                                        data={data} setData={setData} linked={linked} setLinked={setLinked}
                                        knownScenarios={knownScenarios} setScData={setScData} genHandoff={genHandoff}
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
                        ) : page !== 'projects' && page !== 'agent' && (
                            // ===== مفيش مشروع أو قصة مفتوحة: مفيش أي ميزة شغالة =====
                            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8 bg-slate-50">
                                <span className="text-5xl">{cloudProject ? '📖' : '📁'}</span>
                                <h2 className="text-lg font-bold text-slate-800">{cloudProject ? 'No open user story' : 'No open project'}</h2>
                                <p className="text-sm text-slate-500 max-w-sm">
                                    {cloudProject
                                        ? tr('Project "{p}" is open — open an existing user story or create a new one from My Projects.', { p: cloudProject.name })
                                        : tr('All features work inside a project. Open an existing project or create a new one from My Projects.')}
                                </p>
                                <button onClick={() => setPage('projects')} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg text-sm">
                                    {cloudProject ? '📖 Go to User Stories' : '📁 Go to My Projects'}
                                </button>
                            </div>
                        )}

                        <div className={slot('projects')}>
                                            <ProjectsPage cloudProject={cloudProject} setCloudProject={setCloudProject} cloudStory={cloudStory} setCloudStory={setCloudStory} resetFeatureStates={resetFeatureStates} />
                        </div>
                        <div className={slot('agent')}>
                            <AgentPage keys={keys} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ---------- نقطة الدخول ----------
// لينك مشاركة (?share=<id>) ⇒ صفحة قراءة فقط من غير التطبيق ولا الميزات.
// من غيرها ⇒ التطبيق العادي (وبيبقى مقفول لحد تسجيل الدخول).
(function () {
    let shareId = '';
    try { shareId = new URLSearchParams(window.location.search).get('share') || ''; } catch (e) { /* ignore */ }
    const root = ReactDOM.createRoot(document.getElementById('root'));
    if (shareId && sbConfigured()) {
        root.render(<ErrorBoundary><ShareViewer shareId={shareId} /></ErrorBoundary>);
    } else if (shareId) {
        // اللينك مفتوح والمفاتيح مش متظبطة على الجهاز ده
        root.render(
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white border border-red-200 rounded-xl p-5 max-w-md text-sm text-red-700 space-y-2">
                    <p className="font-bold">Supabase key is missing.</p>
                    <p className="text-xs">Open <b>js/core/supabase-config.js</b> and paste the anon key, then reload this link.</p>
                </div>
            </div>
        );
    } else {
        root.render(<ErrorBoundary><App /></ErrorBoundary>);
    }
})();
