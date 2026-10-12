/* =====================================================================
   components/Sidebar.js
   القائمة الجانبية (الميزات الأربعة). لإضافة ميزة جديدة ضيف زرار هنا.
   ===================================================================== */

function Sidebar({ page, setPage, bugsCount, runsCount, onOpenCloud, cloudProject, cloudStatus, cloudUser, onOpenSettings, gapsCount, scenariosCount, casesCount, summaryBadge }) {
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
                                {/* الميزات بتظهر بس لما تكون داخل + فاتح مشروع */}
                                {cloudUser && cloudProject && (
                                    <>
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
                                        {cloudProject && <span className="ml-auto text-[10px] font-bold text-emerald-700 truncate max-w-[90px]">{cloudProject.name}</span>}
                                    </button>
                                    )}
                                {!cloudUser && (
                                    <p className="text-[11px] text-slate-400 px-1 py-2">Sign in to unlock all modules.</p>
                                )}
                                {cloudUser && !cloudProject && (
                                    <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-2">No open project — open or create one from My Projects.</p>
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
                                    : cloudStatus === 'error' ? <span className="text-[10px] font-bold text-red-600">⚠</span>
                                    : <span className="text-[10px] font-bold text-emerald-700">✔</span>)
                                : null}
                        </button>
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
