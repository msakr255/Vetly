# Vetly - QA Workbench

## هيكل المشروع

```
vetly/
├── index.html                  ← الصفحة (HTML + الفوتر + ترتيب تحميل الملفات)
├── css/
│   └── styles.css              ← كل الـ CSS الخاص بالموقع
└── js/
    ├── app.js                  ← نقطة البداية: الحالة المشتركة + التنقل (آخر ملف بيتحمل)
    ├── core/
    │   ├── config.js           ← اسم الأداة (APP_NAME) واللوجو وبيانات المصمم
    │   ├── helpers.js          ← دوال مساعدة: قراءة PDF/Word/صور، تنضيف الداتا، تحميل الملفات
    │   ├── providers.js        ← الـ APIs: OpenRouter / CodeCraft / ChatGPT / Claude / Gemini + الـ fallback
    │   └── footer.js           ← تحديث سنة الفوتر
    ├── components/
    │   ├── SettingsModal.js    ← شاشة Settings (المفاتيح + أسماء الموديلات + Test all keys)
    │   ├── Sidebar.js          ← القائمة الجانبية
    │   ├── UploadedFiles.js    ← عرض الملفات المرفوعة تحت خانة الرفع + دالة joinWithFiles
    │   └── ErrorBoundary.js    ← بيمنع الشاشة البيضا
    └── features/               ← كل ميزة في ملف لوحدها
        ├── gaps.js             ← Requirement Gaps
        ├── scenarios.js        ← Test Scenarios
        ├── generation.js       ← Test Generation
        └── bugs.js             ← Bug Report
```

## تعدّل إيه في أنهي ملف؟

| عايز تغيّر | الملف |
|---|---|
| اسم الأداة / اسم المصمم | `js/core/config.js` |
| الفوتر | `index.html` |
| الألوان العامة والـ scrollbar | `css/styles.css` |
| الـ APIs وترتيب المزوّدين والموديلات الافتراضية | `js/core/providers.js` |
| شاشة Settings | `js/components/SettingsModal.js` |
| القائمة الجانبية | `js/components/Sidebar.js` |
| شكل الملفات المرفوعة (تم رفع الملف) | `js/components/UploadedFiles.js` |
| اختيارات الـ Environment (Web / Mobile) | `ENV_GROUPS` في `js/features/bugs.js` |
| تحليل المتطلبات (الـ Gaps) والمرجعية (KB) والتقرير | `js/features/gaps.js` |
| السيناريوهات | `js/features/scenarios.js` |
| توليد الـ Test Cases والتصدير | `js/features/generation.js` |
| الباجز والـ Traceability والتقرير | `js/features/bugs.js` |

## إضافة ميزة جديدة
1. أنشئ ملف جديد في `js/features/` فيه component (مثلاً `function MyFeaturePage(props) { ... }`).
2. ضيف سطر `<script type="text/babel" src="js/features/my-feature.js"></script>` في `index.html` **قبل** `app.js`.
3. ضيف زرار في `js/components/Sidebar.js`.
4. ضيف الـ component في `js/app.js` جوه `<div className={slot('اسم-الصفحة')}>`.

## ملاحظات
- الترتيب في `index.html` مهم: core ثم components ثم features ثم `app.js` آخر واحد.
- الملفات بتشتغل من سيرفر (مش بفتح `index.html` بالدبل كليك)، لأن Babel بيحمّل الملفات بـ XHR.
- أسماء التخزين الداخلية في المتصفح (`wakil_...`) لسه زي ما هي عشان الداتا والمفاتيح القديمة ما تضيعش.
