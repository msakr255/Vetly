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
['Write the Actual Result first on the Test Generation page before sending to the Bug Report:\n{ids}','اكتب «النتيجة الفعلية» أولًا في صفحة توليد الاختبارات قبل الإرسال إلى تقرير الأخطاء:\n{ids}','Tragen Sie zuerst das tatsächliche Ergebnis auf der Seite Testgenerierung ein, bevor Sie an den Fehlerbericht senden:\n{ids}','اكتب الـ Actual Result الأول في صفحة Test Generation قبل ما تبعت للـ Bug Report: {ids}'],

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