# 🛡️ إعداد Supabase — Ash Pure ERP

## الخطوات بالترتيب

### الخطوة 1 — إنشاء الجداول
شغّل في **Supabase → SQL Editor**:
```
all_tables_schema.sql
```

### الخطوة 2 — تفعيل الأمان (RLS + Triggers + Policies)
شغّل:
```
migrations/003_add_username_and_security.sql
```
أو لو بتبدأ من الصفر:
```
auth_security_setup.sql
```

### الخطوة 3 — إنشاء أول أدمن

1. روح **Supabase Dashboard → Authentication → Users**
2. اضغط **Add user** وادخل:
   - Email: `admin@ashpure.internal`
   - Password: كلمة مرور قوية (8 حروف+)
3. انسخ الـ **UUID** بتاعه
4. شغّل في SQL Editor:

```sql
UPDATE public.profiles
SET
  role        = 'admin',
  username    = 'admin',
  full_name   = 'المدير العام',
  permissions = '{"dashboard":true,"pos":true,"products":true,"customers":true,"invoices":true,"reports":true,"settings":true}'::jsonb,
  is_active   = true
WHERE id = 'PASTE_UUID_HERE';
```

### الخطوة 4 — متغيرات البيئة
اعمل ملف `.env` في روت المشروع:
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## كيف بيشتغل النظام؟

### تسجيل الدخول
- المستخدم بيدخل **username** + password فقط
- النظام بيحول الـ username → `username@ashpure.internal` داخلياً
- Supabase بيرجع **JWT Token** صالح للجلسة

### حماية البيانات (RLS)
- **كل request** لازم يكون معاه **JWT Token** عشان يشوف أي بيانات
- بدون توكن = مفيش بيانات (حتى لو عرفت الـ URL)
- كل مستخدم بيشوف بياناته بس من `profiles`

### الصلاحيات
| Role | الصلاحيات |
|------|-----------|
| `admin` | كل الصفحات + إدارة المستخدمين |
| `sales` | نقطة البيع + العملاء + الفواتير |
| `warehouse` | المنتجات والمخزون فقط |

### إضافة مستخدم جديد
من داخل التطبيق: **الإعدادات → إدارة المستخدمين** (الأدمن فقط)

---

## أخطاء شائعة

| الخطأ | الحل |
|-------|-------|
| `column p.username does not exist` | شغّل `migrations/003_add_username_and_security.sql` |
| `invalid login credentials` | تأكد إن اليوزر اتعمل بالصيغة `username@ashpure.internal` |
| `permission denied` | تأكد إن RLS شغال والـ policies اتضافت |
| بيانات مش بتظهر | تأكد إن الـ VITE_SUPABASE_ANON_KEY صح في `.env` |
