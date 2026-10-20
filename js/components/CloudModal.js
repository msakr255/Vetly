/* =====================================================================
   components/CloudModal.js
   ☁ Account: الإيميل + Sign out وخلاص.
   المشاريع والإحصائيات ليها صفحة كاملة (features/projects.js).
   ===================================================================== */

function CloudModal({ open, onClose, cloudUser, cloudProject, setCloudProject, onSignedIn, recovery, onResetDone, onResetCancel }) {
    const [mode, setMode] = useState('signin'); // signin | signup | forgot
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [pass2, setPass2] = useState('');
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => { if (open) setMsg(''); }, [open]);
    // لما لينك الاسترجاع يفتح الشاشة: نفضّي الحقول والرسايل
    useEffect(() => { if (recovery) { setMsg(''); setPass(''); setPass2(''); } }, [recovery]);

    const doAuth = async (fn) => {
        if (!email.trim() || !pass) { setMsg('Enter your email and password.'); return; }
        setBusy(true); setMsg('');
        const r = await fn(email, pass);
        setBusy(false);
        if (r.error) { setMsg(r.error.message); return; }
        // لو الـ signup محتاج تأكيد إيميل: في مستخدم من غير session
        if (fn === sbSignUp && r.data && r.data.user && !r.data.session) {
            setMsg('✔ Account created. Check your inbox to confirm your email, then Sign in.');
            setMode('signin');
            return;
        }
        setEmail(''); setPass('');
        // الدخول تم: المودال يقفل لوحده + توست ترحيبي + توجيه لصفحة المشاريع
        if (onSignedIn) onSignedIn();
    };

    const doSignOut = async () => {
        await sbSignOut();
        setCloudProject(null);
        onClose();
    };

    // نسيت كلمة السر: Supabase يبعت لينك استرجاع على الإيميل
    const doForgot = async () => {
        if (!email.trim()) { setMsg('Enter your account email first.'); return; }
        setBusy(true); setMsg('');
        const r = await sbResetPassword(email);
        setBusy(false);
        if (r.error) { setMsg(r.error.message); return; }
        setMsg("✔ Reset link sent — check your inbox (and spam). The link is valid for about an hour.");
    };

    // حفظ كلمة السر الجديدة (بعد فتح لينك الاسترجاع — الجلسة بتبقى جاهزة من اللينك نفسه)
    const doReset = async () => {
        if (!pass || pass.length < 6) { setMsg('Password must be at least 6 characters.'); return; }
        if (pass !== pass2) { setMsg('The two passwords do not match.'); return; }
        setBusy(true); setMsg('');
        const r = await sbUpdatePassword(pass);
        setBusy(false);
        if (r.error) { setMsg(r.error.message); return; }
        setPass(''); setPass2('');
        if (onResetDone) onResetDone();
    };

    if (!open) return null;
    const inp = 'w-full border border-slate-300 rounded p-2 text-sm bg-white';

    // ---------- وضع الاسترجاع: لينك الإيميل فتح التطبيق بجلسة استرجاع ⇒ كلمة سر جديدة ----------
    if (recovery) {
        return (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
                <div className="bg-white rounded-xl p-5 w-[420px] max-w-[95vw] shadow-xl space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-slate-800">🔑 Set a new password</h3>
                        <button onClick={onResetCancel} className="text-slate-500 hover:text-slate-800">✕</button>
                    </div>
                    <p className="text-xs text-slate-500">You opened a password-reset link. Choose a new password for your account.</p>
                    <input className={inp} type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="New password (min 6 characters)" />
                    <input className={inp} type="password" value={pass2} onChange={e => setPass2(e.target.value)} placeholder="Repeat new password"
                        onKeyDown={e => { if (e.key === 'Enter') doReset(); }} />
                    <button onClick={doReset} disabled={busy}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50">
                        {busy ? '...' : 'Save new password'}
                    </button>
                    {msg && <p className={`text-xs rounded p-2 border ${msg.startsWith('✔') ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-600 bg-red-50 border-red-100'}`}>{msg}</p>}
                </div>
            </div>
        );
    }

    // ---------- خارج الحساب: Sign in / Sign up ----------
    if (!cloudUser) {
        return (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
                <div className="bg-white rounded-xl p-5 w-[420px] max-w-[95vw] shadow-xl space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-slate-800">☁ Sign in to Vetly</h3>
                        <button onClick={onClose} className="text-slate-500 hover:text-slate-800">✕</button>
                    </div>
                    {!sbConfigured() && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
                            <p className="font-bold">Supabase key is missing.</p>
                            <p>Open <b>js/core/supabase-config.js</b> and paste your full anon key, then reload.</p>
                        </div>
                    )}
                    {sbConfigured() && (mode === 'forgot' ? (
                        <div className="space-y-2">
                            <p className="text-xs text-slate-500">Enter your account email and we'll send you a reset link.</p>
                            <input className={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
                                onKeyDown={e => { if (e.key === 'Enter') doForgot(); }} />
                            <button onClick={doForgot} disabled={busy}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50">
                                {busy ? '...' : 'Send reset link'}
                            </button>
                            <button onClick={() => { setMode('signin'); setMsg(''); }} className="w-full text-xs text-blue-600 hover:underline">← Back to sign in</button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex gap-1 text-xs">
                                <button onClick={() => { setMode('signin'); setMsg(''); }} className={`flex-1 py-1.5 rounded font-semibold border ${mode === 'signin' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>Sign in</button>
                                <button onClick={() => { setMode('signup'); setMsg(''); }} className={`flex-1 py-1.5 rounded font-semibold border ${mode === 'signup' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>Sign up</button>
                            </div>
                            <input className={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
                            <input className={inp} type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Password (min 6 characters)" />
                            <button
                                onClick={() => doAuth(mode === 'signup' ? sbSignUp : sbSignIn)}
                                disabled={busy}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50"
                            >
                                {busy ? '...' : (mode === 'signup' ? 'Create account' : 'Sign in')}
                            </button>
                            {mode === 'signin' && (
                                <button onClick={() => { setMode('forgot'); setMsg(''); }} className="w-full text-xs text-blue-600 hover:underline">Forgot password?</button>
                            )}
                        </div>
                    ))}
                    {msg && <p className={`text-xs rounded p-2 border ${msg.startsWith('✔') ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-600 bg-red-50 border-red-100'}`}>{msg}</p>}
                </div>
            </div>
        );
    }

    // ---------- داخل الحساب: Account بس ----------
    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="bg-white rounded-xl p-5 w-[420px] max-w-[95vw] shadow-xl space-y-3">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">👤 Account</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800">✕</button>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-1">
                    <p><span className="text-slate-500">Signed in as:</span> <b className="text-slate-800">{cloudUser.email}</b></p>
                    {cloudProject && <p className="text-xs text-slate-500">Open project: <b>{cloudProject.name}</b></p>}
                </div>
                <button onClick={doSignOut} className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded-lg text-sm">
                    Sign out
                </button>
                {msg && <p className="text-xs rounded p-2 border text-red-600 bg-red-50 border-red-100">{msg}</p>}
            </div>
        </div>
    );
}
