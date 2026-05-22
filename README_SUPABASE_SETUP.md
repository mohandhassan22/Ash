ملف الإعدادات والتعليمات للـ Supabase

خطوات سريعة لتطبيق المهاجرة والتأكد من الصلاحيات:

1) تنفيذ SQL migration
- افتح لوحة Supabase -> SQL Editor
- الصق محتوى الملف `migrations/001_supabase_waste_and_special_prices.sql` وشغّله

2) توصيات سياسات RLS
- إذا كنت تستخدم RLS فعّلها على الجداول `waste_logs` و `invoice_items` و `customer_special_prices` بعد مراجعة السياسات في الملف.
- افترضنا وجود جدول `profiles` يحتوي على `id (uuid)` و `role (text)` بقيم `admin` و `sales`.
- لتطبيق سياسة تمنع المستخدمين غير الأدمن من تسجيل 'waste' استخدم Policy مماثلة للتي في الملف SQL (معلّقة)

3) Edge Functions (موصى به)
- لتعزيز الأمان ينصح بإنشاء Edge Function على Supabase للتحقق من `auth.uid()` ودور المستخدم قبل إدراج نوع `waste`.
- واجهات CRUD للـ `customer_special_prices` يمكن إنشاؤها كـ Edge Functions أو استدعاء مباشر من الـ client مع قواعد RLS مناسبة.

4) متغيرات البيئة
- ضع `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY` في `.env` أو إعدادات Vite.

5) UI integration
- قمت بإضافة مكونات مساعدة في `src/components` و واجهات API في `src/api` للتكامل مع الـ frontend.

6) الخطوات التالية المقترحة
- إنشاء Edge Function لحماية إدراج `waste` (admin only).
- تعديل مكون الفاتورة/البند لإرسال `movement_type` عند الإضافة.
- تعديل شاشة POS لاستخدام `ProductMovementToggle` وتلوين العناصر.
- إضافة تقارير على الـ Dashboard تستعلم من `waste_logs` و `customer_special_prices`.

إذا ترغب أستطيع:
- إنشاء Edge Function جاهز.
- تعديل مكونات الفاتورة وPOS الحالية في المشروع لتضمين التعديلات.
- إعداد صفحات إدارة `الأسعار الخاصة` في واجهة العملاء.
