/* =====================================================================
   core/theme.js
   الدارك مود — JavaScript خالص (Vanilla JS)، من غير أي مكتبة.
   - بيحفظ اختيارك في المتصفح (localStorage) تحت المفتاح vetly_theme
   - بيضيف/يشيل كلاس "dark" على وسم <html>
   - أي زرار عليه attribute اسمه data-theme-toggle بيشتغل تلقائياً
   ملحوظة: الكلاس نفسه بيتضاف بدري في index.html (سطر صغير في <head>)
   عشان الصفحة ما تفلاش أبيض أول ثانية. الملف ده للتبديل والحفظ والأيقونة.
   ===================================================================== */
(function () {
    'use strict';

    var STORAGE_KEY = 'vetly_theme';
    var root = document.documentElement;

    var isDark = function () {
        return root.classList.contains('dark');
    };

    // بيحدّث شكل أيقونة/عنوان الزرار (من غير ما يلمس الـ localStorage)
    var syncButtons = function () {
        var dark = isDark();
        var buttons = document.querySelectorAll('[data-theme-toggle]');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].textContent = dark ? '\u2600\uFE0F' : '\uD83C\uDF19'; // ☀️ / 🌙
            buttons[i].setAttribute('title', dark ? 'Light mode' : 'Dark mode');
            buttons[i].setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
        }
    };

    // التبديل الرئيسي: يطبّق الثيم + يحفظ الاختيار
    window.toggleTheme = function () {
        var dark = !isDark();
        root.classList.toggle('dark', dark);
        try { localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light'); } catch (e) { /* ignore */ }
        syncButtons();
    };

    // تفعيل أي زرار عليه data-theme-toggle — مرة واحدة بـ event delegation
    document.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-theme-toggle]') : null;
        if (btn) window.toggleTheme();
    });

    // لو المستخدم غيّر ثيم وندوز/ماك والمشروع لسه على "الافتراضي" (مختارش حاجة قبل كده)
    try {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
            var saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) {
                root.classList.toggle('dark', e.matches);
                syncButtons();
            }
        });
    } catch (e) { /* متصفحات قديمة */ }

    // أول تحميل: ظبط أيقونة الزرار على الثيم المطبّق أصلاً
    syncButtons();
})();
