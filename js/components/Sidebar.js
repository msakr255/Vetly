/* =====================================================================
   components/Sidebar.js
   القائمة الجانبية (الميزات الأربعة). لإضافة ميزة جديدة ضيف زرار هنا.
   ===================================================================== */

function Sidebar({ page, setPage, bugsCount }) {
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
                                <button
                                    onClick={() => setPage('gaps')}
                                    className={`w-full flex items-center gap-2 p-2 rounded-lg font-medium text-xs text-left ${page === 'gaps' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                                >
                                    <span>🔍</span>
                                    <span>Requirement Analysis</span>
                                </button>
                                <button
                                    onClick={() => setPage('scenarios')}
                                    className={`w-full flex items-center gap-2 p-2 rounded-lg font-medium text-xs text-left ${page === 'scenarios' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                                >
                                    <span>📋</span>
                                    <span>Test Scenarios</span>
                                </button>
                                <button
                                    onClick={() => setPage('generation')}
                                    className={`w-full flex items-center gap-2 p-2 rounded-lg font-medium text-xs text-left ${page === 'generation' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                                >
                                    <span>⚡</span>
                                    <span>Test Generation</span>
                                </button>
                                <button
                                    onClick={() => setPage('bugs')}
                                    className={`w-full flex items-center gap-2 p-2 rounded-lg font-medium text-xs text-left ${page === 'bugs' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                                >
                                    <span>🐞</span>
                                    <span>Bug Report</span>
                                    {bugsCount > 0 && <span className="ml-auto bg-red-100 text-red-700 rounded-full px-1.5 text-[10px] font-bold">{bugsCount}</span>}
                                </button>
                            </div>
                        </div>
                    <div className="px-2">
                        <LangSwitcher />
                        <div className="text-xs text-slate-400">Full QA Suite</div>
                    </div>                    </aside>
    );
}
