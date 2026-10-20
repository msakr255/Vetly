/* =====================================================================
   components/Sidebar.js
   القائمة الجانبية (الميزات الأربعة). لإضافة ميزة جديدة ضيف زرار هنا.
   ===================================================================== */

function Sidebar({ page, setPage, bugsCount, runsCount, onOpenCloud, onOpenAgent, cloudProject, cloudStory, cloudStatus, cloudUser, onOpenSettings, gapsCount, scenariosCount, casesCount, summaryBadge, cloudSyncInfo, onRetrySync }) {
    return (
        <aside className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-6 px-2">
                                <AppLogo size={36} />
                                <div>
                                    <h1 className="font-bold text-slate-800 text-base leading-tight">{APP_NAME}</h1>
                                    <p className="text-xs text-slate-400">{APP_TAGLINE}</p>
                                </div>
                                <button data-theme-toggle type="button" class="text-sm px-5 hover:opacity-70 transition" aria-label="Toggle dark mode">🌙</button>

                            </div>
                            <div className="space-y-1 px-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Modules</p>
                                {/* الميزات بتظهر بس لما تكون داخل + فاتح مشروع + فاتح قصة */}
                                {cloudUser && cloudProject && cloudStory && (
                                    <>
                                    <button
                                        onClick={() => setPage('requirements')}
                                        className={`w-full flex items-center gap-2 p-2 rounded-lg font-medium text-xs text-left ${page === 'requirements' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        <span>📋</span>
                                        <span>Requirements</span>
                                    </button>
                                    <button
                                        onClick={() => setPage('gaps')}
                                        className={`w-full flex items-center gap-2 p-2 rounded-lg font-medium text-xs text-left ${page === 'gaps' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        <span>🔍</span>
                                        <span>Requirement Analysis</span>
                                        {gapsCount > 0 && <span className="ml-auto bg-blue-100 text-blue-700 rounded-full px-1.5 text-[10px] font-bold">{gapsCount}</span>}
                                    </button>
                                    <button
                                        onClick={() => setPage('scenarios')}
                                        className={`w-full flex items-center gap-2 p-2 rounded-lg font-medium text-xs text-left ${page === 'scenarios' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        <span>📋</span>
                                        <span>Test Scenarios</span>
                                        {scenariosCount > 0 && <span className="ml-auto bg-blue-100 text-blue-700 rounded-full px-1.5 text-[10px] font-bold">{scenariosCount}</span>}
                                    </button>
                                    <button
                                        onClick={() => setPage('generation')}
                                        className={`w-full flex items-center gap-2 p-2 rounded-lg font-medium text-xs text-left ${page === 'generation' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        <span>⚡</span>
                                        <span>Test Generation</span>
                                        {casesCount > 0 && <span className="ml-auto bg-blue-100 text-blue-700 rounded-full px-1.5 text-[10px] font-bold">{casesCount}</span>}
                                    </button>
                                    <button
                                        onClick={() => setPage('runs')}
                                        className={`w-full flex items-center gap-2 p-2 rounded-lg font-medium text-xs text-left ${page === 'runs' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        <span>🏃</span>
                                        <span>Test Runs</span>
                                        {runsCount > 0 && <span className="ml-auto bg-blue-100 text-blue-700 rounded-full px-1.5 text-[10px] font-bold">{runsCount}</span>}
                                    </button>
                                    <button
                                        onClick={() => setPage('bugs')}
                                        className={`w-full flex items-center gap-2 p-2 rounded-lg font-medium text-xs text-left ${page === 'bugs' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        <span>🐞</span>
                                        <span>Bug Report</span>
                                        {bugsCount > 0 && <span className="ml-auto bg-red-100 text-red-700 rounded-full px-1.5 text-[10px] font-bold">{bugsCount}</span>}
                                    </button>
                                    <button
                                        onClick={() => setPage('summary')}
                                        className={`w-full flex items-center gap-2 p-2 rounded-lg font-medium text-xs text-left ${page === 'summary' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        <span>📈</span>
                                        <span>Summary Report</span>
                                        {summaryBadge && <span className="ml-auto bg-emerald-100 text-emerald-700 rounded-full px-1.5 text-[10px] font-bold">{summaryBadge}</span>}
                                    </button>
                                    </>
                                )}
                                    {/* My Projects متاحة دايمًا لما تكون داخل — منها بتفتح/تعمل المشاريع */}
                                    {cloudUser && (
                                    <button
                                        onClick={() => setPage('projects')}
                                        className={`w-full flex items-center gap-2 p-2 rounded-lg font-medium text-xs text-left ${page === 'projects' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        <span>📁</span>
                                        <span>My Projects</span>
                                        {cloudProject && <span className="ml-auto text-[10px] font-bold text-emerald-700 truncate max-w-[140px]">{cloudProject.name}{cloudStory ? <span className="text-slate-500 font-medium"> ({cloudStory.name})</span> : ''}</span>}
                                    </button>
                                    )}
                                {!cloudUser && (
                                    <p className="text-[11px] text-slate-400 px-1 py-2">Sign in to unlock all modules.</p>
                                )}
                                {cloudUser && cloudProject && !cloudStory && (
                                    <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-2">No open story — open or create one from My Projects.</p>
                                )}
                            </div>
                        </div>
                    <div className="px-2">
                        <button
                            onClick={onOpenCloud}
                            className={`w-full flex items-center gap-2 p-2 mb-2 rounded-lg font-medium text-xs text-left border ${cloudProject ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                        >
                            <span>👤</span>
                            <span className="flex-1">Account</span>
                            {cloudProject
                                ? (cloudStatus === 'saving' ? <span className="text-[10px] font-bold text-amber-600">⏳</span>
                                    : cloudStatus === 'queued' ? <span className="text-[10px] font-bold text-amber-600" title={tr('Pending changes are stored in this browser and will sync when the connection returns')}>◷</span>
                                    : cloudStatus === 'offline' ? <span className="text-[10px] font-bold text-amber-600" title={tr('Offline. New changes will be queued for sync when the connection returns.')}>◷</span>
                                    : cloudStatus === 'conflict' ? <span className="text-[10px] font-bold text-orange-600" title="Cloud changes conflict with local edits. Reload the story before continuing.">↔</span>
                                    : cloudStatus === 'error' ? <span className="text-[10px] font-bold text-red-600" title="Cloud sync or live updates failed">⚠</span>
                                    : <span className="text-[10px] font-bold text-emerald-700" title="Cloud changes synchronized">✔</span>)
                                : null}
                        </button>
                        <button
                            onClick={() => onOpenAgent()}
                            className={`w-full flex items-center gap-2 p-2 mb-2 rounded-lg font-medium text-xs text-left border ${cloudProject ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                        >
                            <span>🤖</span>
                            <span className="flex-1">Vetly Agent</span>
                            {cloudProject
                                ? (cloudStatus === 'saving' ? <span className="text-[10px] font-bold text-amber-600">⏳</span>
                                    : cloudStatus === 'queued' ? <span className="text-[10px] font-bold text-amber-600" title={tr('Pending changes are stored in this browser and will sync when the connection returns')}>◷</span>
                                    : cloudStatus === 'offline' ? <span className="text-[10px] font-bold text-amber-600" title={tr('Offline. New changes will be queued for sync when the connection returns.')}>◷</span>
                                    : cloudStatus === 'conflict' ? <span className="text-[10px] font-bold text-orange-600" title="Cloud changes conflict with local edits. Reload the story before continuing.">↔</span>
                                    : cloudStatus === 'error' ? <span className="text-[10px] font-bold text-red-600" title="Cloud sync or live updates failed">⚠</span>
                                    : <span className="text-[10px] font-bold text-emerald-700" title="Cloud changes synchronized">✔</span>)
                                : null}
                        </button>
                        {cloudUser && cloudProject && cloudStory && (
                            <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600">
                                <div className="font-semibold">
                                    {cloudStatus === 'saving' ? tr('Saving changes...') :
                                        cloudStatus === 'saved' ? tr('All changes saved') :
                                            cloudStatus === 'queued' || cloudStatus === 'offline'
                                                ? (navigator.onLine === false ? tr('Pending changes') : tr('Saving changes...')) :
                                                cloudStatus === 'conflict' ? tr('Cloud conflict needs attention') :
                                                    cloudStatus === 'error' ? tr('Sync needs attention') : tr('Sync status')}
                                </div>
                                {navigator.onLine === false && cloudSyncInfo && cloudSyncInfo.pendingCount > 0 && (
                                    <div className="mt-1">{tr('Pending snapshots')}: {cloudSyncInfo.pendingCount}</div>
                                )}
                                {cloudSyncInfo && cloudSyncInfo.lastSavedAt && (
                                    <div className="mt-1">{tr('Last saved')}: {new Date(cloudSyncInfo.lastSavedAt).toLocaleTimeString()}</div>
                                )}
                                {cloudSyncInfo && cloudSyncInfo.error && (
                                    <div className="mt-1 break-words text-red-600">{tr(cloudSyncInfo.error)}</div>
                                )}
                                {(cloudStatus === 'error' || cloudStatus === 'queued' || cloudStatus === 'offline') && (
                                    <div className="mt-2 flex gap-2">
                                        <button onClick={onRetrySync} className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold hover:bg-slate-100">{tr('Retry sync')}</button>
                                    </div>
                                )}
                            </div>
                        )}
                        <button
                            onClick={onOpenSettings}
                            className="w-full flex items-center gap-2 p-2 mb-2 rounded-lg font-medium text-xs text-left bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                        >
                            <span>⚙</span>
                            <span>API keys settings</span>
                        </button>
                        <LangSwitcher />
                        <div className="text-xs text-slate-400">Full QA Suite · build 2026-10-11c</div>
                    </div>                    </aside>
    );
}
