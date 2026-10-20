/* =====================================================================
   app.js
   نقطة البداية: الحالة المشتركة بين الميزات + التنقل + التخطيط. (مفيش ميزة هنا، كل ميزة في features/).
   ===================================================================== */

function acquireVetlyAccountTabLock(userId, onState) {
    let stopped = false;
    const lockName = 'vetly-account-' + userId;
    if (navigator.locks && typeof navigator.locks.request === 'function') {
        let releaseLock;
        const hold = new Promise(resolve => { releaseLock = resolve; });
        navigator.locks.request(lockName, { ifAvailable: true }, lock => {
            if (stopped) return;
            if (!lock) { onState('blocked'); return; }
            onState('active');
            return hold;
        }).catch(error => {
            if (!stopped) {
                onState('error');
                console.error('Failed to acquire the account tab lock:', error);
            }
        });
        return () => {
            stopped = true;
            if (releaseLock) releaseLock();
        };
    }

    const key = 'vetly_active_tab_' + encodeURIComponent(userId);
    const token = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    const leaseMs = 120000;
    let heartbeat = null;
    const readLease = () => {
        try { return JSON.parse(localStorage.getItem(key) || 'null'); }
        catch (error) { console.error('Failed to read the account tab lock:', error); return null; }
    };
    const writeLease = () => {
        try { localStorage.setItem(key, JSON.stringify({ token, expiresAt: Date.now() + leaseMs })); }
        catch (error) {
            onState('error');
            console.error('Failed to persist the account tab lock:', error);
            return false;
        }
        return true;
    };
    const onStorage = event => {
        if (event.key === key && event.newValue && readLease()?.token !== token) {
            if (heartbeat) clearInterval(heartbeat);
            heartbeat = null;
            onState('blocked');
        }
    };
    window.addEventListener('storage', onStorage);
    const lease = readLease();
    if (lease && lease.token !== token && lease.expiresAt > Date.now()) {
        onState('blocked');
    } else if (writeLease()) {
        setTimeout(() => {
            if (stopped) return;
            const current = readLease();
            if (!current || current.token !== token) { onState('blocked'); return; }
            onState('active');
            heartbeat = setInterval(writeLease, 30000);
        }, 80);
    }
    return () => {
        stopped = true;
        window.removeEventListener('storage', onStorage);
        if (heartbeat) clearInterval(heartbeat);
        if (readLease()?.token === token) {
            try { localStorage.removeItem(key); }
            catch (error) { console.error('Failed to release the account tab lock:', error); }
        }
    };
}

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
    const [cloudStatus, setCloudStatus] = useState(() => {
        const project = safeJSON('wakil_cloud_project', null);
        const story = safeJSON('wakil_cloud_story', null);
        return project && project.id && story && story.id ? 'loading' : '';
    }); // '' | 'loading' | 'saving' | 'saved' | 'queued' | 'conflict' | 'error'
    const [cloudSyncInfo, setCloudSyncInfo] = useState({ pendingCount: 0, lastSavedAt: null, error: '' });
    const [cloudUser, setCloudUser] = useState(null); // بيتحدّث من Supabase auth — التطبيق مقفول من غيره
    const [tabLockStatus, setTabLockStatus] = useState('waiting');
    const [tabLockAttempt, setTabLockAttempt] = useState(0);
    const [conflictRows, setConflictRows] = useState(null);
    const [recoveryMode, setRecoveryMode] = useState(false); // لينك "نسيت كلمة السر" اتفتح من الإيميل ⇒ شاشة باسورد جديد

    useEffect(() => {
        localStorage.setItem('wakil_cloud_project', JSON.stringify(cloudProject));
    }, [cloudProject]);

    useEffect(() => {
        localStorage.setItem('wakil_cloud_story', JSON.stringify(cloudStory));
    }, [cloudStory]);

    // الحفظ التلقائي للسحابة: أول ما الداتا المحلية تتغير والحساب داخل وفي مشروع مفتوح
    useEffect(() => {
        if (!cloudUser) {
            setTabLockStatus('signedOut');
            return;
        }
        setTabLockStatus('waiting');
        return acquireVetlyAccountTabLock(cloudUser.id, setTabLockStatus);
    }, [cloudUser && cloudUser.id, tabLockAttempt]);

    useEffect(() => {
        if (tabLockStatus !== 'active') return;
        if (!sbConfigured()) return;
        sbStartAutoSave((status, details) => {
            setCloudStatus(status);
            if (details) setCloudSyncInfo(previous => ({ ...previous, ...details }));
        });
    }, [tabLockStatus]);

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
        if (tabLockStatus !== 'active' || !cloudUser || !cloudProject || !cloudProject.id || !cloudStory || !cloudStory.id) return;
        let cancelled = false;
        let stopWatching = null;
        const projectId = cloudProject.id;
        const storyId = cloudStory.id;
        const readyKey = projectId + ':' + storyId;

        const activatePending = (pending, cloudData, remoteVersion, isOffline) => {
            sbSetSnapshotVersion(projectId, pending.baseVersion);
            sbWorkspaceReplace(pending.data || {});
            window._sbReadyKey = readyKey;
            sbSwitchLock(false);
            window._sbLastSyncedFingerprint = isOffline ? '__cloud_version_unknown__' : _sbFingerprint(cloudData || {});
            const hasConflict = !isOffline && (
                pending.legacyConflict || pending.baseVersion !== (remoteVersion || null)
            );
            window._sbConflict = hasConflict;
            setCloudStatus(hasConflict ? 'conflict' : 'queued');
            setCloudSyncInfo(previous => ({ ...previous, pendingCount: Math.max(previous.pendingCount, 1) }));
            if (!hasConflict) window._sbSchedule();
            return !hasConflict;
        };

        const clearDeletedProject = async () => {
            sbSwitchLock(true);
            window._sbConflict = true;
            window._sbReadyKey = null;
            try {
                await sbRemoveQueuedProjectSnapshots(cloudUser.id, projectId);
            } catch (error) {
                console.error('The project was deleted in the cloud, but its local pending snapshots could not be cleared:', error);
            }
            if (cancelled) return;
            sbSwitchLock(false);
            sbWorkspaceClear();
            window._sbConflict = false;
            localStorage.removeItem('wakil_cloud_project');
            localStorage.removeItem('wakil_cloud_story');
            setCloudProject(null);
            setCloudStory(null);
            setCloudStatus('');
            setCloudSyncInfo({ pendingCount: 0, lastSavedAt: null, error: '' });
            setPage('projects');
            window.dispatchEvent(new Event('vetly_projects_refresh'));
        };

        const clearDeletedStory = async payload => {
            sbSwitchLock(true);
            window._sbConflict = true;
            window._sbReadyKey = null;
            try {
                await sbRemoveQueuedSnapshot(cloudUser.id, projectId, storyId);
            } catch (error) {
                console.error('The story was deleted in the cloud, but its pending snapshot could not be cleared:', error);
            }
            if (cancelled) return;
            const stories = Array.isArray(payload.stories) ? payload.stories : [];
            const nextStory = stories.find(item => item.id === payload.activeStory) || stories[0] || null;
            sbSwitchLock(!!nextStory);
            sbWorkspaceClear();
            window._sbConflict = false;
            window._sbReadyKey = null;
            setCloudSyncInfo(previous => ({ ...previous, pendingCount: Math.max(0, previous.pendingCount - 1), error: '' }));
            if (nextStory) {
                const selected = { id: nextStory.id, name: nextStory.name || 'Story' };
                localStorage.setItem('wakil_cloud_story', JSON.stringify(selected));
                setCloudStory(selected);
                setCloudStatus('loading');
            } else {
                localStorage.removeItem('wakil_cloud_story');
                setCloudStory(null);
                setCloudStatus('');
                setPage('projects');
            }
            window.dispatchEvent(new Event('vetly_projects_refresh'));
        };

        const readStory = async () => {
            setCloudSyncInfo(previous => ({ ...previous, pendingCount: 0, lastSavedAt: null, error: '' }));
            setCloudStatus('loading');
            let projectResult;
            try {
                projectResult = await sbListProjects();
            } catch (error) {
                setCloudStatus('error');
                console.error('Failed to verify the active cloud project:', error);
                return false;
            }
            if (cancelled) return false;
            if (projectResult.error) {
                setCloudStatus('error');
                console.error('Failed to verify the active cloud project:', projectResult.error);
                return false;
            }
            const currentProject = projectResult.data.find(item => item.id === projectId);
            if (!currentProject) {
                await clearDeletedProject();
                return false;
            }
            if (currentProject.name !== cloudProject.name) {
                const updatedProject = { id: projectId, name: currentProject.name };
                localStorage.setItem('wakil_cloud_project', JSON.stringify(updatedProject));
                setCloudProject(updatedProject);
            }
            let pending = null;
            let legacyData = null;
            try {
                pending = await sbGetQueuedSnapshot(cloudUser.id, projectId, storyId);
                const queuedCount = await sbGetQueuedSnapshotCount(cloudUser.id, projectId, storyId);
                setCloudSyncInfo(previous => ({ ...previous, pendingCount: queuedCount }));
                if (window._wkLegacyDataPending && sbWorkspaceHasContent()) legacyData = sbWorkspaceDump();
                else if (window._wkLegacyDataPending) window._wkLegacyDataPending = false;
                if (pending && (pending.userId !== cloudUser.id || pending.projectId !== projectId ||
                    pending.storyId !== storyId || !pending.data || typeof pending.data !== 'object' || Array.isArray(pending.data))) {
                    throw new Error('Pending offline workspace data is invalid; it was not applied.');
                }
            } catch (e) {
                setCloudStatus('error');
                console.error('Failed to read pending offline workspace changes:', e);
                return false;
            }

            let result;
            try {
                result = await sbLoadSnapshot(projectId);
            } catch (e) {
                if (!cancelled && !pending && legacyData) {
                    try {
                        pending = await sbQueueSnapshotData(cloudUser.id, projectId, storyId, legacyData, null);
                        window._wkLegacyDataPending = false;
                    } catch (queueError) {
                        setCloudStatus('error');
                        console.error('Failed to preserve legacy local workspace data:', queueError);
                        return false;
                    }
                }
                if (!cancelled && pending) {
                    activatePending(pending, {}, null, true);
                    if (navigator.onLine !== false) setCloudStatus('error');
                    console.error('Failed to load cloud workspace; local pending changes were preserved:', e);
                    return true;
                }
                if (!cancelled) { setCloudStatus('error'); console.error('Failed to load cloud workspace:', e); }
                return false;
            }
            if (cancelled) return false;
            if (result.error) {
                if (!pending && legacyData) {
                    try {
                        pending = await sbQueueSnapshotData(cloudUser.id, projectId, storyId, legacyData, null);
                        window._wkLegacyDataPending = false;
                    } catch (queueError) {
                        setCloudStatus('error');
                        console.error('Failed to preserve legacy local workspace data:', queueError);
                        return false;
                    }
                }
                if (pending) {
                    activatePending(pending, {}, null, true);
                    setCloudStatus(navigator.onLine === false ? 'queued' : 'error');
                    console.error('Failed to load cloud workspace; local pending changes were preserved:', result.error);
                    return true;
                }
                setCloudStatus('error');
                console.error('Failed to load cloud workspace:', result.error);
                return false;
            }
            const story = result.data.payload.stories.find(item => item.id === storyId);
            if (!story) {
                let latestProjects;
                try {
                    latestProjects = await sbListProjects();
                } catch (error) {
                    setCloudStatus('error');
                    console.error('Failed to verify project after the active story was missing:', error);
                    return false;
                }
                if (cancelled) return false;
                if (latestProjects.error) {
                    setCloudStatus('error');
                    console.error('Failed to verify project after the active story was missing:', latestProjects.error);
                    return false;
                }
                if (!latestProjects.data.some(item => item.id === projectId)) {
                    await clearDeletedProject();
                    return false;
                }
                await clearDeletedStory(result.data.payload);
                return false;
            }
            if (story.name && story.name !== cloudStory.name) {
                const updatedStory = { id: storyId, name: story.name };
                localStorage.setItem('wakil_cloud_story', JSON.stringify(updatedStory));
                setCloudStory(updatedStory);
            }
            if (window._sbRestorePending && window._sbReadyKey === readyKey) {
                window._sbRestorePending = false;
                sbSwitchLock(false);
                setCloudStatus('saving');
                if (window._sbSchedule) window._sbSchedule();
                return true;
            }
            const cloudData = story.data || {};
            const remoteVersion = result.data.savedAt || null;
            if (!pending && legacyData) {
                if (_sbFingerprint(legacyData) !== _sbFingerprint(cloudData)) {
                    try {
                        const cloudHasContent = sbWorkspaceHasContent(cloudData);
                        pending = await sbQueueSnapshotData(cloudUser.id, projectId, storyId, legacyData, remoteVersion, cloudHasContent);
                        window._wkLegacyDataPending = false;
                    } catch (e) {
                        setCloudStatus('error');
                        console.error('Failed to preserve legacy local workspace data:', e);
                        return false;
                    }
                } else {
                    window._wkLegacyDataPending = false;
                }
            }
            if (pending && _sbFingerprint(pending.data || {}) === _sbFingerprint(cloudData)) {
                try {
                    await sbRemoveQueuedSnapshot(cloudUser.id, projectId, storyId, pending.fingerprint);
                } catch (e) {
                    setCloudStatus('error');
                    console.error('Cloud data matches the pending copy, but its local queue could not be cleared:', e);
                }
                pending = null;
            }
            if (pending && !window._sbConflict) {
                setCloudSyncInfo(previous => ({ ...previous, pendingCount: Math.max(previous.pendingCount, 1) }));
            } else if (!pending) {
                try {
                    setCloudSyncInfo(previous => ({
                        ...previous,
                        lastSavedAt: result.data.savedAt ? Date.parse(result.data.savedAt) : previous.lastSavedAt,
                        pendingCount: 0,
                        error: ''
                    }));
                } catch (e) {
                    console.error('Failed to update sync status details:', e);
                }
            }
            if (pending) {
                activatePending(pending, cloudData, remoteVersion, false);
                if (window._sbConflict) return true;
                return true;
            }
            sbWorkspaceReplace(cloudData);
            window._sbReadyKey = readyKey;
            sbSwitchLock(false);
            window._sbConflict = false;
            setCloudStatus('saved');
            setCloudSyncInfo(previous => ({
                ...previous,
                lastSavedAt: result.data.savedAt ? Date.parse(result.data.savedAt) : previous.lastSavedAt,
                pendingCount: 0,
                error: ''
            }));
            return true;
        };

        const reloadFromCloud = async () => {
            let latest;
            try { latest = await sbLoadSnapshot(projectId); }
            catch (e) {
                setCloudStatus('error');
                console.error('Failed to reload cloud workspace:', e);
                return false;
            }
            if (latest.error) {
                setCloudStatus('error');
                console.error('Failed to reload cloud workspace:', latest.error);
                return false;
            }
            const story = latest.data.payload.stories.find(item => item.id === storyId);
            if (!story) {
                let projects;
                try { projects = await sbListProjects(); }
                catch (error) {
                    setCloudStatus('error');
                    console.error('Failed to verify the project while reloading the cloud story:', error);
                    return false;
                }
                if (projects.error) {
                    setCloudStatus('error');
                    console.error('Failed to verify the project while reloading the cloud story:', projects.error);
                    return false;
                }
                if (!projects.data.some(item => item.id === projectId)) await clearDeletedProject();
                else await clearDeletedStory(latest.data.payload);
                return true;
            }
            try { await sbRemoveQueuedSnapshot(cloudUser.id, projectId, storyId); }
            catch (e) {
                setCloudStatus('error');
                console.error('Pending local changes could not be cleared; cloud workspace was not applied:', e);
                return false;
            }
            sbWorkspaceReplace(story.data || {});
            window._sbReadyKey = readyKey;
            sbSwitchLock(false);
            window._sbConflict = false;
            setCloudStatus('saved');
            setCloudSyncInfo(previous => ({
                ...previous,
                lastSavedAt: latest.data.savedAt ? Date.parse(latest.data.savedAt) : previous.lastSavedAt,
                pendingCount: 0,
                error: ''
            }));
            return true;
        };
        window._sbReload = reloadFromCloud;
        const keepLocal = async () => {
            let projects;
            try { projects = await sbListProjects(); }
            catch (error) {
                console.error('Failed to verify the project before keeping local changes:', error);
                return { error };
            }
            if (projects.error) return { error: projects.error };
            if (!projects.data.some(item => item.id === projectId)) {
                await clearDeletedProject();
                return { error: null };
            }
            let latest;
            try { latest = await sbLoadSnapshot(projectId); }
            catch (e) {
                console.error('Failed to check the latest cloud version before keeping local changes:', e);
                return { error: e };
            }
            if (latest.error) return { error: latest.error };
            const cloudStoryData = latest.data.payload.stories.find(item => item.id === storyId);
            if (!cloudStoryData) {
                await clearDeletedStory(latest.data.payload);
                return { error: null };
            }
            const localData = sbWorkspaceDump();
            if (_sbFingerprint(localData) === _sbFingerprint(cloudStoryData.data || {})) {
                window._sbReadyKey = readyKey;
                sbSwitchLock(false);
                window._sbLastSyncedFingerprint = _sbFingerprint(cloudStoryData.data || {});
                window._sbConflict = false;
                try { await sbRemoveQueuedSnapshot(cloudUser.id, projectId, storyId); }
                catch (e) {
                    window._sbConflict = true;
                    console.error('Cloud data already matches the local copy, but its pending queue could not be cleared:', e);
                    return { error: e };
                }
                setCloudStatus('saved');
                return { error: null };
            }
            window._sbReadyKey = readyKey;
            sbSwitchLock(false);
            window._sbLastSyncedFingerprint = _sbFingerprint(cloudStoryData && cloudStoryData.data || {});
            window._sbConflict = false;
            try {
                await sbQueueSnapshotData(cloudUser.id, projectId, storyId, sbWorkspaceDump(), latest.data.savedAt);
            } catch (e) {
                window._sbConflict = true;
                console.error('Failed to preserve local changes before retrying:', e);
                return { error: e };
            }
            setCloudStatus('saving');
            if (window._sbSchedule) window._sbSchedule();
            return { error: null };
        };
        window._sbKeepLocal = keepLocal;

        const startWatching = () => {
            if (cancelled || stopWatching) return;
            stopWatching = sbWatchSnapshot(projectId, p => {
                const rec = p && p.new;
                if (rec && sbIsOwnVersion(projectId, rec.updated_at)) return;
                sbListProjects().then(async projects => {
                    if (cancelled) return;
                    if (projects.error) {
                        setCloudStatus('error');
                        console.error('Failed to verify project after a cloud update:', projects.error);
                        return;
                    }
                    if (!projects.data.some(item => item.id === projectId)) {
                        await clearDeletedProject();
                        return;
                    }
                    const latestSnapshot = await sbLoadSnapshot(projectId);
                    if (cancelled) return;
                    if (latestSnapshot.error) {
                        setCloudStatus('error');
                        console.error('Failed to check the active story after a cloud update:', latestSnapshot.error);
                        return;
                    }
                    if (!latestSnapshot.data.payload.stories.some(item => item.id === storyId)) {
                        await clearDeletedStory(latestSnapshot.data.payload);
                        return;
                    }
                    if (sbIsDirty()) { setCloudStatus('conflict'); window._sbConflict = true; return; }
                    readStory();
                }).catch(error => {
                    if (cancelled) return;
                    setCloudStatus('error');
                    console.error('Failed to verify project after a cloud update:', error);
                });
            }, status => setCloudStatus(status));
        };
        const loadAndWatch = async () => {
            const loaded = await readStory();
            if (loaded) startWatching();
            return loaded;
        };
        window._sbRetryLoad = loadAndWatch;
        loadAndWatch();
        return () => {
            cancelled = true;
            window._sbReadyKey = null;
            if (stopWatching) stopWatching();
            if (window._sbReload === reloadFromCloud) window._sbReload = null;
            if (window._sbKeepLocal === keepLocal) window._sbKeepLocal = null;
            if (window._sbRetryLoad === loadAndWatch) window._sbRetryLoad = null;
        };
    }, [tabLockStatus, cloudUser && cloudUser.id, cloudProject && cloudProject.id, cloudStory && cloudStory.id]);

    useEffect(() => {
        if (cloudStatus !== 'conflict' || !cloudProject || !cloudStory) {
            if (cloudStatus !== 'conflict') setConflictRows(null);
            return;
        }
        let cancelled = false;
        sbLoadSnapshot(cloudProject.id).then(result => {
            if (cancelled) return;
            if (result.error) {
                setConflictRows(false);
                console.error('Failed to load cloud data for conflict review:', result.error);
                return;
            }
            const story = result.data.payload.stories.find(item => item.id === cloudStory.id);
            if (!story) {
                setConflictRows(false);
                console.error('The active story was not found while preparing conflict review.');
                return;
            }
            setConflictRows(sbCompareWorkspaceSnapshots(sbWorkspaceDump(), story.data || {}));
        }).catch(error => {
            if (cancelled) return;
            setConflictRows(false);
            console.error('Failed to prepare conflict review:', error);
        });
        return () => { cancelled = true; };
    }, [cloudStatus, cloudProject && cloudProject.id, cloudStory && cloudStory.id]);

    useEffect(() => {
        const onSelectionChanged = () => {
            setCloudProject(sbGetOpenProject());
            setCloudStory(sbGetOpenStory());
        };
        const onCloudLoading = () => setCloudStatus('loading');
        window.addEventListener('vetly_cloud_selection_changed', onSelectionChanged);
        window.addEventListener('vetly_cloud_loading', onCloudLoading);
        return () => {
            window.removeEventListener('vetly_cloud_selection_changed', onSelectionChanged);
            window.removeEventListener('vetly_cloud_loading', onCloudLoading);
        };
    }, []);

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
    const reloadCloudWorkspace = async () => {
        if (!window._sbReload || !window.confirm(tr("Discard this tab's unsaved changes and reload the latest cloud copy?"))) return;
        if (!(await window._sbReload())) notify(tr('Could not reload the cloud copy. Your local changes were kept.'));
    };
    const retryCloudSync = () => {
        if (!window._sbRetrySync || !window._sbRetrySync()) {
            setCloudSyncInfo(previous => ({ ...previous, error: tr('Sync retry is not available yet.') }));
            return;
        }
        setCloudSyncInfo(previous => ({ ...previous, error: '' }));
        setCloudStatus(navigator.onLine === false ? 'queued' : 'saving');
    };
    const keepLocalWorkspace = async () => {
        if (!window._sbKeepLocal || !window.confirm(tr("Replace the cloud story with this tab's local copy? This overwrites the newer cloud version."))) return;
        const result = await window._sbKeepLocal();
        if (result.error) {
            setCloudStatus('conflict');
            notify(result.error.message || tr('Could not preserve local changes.'));
        }
    };

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
                <Sidebar page={page} setPage={setPage} bugsCount={bugStore.bugs.length} runsCount={runs.length} onOpenCloud={() => { if (!cloudUser || tabLockStatus === 'active') setCloudOpen(true); }} onOpenAgent={() => { if (tabLockStatus === 'active') setPage('agent'); }} cloudProject={cloudProject} cloudStory={cloudStory} cloudStatus={cloudStatus} cloudUser={cloudUser} onOpenSettings={() => { if (!cloudUser || tabLockStatus === 'active') setShowSettings(true); }} gapsCount={gapsCount} scenariosCount={scenariosCount} casesCount={casesCount} summaryBadge={summaryBadge} cloudSyncInfo={cloudSyncInfo} onRetrySync={retryCloudSync} />

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
                        {tabLockStatus !== 'active' ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8 bg-slate-50">
                                <AppLogo size={56} />
                                <h2 className="text-lg font-bold text-slate-800">
                                    {tabLockStatus === 'blocked' ? tr('This account is already open in another tab') : tr('Checking this account tab...')}
                                </h2>
                                <p className="text-sm text-slate-500 max-w-md">
                                    {tabLockStatus === 'blocked'
                                        ? tr('Only one active tab per account is allowed in this browser. Close the other tab, then refresh this page. You can still use this account on another device.')
                                        : tabLockStatus === 'error'
                                            ? tr('The account tab lock could not be checked. Refresh the page or close other Vetly tabs.')
                                            : tr('Please wait while Vetly checks for another active tab.')}
                                </p>
                                {(tabLockStatus === 'blocked' || tabLockStatus === 'error') && (
                                    <button onClick={() => setTabLockAttempt(value => value + 1)} className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-semibold">
                                        {tr('Recheck account tab')}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <>
                        {cloudStatus === 'conflict' && cloudProject && cloudStory && (
                            <div role="alert" className="fixed z-50 top-16 left-1/2 -translate-x-1/2 w-[min(680px,calc(100vw-2rem))] rounded-xl border border-amber-400 bg-white p-4 text-slate-900 shadow-2xl">
                                <div className="flex items-start gap-3">
                                    <span className="text-xl leading-none" aria-hidden="true">⚠</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-slate-900">{tr('This story changed in another tab or device.')}</p>
                                        <p className="mt-1 text-xs leading-5 text-slate-700">{tr("Choose which complete story copy to keep. Reloading discards this tab's pending changes; keeping local replaces the newer cloud copy.")}</p>
                                    </div>
                                </div>
                                <p className="mt-3 text-xs font-semibold text-slate-800">
                                    {conflictRows === null ? tr('Comparing story versions...') :
                                        conflictRows === false ? tr('Could not compare story versions.') :
                                            tr('Different workspace fields') + ': ' + conflictRows.length}
                                </p>
                                {Array.isArray(conflictRows) && conflictRows.length > 0 && (
                                    <ul className="mt-2 max-h-36 overflow-auto rounded-lg border border-slate-200 bg-slate-50 px-3 text-[11px] leading-5 text-slate-800">
                                        {conflictRows.slice(0, 6).map(row => (
                                            <li key={row.key} className="border-t border-slate-200 py-1.5 first:border-0">
                                                <strong className="break-all">{row.key}</strong> <span className="text-slate-600">({tr(row.change)})</span>
                                                <div className="break-words"><strong>{tr('Local')}:</strong> {row.local}</div>
                                                <div className="break-words"><strong>{tr('Cloud')}:</strong> {row.cloud}</div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <div className="mt-3 flex flex-wrap justify-end gap-2">
                                    <button onClick={reloadCloudWorkspace} className="rounded-lg border border-slate-400 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100">{tr('Reload cloud copy')}</button>
                                    <button onClick={keepLocalWorkspace} className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800">{tr('Keep this tab and overwrite cloud')}</button>
                                </div>
                            </div>
                        )}
                        {(page !== 'projects' && page !== 'agent' && cloudProject && cloudStory && window._sbReadyKey !== cloudProject.id + ':' + cloudStory.id) ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8 bg-slate-50">
                                <AppLogo size={48} />
                                <h2 className="text-lg font-bold text-slate-800">
                                    {cloudStatus === 'error' ? tr('Could not load this cloud story') : tr('Loading cloud story...')}
                                </h2>
                                <p className="text-sm text-slate-500 max-w-md">
                                    {cloudStatus === 'error'
                                        ? tr('The workspace was not replaced. Check your connection and retry; existing local data is preserved.')
                                        : tr('Please wait while Vetly loads the selected story before enabling edits.')}
                                </p>
                                {cloudStatus === 'error' && (
                                    <button
                                        onClick={async () => {
                                            if (window._sbRetryLoad && !(await window._sbRetryLoad())) setCloudStatus('error');
                                        }}
                                        className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-semibold"
                                    >
                                        {tr('Retry cloud load')}
                                    </button>
                                )}
                            </div>
                        ) : (cloudProject && cloudStory) ? (
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
