/* =====================================================================
   core/i18n.js
   ترجمة الواجهة + التقارير + لغة مخرجات الـ AI (عربي / English / Deutsch).
   لإضافة/تعديل ترجمة: عدّل سطر في I18N_ENTRIES: [English, عربي, Deutsch, ...نصوص مصدر إضافية]
   ===================================================================== */

const LANGS = [
    { id: 'en', label: 'English', dir: 'ltr' },
    { id: 'ar', label: 'العربية', dir: 'rtl' },
    { id: 'de', label: 'Deutsch', dir: 'ltr' }
];
const LANG_INDEX = { en: 0, ar: 1, de: 2 };

/* {x} = متغير. أي نص فيه {x} بيشتغل كـ pattern. */
const I18N_ENTRIES = [
// ---------- Enums ----------
['Positive','إيجابية','Positiv'],['Negative','سلبية','Negativ'],['Edge Case','حالة حدية','Grenzfall'],
['Critical','حرجة','Kritisch'],['High','عالية','Hoch'],['Medium','متوسطة','Mittel'],['Low','منخفضة','Niedrig'],
['Untested','لم يُختبر','Ungetestet'],['Pass','ناجح','Bestanden'],['Fail','فاشل','Fehlgeschlagen'],
['Blocked','محجوب','Blockiert'],['Skipped','تم تخطيه','Übersprungen'],
['Test Runs','جولات الاختبار','Testläufe'],['Summary Report','تقرير الملخص','Zusammenfassungsbericht'],
['Run Report (Word)','تقرير الجولة (Word)','Laufbericht (Word)'],['Start Run','بدء جولة','Lauf starten'],
['Compare','مقارنة','Vergleich'],['Regression','انحدار','Regression'],['Fixed','تم الإصلاح','Behoben'],['Changed','تغيّر','Geändert'],
['Jira CSV','Jira CSV','Jira CSV'],
['New','جديد','Neu'],['Open','مفتوح','Offen'],['In Progress','قيد التنفيذ','In Bearbeitung'],['Fixed','تم الإصلاح','Behoben'],
['Retest','إعادة اختبار','Erneut testen'],['Closed','مغلق','Geschlossen'],['Rejected','مرفوض','Abgelehnt'],['Answered','تمت الإجابة','Beantwortet'],
['Present','موجود','Vorhanden'],['Partial','جزئي','Teilweise'],['Missing','ناقص','Fehlend'],['N/A','غير منطبق','k. A.'],
['Priority: Critical','الأولوية: حرجة','Priorität: Kritisch'],['Priority: High','الأولوية: عالية','Priorität: Hoch'],
['Priority: Med','الأولوية: متوسطة','Priorität: Mittel'],['Priority: Low','الأولوية: منخفضة','Priorität: Niedrig'],
['High priority','أولوية عالية','Hohe Priorität'],['Medium priority','أولوية متوسطة','Mittlere Priorität'],['Low priority','أولوية منخفضة','Niedrige Priorität'],

// ---------- Common ----------
['⚙ Settings','⚙ الإعدادات','⚙ Einstellungen'],['Clear Data','مسح البيانات','Daten löschen'],['Delete','حذف','Löschen'],
['+ Add','+ إضافة','+ Hinzufügen'],['Copy','نسخ','Kopieren'],['Cancel','إلغاء','Abbrechen'],['Stop','إيقاف','Stopp'],
['Edit','تعديل','Bearbeiten'],['Done','تم','Fertig'],['Download Report (Word)','تنزيل التقرير (Word)','Bericht herunterladen (Word)'],
['Reading file...','جارٍ قراءة الملف...','Datei wird gelesen...'],
['File uploaded','تم رفع الملف','Datei hochgeladen'],['{n} files uploaded','تم رفع {n} ملفات','{n} Dateien hochgeladen'],
['Title','العنوان','Titel'],['Title:','العنوان:','Titel:'],['Type','النوع','Typ'],['Type:','النوع:','Typ:'],
['Priority','الأولوية','Priorität'],['Priority:','الأولوية:','Priorität:'],['Status','الحالة','Status'],['Status:','الحالة:','Status:'],
['Scenario','السيناريو','Szenario'],['Test Case','حالة الاختبار','Testfall'],['Bug(s)','الأخطاء','Fehler'],
['Total','الإجمالي','Gesamt'],['Count','العدد','Anzahl'],['Description','الوصف','Beschreibung'],['Section','القسم','Abschnitt'],
['Evidence','الدليل','Beleg'],['Owner','المسؤول','Verantwortlicher'],['ID','المعرّف','ID'],['Category','الفئة','Kategorie'],
['Steps','الخطوات','Schritte'],['Expected','المتوقع','Erwartet'],['Scenario ID','رقم السيناريو','Szenario-ID'],
['Pasted text','نص ملصوق','Eingefügter Text'],['Document start','بداية المستند','Dokumentanfang'],
['Requirement text','نص المتطلبات','Anforderungstext'],['Uploaded images','الصور المرفوعة','Hochgeladene Bilder'],['Images','صور','Bilder'],
['QA Team','فريق الجودة','QA-Team'],['Date:','التاريخ:','Datum:'],

// ---------- Footer / Sidebar / ErrorBoundary ----------
['. All rights reserved.','. جميع الحقوق محفوظة.','. Alle Rechte vorbehalten.'],
['Designed by','تصميم','Entworfen von'],['Software Testing Engineer','مهندس اختبار برمجيات','Software-Test-Ingenieur'],
['QA Workbench','منصة اختبار الجودة','QA-Werkbank'],['Modules','الوحدات','Module'],
['Requirement Gaps','ثغرات المتطلبات','Anforderungslücken'],['Test Scenarios','سيناريوهات الاختبار','Testszenarien'],
['User Stories','اليوزر ستوريز','User Stories'],['User Story','اليوزر ستوري','User Story'],['Test Cases','حالات الاختبار','Testfälle'],['Bugs','الباجز','Bugs'],
['Other','أخرى','Andere'],
['Translating your generated content…','جاري ترجمة المحتوى المولّد…','Ihr KI-Inhalt wird übersetzt…'],
['Translating: {f}…','جاري الترجمة: {f}…','Übersetzung läuft: {f}…'],
['Translating…','جاري الترجمة…','Übersetzung läuft…'],
['Writing {n} bug reports in parallel…','جاري كتابة {n} تقرير باج بالتوازي…','{n} Bug-Berichte werden parallel geschrieben…'],
['Enhancing {n} bug reports with AI…','جاري تحسين {n} تقرير باج بالذكاء الاصطناعي…','{n} Bug-Berichte werden mit KI verfeinert…'],
['Translation already in progress — one moment…','فيه ترجمة شغالة دلوقتي — لحظة من فضلك…','Eine Übersetzung läuft bereits — einen Moment…'],
['This project has no stories yet.','المشروع ده مفيهوش ستوريز لسه.','Dieses Projekt hat noch keine Stories.'],
['Project Summary','ملخص المشروع','Projektübersicht'],
['Generated','تاريخ الإنشاء','Erstellt'],
['Stories','اليوزر ستوريز','Stories'],
['Overall','الإجمالي','Gesamt'],
['Bugs by severity','الباجز حسب الخطورة','Bugs nach Schweregrad'],
['Per user story','لكل يوزر ستوري','Pro User Story'],
['Test runs','جولات الاختبار','Testläufe'],
['Scenarios','السيناريوهات','Szenarien'],
['Test cases','حالات الاختبار','Testfälle'],
['Executions','التنفيذات','Ausführungen'],
['Pass rate','نسبة النجاح','Erfolgsquote'],
['Gaps','الثغرات','Lücken'],
['Run','الجولة','Lauf'],
['Date','التاريخ','Datum'],
['Pass','ناجح','Bestanden'],
['Fail','فاشل','Fehlgeschlagen'],
['Blocked','محجوب','Blockiert'],
['No test runs yet.','مفيش جولات اختبار لسه.','Noch keine Testläufe.'],
['Download PDF','تنزيل PDF','PDF herunterladen'],
['Download Word','تنزيل Word','Word herunterladen'],
['Back','رجوع','Zurück'],
['Requirements','المتطلبات','Anforderungen'],
['Raw input — feeds the other features','الخامة الخام — بتغذي باقي الفيتشرز','Rohdaten — sie speisen die anderen Funktionen'],
['Requirements (User Story / SRS / BRD / anything)','المتطلبات (يوزر ستوري / SRS / BRD / أي حاجة)','Anforderungen (User Story / SRS / BRD / alles)'],
['Paste or write the requirements here (User Story / SRS / BRD / anything)…','اكتب أو الصق المتطلبات هنا (يوزر ستوري / SRS / BRD / أي حاجة)…','Fügen Sie die Anforderungen hier ein oder schreiben Sie sie (User Story / SRS / BRD / alles)…'],
['Saved automatically — the content stays in this story and syncs to the cloud.','بيتحفظ تلقائيًا — المحتوى بيفضل في الستوري دي وبيتزامن مع السحابة.','Wird automatisch gespeichert — der Inhalt bleibt in dieser Story und synchronisiert mit der Cloud.'],
['Files & images','الملفات والصور','Dateien & Bilder'],
['Add files or images','إضافة ملفات أو صور','Dateien oder Bilder hinzufügen'],
['Images, text files, PDFs — preview them here and send them with the requirements.','صور وملفات نصية و PDF — عاينها هنا وابعتها مع المتطلبات.','Bilder, Textdateien, PDFs — hier ansehen und mit den Anforderungen senden.'],
['No files yet — add files or images to preview them here.','مفيش ملفات لسه — ضيف ملفات أو صور لتعاينها هنا.','Noch keine Dateien — fügen Sie Dateien oder Bilder hinzu, um sie hier anzusehen.'],
['Click to preview','اضغط للمعاينة','Klicken zum Ansehen'],
['Download','تنزيل','Herunterladen'],
['Preview','معاينة','Vorschau'],
['Light mode','الوضع الفاتح','Heller Modus'],
['Dark mode','الوضع الداكن','Dunkler Modus'],
['Preview is not available for this file type — download it to view.','المعاينة مش متاحة للنوع ده — نزّله لتشاهده.','Vorschau für diesen Dateityp nicht verfügbar — laden Sie ihn herunter.'],
['Paste or upload requirements first!','اكتب أو ارفع المتطلبات الأول!','Fügen Sie zuerst Anforderungen ein oder laden Sie sie hoch!'],
['Send to Requirement Analysis','إرسال إلى تحليل المتطلبات','An Anforderungsanalyse senden'],
['Send to Test Scenarios','إرسال إلى سيناريوهات الاختبار','An Testszenarien senden'],
['Send to Test Generation','إرسال إلى توليد الاختبارات','An Testgenerierung senden'],
['Send the text and files to Requirement Analysis','إرسال النص والملفات إلى تحليل المتطلبات','Text und Dateien an die Anforderungsanalyse senden'],
['Send the text and files to Test Scenarios','إرسال النص والملفات إلى سيناريوهات الاختبار','Text und Dateien an die Testszenarien senden'],
['Send the text and files to Test Generation','إرسال النص والملفات إلى توليد الاختبارات','Text und Dateien an die Testgenerierung senden'],
['Screenshots','لقطات الشاشة','Screenshots'],
['Browser storage is full — remove some files.','مساحة التخزين ممتلئة — شيل بعض الملفات.','Der Browser-Speicher ist voll — entfernen Sie einige Dateien.'],
['Add at least one API key in Settings first.','ضيف مفتاح API واحد على الأقل في الإعدادات الأول.','Fügen Sie zuerst mindestens einen API-Schlüssel in den Einstellungen hinzu.'],
['Blocked/Skipped','محجوب/متخطى','Blockiert/Übersprungen'],
['Bug','باج','Fehler'],
['Cases','كيسز','Fälle'],
['Executed','تم تنفيذه','Ausgeführt'],
['Execution & Coverage by Scenario','التنفيذ والتغطية لكل سيناريو','Ausführung & Abdeckung pro Szenario'],
['Execution source','مصدر التنفيذ','Ausführungsquelle'],
['Open questions','أسئلة مفتوحة','Offene Fragen'],
['Sections analyzed','أقسام تم تحليلها','Analysierte Abschnitte'],
['State','الحالة','Status'],
['The report aggregates from: Requirement Gaps + Test Scenarios + Test Generation + Test Runs + Bug Report — across ALL user stories of the project.','التقرير بيتجمّع من: Requirement Gaps + Test Scenarios + Test Generation + Test Runs + Bug Report — عبر كل اليوزر ستوريز في المشروع.','Der Bericht fasst zusammen aus: Requirement Gaps + Test Scenarios + Test Generation + Test Runs + Bug Report — über ALLE User Stories des Projekts.'],
['The summary is aggregated automatically from all pages of ALL user stories: analysis, scenarios, cases, runs, and bugs.','الملخص بيتجمّع تلقائيًا من كل صفحات كل اليوزر ستوريز: التحليل، السيناريوهات، الكيسز، الجولات، والباجز.','Die Zusammenfassung wird automatisch aus allen Seiten ALLER User Stories zusammengestellt: Analyse, Szenarien, Fälle, Läufe und Bugs.'],
['current saved statuses','آخر الحالات المحفوظة','aktuell gespeicherte Statuswerte'],
['scenario(s) have test cases','سيناريو عنده كيسز','Szenarien haben Testfälle'],
['scenario(s) with NO test case','سيناريو من غير أي تيست كيس','Szenarien ohne Testfall'],
['Add gap','إضافة ثغرة','Lücke hinzufügen'],
['Add a gap manually','إضافة ثغرة يدويًا','Lücke manuell hinzufügen'],
['Write the gap description first.','اكتب وصف الثغرة الأول.','Schreiben Sie zuerst die Lückenbeschreibung.'],
['Description','الوصف','Beschreibung'],
['A clear factual statement of what is missing or unclear…','بيان واضح وموضوعي لما هو ناقص أو غير واضح…','Eine klare sachliche Aussage darüber, was fehlt oder unklar ist…'],
['Scenario / Example','سيناريو / مثال','Szenario / Beispiel'],
['Question','السؤال','Frage'],
['Save gap','حفظ الثغرة','Lücke speichern'],
['No runs yet. Start one from above.','لسه مفيش جولات. ابدأ واحدة من فوق.','Noch keine Läufe. Starten Sie oben einen.'],
['No Test Cases yet. Generate the cases first in Test Generation, then come back here to log the runs.','مفيش Test Cases لسه. ولّد الكيسز الأول في صفحة Test Generation وبعدين ارجع هنا تسجّل جولات التنفيذ.','Keine Testfälle. Erzeugen Sie zuerst Fälle in Test Generation und kommen Sie dann hierher, um die Läufe zu erfassen.'],
['Pick two different runs to compare (need at least two).','اختار جولتين مختلفتين للمقارنة (محتاج جولتين على الأقل).','Wählen Sie zwei verschiedene Läufe zum Vergleich (mindestens zwei nötig).'],
['No changes between the two runs ✔','مفيش تغييرات بين الجولتين ✔','Keine Änderungen zwischen den beiden Läufen ✔'],
['No cases match the filter.','مفيش كيسز مطابقة للفلتر.','Keine Fälle entsprechen dem Filter.'],
['The summary report is assembled automatically from all pages: analysis, scenarios, cases, runs, and bugs.','التقرير الملخص بيتجمع تلقائي من كل الصفحات: التحليل، السيناريوهات، الكيسز، جولات التنفيذ، والباجز.','Der Zusammenfassungsbericht wird automatisch aus allen Seiten zusammengestellt: Analyse, Szenarien, Fälle, Läufe und Bugs.'],
['Execution is calculated from a Test Run — create one and log its results first.','التنفيذ بيتحسب من جولة Test Runs — اعمل جولة وسجّل نتايجها هناك الأول.','Die Ausführung wird aus einem Testlauf berechnet — erstellen Sie zuerst einen und erfassen Sie dessen Ergebnisse.'],
['Not enough data for a report yet.','لسه مفيش داتا كفاية لتقرير.','Noch nicht genug Daten für einen Bericht.'],
['The report aggregates from: Requirement Gaps + Test Scenarios + Test Generation + Test Runs + Bug Report. Fill in what is available and download the report.','التقرير بيجمّع من: Requirement Gaps + Test Scenarios + Test Generation + Test Runs + Bug Report. املا اللي متاح وأنزل التقرير.','Der Bericht fasst zusammen aus: Requirement Gaps + Test Scenarios + Test Generation + Test Runs + Bug Report. Füllen Sie aus, was verfügbar ist, und laden Sie den Bericht herunter.'],
['No test scenarios yet.','لسه مفيش سيناريوهات.','Noch keine Testszenarien.'],
['No content saved in the cloud for this scope yet — open the story, add your work, let it auto-save, then share.','مفيش محتوى متسجل في السحابة للنطاق ده لسه — افتح الستوري، شتغل شغلك، خلي الحفظ التلقائي يشتغل، وبعدين شير.','Für diesen Bereich wurde noch kein Inhalt in der Cloud gespeichert — öffnen Sie die Story, arbeiten Sie, lassen Sie automatisch speichern und teilen Sie dann.'],
['Link created — but this scope has no saved content in the cloud yet, so it will open empty. Open the story, add your work, and it auto-updates.','✔ اللينك اتعمل — بس النطاق ده ملوش محتوى متسجل في السحابة، فهيفتح فاضي. افتح الستوري وشتغل شغلك وهيتم التحديث تلقائيًا.','Link erstellt — aber dieser Bereich hat noch keinen gespeicherten Inhalt in der Cloud und öffnet sich leer. Öffnen Sie die Story, arbeiten Sie, und er aktualisiert sich automatisch.'],
['Start a run from the panel on the left to log execution results.','ابدأ جولة من اللوحة اللي على الشمال عشان تسجّل نتايج التنفيذ.','Starten Sie einen Lauf über das linke Panel, um die Ausführungsergebnisse zu erfassen.'],
['✔ Content translated — reloading…','✔ اترجم المحتوى — الصفحة هتعيد التحميل…','✔ Inhalt übersetzt — wird neu geladen…'],
['Translation partially failed: {f} — switch the language again to retry.','الترجمة نجحت جزئيًا: {f} — بدّل اللغة تاني لتعيد المحاولة للفاشل.','Übersetzung teilweise fehlgeschlagen: {f} — Sprache erneut wechseln, um es erneut zu versuchen.'],
['✔ Content language updated.','✔ اتحدّثت لغة المحتوى.','Inhaltssprache aktualisiert.'],

// ---------- ثوابت التنقّل والصفحات (شريط جانبي + مشاريع + دخول) ----------
['My Projects','مشاريعي','Meine Projekte'],
['Account','الحساب','Konto'],
['Vetly Agent','فيترلي إيجنت','Vetly Agent'],
['API keys settings','إعدادات مفاتيح API','API-Schlüssel-Einstellungen'],
['Requirement Analysis','تحليل المتطلبات','Anforderungsanalyse'],
['Sign in to unlock all modules.','سجّل دخولك لفتح كل الميزات.','Melden Sie sich an, um alle Module freizuschalten.'],
['No open story — open or create one from My Projects.','مفيش قصة مفتوحة — افتح أو اعمل واحدة من مشاريعي.','Keine offene Story — öffnen oder erstellen Sie eine unter Meine Projekte.'],
['Sign in to start working','سجّل الدخول لتبدأ الشغل','Melden Sie sich an, um zu arbeiten'],
['☁ Sign in / Create account','☁ دخول / إنشاء حساب','☁ Anmelden / Konto erstellen'],
['Provider & Model','المزوّد والموديل','Anbieter & Modell'],
['Dashboard — all projects','لوحة الإحصائيات — كل المشاريع','Übersicht — alle Projekte'],
['Your projects','مشاريعك','Ihre Projekte'],
['press a project name to open its user stories','اضغط على اسم المشروع يفتحلك يوزر ستوريزه','Klicken Sie auf einen Projektnamen, um seine User Stories zu öffnen'],
['No projects yet — create the first one from the header above.','مفيش مشاريع لسه — اعمل أول واحد من الهيدر فوق.','Noch keine Projekte — erstellen Sie das erste oben in der Kopfzeile.'],
['No user stories — create the first one from below ⬇','مفيش يوزر ستوريز — اعمل أول واحدة من تحت ⬇','Keine User Stories — erstellen Sie die erste von unten ⬇'],
['New project name...','اسم المشروع الجديد...','Neuer Projektname...'],
['+ Create','+ إنشاء','+ Erstellen'],
['↻ Refresh','↻ تحديث','↻ Aktualisieren'],
['Loading...','جارٍ التحميل...','Wird geladen...'],
['New user story name...','اسم اليوزر ستوري الجديد...','Neuer User-Story-Name...'],
['+ New Story','+ ستوري جديدة','+ Neue Story'],
['Project details','تفاصيل المشروع','Projektdetails'],
['✕ close','✕ إغلاق','✕ Schließen'],
['Open project','افتح المشروع','Projekt öffnen'],
['Open story','افتح الستوري','Story öffnen'],
['Rename','إعادة تسمية','Umbenennen'],
['Show / hide user stories','إظهار/إخفاء اليوزر ستوريز','User Stories ein-/ausblenden'],
['Sign in to Vetly','تسجيل الدخول إلى فيترلي','Bei Vetly anmelden'],
['Create account','إنشاء حساب','Konto erstellen'],
['Sign up','حساب جديد','Registrieren'],
['Sign out','تسجيل الخروج','Abmelden'],
['Forgot password?','نسيت كلمة السر؟','Passwort vergessen?'],
['Send reset link','إرسال لينك الاسترجاع','Reset-Link senden'],
['← Back to sign in','← رجوع لتسجيل الدخول','← Zurück zur Anmeldung'],
['Set a new password','تعيين كلمة سر جديدة','Neues Passwort festlegen'],
['Save new password','حفظ كلمة السر الجديدة','Neues Passwort speichern'],
['New password (min 6 characters)','كلمة السر الجديدة (6 أحرف على الأقل)','Neues Passwort (min. 6 Zeichen)'],
['Repeat new password','أعد كتابة كلمة السر الجديدة','Neues Passwort wiederholen'],
['Password must be at least 6 characters.','كلمة السر لازم 6 أحرف على الأقل.','Das Passwort muss mindestens 6 Zeichen lang sein.'],
['The two passwords do not match.','كلمتا السر غير متطابقتين.','Die Passwörter stimmen nicht überein.'],
['Signed in as:','مسجّل باسم:','Angemeldet als:'],
['Supabase key is missing.','مفتاح Supabase ناقص.','Supabase-Schlüssel fehlt.'],
["Enter your account email and we'll send you a reset link.",'اكتب إيميل حسابك وهيوصلك لينك استرجاع.','Geben Sie Ihre Konto-E-Mail ein und wir senden Ihnen einen Reset-Link.'],
['✔ Reset link sent — check your inbox (and spam). The link is valid for about an hour.','✔ اتبعت رسالة الاسترجاع — بص في الوارد (والسبام). اللينك صالح حوالي ساعة.','✔ Reset-Link gesendet — prüfen Sie Posteingang (und Spam). Der Link ist ca. 1 Stunde gültig.'],
['You opened a password-reset link. Choose a new password for your account.','فتحت لينك استرجاع كلمة السر. اختار كلمة سر جديدة لحسابك.','Sie haben einen Passwort-Reset-Link geöffnet. Wählen Sie ein neues Passwort für Ihr Konto.'],
['Shared view','عرض مشترك','Geteilte Ansicht'],['Read-only','للقراءة فقط','Nur lesen'],['Open Vetly','افتح Vetly','Vetly öffnen'],
['Last update','آخر تحديث','Letzte Aktualisierung'],['All user stories','كل اليوزر ستوريز','Alle User Stories'],
['Result','النتيجة','Ergebnis'],['Actual','الفعلي','Tatsächlich'],['Notes','ملاحظات','Notizen'],['Build','البناء','Build'],
['Technique','تقنية التصميم','Technik'],['Pre-condition','الشرط المسبق','Vorbedingung'],['Test data','بيانات الاختبار','Testdaten'],
['Cross-requirement gaps','ثغرات بين المتطلبات','Anforderungsübergreifende Lücken'],
['— empty —','— فاضي —','— leer —'],['Story','ستوري','Story'],['Project','مشروع','Projekt'],['Feature','فيتشر','Feature'],
['This view is read-only and updates automatically with every save by the project owner — editing and running the features are available to the owner only after signing in.','العرض ده للقراءة فقط وبيتحدّث تلقائيًا مع كل حفظ لصاحب المشروع — التعديل وتشغيل الميزات متاحين لصاحب المشروع بس عند تسجيل الدخول.','Diese Ansicht ist schreibgeschützt und aktualisiert sich automatisch bei jedem Speichern des Projektinhabers — Bearbeiten und Ausführen der Funktionen sind nur dem eingeloggteten Projektinhaber möglich.'],
['Test Generation','توليد الاختبارات','Testgenerierung'],['Bug Report','تقرير الأخطاء','Fehlerbericht'],
['Full QA Suite','حزمة QA متكاملة','Komplette QA-Suite'],
['An error occurred while rendering the page','حدث خطأ أثناء عرض الصفحة','Beim Anzeigen der Seite ist ein Fehler aufgetreten','حصل خطأ في عرض الصفحة'],
['Reload','إعادة تحميل','Neu laden'],
['Reset saved data (API keys are kept)','مسح البيانات المحفوظة (المفاتيح تبقى كما هي)','Gespeicherte Daten zurücksetzen (API-Schlüssel bleiben erhalten)','Reset saved data (المفاتيح هتفضل زي ما هي)'],

// ---------- Settings ----------
['API Keys Settings','إعدادات مفاتيح API','API-Schlüssel-Einstellungen'],
['Priority order: OpenRouter ← ChatGPT ← Claude ← Gemini. Any provider with an empty key is skipped. Keys are stored in your browser only (localStorage).',
 'ترتيب الأولوية: OpenRouter ← ChatGPT ← Claude ← Gemini. يتم تخطي أي مزوّد مفتاحه فارغ. تُخزَّن المفاتيح في متصفحك فقط (localStorage).',
 'Reihenfolge: OpenRouter ← ChatGPT ← Claude ← Gemini. Anbieter ohne Schlüssel werden übersprungen. Schlüssel werden nur in Ihrem Browser gespeichert (localStorage).',
 'الأولوية: OpenRouter ← ChatGPT ← Claude ← Gemini. بيتخطى أي واحد مفتاحه فاضي. المفاتيح بتتخزن في متصفحك بس (localStorage).'],
['key:','المفتاح:','Schlüssel:'],['{p} API key','مفتاح API لـ {p}','API-Schlüssel für {p}'],
['Model (optional, default: {m})','الموديل (اختياري، الافتراضي: {m})','Modell (optional, Standard: {m})','Model (اختياري، الافتراضي: {m})'],
['first available model','أول موديل متاح','erstes verfügbares Modell','أول موديل متاح'],
['Test all keys','اختبار كل المفاتيح','Alle Schlüssel testen'],['Testing...','جارٍ الاختبار...','Teste...'],
['No key (skipped)','لا يوجد مفتاح (تم التخطي)','Kein Schlüssel (übersprungen)'],
['Key: {k}... ({n} chars)','المفتاح: {k}... ({n} حرف)','Schlüssel: {k}... ({n} Zeichen)'],
['The key contains spaces or non-English characters. Delete it and paste it again with nothing extra.','المفتاح يحتوي على مسافات أو أحرف غير إنجليزية. احذفه والصقه مرة أخرى بدون أي إضافات.','Der Schlüssel enthält Leerzeichen oder nicht-englische Zeichen. Löschen Sie ihn und fügen Sie ihn ohne Zusätze erneut ein.'],
['Empty response','رد فارغ','Leere Antwort'],['Available models:','النماذج المتاحة:','Verfügbare Modelle:'],
['Works ✔ ({s}s)','يعمل ✔ ({s} ث)','Funktioniert ✔ ({s}s)'],
['Available models for your key:','النماذج المتاحة لمفتاحك:','Verfügbare Modelle für Ihren Schlüssel:'],
['The key is invalid or was deleted/disabled. Create a new key for {p} and put it in Settings (or leave the field empty to skip it).','المفتاح غير صالح أو تم حذفه/تعطيله. أنشئ مفتاحًا جديدًا لـ {p} وضعه في الإعدادات (أو اترك الخانة فارغة ليتم تخطيه).','Der Schlüssel ist ungültig oder wurde gelöscht/deaktiviert. Erstellen Sie einen neuen Schlüssel für {p} und tragen Sie ihn in den Einstellungen ein (oder lassen Sie das Feld leer, um ihn zu überspringen).'],
['The {p} account has no credit/quota left (billing). Top it up or use another provider.','حساب {p} خلص رصيده/حصته (مشكلة فاتورة). اشحن الحساب أو استخدم مزوّد تاني.','Das Konto {p} hat kein Guthaben/Kontingent mehr (Abrechnung). Konto aufladen oder einen anderen Anbieter verwenden.'],
['tried: {m}','الموديلات المجرّبة: {m}','versucht: {m}'],
['No models available, enter a model name in Settings','لا توجد نماذج متاحة، أدخل اسم نموذج في الإعدادات','Keine Modelle verfügbar, geben Sie in den Einstellungen einen Modellnamen ein'],
['Old .doc files are not supported. Save as .docx and upload again.','ملفات .doc القديمة غير مدعومة. احفظها بصيغة .docx وارفعها مرة أخرى.','Alte .doc-Dateien werden nicht unterstützt. Als .docx speichern und erneut hochladen.'],
['This format is not supported here. Save it as PDF or Word, or copy the text.','هذه الصيغة غير مدعومة هنا. احفظها PDF أو Word أو انسخ النص.','Dieses Format wird hier nicht unterstützt. Speichern Sie es als PDF oder Word oder kopieren Sie den Text.'],

// ---------- Alerts / confirms ----------
['No API key found. Open Settings and add at least one key.','لا يوجد مفتاح API. افتح الإعدادات وأضف مفتاحًا واحدًا على الأقل.','Kein API-Schlüssel gefunden. Öffnen Sie die Einstellungen und fügen Sie mindestens einen Schlüssel hinzu.','مفيش ولا API key. افتح Settings وحط مفتاح واحد على الأقل.'],
['Could not load the Excel library. Download the Word report instead.','تعذر تحميل مكتبة Excel. نزّل تقرير Word بدلًا منه.','Die Excel-Bibliothek konnte nicht geladen werden. Laden Sie stattdessen den Word-Bericht herunter.','تعذر تحميل مكتبة Excel. حمّل التقرير (Word) بدلها.'],
['Could not load the Excel library. Use the Word export instead.','تعذر تحميل مكتبة Excel. استخدم تصدير Word بدلًا منه.','Die Excel-Bibliothek konnte nicht geladen werden. Verwenden Sie stattdessen den Word-Export.','تعذر تحميل مكتبة Excel. استخدم تصدير Word بدلها.'],
['Could not load the Excel library, exporting as CSV instead.','تعذر تحميل مكتبة Excel، سيتم التصدير بصيغة CSV.','Die Excel-Bibliothek konnte nicht geladen werden, es wird stattdessen als CSV exportiert.','تعذر تحميل مكتبة Excel، هيتم التصدير كـ CSV.'],
['Please paste requirements or upload a file first!','يرجى لصق المتطلبات أو رفع ملف أولًا!','Bitte zuerst Anforderungen einfügen oder eine Datei hochladen!'],
['Please enter requirements or upload a file first!','يرجى إدخال المتطلبات أو رفع ملف أولًا!','Bitte zuerst Anforderungen eingeben oder eine Datei hochladen!'],
['Please enter a User Story or upload a file first!','يرجى إدخال قصة مستخدم أو رفع ملف أولًا!','Bitte zuerst eine User Story eingeben oder eine Datei hochladen!'],
['All APIs failed. Details are shown under the Generate button.','فشلت جميع واجهات API. التفاصيل ظاهرة تحت زر التوليد.','Alle APIs sind fehlgeschlagen. Details stehen unter der Schaltfläche „Generieren“.','كل الـ APIs فشلت. التفاصيل ظاهرة تحت زر Generate.'],
['Scenarios copied ✔','تم نسخ السيناريوهات ✔','Szenarien kopiert ✔','تم نسخ السيناريوهات ✔'],
['Copy the scenarios from here:','انسخ السيناريوهات من هنا:','Kopieren Sie die Szenarien von hier:','انسخ السيناريوهات من هنا:'],
['Write the scenario title first.','اكتب عنوان السيناريو أولًا.','Geben Sie zuerst den Szenario-Titel ein.','اكتب عنوان السيناريو الأول.'],
['Write the test case title first.','اكتب عنوان حالة الاختبار أولًا.','Geben Sie zuerst den Testfall-Titel ein.','اكتب عنوان التيست كيس الأول.'],
['Choose or type the scenario ID (e.g. TS-01).','اختر أو اكتب رقم السيناريو (مثلًا TS-01).','Wählen oder tippen Sie die Szenario-ID (z. B. TS-01).','اختار أو اكتب رقم السيناريو (مثلاً TS-01).'],
['Delete all bugs?','حذف كل الأخطاء؟','Alle Fehler löschen?','تمسح كل الباجز؟'],
['Write the Actual Result first on the Test Runs page before sending to the Bug Report:\n{ids}','اكتب «النتيجة الفعلية» أولًا في صفحة جولات الاختبار قبل الإرسال إلى تقرير الأخطاء:\n{ids}','Tragen Sie zuerst das tatsächliche Ergebnis auf der Seite Testläufe ein, bevor Sie an den Fehlerbericht senden:\n{ids}','اكتب الـ Actual Result الأول في صفحة Test Runs قبل ما تبعت للـ Bug Report: {ids}'],

// ---------- Gaps page ----------
['Gap Log (.xlsx)','سجل الثغرات (.xlsx)','Lückenprotokoll (.xlsx)'],
['Requirements (User Story / AC / BRD / SRS / FRS)','المتطلبات (قصة مستخدم / معايير قبول / BRD / SRS / FRS)','Anforderungen (User Story / AK / BRD / SRS / FRS)'],
['Paste requirements or upload file(s)...','الصق المتطلبات أو ارفع ملفًا/ملفات...','Anforderungen einfügen oder Datei(en) hochladen...'],
['Or Upload File(s) (PDF/Word/Image/Text)','أو ارفع ملفًا/ملفات (PDF/Word/صورة/نص)','Oder Datei(en) hochladen (PDF/Word/Bild/Text)'],
['Report settings','إعدادات التقرير','Berichtseinstellungen'],['Project / Feature name:','اسم المشروع / الميزة:','Projekt-/Funktionsname:'],
['e.g. Cash Withdrawal','مثال: سحب نقدي','z. B. Bargeldabhebung'],['Assign to:','تعيين إلى:','Zuweisen an:'],
['Business Analyst','محلل أعمال','Business-Analyst'],['Product Owner','مالك المنتج','Product Owner'],
['Business Analyst - {n}','محلل أعمال - {n}','Business-Analyst - {n}'],['Product Owner - {n}','مالك المنتج - {n}','Product Owner - {n}'],
['Business Analyst ({n})','محلل أعمال ({n})','Business-Analyst ({n})'],['Product Owner ({n})','مالك المنتج ({n})','Product Owner ({n})'],
['Name (optional):','الاسم (اختياري):','Name (optional):'],['Recipient name','اسم المستلم','Name des Empfängers'],
['Analyze Requirements','تحليل المتطلبات','Anforderungen analysieren'],['Analyzing...','جارٍ التحليل...','Analysiere...'],
['Analyzing section {i} of {n}: {title}','جارٍ تحليل القسم {i} من {n}: {title}','Analysiere Abschnitt {i} von {n}: {title}'],
['Cross-checking consistency between sections...','جارٍ فحص الاتساق بين الأقسام...','Prüfe Konsistenz zwischen Abschnitten...'],
['Stopped.','تم الإيقاف.','Gestoppt.'],
['Paste or upload the requirements and click Analyze Requirements. Each section is analyzed separately, then a cross-section check runs at the end.','الصق المتطلبات أو ارفعها ثم اضغط «تحليل المتطلبات». يُحلَّل كل قسم على حدة، ثم يُجرى فحص بين الأقسام في النهاية.','Fügen Sie die Anforderungen ein oder laden Sie sie hoch und klicken Sie auf „Anforderungen analysieren“. Jeder Abschnitt wird einzeln analysiert, am Ende folgt eine abschnittsübergreifende Prüfung.'],
['Total gaps','إجمالي الثغرات','Lücken gesamt'],['Sections','الأقسام','Abschnitte'],['gap(s)','ثغرة/ثغرات','Lücke(n)'],
['Analysis failed:','فشل التحليل:','Analyse fehlgeschlagen:'],['No gaps found in this section.','لم يتم العثور على ثغرات في هذا القسم.','In diesem Abschnitt wurden keine Lücken gefunden.'],
['Cross-section gaps (','ثغرات بين الأقسام (','Abschnittsübergreifende Lücken ('],
['Ref:','المرجع:','Ref.:'],['Gap:','الثغرة:','Lücke:'],['Evidence:','الدليل:','Beleg:'],['Scenario:','السيناريو:','Szenario:'],['Question to','سؤال إلى','Frage an'],
['Missing requirement','متطلب مفقود','Fehlende Anforderung'],['Ambiguous requirement','متطلب غامض','Mehrdeutige Anforderung'],
['Incomplete requirement','متطلب غير مكتمل','Unvollständige Anforderung'],['Conflicting requirement','متطلب متعارض','Widersprüchliche Anforderung'],
['Assumed / implicit requirement','متطلب مفترض / ضمني','Angenommene / implizite Anforderung'],['Non-functional gap','ثغرة غير وظيفية','Nicht-funktionale Lücke'],
['UI/UX & error-message gap','ثغرة واجهة/تجربة مستخدم ورسائل خطأ','UI/UX- & Fehlermeldungs-Lücke'],
['Negative scenario gap','ثغرة سيناريو سلبي','Lücke bei Negativszenario'],['Business rule gap','ثغرة قاعدة عمل','Geschäftsregel-Lücke'],
['Preconditions','الشروط المسبقة','Vorbedingungen'],['Business Rules','قواعد العمل','Geschäftsregeln'],['Field Validations','التحقق من الحقول','Feldvalidierungen'],
['Assumptions','الافتراضات','Annahmen'],['Dependencies','الاعتمادات','Abhängigkeiten'],['Acceptance Criteria','معايير القبول','Akzeptanzkriterien'],
['Exception Handling','معالجة الاستثناءات','Ausnahmebehandlung'],['UI / Screen Flow','واجهة المستخدم / تدفق الشاشات','UI / Bildschirmablauf'],
['Data Requirements','متطلبات البيانات','Datenanforderungen'],['Out of Scope','خارج النطاق','Außerhalb des Umfangs'],

// ---------- Scenarios page ----------
['Requirements / User Story','المتطلبات / قصة المستخدم','Anforderungen / User Story'],
['Paste requirements or upload file...','الصق المتطلبات أو ارفع ملفًا...','Anforderungen einfügen oder Datei hochladen...'],
['Or Upload File (PDF/Word/Image/Text)','أو ارفع ملفًا (PDF/Word/صورة/نص)','Oder Datei hochladen (PDF/Word/Bild/Text)'],
['Generate Scenarios','توليد السيناريوهات','Szenarien generieren'],['Analyzing Requirements...','جارٍ تحليل المتطلبات...','Analysiere Anforderungen...'],
['✔ Generated using','✔ تم التوليد باستخدام','✔ Generiert mit'],
['Send to Test Generation →','إرسال إلى توليد الاختبارات ←','An Testgenerierung senden →'],
['Provide requirements and click Generate Scenarios.','أدخل المتطلبات ثم اضغط «توليد السيناريوهات».','Geben Sie Anforderungen ein und klicken Sie auf „Szenarien generieren“.'],
['Positive Scenarios ({n})','السيناريوهات الإيجابية ({n})','Positive Szenarien ({n})'],['Negative Scenarios ({n})','السيناريوهات السلبية ({n})','Negative Szenarien ({n})'],
['Edge Case Scenarios ({n})','سيناريوهات الحالات الحدية ({n})','Grenzfall-Szenarien ({n})'],
['— No scenarios of this type in the requirements','— لا توجد سيناريوهات من هذا النوع في المتطلبات','— Keine Szenarien dieses Typs in den Anforderungen','— مفيش سيناريوهات من النوع ده في المتطلبات'],
['Add Test Scenario','إضافة سيناريو اختبار','Testszenario hinzufügen'],
['Type (which section it goes in):','النوع (في أي قسم سيظهر):','Typ (in welchem Abschnitt es erscheint):','Type (هينزل في أنهي قسم):'],
['Scenario title','عنوان السيناريو','Szenario-Titel'],['Add Scenario','إضافة السيناريو','Szenario hinzufügen'],
['Date: {d} &nbsp;|&nbsp; Total scenarios: {n}','التاريخ: {d} &nbsp;|&nbsp; إجمالي السيناريوهات: {n}','Datum: {d} &nbsp;|&nbsp; Szenarien gesamt: {n}'],

// ---------- Generation page ----------
['Test Case Management Workbench','منصة إدارة حالات الاختبار','Testfall-Verwaltung'],
['🐞 Send failed to Bugs ({n})','🐞 إرسال الفاشلة إلى الأخطاء ({n})','🐞 Fehlgeschlagene an Fehler senden ({n})'],
['Creating bugs...','جارٍ إنشاء الأخطاء...','Fehler werden erstellt...'],
['Export Excel (.xlsx)','تصدير Excel (.xlsx)','Excel exportieren (.xlsx)'],
['User Story / Acceptance Criteria','قصة المستخدم / معايير القبول','User Story / Akzeptanzkriterien'],
['Generate Test Cases','توليد حالات الاختبار','Testfälle generieren'],
['Linked Scenarios (','السيناريوهات المرتبطة (','Verknüpfte Szenarien ('],['Remove link','إزالة الربط','Verknüpfung entfernen'],
['Generate Test Cases will build the cases on these scenarios.','سيبني «توليد حالات الاختبار» الحالات على هذه السيناريوهات.','„Testfälle generieren“ erstellt die Testfälle auf Basis dieser Szenarien.','Generate Test Cases هيبني الكيسز على السيناريوهات دي.'],
['Provide inputs and click Generate to start testing.','أدخل المدخلات ثم اضغط «توليد» لبدء الاختبار.','Eingaben bereitstellen und auf „Generieren“ klicken, um zu starten.'],
['Positive Cases ({n})','الحالات الإيجابية ({n})','Positive Fälle ({n})'],['Negative Cases ({n})','الحالات السلبية ({n})','Negative Fälle ({n})'],
['Edge Case Cases ({n})','الحالات الحدية ({n})','Grenzfälle ({n})'],
['Editing Test Case:','تعديل حالة الاختبار:','Testfall bearbeiten:'],['Scenario ID:','رقم السيناريو:','Szenario-ID:'],
['Scenario ID (e.g. TS-01)','رقم السيناريو (مثال TS-01)','Szenario-ID (z. B. TS-01)'],
['Technique:','التقنية:','Technik:'],['Technique','التقنية','Technik'],['Pre-Condition:','الشرط المسبق:','Vorbedingung:'],['Pre-condition','الشرط المسبق','Vorbedingung'],
['Test Data:','بيانات الاختبار:','Testdaten:'],['Test data','بيانات الاختبار','Testdaten'],
['Steps (one step per line):','الخطوات (خطوة في كل سطر):','Schritte (ein Schritt pro Zeile):'],['Enter each step on a new line','اكتب كل خطوة في سطر جديد','Jeden Schritt in eine neue Zeile schreiben'],
['Expected Result:','النتيجة المتوقعة:','Erwartetes Ergebnis:'],['Expected result','النتيجة المتوقعة','Erwartetes Ergebnis'],['Save Changes','حفظ التعديلات','Änderungen speichern'],
['Steps:','الخطوات:','Schritte:'],['Expected:','المتوقع:','Erwartet:'],['Actual Result:','النتيجة الفعلية:','Tatsächliches Ergebnis:'],['Enter actual result...','اكتب النتيجة الفعلية...','Tatsächliches Ergebnis eingeben...'],
['· View','· عرض','· Ansehen'],['🐞 Send to Bug Report','🐞 إرسال إلى تقرير الأخطاء','🐞 An Fehlerbericht senden'],
['Write the Actual Result first so you can send it to the Bug Report.','اكتب «النتيجة الفعلية» أولًا لتتمكن من الإرسال إلى تقرير الأخطاء.','Tragen Sie zuerst das tatsächliche Ergebnis ein, um an den Fehlerbericht zu senden.','اكتب الـ Actual Result الأول عشان تقدر تبعت للـ Bug Report.'],
['(incomplete: not all types present, try Generate again)','(ناقص: ليست كل الأنواع موجودة، جرّب التوليد مرة أخرى)','(unvollständig: nicht alle Typen vorhanden, erneut generieren)'],
['Add Test Case','إضافة حالة اختبار','Testfall hinzufügen'],['Test case title','عنوان حالة الاختبار','Testfall-Titel'],
['e.g. Boundary Value Analysis','مثال: تحليل القيم الحدية','z. B. Grenzwertanalyse'],

// ---------- Bugs page ----------
['Auto-create from failed test cases','إنشاء تلقائي من حالات الاختبار الفاشلة','Automatisch aus fehlgeschlagenen Testfällen erstellen'],
['On the Test Generation page, set any test case to Fail and a Send to Bug Report button will appear. You can also send all failed cases at once from here.','في صفحة توليد الاختبارات غيّر حالة أي حالة إلى «فاشل» وسيظهر زر الإرسال إلى تقرير الأخطاء. ويمكنك أيضًا إرسال كل الحالات الفاشلة دفعة واحدة من هنا.','Setzen Sie auf der Seite Testgenerierung einen Testfall auf „Fehlgeschlagen“, dann erscheint die Schaltfläche „An Fehlerbericht senden“. Sie können hier auch alle fehlgeschlagenen Fälle auf einmal senden.','في صفحة Test Generation غيّر حالة أي كيس لـ Fail، وهيظهر عليه زرار Send to Bug Report. تقدر كمان تبعت كل الـ Fail مرة واحدة من هنا.'],
['Create bugs from failed cases ({n})','إنشاء أخطاء من الحالات الفاشلة ({n})','Fehler aus fehlgeschlagenen Fällen erstellen ({n})'],
['Creating bug reports...','جارٍ إنشاء تقارير الأخطاء...','Fehlerberichte werden erstellt...'],
['Writing bug report for {id}...','جارٍ كتابة تقرير الخطأ لـ {id}...','Fehlerbericht für {id} wird geschrieben...'],
['Default environment (applied to any new bug):','البيئة الافتراضية (تُطبَّق على أي خطأ جديد):','Standardumgebung (wird auf jeden neuen Fehler angewendet):','Default environment (بيتحط في أي باج جديد):'],
['e.g. ATM Balance Inquiry','مثال: الاستعلام عن رصيد ATM','z. B. ATM-Kontostandsabfrage'],
['Total bugs','إجمالي الأخطاء','Fehler gesamt'],['Critical / High','حرجة / عالية','Kritisch / Hoch'],
['🐞 Bugs (','🐞 الأخطاء (','🐞 Fehler ('],['🔗 Traceability Matrix','🔗 مصفوفة التتبع','🔗 Rückverfolgbarkeitsmatrix'],
['No bugs yet. Mark any test case as Fail in Test Generation and send it here, or click + Add for a manual bug.','لا توجد أخطاء بعد. اجعل أي حالة اختبار «فاشلة» في توليد الاختبارات وأرسلها هنا، أو اضغط «+ إضافة» لخطأ يدوي.','Noch keine Fehler. Setzen Sie einen Testfall in der Testgenerierung auf „Fehlgeschlagen“ und senden Sie ihn hierher, oder klicken Sie auf „+ Hinzufügen“ für einen manuellen Fehler.','مفيش باجز لسه. اعمل Fail لأي test case في Test Generation وابعته هنا، أو دوس + Add لباج يدوي.'],
['No test cases or bugs to link yet.','لا توجد حالات اختبار أو أخطاء للربط بعد.','Noch keine Testfälle oder Fehler zum Verknüpfen.','لسه مفيش test cases أو باجز تتربط.'],
['Bug ID','رقم الخطأ','Fehler-ID'],['Module','الوحدة','Modul'],['Severity','الخطورة','Schweregrad'],['Environment','البيئة','Umgebung'],['Environment:','البيئة:','Umgebung:'],
['Steps to Reproduce','خطوات إعادة الإنتاج','Schritte zur Reproduktion'],['Test Data','بيانات الاختبار','Testdaten'],['Expected Result','النتيجة المتوقعة','Erwartetes Ergebnis'],
['Actual Result','النتيجة الفعلية','Tatsächliches Ergebnis'],['Linked Test Case','حالة الاختبار المرتبطة','Verknüpfter Testfall'],['Linked Scenario','السيناريو المرتبط','Verknüpftes Szenario'],
['Bug title','عنوان الخطأ','Fehlertitel'],['Feature / screen','الميزة / الشاشة','Funktion / Bildschirm'],
['— none —','— لا شيء —','— keine —'],['{id} (not in current test cases)','{id} (غير موجودة في حالات الاختبار الحالية)','{id} (nicht in den aktuellen Testfällen)'],
['— Select environment —','— اختر البيئة —','— Umgebung wählen —'],['Other (type manually)','أخرى (اكتب يدويًا)','Andere (manuell eingeben)'],
['e.g. Build v2.3.1, Staging, Chrome 126 on Windows 11','مثال: Build v2.3.1، Staging، Chrome 126 على Windows 11','z. B. Build v2.3.1, Staging, Chrome 126 unter Windows 11'],
['This bug traces back to Scenario {s} → Test Case {c} — caught during execution.','يعود هذا الخطأ إلى السيناريو {s} ← حالة الاختبار {c} — تم اكتشافه أثناء التنفيذ.','Dieser Fehler geht zurück auf Szenario {s} → Testfall {c} — bei der Ausführung entdeckt.'],
['This bug traces back to Test Case {c} — caught during execution.','يعود هذا الخطأ إلى حالة الاختبار {c} — تم اكتشافه أثناء التنفيذ.','Dieser Fehler geht zurück auf Testfall {c} — bei der Ausführung entdeckt.'],
['This bug traces back to Scenario {s} → a manually reported defect — caught during execution.','يعود هذا الخطأ إلى السيناريو {s} ← عيب تم الإبلاغ عنه يدويًا — تم اكتشافه أثناء التنفيذ.','Dieser Fehler geht zurück auf Szenario {s} → einen manuell gemeldeten Fehler — bei der Ausführung entdeckt.'],
['This bug traces back to a manually reported defect — caught during execution.','يعود هذا الخطأ إلى عيب تم الإبلاغ عنه يدويًا — تم اكتشافه أثناء التنفيذ.','Dieser Fehler geht zurück auf einen manuell gemeldeten Fehler — bei der Ausführung entdeckt.'],

// ---------- Word reports ----------
['Project / Feature:','المشروع / الميزة:','Projekt / Funktion:'],['Reported by:','أعدّه:','Gemeldet von:'],['Prepared for:','أُعدّ لـ:','Erstellt für:'],['Prepared by:','أعدّه:','Erstellt von:'],
['Source documents:','المستندات المصدر:','Quelldokumente:'],
['1. Summary','1. الملخص','1. Zusammenfassung'],['2. Bug Details','2. تفاصيل الأخطاء','2. Fehlerdetails'],['3. Traceability Matrix','3. مصفوفة التتبع','3. Rückverfolgbarkeitsmatrix'],
['No bugs reported.','لم يتم الإبلاغ عن أخطاء.','Keine Fehler gemeldet.'],
['Requirement Gap Analysis Report','تقرير تحليل ثغرات المتطلبات','Bericht zur Anforderungslücken-Analyse'],
['1. Executive Summary','1. الملخص التنفيذي','1. Zusammenfassung für die Geschäftsleitung'],
['The requirements were reviewed section by section against a structured gap-analysis methodology (completeness of requirement components, testability, consistency, and the standard gap types). A total of','تمت مراجعة المتطلبات قسمًا قسمًا وفق منهجية منظمة لتحليل الثغرات (اكتمال مكوّنات المتطلب، وقابلية الاختبار، والاتساق، وأنواع الثغرات القياسية). تم تحديد إجمالي','Die Anforderungen wurden Abschnitt für Abschnitt anhand einer strukturierten Methodik zur Lückenanalyse geprüft (Vollständigkeit der Anforderungskomponenten, Testbarkeit, Konsistenz und Standard-Lückentypen). Insgesamt wurden'],
['gaps were identified across','ثغرة في','Lücken identifiziert in'],
['section(s), including cross-section checks.','قسم (أقسام)، بما في ذلك فحوصات الاتساق بين الأقسام.','Abschnitt(en), einschließlich abschnittsübergreifender Prüfungen.'],
['Gaps by type','الثغرات حسب النوع','Lücken nach Typ'],['Gap type','نوع الثغرة','Lückentyp'],
['Please review each item below and provide the requested decisions. Each gap includes the exact requirement reference, a concrete scenario showing the impact, and the specific question that needs an answer.','يرجى مراجعة كل بند أدناه وتقديم القرارات المطلوبة. تتضمن كل ثغرة المرجع الدقيق للمتطلب، وسيناريو ملموسًا يوضح الأثر، والسؤال المحدد المطلوب الإجابة عنه.','Bitte prüfen Sie jeden Punkt unten und treffen Sie die erbetenen Entscheidungen. Jede Lücke enthält die genaue Anforderungsreferenz, ein konkretes Szenario mit den Auswirkungen und die konkrete Frage, die beantwortet werden muss.'],
['2. Findings by Section','2. النتائج حسب القسم','2. Ergebnisse nach Abschnitt'],
['Document: {d} | Level: {l}','المستند: {d} | المستوى: {l}','Dokument: {d} | Ebene: {l}'],['Document: {d}','المستند: {d}','Dokument: {d}'],
['This section could not be analyzed: {e}','تعذر تحليل هذا القسم: {e}','Dieser Abschnitt konnte nicht analysiert werden: {e}'],
['Requirement component','مكوّن المتطلب','Anforderungskomponente'],['Coverage','التغطية','Abdeckung'],
['No gaps identified in this section.','لم يتم تحديد ثغرات في هذا القسم.','In diesem Abschnitt wurden keine Lücken festgestellt.'],
['3. Cross-Section Findings','3. النتائج بين الأقسام','3. Abschnittsübergreifende Ergebnisse'],['No cross-section gaps identified.','لم يتم تحديد ثغرات بين الأقسام.','Keine abschnittsübergreifenden Lücken festgestellt.'],
['Gap ID','رقم الثغرة','Lücken-ID'],['Requirement Ref.','مرجع المتطلب','Anforderungsreferenz'],
['Question to {a}','سؤال إلى {a}','Frage an {a}'],['Evidence: {e}','الدليل: {e}','Beleg: {e}'],
['4. Questions Requiring a Decision from the {a}','4. أسئلة تتطلب قرارًا من {a}','4. Fragen, die eine Entscheidung von {a} erfordern'],
['5. Consolidated Gap Log','5. سجل الثغرات الموحّد','5. Konsolidiertes Lückenprotokoll'],['No gaps identified.','لم يتم تحديد ثغرات.','Keine Lücken festgestellt.'],
['Status values: Open / Answered / Closed. Owner: {o}','قيم الحالة: مفتوح / تمت الإجابة / مغلق. المسؤول: {o}','Statuswerte: Offen / Beantwortet / Geschlossen. Verantwortlich: {o}'],

// ---------- نصوص عربية كانت ثابتة في الواجهة — بتتمتص هنا وبتترجم حسب لغة الموقع ----------
['Pending changes are stored in this browser and will sync when the connection returns','التغييرات المعلّقة محفوظة مؤقتًا في المتصفح ده وهتتزامن لما الاتصال يرجع','Ausstehende Änderungen werden in diesem Browser gespeichert und synchronisiert, sobald die Verbindung wiederhergestellt ist.'],
['Offline. New changes will be queued for sync when the connection returns.','مفيش اتصال بالإنترنت. التغييرات الجديدة هتتحفظ مؤقتًا للمزامنة لما الاتصال يرجع.','Offline. Neue Änderungen werden zur Synchronisierung vorgemerkt, sobald die Verbindung wiederhergestellt ist.'],
['This account is already open in another tab','الحساب ده مفتوح بالفعل في تبويب تاني','Dieses Konto ist bereits in einem anderen Tab geöffnet'],
['Checking this account tab...','جارٍ التحقق من وجود تبويب آخر للحساب...','Dieser Konto-Tab wird überprüft...'],
['Only one active tab per account is allowed in this browser. Close the other tab, then refresh this page. You can still use this account on another device.','مسموح بتبويب نشط واحد فقط للحساب في المتصفح ده. اقفل التبويب التاني وبعدها حدّث الصفحة. تقدر تستخدم الحساب على جهاز تاني.','Pro Konto ist in diesem Browser nur ein aktiver Tab erlaubt. Schließen Sie den anderen Tab und aktualisieren Sie diese Seite. Auf einem anderen Gerät können Sie dieses Konto weiterhin verwenden.'],
['The account tab lock could not be checked. Refresh the page or close other Vetly tabs.','تعذر التحقق من قفل تبويب الحساب. حدّث الصفحة أو اقفل تبويبات Vetly التانية.','Die Kontosperre für Tabs konnte nicht überprüft werden. Aktualisieren Sie die Seite oder schließen Sie andere Vetly-Tabs.'],
['Please wait while Vetly checks for another active tab.','انتظر لحد ما Vetly يتأكد إن مفيش تبويب نشط تاني.','Bitte warten Sie, während Vetly nach einem anderen aktiven Tab sucht.'],
["Discard this tab's unsaved changes and reload the latest cloud copy?",'تجاهل التغييرات غير المحفوظة في التبويب ده وتحميل أحدث نسخة من السحابة؟','Nicht gespeicherte Änderungen in diesem Tab verwerfen und die neueste Cloud-Kopie laden?'],
['Could not reload the cloud copy. Your local changes were kept.','تعذر تحميل نسخة السحابة. تم الاحتفاظ بتغييراتك المحلية.','Die Cloud-Kopie konnte nicht geladen werden. Ihre lokalen Änderungen wurden beibehalten.'],
["Replace the cloud story with this tab's local copy? This overwrites the newer cloud version.",'استبدال القصة في السحابة بالنسخة المحلية في التبويب ده؟ ده هيكتب فوق نسخة السحابة الأحدث.','Die Cloud-Story durch die lokale Kopie dieses Tabs ersetzen? Dadurch wird die neuere Cloud-Version überschrieben.'],
['Could not preserve local changes.','تعذر الحفاظ على التغييرات المحلية.','Lokale Änderungen konnten nicht gesichert werden.'],
['This story changed in another tab or device.','القصة دي اتعدلت في تبويب أو جهاز تاني.','Diese Story wurde in einem anderen Tab oder auf einem anderen Gerät geändert.'],
["This tab has local edits and the cloud copy has changed too. Reloading discards this tab's unsaved edits; keeping local replaces the cloud copy.",'فيه تعديلات محلية في التبويب ده ونسخة السحابة اتغيرت كمان. تحميل السحابة هيلغي التعديلات المحلية غير المحفوظة؛ والاحتفاظ بالمحلي هيستبدل نسخة السحابة.','Dieser Tab enthält lokale Änderungen und auch die Cloud-Kopie wurde geändert. Beim Neuladen werden die lokalen, nicht gespeicherten Änderungen verworfen; beim Beibehalten der lokalen Version wird die Cloud-Kopie ersetzt.'],
['Reload cloud copy','تحميل نسخة السحابة','Cloud-Kopie laden'],
['Keep this tab and overwrite cloud','الاحتفاظ بهذا التبويب واستبدال نسخة السحابة','Diesen Tab behalten und Cloud überschreiben'],
['Could not load this cloud story','تعذر تحميل القصة من السحابة','Diese Cloud-Story konnte nicht geladen werden'],
['Loading cloud story...','جارٍ تحميل القصة من السحابة...','Cloud-Story wird geladen...'],
['The workspace was not replaced. Check your connection and retry; existing local data is preserved.','لم يتم استبدال مساحة العمل. تحقق من الاتصال وحاول مجددًا؛ تم الحفاظ على البيانات المحلية الموجودة.','Der Arbeitsbereich wurde nicht ersetzt. Prüfen Sie die Verbindung und versuchen Sie es erneut; vorhandene lokale Daten bleiben erhalten.'],
['Please wait while Vetly loads the selected story before enabling edits.','انتظر لحد ما Vetly يحمل القصة المختارة قبل تفعيل التعديل.','Bitte warten Sie, bis Vetly die ausgewählte Story geladen hat, bevor Sie Änderungen vornehmen.'],
['Retry cloud load','إعادة محاولة التحميل من السحابة','Cloud-Laden erneut versuchen'],
['Saving changes...','جارٍ حفظ التغييرات...','Änderungen werden gespeichert...'],
['All changes saved','تم حفظ كل التغييرات','Alle Änderungen gespeichert'],
['Pending changes','تغييرات معلّقة','Ausstehende Änderungen'],
['Cloud conflict needs attention','تعارض السحابة يحتاج مراجعة','Cloud-Konflikt erfordert Aufmerksamkeit'],
['Sync needs attention','المزامنة تحتاج مراجعة','Synchronisierung erfordert Aufmerksamkeit'],
['Sync status','حالة المزامنة','Synchronisierungsstatus'],
['Pending snapshots','لقطات معلّقة','Ausstehende Snapshots'],
['Last saved','آخر حفظ','Zuletzt gespeichert'],
['Retry sync','إعادة محاولة المزامنة','Synchronisierung erneut versuchen'],
['Sync retry is not available yet.','إعادة محاولة المزامنة غير متاحة حاليًا.','Erneuter Synchronisierungsversuch ist derzeit nicht verfügbar.'],
['Some pending snapshots still need synchronization.','لا تزال بعض اللقطات المعلّقة بحاجة إلى المزامنة.','Einige ausstehende Snapshots müssen noch synchronisiert werden.'],
['Recheck account tab','إعادة فحص تبويب الحساب','Konto-Tab erneut prüfen'],
['Comparing story versions...','جارٍ مقارنة نسخ القصة...','Story-Versionen werden verglichen...'],
['Different workspace fields','حقول مساحة العمل المختلفة','Unterschiedliche Arbeitsbereichsfelder'],
['local-only','موجود محليًا فقط','Nur lokal'],
['cloud-only','موجود في السحابة فقط','Nur in der Cloud'],
['changed','تم تغييره','Geändert'],
['Local','محلي','Lokal'],
['Cloud','السحابة','Cloud'],
['The account keeps your work in the cloud: separate projects, auto-save, and access from any device. Create a new account or sign in.','الحساب بيتيقي شغلك في السحابة: مشاريع منفصلة، حفظ تلقائي، وفتح من أي جهاز. اعمل حساب جديد أو ادخل بحسابك.','Das Konto sichert Ihre Arbeit in der Cloud: getrennte Projekte, Auto-Save und Zugriff von jedem Gerät. Erstellen Sie ein neues Konto oder melden Sie sich an.'],
['Project "{p}" is open — open an existing user story or create a new one from My Projects.','المشروع "{p}" مفتوح — افتح يوزر ستوري موجودة أو اعمل واحدة جديدة من My Projects.','Projekt "{p}" ist offen — öffnen Sie eine vorhandene User Story oder erstellen Sie eine neue unter My Projects.'],
['All features work inside a project. Open an existing project or create a new one from My Projects.','كل الميزات بتشتغل جوه مشروع. افتح مشروع موجود أو اعمل واحد جديد من My Projects.','Alle Funktionen laufen innerhalb eines Projekts. Öffnen Sie ein vorhandenes Projekt oder erstellen Sie ein neues unter My Projects.'],
['Write the first scenario title.','اكتب عنوان السيناريو الأول.','Schreiben Sie den ersten Szenariotitel.'],
['Copy scenarios from here:','انسخ السيناريوهات من هنا:','Szenarien von hier kopieren:'],
['Excel library failed to load. Use the Word export instead.','تعذر تحميل مكتبة Excel. استخدم تصدير Word بدلها.','Excel-Bibliothek konnte nicht geladen werden. Verwenden Sie den Word-Export.'],
['Scenarios copied ✔','تم نسخ السيناريوهات ✔','Szenarien kopiert ✔'],
['All APIs failed. Details are shown under the Generate button.','كل الـ APIs فشلت. التفاصيل ظاهرة تحت زر Generate.','Alle APIs fehlgeschlagen. Details stehen unter der Schaltfläche Generate.'],
['No API key at all. Open Settings and add at least one key.','مفيش ولا API key. افتح Settings وحط مفتاح واحد على الأقل.','Kein API-Schlüssel vorhanden. Öffnen Sie Settings und fügen Sie mindestens einen Schlüssel hinzu.'],
['Pick or type a scenario number (e.g. TS-01).','اختار أو اكتب رقم السيناريو (مثلاً TS-01).','Wählen oder tippen Sie eine Szenario-Nummer (z. B. TS-01).'],
['Write the first test case title.','اكتب عنوان التيست كيس الأول.','Schreiben Sie den ersten Testfall-Titel.'],
['Excel library failed to load; exporting as CSV.','تعذر تحميل مكتبة Excel، هيتم التصدير كـ CSV.','Excel-Bibliothek konnte nicht geladen werden; Export als CSV.'],
['Name + Base URL + API key are required.','Name + Base URL + API key مطلوبين.','Name, Basis-URL und API-Schlüssel sind erforderlich.'],
['Restoring will replace ALL current data (including keys) with this backup. Continue?','الاسترجاع هيستبدل كل الداتا الحالية (بما فيها المفاتيح) بالنسخة دي. تكمل؟','Die Wiederherstellung ersetzt ALLE aktuellen Daten (einschließlich Schlüssel) durch dieses Backup. Fortfahren?'],
['Restored ✔ Changes will sync when a project is open and connected.','تم الاسترجاع ✔ التغييرات هتتزامن لما يكون فيه مشروع مفتوح والاتصال متاح.','Wiederhergestellt ✔ Änderungen werden synchronisiert, sobald ein Projekt geöffnet und verbunden ist.'],
['Restore failed: {e}','فشل الاسترجاع: {e}','Wiederherstellung fehlgeschlagen: {e}'],
['Invalid file','ملف غير صالح','Ungültige Datei'],
['Model (optional, default: {m})','Model (اختياري، الافتراضي: {m})','Modell (optional, Standard: {m})'],
['first available model','أول موديل متاح','erstes verfügbares Modell'],
['or restore it on any other browser/device. Restoring replaces the current data.','أو استرجعها على أي متصفح/جهاز تاني. الاسترجاع بيستبدل الداتا الحالية.','oder stellen Sie sie in jedem anderen Browser/Gerät wieder her. Die Wiederherstellung ersetzt die aktuellen Daten.'],
['These stats are from the last cloud save of the project','الإحصائيات دي من آخر نسخة محفوظة في السحابة للمشروع','Diese Statistiken stammen aus der letzten Cloud-Speicherung des Projekts'],
['open now','المفتوح دلوقتي','jetzt offen'],
['not currently open','مش مفتوح حاليًا','derzeit nicht offen'],
['You have local work on this device with no open project.\nUpload it and link it to the new project "{p}"?','عندك شغل محلي على الجهاز ده من غير مشروع مفتوح.\nتحب ترفعه وتربطه بالمشروع الجديد "{p}"؟','Sie haben lokale Arbeit auf diesem Gerät ohne offenes Projekt.\nMöchten Sie sie hochladen und mit dem neuen Projekt "{p}" verknüpfen?'],
['Write the Actual Result first in Test Runs before sending to Bug Report:\n{list}','اكتب الـ Actual Result الأول في صفحة Test Runs قبل ما تبعت للـ Bug Report:\n{list}','Schreiben Sie zuerst das tatsächliche Ergebnis in Test Runs, bevor Sie an den Bug-Bericht senden:\n{list}'],
['Delete all bugs?','تمسح كل الباجز؟','Alle Bugs löschen?'],
['Browser storage is full. Download a Backup from Settings and remove old bug screenshots.','مساحة التخزين في المتصفح امتلأت. نزّل Backup من Settings، وشيل صور قديمة من الباجز.','Der Browser-Speicher ist voll. Laden Sie ein Backup aus Settings herunter und entfernen Sie alte Bug-Screenshots.'],
['Excel library failed to load. Download the (Word) report instead.','تعذر تحميل مكتبة Excel. حمّل التقرير (Word) بدلها.','Excel-Bibliothek konnte nicht geladen werden. Laden Sie stattdessen den (Word-)Bericht herunter.'],
['Excel library failed to load. Download the Word report instead.','تعذر تحميل مكتبة Excel. حمّل تقرير Word بدلها.','Excel-Bibliothek konnte nicht geladen werden. Laden Sie stattdessen den Word-Bericht herunter.'],
['No Test Cases. Generate cases first in Test Generation, then log runs from here.','مفيش Test Cases. ولّد الكيسز الأول في صفحة Test Generation وبعدين سجّل الجولات من هنا.','Keine Testfälle. Erzeugen Sie zuerst Fälle in Test Generation und erfassen Sie dann hier Läufe.'],
['Press again to stop and send','اضغط تاني للإيقاف والإرسال','Erneut drücken zum Stoppen und Senden'],
['No messages to save.','مفيش رسايل للحفظ.','Keine Nachrichten zum Speichern.'],
['Copy the code from here:','انسخ الكود من هنا:','Code von hier kopieren:'],
['Zip library failed to load. Download the files one by one.','تعذر تحميل مكتبة الضغط. نزّل الملفات واحدة واحدة.','Zip-Bibliothek konnte nicht geladen werden. Laden Sie die Dateien einzeln herunter.'],
['Code copied ✔','تم نسخ الكود ✔','Code kopiert ✔'],
['From DevTools: right-click the page → Copy → Copy outerHTML and paste here…','من DevTools: كليك يمين على الصفحة → Copy → Copy outerHTML والصقه هنا…','Aus DevTools: Rechtsklick auf die Seite → Copy → Copy outerHTML und hier einfügen…'],
['⚠️ Add at least one API key in Settings first.','⚠️ حط مفتاح API واحد على الأقل في Settings الأول.','⚠️ Fügen Sie zuerst mindestens einen API-Schlüssel in Settings hinzu.'],
['Revoke this link? Nobody will be able to open it anymore.','إبطال اللينك ده؟ أي حد معاه مش هيقدر يفتحه تاني.','Diesen Link widerrufen? Niemand kann ihn dann mehr öffnen.'],
['Pick a feature first.','اختر الفيتشر الأول.','Wählen Sie zuerst die Funktion.'],
['Pick a user story first.','اختر اليوزر ستوري الأول.','Wählen Sie zuerst die User Story.'],
['No cloud data for this story — open it and make sure it was saved.','مفيش داتا للستوري دي في السحابة — افتحها واتأكد إنها اتحفظت.','Keine Cloud-Daten für diese Story — öffnen Sie sie und stellen Sie sicher, dass sie gespeichert wurde.'],
['📁 Whole project','📁 المشروع كله','📁 Gesamtes Projekt'],
['📖 One story','📖 ستوري واحدة','📖 Eine Story'],
['🧩 Feature in a story','🧩 فيتشر من ستوري','🧩 Funktion in einer Story'],
['The link shows the content read-only — the visitor cannot edit or use any feature. The link is live: it updates automatically with every save, so the visitor always sees the latest version of your work without you creating a new link.','اللينك بيعرض المحتوى للقراءة فقط — الزائر مش بيقدر يعدّل ولا يستخدم أي فيتشر. اللينك live: بيتحدّث تلقائيًا مع كل حفظ، فالزائر بيشوف دايمًا آخر نسخة من شغلك من غير ما تعمل لينك جديد.','Der Link zeigt den Inhalt schreibgeschützt — der Besucher kann nichts bearbeiten und keine Funktion nutzen. Der Link ist live: Er aktualisiert sich automatisch bei jedem Speichern, sodass der Besucher immer die neueste Version Ihrer Arbeit sieht.'],
['This link is revoked or does not exist — ask the project owner for a new link.','هذا اللينك ملغي أو مش موجود — اطلب لينك جديد من صاحب المشروع.','Dieser Link ist widerrufen oder existiert nicht — fordern Sie einen neuen Link vom Projektinhaber an.'],
['User story:','اليوزر ستوري:','User Story:'],
['Feature:','الفيتشر:','Funktion:'],
['— no user stories in this project —','— مفيش يوزر ستوريز في المشروع ده —','— keine User Stories in diesem Projekt —'],
['✔ Link created & copied','✔ اتعمل اللينك واتنسخ','✔ Link erstellt & kopiert'],
['Existing links','اللينكات الموجودة','Vorhandene Links'],
['deleting revokes a link immediately','الحذف بيلغي اللينك فورًا','Löschen widerruft einen Link sofort'],
['No links yet.','مفيش لينكات قديمة.','Noch keine Links.'],
['Priority: OpenRouter ← ChatGPT ← Claude ← Gemini. Any provider with an empty key is skipped. Keys are stored in your browser only (localStorage).','الأولوية: OpenRouter ← ChatGPT ← Claude ← Gemini. بيتخطى أي واحد مفتاحه فاضي. المفاتيح بتتخزن في متصفحك بس (localStorage).','Priorität: OpenRouter ← ChatGPT ← Claude ← Gemini. Anbieter mit leerem Schlüssel werden übersprungen. Schlüssel werden nur in Ihrem Browser gespeichert (localStorage).'],
['Download a backup of everything (analysis + cases + runs + bugs + keys) in one JSON file, or restore it on any other browser/device. Restoring replaces the current data.','نزّل نسخة من كل حاجة (التحليل + الكيسز + الجولات + الباجز + المفاتيح) في ملف JSON واحد، أو استرجعها على أي متصفح/جهاز تاني. الاسترجاع بيستبدل الداتا الحالية.','Laden Sie ein Backup von allem (Analyse + Fälle + Läufe + Bugs + Schlüssel) in einer JSON-Datei herunter, oder stellen Sie es in jedem anderen Browser/Gerät wieder her. Die Wiederherstellung ersetzt die aktuellen Daten.'],
['Any OpenAI-compatible API: put the Base URL ending with {b} (e.g. https://api.deepseek.com/v1) — the app completes the rest of the path automatically, and it appears immediately in the Model list.','أي API بصيغة OpenAI: حط الـ Base URL المنتهي بـ {b} (مثلًا https://api.deepseek.com/v1) — التطبيق بيكمّل باقي المسار تلقائيًا، وبيظهر فورًا في قايمة الـ Model.','Jede OpenAI-kompatible API: Geben Sie die Basis-URL mit Endung {b} ein (z. B. https://api.deepseek.com/v1) — die App ergänzt den Pfad automatisch, und sie erscheint sofort in der Modell-Liste.'],
// ---------- Share viewer: Summary Report ----------
['Not enough data for the summary report yet.','لسه مفيش داتا كفاية لتقرير الملخص.','Noch nicht genügend Daten für den Zusammenfassungsbericht.'],
['The report aggregates from: Requirement Gaps + Test Scenarios + Test Generation + Test Runs + Bug Report.','التقرير بيجمّع من: Requirement Gaps + Test Scenarios + Test Generation + Test Runs + Bug Report.','Der Bericht fasst zusammen aus: Requirement Gaps + Test Scenarios + Test Generation + Test Runs + Bug Report.'],
['Not enough data for the project summary report yet.','لسه مفيش داتا كفاية لتقرير الملخص للمشروع.','Noch nicht genügend Daten für den Projekt-Zusammenfassungsbericht.'],
['The report aggregates from all user stories: Requirement Gaps + Test Scenarios + Test Generation + Test Runs + Bug Report.','التقرير بيجمّع من كل اليوزر ستوريز: Requirement Gaps + Test Scenarios + Test Generation + Test Runs + Bug Report.','Der Bericht fasst alle User Stories zusammen: Requirement Gaps + Test Scenarios + Test Generation + Test Runs + Bug Report.'],
['Automatic summary of all work outputs (Gaps + Scenarios + Cases + Runs + Bugs)','تقرير ملخص تلقائي من كل مخرجات الشغل (Gaps + Scenarios + Cases + Runs + Bugs)','Automatische Zusammenfassung aller Arbeitsergebnisse (Gaps + Szenarien + Fälle + Läufe + Bugs)'],
['Aggregated summary from all user stories ({n} stories)','تقرير ملخص مجمع من كل اليوزر ستوريز ({n} stories)','Aggregierte Zusammenfassung aus allen User Stories ({n} Stories)'],
['Project Summary Report','تقرير ملخص المشروع','Projekt-Zusammenfassungsbericht'],
['PDF export failed','فشل تصدير PDF','PDF-Export fehlgeschlagen'],
['Some files could not be read and were not sent:','فيه ملفات مقدرناش نقراها فما اتبعتتش:','Einige Dateien konnten nicht gelesen werden und wurden nicht gesendet:'],
];

/* ---------------------------------------------------------------------
   المحرك
   --------------------------------------------------------------------- */
const _norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const _escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const _exact = new Map();
const _byForm = new Map();
const _patterns = [];

I18N_ENTRIES.forEach(entry => {
    entry.forEach(form => {
        const n = _norm(form);
        if (!_byForm.has(n)) _byForm.set(n, entry);
        if (!/\{\w+\}/.test(n)) { if (!_exact.has(n)) _exact.set(n, entry); return; }
        const names = [];
        let src = '';
        n.split(/\{(\w+)\}/).forEach((part, i) => {
            if (i % 2) { names.push(part); src += '([\\s\\S]+?)'; } else src += _escRe(part);
        });
        _patterns.push({ re: new RegExp('^' + src + '$'), names, entry });
    });
});

let _lang = (() => {
    try { const l = localStorage.getItem('vetly_lang'); return LANG_INDEX[l] !== undefined ? l : 'en'; } catch (e) { return 'en'; }
})();
const _listeners = new Set();

function getLang() { return _lang; }

/* ---------- لغة مخرجات الـ AI ----------
   بتتبعت ملحقة بآخر أي prompt عشان الموديل يكتب المحتوى بنفس لغة الموقع المختارة.
   المعرّفات (TC-01...) وأسماء الأنواع/الأولويات/الحالات بتفضل زي ما هي بالإنجليزي
   عشان منطق التطبيق (فلترة/عدّ/ألوان) يفهمها — وكل النص الحرج يتكتب بلغة الموقع. */
function aiLangInstr() {
    const name = { en: 'English', ar: 'Arabic', de: 'German' }[_lang] || 'English';
    return '\n\nOUTPUT LANGUAGE (MANDATORY): Write ALL generated text content — titles, steps, descriptions, expected/actual results, summaries, notes, questions, scenarios — in ' + name +
        '. Do NOT translate or alter: identifiers (TS-01, TC-01, GAP-001, BUG-001, RUN-01) and the exact enum words for type (Positive / Negative / Edge Case), priority & severity (Critical / High / Medium / Low), and status (New / Open / In Progress / Fixed / Retest / Closed / Rejected / Answered / Pass / Fail / Blocked / Skipped / Untested) — those MUST stay exactly as specified in this prompt.';
}

function _fill(tpl, vars, li) {
    return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (k in vars) ? (_lookup(vars[k], li) ?? vars[k]) : m);
}

function _lookup(s, li) {
    const n = _norm(s);
    if (!n) return null;
    const e = _exact.get(n);
    if (e) return e[li];
    for (const p of _patterns) {
        const m = p.re.exec(n);
        if (m) {
            const vars = {};
            p.names.forEach((k, i) => { vars[k] = m[i + 1]; });
            return _fill(p.entry[li], vars, li);
        }
    }
    return null;
}

// tr('نص') أو tr('Key: {k}', { k: 1 })
function tr(text, vars) {
    const li = LANG_INDEX[_lang];
    if (vars) {
        const e = _byForm.get(_norm(text));
        return _fill(e ? e[li] : text, vars, li);
    }
    const r = _lookup(text, li);
    return r == null ? String(text == null ? '' : text) : r;
}

function _trKeep(s, li) {
    const r = _lookup(s, li);
    if (r == null) return s;
    return s.match(/^\s*/)[0] + r + s.match(/\s*$/)[0];
}

/* ---------- ترجمة الـ DOM (نصوص + placeholder) ---------- */
const _textOrig = new WeakMap();
const _attrOrig = new WeakMap();
const _SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, NOSCRIPT: 1 };
const _ATTRS = ['placeholder', 'title'];

function _doText(node) {
    const el = node.parentElement;
    if (!el || _SKIP[el.tagName] || el.closest('[data-notr]')) return;
    const li = LANG_INDEX[_lang];
    const rec = _textOrig.get(node);
    const cur = node.nodeValue;
    const orig = (rec && rec.shown === cur) ? rec.orig : cur;
    const next = _trKeep(orig, li);
    if (next !== cur) node.nodeValue = next;
    _textOrig.set(node, { orig, shown: next });
}

function _doAttr(el, attr) {
    if (!el.getAttribute || el.closest('[data-notr]')) return;
    const v = el.getAttribute(attr);
    if (v == null) return;
    let map = _attrOrig.get(el);
    if (!map) { map = {}; _attrOrig.set(el, map); }
    const rec = map[attr];
    const orig = (rec && rec.shown === v) ? rec.orig : v;
    const next = _trKeep(orig, LANG_INDEX[_lang]);
    if (next !== v) el.setAttribute(attr, next);
    map[attr] = { orig, shown: next };
}

function _doAttrs(el) { _ATTRS.forEach(a => { if (el.hasAttribute && el.hasAttribute(a)) _doAttr(el, a); }); }

function _walk(root) {
    if (root.nodeType === 3) { _doText(root); return; }
    if (root.nodeType !== 1) return;
    _doAttrs(root);
    const w = document.createTreeWalker(root, 5); // elements + text
    let n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) _doText(n); else _doAttrs(n); }
}

const _obs = new MutationObserver(muts => {
    for (const m of muts) {
        if (m.type === 'childList') m.addedNodes.forEach(_walk);
        else if (m.type === 'characterData') _doText(m.target);
        else if (m.type === 'attributes') _doAttr(m.target, m.attributeName);
    }
});

function _applyDoc() {
    const d = document.documentElement;
    d.lang = _lang;
    d.dir = LANGS.find(x => x.id === _lang).dir;
    document.title = `${APP_NAME} - ${tr(APP_TAGLINE)}`;
}

function setLang(l) {
    if (LANG_INDEX[l] === undefined || l === _lang) return;
    _lang = l;
    try { localStorage.setItem('vetly_lang', l); } catch (e) {}
    _applyDoc();
    _walk(document.body);
    _listeners.forEach(fn => fn(l));
}

function useLang() {
    const [l, setL] = useState(_lang);
    useEffect(() => { _listeners.add(setL); return () => { _listeners.delete(setL); }; }, []);
    return [l, setLang];
}

/* ---------- التقارير: Word / Excel ---------- */
function trHtml(html) {
    const li = LANG_INDEX[_lang];
    const un = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const enc = (s) => s.replace(/&(?!(?:nbsp|amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let out = String(html).replace(/>([^<>]+)</g, (m, txt) => {
        const r = _lookup(un(txt), li);
        if (r == null) return m;
        return '>' + txt.match(/^\s*/)[0] + enc(r) + txt.match(/\s*$/)[0] + '<';
    });
    if (_lang === 'ar') {
        out = out.replace('<html ', '<html dir="rtl" lang="ar" ').replace('<body>', '<body dir="rtl">').replace(/text-align:left/g, 'text-align:right');
    } else {
        out = out.replace('<html ', `<html lang="${_lang}" `);
    }
    return out;
}

const trAoa = (aoa) => aoa.map(row => row.map(v => {
    if (typeof v !== 'string') return v;
    const r = _lookup(v, LANG_INDEX[_lang]);
    return r == null ? v : r;
}));

/* ---------- لغة مخرجات الـ AI ---------- */
function langRule() {
    if (_lang === 'en') return 'Write everything in English, except verbatim evidence quotes which stay in the original language.';
    const name = _lang === 'ar' ? 'Arabic (clear Modern Standard Arabic; keep product names, field names and technical terms such as API, OTP, PIN, URL in Latin script)' : 'German';
    return `OUTPUT LANGUAGE: write every human-readable text value (titles, descriptions, scenarios, steps, pre-conditions, test data descriptions, expected results, questions, summaries, module names) in ${name}. Keep ALL JSON keys, IDs (e.g. TS-01, TC-01) and these enumerated values EXACTLY in English: "Positive", "Negative", "Edge Case", "Critical", "High", "Medium", "Low", "Pass", "Fail", "Untested", the nine gap type names, the ten requirement component names, and "Present", "Partial", "Missing", "N/A". Verbatim evidence quotes stay in their original language.`;
}

/* ---------- زرار تغيير اللغة ---------- */
function LangSwitcher() {
    const [lang, change] = useLang();
    return (
        <div data-notr className="flex gap-1 mb-2">
            {LANGS.map(l => (
                <button key={l.id} onClick={() => change(l.id)}
                    className={`flex-1 py-1 rounded text-[11px] font-semibold border ${lang === l.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                    {l.label}
                </button>
            ))}
        </div>
    );
}

/* ---------- alert / confirm / prompt بتتترجم لوحدها ---------- */
const _alert = window.alert.bind(window), _confirm = window.confirm.bind(window), _prompt = window.prompt.bind(window);
window.alert = (m) => _alert(tr(m));
window.confirm = (m) => _confirm(tr(m));
window.prompt = (m, d) => _prompt(tr(m), d);

Object.assign(window, { LANGS, tr, trHtml, trAoa, langRule, getLang, setLang, useLang, LangSwitcher });

function _startI18n() {
    _applyDoc();
    _walk(document.body);
    _obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: _ATTRS });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _startI18n); else _startI18n();