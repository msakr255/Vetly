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
    │   ├── store.js           ← بيانات الشغل في ذاكرة الصفحة؛ Supabase هو مصدر النسخة المشتركة
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
        ├── generation.js       ← Test Generation (كيسز بس — من غير تنفيذ)
        ├── bugs.js             ← Bug Report (+ سكرين شوتس + Jira CSV)
        ├── runs.js             ← Test Runs (Status + Expected/Actual + مقارنة + إرسال الفاشل للباجز)
        └── summary.js          ← Summary Report (الملخص التنفيذي)
```

## تعدّل إيه في أنهي ملف؟

| عايز تغيّر | الملف |
|---|---|
| اسم الأداة / اسم المصمم | `js/core/config.js` |
| الفوتر | `index.html` |
| بيانات المشاريع والقصص المشتركة | `js/core/store.js` و`js/core/supabase.js` |
| الألوان العامة والـ scrollbar | `css/styles.css` |
| الـ APIs وترتيب المزوّدين والموديلات الافتراضية | `js/core/providers.js` |
| شاشة Settings | `js/components/SettingsModal.js` |
| القائمة الجانبية | `js/components/Sidebar.js` |
| شكل الملفات المرفوعة (تم رفع الملف) | `js/components/UploadedFiles.js` |
| اختيارات الـ Environment (Web / Mobile) | `ENV_GROUPS` في `js/features/bugs.js` |
| تحليل المتطلبات (الـ Gaps) والمرجعية (KB) والتقرير | `js/features/gaps.js` |
| السيناريوهات | `js/features/scenarios.js` |
| توليد الـ Test Cases والتصدير (Excel/CSV) | `js/features/generation.js` |
| الباجز والـ Traceability والتقرير والسكرين شوتس والـ Jira CSV | `js/features/bugs.js` |
| جولات التنفيذ: Status + Expected/Actual + المقارنة + إرسال الـ Fail للباجز | `js/features/runs.js` |
| تقرير الملخص التنفيذي | `js/features/summary.js` |
| الـ Backup / Restore (ملف JSON واحد لكل حاجة) | `js/components/SettingsModal.js` |

## إضافة ميزة جديدة
1. أنشئ ملف جديد في `js/features/` فيه component (مثلاً `function MyFeaturePage(props) { ... }`).
2. ضيف سطر `<script type="text/babel" src="js/features/my-feature.js"></script>` في `index.html` **قبل** `app.js`.
3. ضيف زرار في `js/components/Sidebar.js`.
4. ضيف الـ component في `js/app.js` جوه `<div className={slot('اسم-الصفحة')}>`.

## ملاحظات
- الترتيب في `index.html` مهم: core ثم components ثم features ثم `app.js` آخر واحد.
- بيانات الشغل المتزامنة تُحفظ في ذاكرة الصفحة وتُرفع مباشرة إلى Supabase أثناء الاتصال. لا يُستخدم طابور IndexedDB إلا عند انقطاع الاتصال، وتُرفع التغييرات المعلقة عند عودته؛ لذلك لا تنتقل هذه النسخة المؤقتة تلقائيًا إلى متصفح أو جهاز آخر. تعرض الواجهة حالة الطابور فقط أثناء عدم الاتصال. البيانات القديمة التي كانت محفوظة محليًا تُحمى أثناء التحميل؛ وإذا تعارضت مع نسخة السحابة يظهر للمستخدم اختيار النسخة التي يحتفظ بها.
- مفاتيح API والثيم واللغة واختيار المشروع تظل محلية في المتصفح. يسمح التطبيق بتبويب نشط واحد لكل حساب داخل ملف المتصفح؛ التبويبات الأخرى تُمنع من استخدام مساحة العمل، بينما يظل استخدام الحساب على جهاز آخر متاحًا.
- إذا عُدّلت القصة في مكان آخر أثناء وجود تغييرات محلية، يوقف التطبيق الحفظ ويعرض اختيارًا صريحًا: تحميل نسخة السحابة أو استبدالها بالنسخة المحلية.
- تعرض القائمة الجانبية حالة الحفظ وعدد اللقطات المعلّقة وآخر وقت حفظ، مع إعادة المحاولة. عند التعارض، تظهر مقارنة مختصرة للحقول المختلفة قبل اختيار النسخة؛ ويمكن إعادة فحص قفل التبويب إذا انتهى التبويب الآخر أو أُغلق.
- عند حذف مشروع أو قصة من متصفح آخر، يتحقق التطبيق من وجودهما عند التحميل وعند وصول تحديث سحابي؛ يُزال الاختيار المحلي والبيانات المؤقتة المرتبطة بالكيان المحذوف، وتُفتح القصة المتاحة التالية إن وجدت. لا يحاول التطبيق رفع لقطة معلّقة لكيان حُذف عمدًا.
- الملفات بتشتغل من سيرفر (مش بفتح `index.html` بالدبل كليك)، لأن Babel بيحمّل الملفات بـ XHR.
- أسماء التخزين الداخلية في المتصفح (`wakil_...`) لسه زي ما هي عشان الداتا والمفاتيح القديمة ما تضيعش.
