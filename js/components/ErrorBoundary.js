/* =====================================================================
   components/ErrorBoundary.js
   بيمنع الشاشة البيضا: لو حصل خطأ بيعرض رسالة وزرار Reset.
   ===================================================================== */

/* لو حصل أي خطأ في العرض، بدل الشاشة البيضا بتظهر رسالة وزرار لمسح الداتا المحفوظة */
class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    render() {
        if (!this.state.error) return this.props.children;
        const resetData = () => {
            ['wakil_ai_data', 'wakil_story', 'wakil_sc_data', 'wakil_sc_story', 'wakil_linked', 'wakil_gap_data', 'wakil_gap_text', 'wakil_bugs']
                .forEach(k => localStorage.removeItem(k));
            location.reload();
        };
        return (
            <div className="p-8 max-w-xl mx-auto mt-16 bg-white border border-red-200 rounded-xl shadow text-sm space-y-3">
                <h2 className="font-bold text-red-700 text-base">حصل خطأ في عرض الصفحة</h2>
                <p className="text-slate-600">{String(this.state.error && this.state.error.message || this.state.error)}</p>
                <div className="flex gap-2">
                    <button onClick={() => location.reload()} className="bg-slate-200 px-3 py-2 rounded font-medium">Reload</button>
                    <button onClick={resetData} className="bg-red-600 text-white px-3 py-2 rounded font-medium">Reset saved data (المفاتيح هتفضل زي ما هي)</button>
                </div>
            </div>
        );
    }
}
