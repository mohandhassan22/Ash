
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import ProductMovementToggle from "./src/components/ProductMovementToggle.jsx";
import CustomerSpecialPrices from "./src/components/CustomerSpecialPrices.jsx";
import DashboardWasteSummary from "./src/components/DashboardWasteSummary.jsx";

// ==================== SUPABASE CONFIG ====================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ==================== AUTH HELPERS ====================
// تسجيل الدخول بالـ username أو الـ email
export async function signInWithUsername(loginIdentifier, password) {
  const cleanIdentifier = loginIdentifier.trim().toLowerCase();
  
  // البحث عن البروفايل أولاً لمعرفة الإيميل الحقيقي والتحقق من الحالة
  let query = supabase.from("profiles").select("id, username, email, full_name, role, permissions, is_active");
  
  if (cleanIdentifier.includes("@")) {
    query = query.eq("email", cleanIdentifier);
  } else {
    query = query.eq("username", cleanIdentifier);
  }

  const { data: profile, error: profileError } = await query.single();

  // إذا وجدنا البروفايل، نستخدم الإيميل المرتبط به
  if (profile && !profileError) {
    if (!profile.is_active) {
      return { data: null, error: { message: "هذا الحساب موقوف، تواصل مع المدير" } };
    }

    const loginEmail = profile.email || (cleanIdentifier.includes("@") ? cleanIdentifier : `${cleanIdentifier}@ashpure.internal`);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (error) return { data: null, error: { message: "كلمة المرور غير صحيحة" } };

    return {
      data: {
        user: {
          ...data.user,
          username: profile.username,
          name: profile.full_name || profile.username,
          role: profile.role,
          permissions: profile.permissions || getDefaultPermissions(profile.role),
        },
        session: data.session,
      },
      error: null,
    };
  }

  // إذا لم نجد بروفايل، قد يكون المستخدم جديداً أو هناك مشكلة في جدول الـ profiles
  // سنحاول تسجيل الدخول مباشرة بالإيميل إذا كان المدخل إيميل
  if (cleanIdentifier.includes("@")) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanIdentifier,
      password,
    });

    if (!error) {
      // جلب البروفايل بعد تسجيل الدخول الناجح
      const { data: newProfile } = await supabase
        .from("profiles")
        .select("id, username, email, full_name, role, permissions, is_active")
        .eq("id", data.user.id)
        .single();

      return {
        data: {
          user: {
            ...data.user,
            username: newProfile?.username || cleanIdentifier.split("@")[0],
            name: newProfile?.full_name || data.user.email,
            role: newProfile?.role || "sales",
            permissions: newProfile?.permissions || getDefaultPermissions(newProfile?.role || "sales"),
          },
          session: data.session,
        },
        error: null,
      };
    }
  }

  return { data: null, error: { message: "بيانات الدخول غير صحيحة" } };
}

function getDefaultPermissions(role) {
  if (role === "admin") {
    return { dashboard: true, pos: true, products: true, customers: true, invoices: true, reports: true, settings: false };
  }
  if (role === "warehouse") {
    return { dashboard: false, pos: false, products: true, customers: false, invoices: false, reports: false, settings: false };
  }
  // sales
  return { dashboard: false, pos: true, products: false, customers: true, invoices: true, reports: false, settings: false };
}

// جلب بيانات الجلسة الحالية عند تحميل الصفحة
export async function getCurrentUserProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, email, full_name, role, permissions, is_active")
    .eq("id", session.user.id)
    .single();

  if (error || !profile || !profile.is_active) return null;

  return {
    ...session.user,
    username: profile.username,
    name: profile.full_name || profile.username,
    role: profile.role,
    permissions: profile.permissions || getDefaultPermissions(profile.role),
  };
}

// ==================== INITIAL MOCK DATA ====================
const INITIAL_PRODUCTS = [
  { id: 1, name: "شامبو أش بيور للشعر الجاف", sku: "AP-SH-001", barcode: "6001234567890", category: "شامبو", qty: 45, buyPrice: 85, sellPrice: 150, traderPrice: 120, specialistPrice: 130, clientPrice: 150, supplier: "مورد الأساس", expiry: "2026-06-01", image: null, minQty: 10 },
  { id: 2, name: "كريم أش بيور للترطيب العميق", sku: "AP-CR-001", barcode: "6001234567891", category: "كريمات", qty: 8, buyPrice: 120, sellPrice: 220, traderPrice: 175, specialistPrice: 195, clientPrice: 220, supplier: "مورد الأساس", expiry: "2025-12-01", image: null, minQty: 10 },
  { id: 3, name: "سيروم أش بيور لتقوية الشعر", sku: "AP-SR-001", barcode: "6001234567892", category: "سيروم", qty: 30, buyPrice: 200, sellPrice: 380, traderPrice: 300, specialistPrice: 340, clientPrice: 380, supplier: "مورد النخبة", expiry: "2026-03-15", image: null, minQty: 5 },
  { id: 4, name: "بلسم أش بيور للشعر التالف", sku: "AP-BL-001", barcode: "6001234567893", category: "بلسم", qty: 3, buyPrice: 95, sellPrice: 175, traderPrice: 140, specialistPrice: 158, clientPrice: 175, supplier: "مورد الأساس", expiry: "2026-01-20", image: null, minQty: 10 },
  { id: 5, name: "زيت أش بيور للعناية الليلية", sku: "AP-OL-001", barcode: "6001234567894", category: "زيوت", qty: 22, buyPrice: 150, sellPrice: 290, traderPrice: 230, specialistPrice: 260, clientPrice: 290, supplier: "مورد النخبة", expiry: "2026-08-10", image: null, minQty: 5 },
  { id: 6, name: "ماسك أش بيور الأسبوعي", sku: "AP-MK-001", barcode: "6001234567895", category: "ماسك", qty: 18, buyPrice: 110, sellPrice: 200, traderPrice: 160, specialistPrice: 180, clientPrice: 200, supplier: "مورد الأساس", expiry: "2025-11-30", image: null, minQty: 8 },
];

const INITIAL_CUSTOMERS = [
  { id: 1, name: "صالون لمسة جمال", phone: "01012345678", address: "القاهرة - مدينة نصر", type: "specialist", balance: 0, totalPurchases: 4200, notes: "" },
  { id: 2, name: "محمود التاجر", phone: "01098765432", address: "الجيزة - الهرم", type: "trader", balance: 1500, totalPurchases: 18500, notes: "عميل VIP" },
  { id: 3, name: "سارة أحمد", phone: "01155566677", address: "الإسكندرية", type: "client", balance: 0, totalPurchases: 950, notes: "" },
  { id: 4, name: "بيوتي هاوس", phone: "01234567890", address: "القاهرة - المعادي", type: "specialist", balance: 2800, totalPurchases: 12000, notes: "تأخير في السداد" },
];

const INITIAL_INVOICES = [
  { id: "INV-001", customerId: 1, customerName: "صالون لمسة جمال", customerType: "specialist", items: [{ productId: 1, name: "شامبو أش بيور للشعر الجاف", qty: 5, price: 130, total: 650, type: "sale" }, { productId: 3, name: "سيروم أش بيور لتقوية الشعر", qty: 2, price: 340, total: 680, type: "sale" }], subtotal: 1330, discount: 0, tax: 0, total: 1330, paid: 1330, remaining: 0, paymentMethod: "cash", date: "2025-05-10", status: "paid" },
  { id: "INV-002", customerId: 2, customerName: "محمود التاجر", customerType: "trader", items: [{ productId: 1, name: "شامبو أش بيور للشعر الجاف", qty: 20, price: 120, total: 2400, type: "sale" }, { productId: 5, name: "زيت أش بيور للعناية الليلية", qty: 10, price: 230, total: 2300, type: "sale" }], subtotal: 4700, discount: 200, tax: 0, total: 4500, paid: 3000, remaining: 1500, paymentMethod: "deferred", date: "2025-05-12", dueDate: "2025-06-12", status: "partial" },
  { id: "INV-003", customerId: 3, customerName: "سارة أحمد", customerType: "client", items: [{ productId: 6, name: "ماسك أش بيور الأسبوعي", qty: 2, price: 200, total: 400, type: "sale" }, { productId: 2, name: "كريم أش بيور للترطيب العميق", qty: 1, price: 220, total: 220, type: "sale" }], subtotal: 620, discount: 0, tax: 0, total: 620, paid: 620, remaining: 0, paymentMethod: "vodafone", date: "2025-05-15", status: "paid" },
];

const INITIAL_WASTE_LOGS = [
  { id: "WST-001", productId: 1, name: "شامبو أش بيور للشعر الجاف", qty: 3, type: "waste", cost: 255, createdBy: "honda229204@gmail.com", createdAt: "2026-05-10", notes: "عبوة تالفة عند الاستلام" },
  { id: "WST-002", productId: 2, name: "كريم أش بيور للترطيب العميق", qty: 2, type: "gift", cost: 240, createdBy: "honda229204@gmail.com", createdAt: "2026-05-12", notes: "هدية دعائية لصالون لمسة جمال" },
  { id: "WST-003", productId: 4, name: "بلسم أش بيور للشعر التالف", qty: 1, type: "waste", cost: 95, createdBy: "honda229204@gmail.com", createdAt: "2026-05-18", notes: "منتهية الصلاحية" }
];

const INITIAL_SPECIAL_PRICES = [
  { id: 1, customerId: 2, productId: 1, specialPrice: 100, minQty: 1, createdAt: "2026-05-20", updatedAt: "2026-05-20" },
  { id: 2, customerId: 1, productId: 2, specialPrice: 180, minQty: 1, createdAt: "2026-05-20", updatedAt: "2026-05-20" }
];

const CATEGORIES = ["شامبو", "كريمات", "سيروم", "بلسم", "زيوت", "ماسك", "تونك", "أخرى"];
const PAYMENT_METHODS = [
  { id: "cash", label: "كاش", icon: "💵" },
  { id: "deferred", label: "آجل", icon: "📋" },
  { id: "bank", label: "تحويل بنكي", icon: "🏦" },
  { id: "vodafone", label: "فودافون كاش", icon: "📱" },
  { id: "instapay", label: "إنستا باي", icon: "⚡" },
];
const CUSTOMER_TYPES = [
  { id: "client", label: "عميل عادي", priceKey: "clientPrice" },
  { id: "specialist", label: "متخصصة", priceKey: "specialistPrice" },
  { id: "trader", label: "تاجر", priceKey: "traderPrice" },
];

// ==================== UTILITIES ====================
const formatCurrency = (n) => `${(n || 0).toLocaleString("ar-EG")} ج.م`;
const formatDate = (d) => d ? new Date(d).toLocaleDateString("ar-EG") : "-";
const generateId = (prefix) => `${prefix}-${Date.now().toString().slice(-6)}`;

const getProductIcon = (p) => {
  const name = p.name || "";
  if (name.includes("شامبو")) return "🧴";
  if (name.includes("زيت")) return "💧";
  if (name.includes("صابون")) return "🧼";
  if (name.includes("كريم")) return "🧴";
  if (name.includes("سيروم")) return "✨";
  if (name.includes("بلسم")) return "🧴";
  if (p.category === "العناية بالشعر") return "💇‍♀️";
  if (p.category === "العناية بالبشرة") return "✨";
  return "📦";
};

// Dynamic script loader utility for browser-side libraries
const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject();
    document.body.appendChild(script);
  });
};

// ==================== EXCEL EXPORT ====================
const exportInvoicesToExcel = async (invoices, customers) => {
  // Load SheetJS from CDN
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  const XLSX = window.XLSX;

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: ملخص الفواتير ──
  const invoiceRows = invoices.map(inv => ({
    "رقم الفاتورة":      inv.id,
    "التاريخ":           inv.date,
    "العميل":            inv.customerName || "عميل نقدي",
    "نوع العميل":        inv.customerType || "-",
    "المجموع الفرعي":    inv.subtotal || 0,
    "الخصم":             inv.discount || 0,
    "الضريبة":           inv.tax || 0,
    "الإجمالي":          inv.total || 0,
    "المدفوع":           inv.paid || 0,
    "المتبقي":           inv.remaining || 0,
    "طريقة الدفع":       inv.paymentMethod === "cash" ? "نقدي" : inv.paymentMethod === "card" ? "بطاقة" : inv.paymentMethod === "deferred" ? "آجل" : inv.paymentMethod,
    "الحالة":            inv.status === "paid" ? "مدفوعة" : inv.status === "partial" ? "جزئي" : "آجل",
    "تاريخ الاستحقاق":   inv.dueDate || "-",
  }));

  const ws1 = XLSX.utils.json_to_sheet(invoiceRows);

  // تحديد عرض الأعمدة
  ws1["!cols"] = [
    { wch: 16 }, { wch: 12 }, { wch: 22 }, { wch: 14 },
    { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 16 },
  ];

  // تنسيق الهيدر بخلفية ذهبية
  const headerRange = XLSX.utils.decode_range(ws1["!ref"]);
  for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws1[cell]) continue;
    ws1[cell].s = {
      font:      { bold: true, color: { rgb: "000000" }, sz: 12 },
      fill:      { fgColor: { rgb: "D4AF37" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top:    { style: "thin", color: { rgb: "8B7355" } },
        bottom: { style: "thin", color: { rgb: "8B7355" } },
        left:   { style: "thin", color: { rgb: "8B7355" } },
        right:  { style: "thin", color: { rgb: "8B7355" } },
      }
    };
  }

  // تلوين صفوف البيانات بالتناوب
  for (let R = 1; R <= headerRange.e.r; R++) {
    const isEven = R % 2 === 0;
    for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
      const cell = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws1[cell]) ws1[cell] = { t: "s", v: "" };
      ws1[cell].s = {
        fill:      { fgColor: { rgb: isEven ? "1E1E2E" : "16161F" } },
        font:      { color: { rgb: "E0E0E0" }, sz: 11 },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          bottom: { style: "thin", color: { rgb: "2A2A3A" } },
          left:   { style: "thin", color: { rgb: "2A2A3A" } },
          right:  { style: "thin", color: { rgb: "2A2A3A" } },
        }
      };
      // تلوين خاص لعمود الحالة
      const colName = invoiceRows[0] ? Object.keys(invoiceRows[0])[C] : "";
      if (colName === "الحالة" && ws1[cell].v) {
        const val = ws1[cell].v;
        ws1[cell].s.font.color = { rgb: val === "مدفوعة" ? "4CAF85" : val === "جزئي" ? "D4AF37" : "E05A5A" };
        ws1[cell].s.font.bold = true;
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws1, "الفواتير");

  // ── Sheet 2: تفاصيل بنود الفواتير ──
  const itemRows = [];
  invoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      itemRows.push({
        "رقم الفاتورة": inv.id,
        "التاريخ":      inv.date,
        "العميل":       inv.customerName || "عميل نقدي",
        "المنتج":       item.name,
        "الكمية":       item.qty,
        "السعر":        item.price,
        "الإجمالي":     item.total,
        "نوع الحركة":  item.movement_type === "sale" ? "بيع" : item.movement_type === "gift" ? "هدية" : "هالك",
      });
    });
  });

  const ws2 = XLSX.utils.json_to_sheet(itemRows);
  ws2["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 22 }, { wch: 26 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];

  // تنسيق هيدر الشيت الثاني
  const range2 = XLSX.utils.decode_range(ws2["!ref"] || "A1");
  for (let C = range2.s.c; C <= range2.e.c; C++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws2[cell]) continue;
    ws2[cell].s = {
      font:      { bold: true, color: { rgb: "000000" }, sz: 12 },
      fill:      { fgColor: { rgb: "8B7355" } },
      alignment: { horizontal: "center", vertical: "center" },
      border:    { bottom: { style: "medium", color: { rgb: "D4AF37" } } }
    };
  }

  XLSX.utils.book_append_sheet(wb, ws2, "تفاصيل البنود");

  // ── Sheet 3: ملخص المبيعات حسب العميل ──
  const byCustomer = {};
  invoices.forEach(inv => {
    const k = inv.customerName || "عميل نقدي";
    if (!byCustomer[k]) byCustomer[k] = { total: 0, count: 0, paid: 0, remaining: 0 };
    byCustomer[k].total     += inv.total || 0;
    byCustomer[k].paid      += inv.paid  || 0;
    byCustomer[k].remaining += inv.remaining || 0;
    byCustomer[k].count++;
  });

  const summaryRows = Object.entries(byCustomer).map(([name, d]) => ({
    "العميل":           name,
    "عدد الفواتير":     d.count,
    "إجمالي المشتريات": d.total,
    "المدفوع":          d.paid,
    "المتبقي":          d.remaining,
  })).sort((a, b) => b["إجمالي المشتريات"] - a["إجمالي المشتريات"]);

  const ws3 = XLSX.utils.json_to_sheet(summaryRows);
  ws3["!cols"] = [{ wch: 24 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];

  const range3 = XLSX.utils.decode_range(ws3["!ref"] || "A1");
  for (let C = range3.s.c; C <= range3.e.c; C++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws3[cell]) continue;
    ws3[cell].s = {
      font:      { bold: true, color: { rgb: "000000" }, sz: 12 },
      fill:      { fgColor: { rgb: "4CAF85" } },
      alignment: { horizontal: "center", vertical: "center" },
    };
  }

  XLSX.utils.book_append_sheet(wb, ws3, "ملخص العملاء");

  // تصدير الملف
  const date = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `AshPure_Invoices_${date}.xlsx`);
};
  // 1. Dynamic CDN Loading for PDF dependencies
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");

  // 2. Create elegant Invoice element for PDF generation
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.top = "-9999px";
  container.style.left = "-9999px";
  container.style.width = "210mm"; // A4 dimensions
  container.style.padding = "20mm";
  container.style.background = "#ffffff";
  container.style.color = "#111111";
  container.style.fontFamily = "'Tajawal', sans-serif";
  container.style.direction = "rtl";

  const itemsRows = invoice.items.map((item) => `
    <tr style="border-bottom: 1px solid #eeeeee;">
      <td style="padding: 12px; text-align: right; font-size: 14px; font-weight: 500; color: #111111;">${item.name}</td>
      <td style="padding: 12px; text-align: center; font-size: 14px; color: #111111;">${item.qty}</td>
      <td style="padding: 12px; text-align: left; font-size: 14px; color: #111111;">${formatCurrency(item.price)}</td>
      <td style="padding: 12px; text-align: left; font-size: 14px; font-weight: bold; color: #8B7355;">${formatCurrency(item.total)}</td>
    </tr>
  `).join("");

  const subtotal = invoice.subtotal || invoice.items.reduce((s, i) => s + i.total, 0);
  const discountAmt = invoice.discount || 0;
  const taxAmt = ((subtotal - discountAmt) * (invoice.tax || 0)) / 100;
  const total = invoice.total;

  container.innerHTML = `
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #8B7355; padding-bottom: 20px; margin-bottom: 30px;">
      <div>
        <h1 style="margin: 0; font-size: 32px; font-weight: 900; color: #8B7355; letter-spacing: 2px;">ASH PURE</h1>
        <p style="margin: 5px 0 0; font-size: 13px; color: #666666;">العناية الفائقة بالشعر والبشرة</p>
      </div>

      <!-- Waste & Gifts Summary removed from PDF invoice -->
      <div style="text-align: left;">
        <h2 style="margin: 0; font-size: 20px; font-weight: bold; color: #111111;">فاتورة مبيعات</h2>
        <p style="margin: 5px 0 0; font-size: 14px; font-weight: 600; color: #8B7355;">رقم الفاتورة: ${invoice.id}</p>
        <p style="margin: 2px 0 0; font-size: 12px; color: #666666;">التاريخ: ${formatDate(invoice.date)}</p>
      </div>
    </div>

    <!-- Details Grid -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
      <div style="background: #fafafa; border: 1px solid #eeeeee; padding: 15px; border-radius: 8px;">
        <h3 style="margin: 0 0 10px; font-size: 14px; font-weight: bold; color: #8B7355;">بيانات العميل</h3>
        <p style="margin: 0; font-size: 15px; font-weight: bold; color: #111111;">الاسم: ${invoice.customerName || "عميل نقدي"}</p>
        <p style="margin: 5px 0 0; font-size: 13px; color: #555555;">النوع: ${invoice.customerType === "trader" ? "تاجر" : invoice.customerType === "specialist" ? "متخصصة" : invoice.customerType === "client" ? "عميل عادي" : invoice.customerType}</p>
      </div>
      <div style="background: #fafafa; border: 1px solid #eeeeee; padding: 15px; border-radius: 8px; text-align: left; direction: ltr;">
        <h3 style="margin: 0 0 10px; font-size: 14px; font-weight: bold; color: #8B7355; text-align: right; direction: rtl;">معلومات الدفع</h3>
        <p style="margin: 0; font-size: 14px; color: #111111; text-align: right; direction: rtl;">طريقة الدفع: ${
          invoice.paymentMethod === "cash" ? "💵 كاش" : 
          invoice.paymentMethod === "deferred" ? "📋 آجل" : 
          invoice.paymentMethod === "bank" ? "🏦 تحويل بنكي" : 
          invoice.paymentMethod === "vodafone" ? "📱 فودافون كاش" : 
          invoice.paymentMethod === "instapay" ? "⚡ إنستا باي" : invoice.paymentMethod
        }</p>
        <p style="margin: 5px 0 0; font-size: 14px; color: #111111; text-align: right; direction: rtl;">حالة الفاتورة: ${
          invoice.status === "paid" ? "✅ مدفوعة بالكامل" : 
          invoice.status === "partial" ? "⚠️ مدفوعة جزئياً" : "📋 آجل"
        }</p>
      </div>
    </div>

    <!-- Items Table -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
      <thead>
        <tr style="background: #8B7355; color: #ffffff;">
          <th style="padding: 12px; text-align: right; font-size: 14px; border-radius: 0 8px 8px 0;">المنتج</th>
          <th style="padding: 12px; text-align: center; font-size: 14px;">الكمية</th>
          <th style="padding: 12px; text-align: left; font-size: 14px;">سعر الوحدة</th>
          <th style="padding: 12px; text-align: left; font-size: 14px; border-radius: 8px 0 0 8px;">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Totals Area -->
    <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
      <div style="width: 300px; background: #fafafa; border: 1px solid #eeeeee; padding: 15px; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
          <span style="color: #666666;">المجموع الفرعي:</span>
          <span style="font-weight: 600;">${formatCurrency(subtotal)}</span>
        </div>
        ${invoice.discount > 0 ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; color: #4CAF85;">
          <span>خصم:</span>
          <span>- ${formatCurrency(discountAmt)}</span>
        </div>` : ""}
        ${invoice.tax > 0 ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
          <span style="color: #666666;">ضريبة (${invoice.tax}%):</span>
          <span>+ ${formatCurrency(taxAmt)}</span>
        </div>` : ""}
        <div style="display: flex; justify-content: space-between; padding-top: 10px; border-top: 1px solid #dddddd; margin-top: 10px; font-size: 18px; font-weight: bold; color: #8B7355;">
          <span>الإجمالي:</span>
          <span>${formatCurrency(total)}</span>
        </div>
        ${invoice.remaining > 0 ? `
        <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 14px; color: #E05A5A; font-weight: bold;">
          <span>المتبقي (دين):</span>
          <span>${formatCurrency(invoice.remaining)}</span>
        </div>` : ""}
      </div>
    </div>

    <!-- Footer message -->
    <div style="margin-top: 60px; text-align: center; border-top: 1px solid #eeeeee; padding-top: 20px; font-size: 12px; color: #888888;">
      <p style="margin: 0;">شكراً لتعاملكم معنا!</p>
      <p style="margin: 4px 0 0;">أنتم سر تميزنا - Ash Pure</p>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await window.html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff"
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const { jsPDF } = window.jspdf;
    
    const pdf = new jsPDF("p", "mm", "a4");
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
    
    document.body.removeChild(container);

    if (isSharing) {
      const pdfBlob = pdf.output("blob");
      return pdfBlob;
    } else {
      pdf.save(`invoice-${invoice.id}.pdf`);
      return true;
    }
  } catch (error) {
    console.error("PDF generation failed:", error);
    document.body.removeChild(container);
    throw error;
  }
};

// ==================== ICONS ====================
const Icon = ({ name, size = 20, className = "" }) => {
  const icons = {
    dashboard: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    products: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
    pos: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
    customers: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    invoices: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    reports: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    settings: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>,
    plus: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    edit: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    trash: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
    search: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    close: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    warning: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    print: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
    download: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    logout: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    menu: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
    cart: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
    check: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><polyline points="20 6 9 17 4 12"/></svg>,
    bell: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    barcode: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14M21 5v14"/></svg>,
    trend_up: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    users: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    package: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    dollar: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    eye: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    filter: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
    refresh: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
    image: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  };
  return icons[name] || <span>{name}</span>;
};

// ==================== SIMPLE CHART ====================
const SimpleBarChart = ({ data, height = 160 }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height, padding: "0 4px" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            width: "100%", background: `linear-gradient(180deg, #D4AF37, #8B7355)`,
            borderRadius: "6px 6px 0 0", height: `${(d.value / max) * 100}%`,
            minHeight: 4, transition: "height 0.5s ease", opacity: 0.85
          }} title={`${d.label}: ${formatCurrency(d.value)}`} />
          <span style={{ fontSize: 10, color: "#888", textAlign: "center", whiteSpace: "nowrap" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
};

// ==================== STYLES ====================
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
  
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  
  :root {
    --gold: #D4AF37;
    --gold-light: #F0D060;
    --gold-dark: #8B7355;
    --bg: #0A0A0F;
    --bg2: #111118;
    --bg3: #1A1A24;
    --card: #14141E;
    --card2: #1E1E2E;
    --border: #2A2A3A;
    --text: #F0EDE0;
    --text2: #A09880;
    --text3: #6B6455;
    --red: #E05A5A;
    --green: #4CAF85;
    --blue: #5A9BE0;
    --purple: #9B7FE0;
    --sidebar-w: clamp(240px, 20vw, 280px);
    --header-h: clamp(56px, 6vh, 72px);
    --radius: clamp(10px, 1.5vw, 16px);
    --radius-sm: clamp(6px, 1vw, 10px);
    --shadow: 0 4px 24px rgba(0,0,0,0.4);
    --shadow-gold: 0 4px 20px rgba(212,175,55,0.2);
    --p-main: clamp(16px, 3vw, 32px);
  }

  body { font-family: 'Tajawal', sans-serif; direction: rtl; background: var(--bg); color: var(--text); overflow-x: hidden; overscroll-behavior: none; }
  
  .app { display: flex; height: 100vh; overflow: hidden; width: 100%; position: relative; }
  
  /* Sidebar & Mobile Drawer */
  .sidebar {
    width: var(--sidebar-w); background: var(--bg2); border-left: 1px solid var(--border);
    display: flex; flex-direction: column; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); z-index: 3000;
    flex-shrink: 0; height: 100%;
  }
  .sidebar-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 2999;
    opacity: 0; pointer-events: none; transition: opacity 0.3s ease; backdrop-filter: blur(2px);
  }
  
  .logo-area { padding: clamp(16px, 2vh, 24px) clamp(16px, 2vw, 20px); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
  .logo-brand { font-size: clamp(18px, 2vw, 22px); font-weight: 900; background: linear-gradient(135deg, var(--gold-light), var(--gold), var(--gold-dark)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 2px; }
  .logo-sub { font-size: 11px; color: var(--text3); letter-spacing: 1px; margin-top: 2px; }
  .close-sidebar-btn { display: none; background: none; border: none; color: var(--text); font-size: 24px; cursor: pointer; }
  
  .nav { flex: 1; padding: 16px 12px; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .nav-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: var(--radius-sm); cursor: pointer; margin-bottom: 4px; color: var(--text2); font-size: clamp(13px, 1.5vw, 15px); font-weight: 500; transition: all 0.2s; border: 1px solid transparent; min-height: 44px; touch-action: manipulation; }
  .nav-item:hover { background: var(--card); color: var(--text); }
  .nav-item.active { background: linear-gradient(135deg, rgba(212,175,55,0.15), rgba(139,115,85,0.1)); border-color: rgba(212,175,55,0.3); color: var(--gold); }
  .nav-section { font-size: 11px; color: var(--text3); letter-spacing: 2px; padding: 12px 14px 6px; text-transform: uppercase; }
  
  .sidebar-footer { padding: 16px; border-top: 1px solid var(--border); }
  .user-info { display: flex; align-items: center; gap: 10px; }
  .user-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--gold), var(--gold-dark)); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #000; flex-shrink: 0; }
  .user-name { font-size: 13px; font-weight: 600; }
  .user-role { font-size: 11px; color: var(--gold); }
  
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; width: 100%; }
  
  /* Header */
  .header { height: var(--header-h); background: var(--bg2); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 0 var(--p-main); gap: 16px; flex-shrink: 0; position: sticky; top: 0; z-index: 100; }
  .header-left { display: flex; align-items: center; gap: 12px; }
  .menu-toggle { display: none; background: none; border: none; color: var(--text); font-size: 24px; cursor: pointer; padding: 8px; margin-right: -8px; }
  .header-title { font-size: clamp(16px, 2vw, 20px); font-weight: 700; }
  .header-actions { display: flex; align-items: center; gap: 8px; }
  
  .search-bar { display: flex; align-items: center; gap: 8px; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0 14px; min-width: 200px; height: 40px; transition: width 0.3s; }
  .search-bar input { background: none; border: none; outline: none; color: var(--text); font-family: 'Tajawal', sans-serif; font-size: 14px; flex: 1; height: 100%; width: 100%; }
  .search-bar input::placeholder { color: var(--text3); }
  
  .content { flex: 1; overflow-y: auto; overflow-x: hidden; padding: var(--p-main); -webkit-overflow-scrolling: touch; }
  
  /* Buttons */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 16px; height: 44px; border-radius: var(--radius-sm); font-family: 'Tajawal', sans-serif; font-size: clamp(13px, 1.5vw, 14px); font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; white-space: nowrap; touch-action: manipulation; }
  .btn-primary { background: linear-gradient(135deg, var(--gold), var(--gold-dark)); color: #000; box-shadow: var(--shadow-gold); }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(212,175,55,0.35); }
  .btn-secondary { background: var(--card2); color: var(--text); border: 1px solid var(--border); }
  .btn-secondary:hover { border-color: var(--gold); color: var(--gold); }
  .btn-danger { background: rgba(224,90,90,0.15); color: var(--red); border: 1px solid rgba(224,90,90,0.3); }
  .btn-ghost { background: transparent; color: var(--text2); }
  .btn-ghost:hover { color: var(--text); background: var(--card); }
  .btn-sm { height: 36px; padding: 0 12px; font-size: 12px; }
  .btn-icon { width: 44px; height: 44px; border-radius: var(--radius-sm); background: var(--card); border: 1px solid var(--border); color: var(--text2); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; touch-action: manipulation; }
  .btn-icon:hover { border-color: var(--gold); color: var(--gold); }
  
  /* Cards & Stats */
  .card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: clamp(16px, 2vw, 24px); width: 100%; }
  .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
  .card-title { font-size: clamp(14px, 1.5vw, 16px); font-weight: 700; }
  
  .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; transition: transform 0.3s, border-color 0.3s; cursor: default; }
  .stat-card:hover { border-color: rgba(212,175,55,0.4); transform: translateY(-2px); box-shadow: var(--shadow-gold); }
  .stat-value { font-size: clamp(20px, 3vw, 28px); font-weight: 800; color: var(--gold); margin: 6px 0; }
  .stat-label { font-size: 13px; color: var(--text2); }
  
  .grid { display: grid; gap: clamp(12px, 2vw, 20px); }
  .grid-2 { grid-template-columns: repeat(2, 1fr); }
  .grid-3 { grid-template-columns: repeat(3, 1fr); }
  .grid-4 { grid-template-columns: repeat(4, 1fr); }
  
  /* Tables to Cards */
  .table-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 600px; }
  th { padding: 14px 16px; text-align: right; color: var(--text2); font-weight: 600; font-size: 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  td { padding: 14px 16px; border-bottom: 1px solid rgba(42,42,58,0.5); color: var(--text); }
  tr:hover td { background: rgba(212,175,55,0.04); }
  
  /* Modals */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 4000; display: flex; align-items: center; justify-content: center; padding: clamp(0px, 2vw, 24px); backdrop-filter: blur(4px); animation: fadeIn 0.2s; }
  .modal { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius); width: 100%; max-width: 680px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; animation: slideUp 0.2s; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
  .modal-lg { max-width: 900px; }
  .modal-header { padding: 16px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; background: var(--bg3); flex-shrink: 0; }
  .modal-title { font-size: 18px; font-weight: 700; }
  .modal-body { padding: 24px; overflow-y: auto; flex: 1; -webkit-overflow-scrolling: touch; }
  .modal-footer { padding: 16px 24px; border-top: 1px solid var(--border); display: flex; gap: 12px; justify-content: flex-end; background: var(--bg2); flex-shrink: 0; }
  
  /* Forms */
  .form-group { margin-bottom: 20px; width: 100%; }
  .form-label { display: block; font-size: 13px; color: var(--text2); margin-bottom: 8px; font-weight: 600; }
  .form-control { width: 100%; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0 16px; height: 48px; color: var(--text); font-family: 'Tajawal', sans-serif; font-size: 15px; outline: none; transition: border 0.2s; -webkit-appearance: none; }
  .form-control:focus { border-color: var(--gold); box-shadow: 0 0 0 2px rgba(212,175,55,0.2); }
  .form-control::placeholder { color: var(--text3); }
  select.form-control { cursor: pointer; background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23A09880' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e"); background-repeat: no-repeat; background-position: left 1rem center; background-size: 1em; padding-left: 2.5rem; }
  textarea.form-control { resize: vertical; min-height: 100px; padding: 12px 16px; }
  
  /* POS Layout */
  .pos-layout { display: grid; grid-template-columns: 1fr 420px; gap: var(--p-main); height: calc(100vh - var(--header-h) - (var(--p-main) * 2)); }
  .pos-products { display: flex; flex-direction: column; gap: 12px; overflow: hidden; }
  .pos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)); gap: 14px; overflow-y: auto; padding: 4px; padding-bottom: 80px; }

  /* POS Product Card — luxury dark tile */
  .pos-product-card {
    background: linear-gradient(145deg, #16161f 0%, #1c1c2a 100%);
    border: 1px solid rgba(42,42,60,0.8);
    border-radius: 14px;
    padding: 18px 14px 14px;
    cursor: pointer;
    transition: all 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    text-align: center;
    touch-action: manipulation;
    display: flex; flex-direction: column; justify-content: space-between;
    min-height: 200px;
    position: relative;
    overflow: hidden;
  }
  .pos-product-card::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent);
    opacity: 0; transition: opacity 0.3s;
  }
  .pos-product-card::after {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(circle at 50% 0%, rgba(212,175,55,0.06) 0%, transparent 60%);
    opacity: 0; transition: opacity 0.3s;
  }
  .pos-product-card:hover {
    border-color: rgba(212,175,55,0.45);
    box-shadow: 0 12px 35px rgba(212,175,55,0.15), 0 4px 12px rgba(0,0,0,0.4);
    transform: translateY(-4px);
  }
  .pos-product-card:hover::before, .pos-product-card:hover::after { opacity: 1; }
  .pos-product-card:active { transform: scale(0.95); }
  .pos-product-card.out { opacity: 0.4; cursor: not-allowed; filter: grayscale(0.6); }
  .pos-product-card.out:hover { transform: none; box-shadow: none; border-color: rgba(42,42,60,0.8); }

  .pos-product-img {
    width: 72px; height: 72px; border-radius: 50%;
    background: linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.04));
    border: 1px solid rgba(212,175,55,0.15);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 12px; font-size: 32px;
    transition: transform 0.3s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }
  .pos-product-card:hover .pos-product-img { transform: scale(1.08) rotate(5deg); }
  .pos-product-name { font-size: 12px; font-weight: 700; margin-bottom: 8px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; color: var(--text); }
  .pos-product-price { font-size: 17px; font-weight: 900; color: var(--gold); letter-spacing: -0.5px; }
  .pos-product-qty { font-size: 11px; color: var(--text3); margin-top: 4px; font-weight: 500; }

  /* Cart panel */
  .cart {
    background: linear-gradient(180deg, #141420 0%, #161622 100%);
    border: 1px solid rgba(42,42,58,0.8);
    border-radius: 16px;
    display: flex; flex-direction: column; overflow: hidden;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: -4px 0 30px rgba(0,0,0,0.2);
  }
  .cart-header {
    padding: 18px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    background: rgba(212,175,55,0.03);
  }
  .cart-toggle-btn { display: none; background: none; border: none; color: var(--text); font-size: 24px; padding: 8px; margin: -8px; }
  .cart-items { flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }

  /* Cart item */
  .cart-item {
    display: flex; flex-direction: column; gap: 10px;
    padding: 14px;
    border-radius: 12px;
    border: 1px solid rgba(42,42,58,0.8);
    background: rgba(20,20,30,0.6);
    transition: all 0.2s ease;
    position: relative;
  }
  .cart-item:hover { border-color: rgba(212,175,55,0.2); background: rgba(20,20,30,0.9); box-shadow: 0 4px 16px rgba(0,0,0,0.25); }

  .cart-item-name { font-size: 13px; font-weight: 700; line-height: 1.4; }
  .cart-item-qty { display: flex; align-items: center; gap: 8px; }

  /* Cart footer totals */
  .cart-footer { padding: 16px 18px; border-top: 1px solid rgba(255,255,255,0.06); }
  .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px; color: var(--text2); }
  .total-final {
    font-size: 22px !important; font-weight: 900 !important;
    background: linear-gradient(135deg, #f0d060, #d4af37);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 0 8px rgba(212,175,55,0.3));
  }

  /* Qty buttons */
  .qty-btn {
    width: 30px; height: 30px; border-radius: 8px;
    background: rgba(212,175,55,0.1);
    border: 1px solid rgba(212,175,55,0.2);
    color: var(--gold); font-size: 18px; font-weight: 700;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
  }
  .qty-btn:hover { background: rgba(212,175,55,0.2); border-color: var(--gold); transform: scale(1.1); }
  .cart-item-name { font-size: 14px; font-weight: 700; line-height: 1.4; }
  .cart-item-qty { display: flex; align-items: center; gap: 8px; }
  .qty-btn { width: 30px; height: 30px; border-radius: 8px; background: var(--card); border: 1px solid var(--border); color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.15s ease; touch-action: manipulation; }
  .qty-btn:hover { border-color: var(--gold); color: var(--gold); }
  .qty-btn:active { background: var(--border); }
  
  /* Badges & Utility */
  .badge { display: inline-flex; align-items: center; justify-content: center; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; white-space: nowrap; }
  .badge-gold { background: rgba(212,175,55,0.15); color: var(--gold); }
  .badge-green { background: rgba(76,175,133,0.15); color: var(--green); }
  .badge-red { background: rgba(224,90,90,0.15); color: var(--red); }
  
  /* Media Queries for Responsive Design */
  @media (max-width: 1440px) {
    .grid-4 { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 1024px) {
    .pos-layout { grid-template-columns: 1fr 320px; }
    .grid-4 { grid-template-columns: repeat(2, 1fr); }
    .grid-3 { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 768px) {
    /* Layout & Sidebar */
    .sidebar { position: fixed; right: 0; transform: translateX(100%); }
    .sidebar.open { transform: translateX(0); }
    .sidebar.open + .sidebar-overlay { opacity: 1; pointer-events: auto; }
    .menu-toggle { display: block; }
    .close-sidebar-btn { display: block; }
    
    /* POS Mobile Bottom Sheet */
    .pos-layout { grid-template-columns: 1fr; position: relative; height: calc(100vh - var(--header-h) - var(--p-main)); }
    .cart { position: absolute; bottom: 0; left: 0; right: 0; height: 85vh; transform: translateY(calc(100% - 64px)); z-index: 2000; border-radius: var(--radius) var(--radius) 0 0; box-shadow: 0 -10px 40px rgba(0,0,0,0.5); }
    .cart.open { transform: translateY(0); }
    .cart-toggle-btn { display: block; }
    
    /* Mobile General */
    .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
    .header { padding: 0 16px; }
    .search-bar { min-width: 120px; }
    .search-bar input { width: 100%; }
    
    /* Mobile Modals */
    .modal { max-width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0; border: none; }
    .modal-overlay { padding: 0; }
    .modal-footer { padding-bottom: max(16px, env(safe-area-inset-bottom)); } /* For iOS notch/bar */
    
    /* Mobile Tables (Cards View) */
    .table-wrap table { min-width: 100%; }
    .table-wrap thead { display: none; }
    .table-wrap tr { display: flex; flex-direction: column; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 12px; padding: 12px; }
    .table-wrap td { display: flex; justify-content: space-between; align-items: center; border: none; padding: 8px 0; border-bottom: 1px solid rgba(42,42,58,0.3); }
    .table-wrap td:last-child { border-bottom: none; }
    .table-wrap td::before { content: attr(data-label); color: var(--text2); font-weight: 600; font-size: 12px; margin-left: 16px; }
  }
  @media (max-width: 480px) {
    .pos-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .card { padding: 16px; }
    .search-bar { display: none; } /* Hide search bar on very small screens to save header space */
  }

  /* Tabs Navigation */
  .tabs { display: flex; gap: 8px; border-bottom: 1px solid var(--border); margin-bottom: 20px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .tab { padding: 10px 16px; cursor: pointer; color: var(--text2); font-weight: 600; border-bottom: 2px solid transparent; transition: all 0.2s; white-space: nowrap; font-size: 14px; }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--gold); border-bottom-color: var(--gold); }

  /* Print Styles */
  @media print {
    body { background: white; color: black; font-size: 12px; direction: rtl; }
    .sidebar, .header, .btn, .modal-footer, .cart-toggle-btn { display: none !important; }
    .main, .content, .modal, .modal-body { overflow: visible !important; height: auto !important; padding: 0 !important; background: transparent !important; box-shadow: none !important; }
    .card, .stat-card { border: 1px solid #ddd !important; break-inside: avoid; }
    * { color: black !important; text-shadow: none !important; }
    .badge { border: 1px solid #aaa; background: transparent !important; color: black !important; }
  }

  /* === ENHANCED VISUAL IMPROVEMENTS === */

  /* Animated gradient background on app */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background: radial-gradient(ellipse at 10% 20%, rgba(212,175,55,0.04) 0%, transparent 50%),
                radial-gradient(ellipse at 90% 80%, rgba(139,115,85,0.05) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
  }

  /* Improved sidebar with subtle gradient */
  .sidebar {
    background: linear-gradient(180deg, #0e0e16 0%, #111118 60%, #0d0d14 100%);
    box-shadow: -4px 0 32px rgba(0,0,0,0.5);
  }

  /* Glowing logo */
  .logo-brand {
    text-shadow: 0 0 20px rgba(212,175,55,0.3);
    letter-spacing: 3px;
  }

  /* Enhanced nav items */
  .nav-item {
    border-radius: 10px;
    position: relative;
    overflow: hidden;
  }
  .nav-item::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(212,175,55,0.08), transparent);
    opacity: 0;
    transition: opacity 0.2s;
  }
  .nav-item.active::before { opacity: 1; }
  .nav-item.active {
    box-shadow: inset 0 0 0 1px rgba(212,175,55,0.25), 0 2px 12px rgba(212,175,55,0.1);
  }

  /* Header glass effect */
  .header {
    background: rgba(17,17,24,0.85);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(212,175,55,0.1);
    box-shadow: 0 2px 20px rgba(0,0,0,0.3);
  }

  /* Enhanced stat cards */
  .stat-card {
    position: relative;
    overflow: hidden;
    background: linear-gradient(135deg, #14141e 0%, #1a1a26 100%);
  }
  .stat-card::after {
    content: '';
    position: absolute;
    top: -30px;
    left: -30px;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(212,175,55,0.12), transparent 70%);
    pointer-events: none;
  }
  .stat-value {
    background: linear-gradient(135deg, var(--gold-light), var(--gold), var(--gold-dark));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 0 8px rgba(212,175,55,0.3));
  }

  /* Enhanced cards */
  .card {
    background: linear-gradient(135deg, #14141e 0%, #161620 100%);
    box-shadow: 0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03);
    transition: box-shadow 0.3s, border-color 0.3s;
  }
  .card:hover {
    border-color: rgba(212,175,55,0.15);
    box-shadow: 0 8px 30px rgba(0,0,0,0.3), 0 0 0 1px rgba(212,175,55,0.08);
  }

  /* Enhanced buttons */
  .btn-primary {
    position: relative;
    overflow: hidden;
    background: linear-gradient(135deg, #e8c84a, #c9a832, #8B7355);
    box-shadow: 0 4px 15px rgba(212,175,55,0.3), inset 0 1px 0 rgba(255,255,255,0.2);
    text-shadow: none;
    letter-spacing: 0.5px;
  }
  .btn-primary::after {
    content: '';
    position: absolute;
    top: 0; left: -100%;
    width: 60%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
    transition: left 0.4s ease;
  }
  .btn-primary:hover::after { left: 150%; }
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(212,175,55,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
  }

  /* Enhanced form controls */
  .form-control {
    background: rgba(20,20,30,0.8);
    border: 1px solid rgba(42,42,58,0.8);
    transition: all 0.25s;
  }
  .form-control:focus {
    background: rgba(20,20,30,1);
    border-color: var(--gold);
    box-shadow: 0 0 0 3px rgba(212,175,55,0.15), 0 2px 8px rgba(0,0,0,0.2);
  }

  /* Enhanced POS product cards */
  .pos-product-card {
    background: linear-gradient(145deg, #16161f, #1c1c28);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .pos-product-card:hover {
    transform: translateY(-4px) scale(1.01);
    box-shadow: 0 12px 30px rgba(212,175,55,0.2), 0 4px 12px rgba(0,0,0,0.4);
    border-color: rgba(212,175,55,0.5);
  }

  /* Enhanced modal */
  .modal {
    background: linear-gradient(145deg, #16161f, #1e1e2e);
    box-shadow: 0 25px 50px rgba(0,0,0,0.7), 0 0 0 1px rgba(212,175,55,0.1);
  }
  .modal-header {
    background: linear-gradient(90deg, rgba(212,175,55,0.05), transparent);
    border-bottom: 1px solid rgba(212,175,55,0.15);
  }

  /* Enhanced table rows */
  tr:hover td {
    background: rgba(212,175,55,0.05);
    transition: background 0.15s;
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.25); border-radius: 10px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(212,175,55,0.4); }

  /* Smooth page transitions */
  .content { animation: fadeInUp 0.3s ease; }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Cart footer total styling */
  .total-final {
    font-size: clamp(18px, 2.5vw, 22px) !important;
    background: linear-gradient(135deg, var(--gold-light), var(--gold));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-weight: 900 !important;
  }

  /* Badge glow */
  .badge-gold {
    box-shadow: 0 0 8px rgba(212,175,55,0.2);
  }
  .badge-green {
    box-shadow: 0 0 8px rgba(76,175,133,0.2);
  }
  .badge-red {
    box-shadow: 0 0 8px rgba(224,90,90,0.2);
  }

  /* Search bar enhancement */
  .search-bar {
    background: rgba(20,20,30,0.9);
    border: 1px solid rgba(42,42,58,0.8);
    transition: all 0.25s;
  }
  .search-bar:focus-within {
    border-color: rgba(212,175,55,0.4);
    box-shadow: 0 0 0 2px rgba(212,175,55,0.1);
  }

  /* User avatar glow */
  .user-avatar {
    box-shadow: 0 0 12px rgba(212,175,55,0.3);
  }

  /* Cart improved */
  .cart {
    background: linear-gradient(180deg, #141420 0%, #16161e 100%);
    box-shadow: -4px 0 20px rgba(0,0,0,0.2);
  }

  /* Notification styles */
  .notif { border-left: 3px solid var(--gold) !important; }
`;

// ==================== LOGIN PAGE ====================
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return setError("أدخل اسم المستخدم وكلمة المرور");
    setLoading(true);
    setError("");
    const { data, error: err } = await signInWithUsername(username, password);
    if (err) setError(err.message);
    else onLogin(data.user);
    setLoading(false);
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div className="logo-brand" style={{ fontSize: 32, marginBottom: 4 }}>ASH PURE</div>
          <div style={{ fontSize: 13, color: "var(--text3)" }}>نظام إدارة المبيعات والمخزون</div>
          <div style={{ width: 60, height: 2, background: "linear-gradient(90deg, var(--gold), transparent)", margin: "16px auto 0" }} />
        </div>
        <form onSubmit={handleLogin}>
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="form-group">
            <label className="form-label">اسم المستخدم</label>
            <input
              className="form-control"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="اسم المستخدم أو البريد الإلكتروني"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">كلمة المرور</label>
            <input
              className="form-control"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "13px", marginTop: 8 }}
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 16, height: 16, border: "2px solid rgba(0,0,0,0.3)", borderTop: "2px solid #000", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                جاري تسجيل الدخول...
              </span>
            ) : "تسجيل الدخول"}
          </button>
        </form>
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "rgba(212,175,55,0.06)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(212,175,55,0.12)" }}>
          <Icon name="warning" size={14} />
          <span style={{ fontSize: 12, color: "var(--text3)" }}>تسجيل الدخول عبر اسم المستخدم فقط. تواصل مع المدير لإنشاء حساب.</span>
        </div>
      </div>
    </div>
  );
}

// ==================== DASHBOARD ====================
function Dashboard({ products, customers, invoices, wasteLogs = [] }) {
  const totalSales = invoices.reduce((s, inv) => s + inv.total, 0);
  const totalProfit = invoices.reduce((s, inv) => {
    const cost = inv.items.reduce((c, item) => {
      const p = products.find(pr => pr.id === item.productId);
      return c + (p ? p.buyPrice * item.qty : 0);
    }, 0);
    return s + (inv.total - cost);
  }, 0);
  const lowStockProducts = products.filter(p => p.qty <= p.minQty);
  const totalDebt = customers.reduce((s, c) => s + (c.balance || 0), 0);

  const giftsCount = (wasteLogs || []).filter(w => w.type === 'gift').reduce((s, w) => s + (w.qty || 0), 0);
  const wasteCount = (wasteLogs || []).filter(w => w.type === 'waste').reduce((s, w) => s + (w.qty || 0), 0);
  const lossValue = (wasteLogs || []).reduce((s, w) => s + (w.cost || 0), 0);

  const recentInvoices = [...invoices].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const topProducts = products.map(p => ({
    ...p,
    soldQty: invoices.reduce((s, inv) => s + inv.items.filter(i => i.productId === p.id).reduce((q, i) => q + i.qty, 0), 0)
  })).sort((a, b) => b.soldQty - a.soldQty).slice(0, 5);

  const monthlyData = [
    { label: "يناير", value: 18500 }, { label: "فبراير", value: 22000 },
    { label: "مارس", value: 19800 }, { label: "أبريل", value: 27500 },
    { label: "مايو", value: totalSales },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>لوحة التحكم</h1>
        <p style={{ color: "var(--text2)", fontSize: 13 }}>مرحباً بك في نظام Ash Pure — {new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          <Icon name="warning" size={16} />
          <span><strong>{lowStockProducts.length} منتجات</strong> تحتاج إعادة تخزين: {lowStockProducts.map(p => p.name).join("، ")}</span>
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: "إجمالي المبيعات", value: formatCurrency(totalSales), icon: "dollar", color: "#D4AF37", bg: "rgba(212,175,55,0.1)", change: "+12.5% هذا الشهر" },
          { label: "إجمالي الأرباح", value: formatCurrency(totalProfit), icon: "trend_up", color: "#4CAF85", bg: "rgba(76,175,133,0.1)", change: "+8.3% هذا الشهر" },
          { label: "عدد العملاء", value: customers.length, icon: "users", color: "#5A9BE0", bg: "rgba(90,155,224,0.1)", change: "+2 هذا الشهر" },
          { label: "المديونيات", value: formatCurrency(totalDebt), icon: "warning", color: "#E05A5A", bg: "rgba(224,90,90,0.1)", change: `${customers.filter(c => c.balance > 0).length} عميل لديه دين` },
        ].map((stat, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-icon" style={{ background: stat.bg }}>
              <Icon name={stat.icon} size={18} style={{ color: stat.color }} />
            </div>
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value" style={{ color: stat.color }}>{stat.value}</div>
            <div className="stat-change" style={{ color: stat.color, opacity: 0.7 }}>{stat.change}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">المبيعات الشهرية</span>
            <span className="badge badge-gold">2025</span>
          </div>
          <SimpleBarChart data={monthlyData} height={160} />
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">أكثر المنتجات مبيعاً</span>
          </div>
          {topProducts.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
                <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (p.soldQty / (topProducts[0]?.soldQty || 1)) * 100)}%`, background: "linear-gradient(90deg, var(--gold), var(--gold-dark))", borderRadius: 2 }} />
                </div>
              </div>
              <span style={{ fontSize: 12, color: "var(--gold)", fontWeight: 700 }}>{p.soldQty} قطعة</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">آخر الفواتير</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>رقم الفاتورة</th><th>العميل</th><th>المبلغ</th><th>الحالة</th></tr>
              </thead>
              <tbody>
                {recentInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td data-label="رقم الفاتورة"><span style={{ fontWeight: 600, color: "var(--gold)" }}>{inv.id}</span></td>
                    <td data-label="العميل">{inv.customerName}</td>
                    <td data-label="المبلغ">{formatCurrency(inv.total)}</td>
                    <td data-label="الحالة">
                      <span className={`badge ${inv.status === "paid" ? "badge-green" : inv.status === "partial" ? "badge-gold" : "badge-red"}`}>
                        {inv.status === "paid" ? "مدفوعة" : inv.status === "partial" ? "جزئي" : "آجل"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">تحذيرات المخزون</span>
            <span className="badge badge-red">{lowStockProducts.length}</span>
          </div>
          {lowStockProducts.length === 0 ? (
            <div className="empty"><div>✅</div><div>المخزون بخير</div></div>
          ) : (
            lowStockProducts.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>SKU: {p.sku}</div>
                </div>
                <span className={`badge ${p.qty === 0 ? "badge-red" : "badge-gold"}`}>{p.qty === 0 ? "نفذ" : `${p.qty} متبقي`}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== PRODUCTS MANAGEMENT ====================
function ProductModal({ product, onSave, onClose }) {
  const [form, setForm] = useState(product || {
    name: "", sku: "", barcode: "", category: "شامبو", qty: 0,
    buyPrice: 0, sellPrice: 0, traderPrice: 0, specialistPrice: 0, clientPrice: 0,
    supplier: "", expiry: "", minQty: 10, notes: ""
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const autoBarcode = () => set("barcode", `600${Date.now().toString().slice(-10)}`);
  const autoSku = () => {
    const cat = CATEGORIES.indexOf(form.category);
    set("sku", `AP-${String.fromCharCode(65 + cat)}-${Date.now().toString().slice(-3)}`);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{product ? "تعديل المنتج" : "إضافة منتج جديد"}</span>
          <button className="btn-icon" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">اسم المنتج *</label>
              <input className="form-control" value={form.name} onChange={e => set("name", e.target.value)} placeholder="اسم المنتج" />
            </div>
            <div className="form-group">
              <label className="form-label">التصنيف</label>
              <select className="form-control" value={form.category} onChange={e => set("category", e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">SKU</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input className="form-control" value={form.sku} onChange={e => set("sku", e.target.value)} placeholder="AP-SH-001" />
                <button className="btn btn-secondary btn-sm" onClick={autoSku}>توليد</button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">الباركود</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input className="form-control" value={form.barcode} onChange={e => set("barcode", e.target.value)} placeholder="6001234567890" />
                <button className="btn btn-secondary btn-sm" onClick={autoBarcode}>توليد</button>
              </div>
            </div>
          </div>
          <div className="section-title">الأسعار</div>
          <div className="grid grid-3" style={{ marginBottom: 16 }}>
            {[
              { label: "سعر الشراء", key: "buyPrice" },
              { label: "سعر البيع (عادي)", key: "clientPrice" },
              { label: "سعر المتخصصة", key: "specialistPrice" },
              { label: "سعر التاجر", key: "traderPrice" },
              { label: "سعر الإجمالي", key: "sellPrice" },
            ].map(f => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.label}</label>
                <input className="form-control" type="number" value={form[f.key]} onChange={e => set(f.key, +e.target.value)} />
              </div>
            ))}
          </div>
          <div className="section-title">المخزون</div>
          <div className="grid grid-3">
            <div className="form-group">
              <label className="form-label">الكمية الحالية</label>
              <input className="form-control" type="number" value={form.qty} onChange={e => set("qty", +e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">الحد الأدنى للتنبيه</label>
              <input className="form-control" type="number" value={form.minQty} onChange={e => set("minQty", +e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">تاريخ الصلاحية</label>
              <input className="form-control" type="date" value={form.expiry} onChange={e => set("expiry", e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">المورد</label>
            <input className="form-control" value={form.supplier} onChange={e => set("supplier", e.target.value)} placeholder="اسم المورد" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>إلغاء</button>
          <button className="btn btn-primary" onClick={() => { if (!form.name) return; onSave({ ...form, id: product?.id || Date.now() }); }}>
            <Icon name="check" size={16} /> {product ? "تحديث" : "إضافة"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WasteModal({ products, onSave, onClose }) {
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [type, setType] = useState("waste");
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");

  const selectedProduct = products.find(p => p.id === Number(productId));

  const handleSave = () => {
    if (!productId) return;
    if (qty <= 0) return;
    if (selectedProduct && qty > selectedProduct.qty) {
      if (!confirm(`الكمية المدخلة (${qty}) أكبر من المخزون المتوفر (${selectedProduct.qty}). هل تريد الاستمرار؟`)) {
        return;
      }
    }
    onSave({
      productId: Number(productId),
      qty: Number(qty),
      type,
      notes,
    });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <span className="modal-title">تسجيل هالك / هدية</span>
          <button className="btn-icon" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">المنتج *</label>
            <select className="form-control" value={productId} onChange={e => setProductId(e.target.value)}>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} (متوفر: {p.qty})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">النوع *</label>
              <select className="form-control" value={type} onChange={e => setType(e.target.value)}>
                <option value="waste">هالك (تالف / منتهي)</option>
                <option value="gift">هدية (عينات دعائية / ترويجية)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">الكمية *</label>
              <input className="form-control" type="number" min="1" value={qty} onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">ملاحظات / سبب الحركة</label>
            <textarea className="form-control" value={notes} onChange={e => setNotes(e.target.value)} placeholder="مثال: عينة مجانية لعميل VIP، كسر بالعبوة..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>إلغاء</button>
          <button className="btn btn-primary" onClick={handleSave} style={{ background: type === 'waste' ? 'linear-gradient(135deg, var(--red), var(--gold-dark))' : 'linear-gradient(135deg, var(--blue), var(--gold-dark))' }}>
            <Icon name="check" size={16} /> تسجيل الحركة
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductsPage({ products, setProducts, wasteLogs = [], setWasteLogs, user, showNotif }) {
  const [subTab, setSubTab] = useState("list"); // "list" or "waste"
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("الكل");
  const [modal, setModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  // Waste sub-tab state
  const [wasteSearch, setWasteSearch] = useState("");
  const [wasteTypeFilter, setWasteTypeFilter] = useState("الكل");
  const [wasteModal, setWasteModal] = useState(null);

  const filtered = products.filter(p =>
    (catFilter === "الكل" || p.category === catFilter) &&
    (p.name.includes(search) || p.sku.includes(search) || p.barcode.includes(search))
  );

  const filteredWaste = (wasteLogs || []).filter(w => {
    const prod = products.find(p => p.id === w.productId);
    const prodName = prod ? prod.name : (w.name || "");
    const matchesSearch = prodName.toLowerCase().includes(wasteSearch.toLowerCase()) || (w.notes || "").toLowerCase().includes(wasteSearch.toLowerCase());
    const matchesType = wasteTypeFilter === "الكل" || w.type === wasteTypeFilter;
    return matchesSearch && matchesType;
  });

  const handleSave = (prod) => {
    if (prod.id && products.find(p => p.id === prod.id)) {
      setProducts(ps => ps.map(p => p.id === prod.id ? prod : p));
      showNotif("تم تحديث المنتج بنجاح", "success");
    } else {
      setProducts(ps => [...ps, prod]);
      showNotif("تم إضافة المنتج بنجاح", "success");
    }
    setModal(null);
  };

  const handleDelete = (id) => {
    setProducts(ps => ps.filter(p => p.id !== id));
    showNotif("تم حذف المنتج", "error");
    setDeleteId(null);
  };

  const handleSaveWaste = (data) => {
    const prod = products.find(p => p.id === data.productId);
    if (!prod) return;
    const cost = prod.buyPrice * data.qty;
    const newLog = {
      id: generateId("WST"),
      productId: data.productId,
      qty: data.qty,
      type: data.type,
      cost,
      createdBy: user?.email || "unknown",
      createdAt: new Date().toISOString().split("T")[0],
      notes: data.notes
    };
    // Decrease stock
    setProducts(ps => ps.map(p => p.id === data.productId ? { ...p, qty: p.qty - data.qty } : p));
    // Add to wasteLogs
    if (setWasteLogs) setWasteLogs(ws => [newLog, ...ws]);
    showNotif(data.type === "waste" ? "تم تسجيل هالك وتحديث المخزون" : "تم تسجيل هدية وتحديث المخزون", "success");
    setWasteModal(null);
  };

  const handleDeleteWaste = (log) => {
    if (confirm("هل أنت متأكد من حذف هذه الحركة وإرجاع الكمية للمخزون؟")) {
      // Restore stock quantity
      setProducts(ps => ps.map(p => p.id === log.productId ? { ...p, qty: p.qty + log.qty } : p));
      // Delete waste log
      if (setWasteLogs) setWasteLogs(ws => ws.filter(x => x.id !== log.id));
      showNotif("تم حذف الحركة وإرجاع المخزون بنجاح", "success");
    }
  };

  const stockColor = (p) => p.qty === 0 ? "var(--red)" : p.qty <= p.minQty ? "var(--gold)" : "var(--green)";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>إدارة المنتجات والمخزون</h2>
          <p style={{ color: "var(--text2)", fontSize: 13 }}>
            {subTab === "list" ? `${products.length} منتج في المخزون` : `${filteredWaste.length} حركة مسجلة`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {subTab === "list" ? (
            <button className="btn btn-primary" onClick={() => setModal("new")}><Icon name="plus" size={16} />إضافة منتج</button>
          ) : (
            <button className="btn btn-primary" onClick={() => setWasteModal("new")} style={{ background: "linear-gradient(135deg, var(--red), var(--gold-dark))" }}><Icon name="plus" size={16} />تسجيل هالك / هدية</button>
          )}
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <div className={`tab ${subTab === "list" ? "active" : ""}`} onClick={() => setSubTab("list")}>قائمة المنتجات</div>
        <div className={`tab ${subTab === "waste" ? "active" : ""}`} onClick={() => setSubTab("waste")}>الهوالك والهدايا</div>
      </div>

      {subTab === "list" ? (
        <>
          <div className="card" style={{ marginBottom: 16, padding: "14px 20px" }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
                <Icon name="search" size={16} style={{ color: "var(--text3)" }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو SKU أو الباركود..." />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["الكل", ...CATEGORIES].map(c => (
                  <button key={c} className={`btn btn-sm ${catFilter === c ? "btn-primary" : "btn-secondary"}`} onClick={() => setCatFilter(c)}>{c}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>المنتج</th><th>SKU</th><th>التصنيف</th><th>الكمية</th>
                    <th>سعر الشراء</th><th>سعر البيع</th><th>الربح</th><th>المورد</th><th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9}><div className="empty"><div className="empty-icon">📦</div><div>لا توجد منتجات</div></div></td></tr>
                  ) : filtered.map(p => (
                    <tr key={p.id}>
                      <td data-label="المنتج">
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💊</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: "var(--text3)" }}>{p.barcode}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="SKU"><span className="tag">{p.sku}</span></td>
                      <td data-label="التصنيف"><span className="badge badge-blue">{p.category}</span></td>
                      <td data-label="الكمية">
                        <div className="stock-indicator">
                          <div className="stock-dot" style={{ background: stockColor(p) }} />
                          <span style={{ color: stockColor(p), fontWeight: 600 }}>{p.qty}</span>
                          <span style={{ color: "var(--text3)", fontSize: 10 }}>/{p.minQty} حد أدنى</span>
                        </div>
                      </td>
                      <td data-label="سعر الشراء">{formatCurrency(p.buyPrice)}</td>
                      <td data-label="سعر البيع" style={{ color: "var(--gold)", fontWeight: 600 }}>{formatCurrency(p.clientPrice)}</td>
                      <td data-label="الربح" style={{ color: "var(--green)", fontWeight: 600 }}>{formatCurrency(p.clientPrice - p.buyPrice)}</td>
                      <td data-label="المورد" style={{ color: "var(--text2)", fontSize: 12 }}>{p.supplier}</td>
                      <td data-label="إجراءات">
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn-icon" onClick={() => setModal(p)} title="تعديل"><Icon name="edit" size={14} /></button>
                          <button className="btn-icon" style={{ color: "var(--red)", borderColor: "rgba(224,90,90,0.3)" }} onClick={() => setDeleteId(p.id)} title="حذف"><Icon name="trash" size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16, padding: "14px 20px" }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
                <Icon name="search" size={16} style={{ color: "var(--text3)" }} />
                <input value={wasteSearch} onChange={e => setWasteSearch(e.target.value)} placeholder="بحث باسم المنتج أو الملاحظات..." />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["الكل", "waste", "gift"].map(type => (
                  <button 
                    key={type} 
                    className={`btn btn-sm ${wasteTypeFilter === type ? "btn-primary" : "btn-secondary"}`} 
                    onClick={() => setWasteTypeFilter(type)}
                  >
                    {type === "الكل" ? "الكل" : type === "waste" ? "هالك 🗑️" : "هدية 🎁"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>المنتج</th><th>النوع</th><th>الكمية</th><th>التكلفة الإجمالية</th><th>التاريخ</th><th>الملاحظات / السبب</th><th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWaste.length === 0 ? (
                    <tr><td colSpan={7}><div className="empty"><div className="empty-icon">🗑️</div><div>لا توجد حركات مسجلة</div></div></td></tr>
                  ) : filteredWaste.map(w => {
                    const prod = products.find(p => p.id === w.productId);
                    const prodName = prod ? prod.name : (w.name || `منتج #${w.productId}`);
                    return (
                      <tr key={w.id}>
                        <td data-label="المنتج">
                          <div style={{ fontWeight: 600 }}>{prodName}</div>
                        </td>
                        <td data-label="النوع">
                          <span className={`badge ${w.type === 'gift' ? 'badge-green' : 'badge-red'}`}>
                            {w.type === 'gift' ? 'هدية 🎁' : 'هالك 🗑️'}
                          </span>
                        </td>
                        <td data-label="الكمية" style={{ fontWeight: 600 }}>{w.qty}</td>
                        <td data-label="التكلفة الإجمالية">{formatCurrency(w.cost)}</td>
                        <td data-label="التاريخ" style={{ color: "var(--text2)", fontSize: 12 }}>{formatDate(w.createdAt || w.created_at)}</td>
                        <td data-label="الملاحظات" style={{ color: "var(--text2)", fontSize: 12 }}>{w.notes || "—"}</td>
                        <td data-label="إجراءات">
                          <button className="btn-icon" style={{ color: "var(--red)", borderColor: "rgba(224,90,90,0.3)" }} onClick={() => handleDeleteWaste(w)} title="حذف وإرجاع للمخزون"><Icon name="trash" size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {(modal === "new" || (modal && modal.id)) && (
        <ProductModal product={modal === "new" ? null : modal} onSave={handleSave} onClose={() => setModal(null)} />
      )}

      {wasteModal === "new" && (
        <WasteModal products={products} onSave={handleSaveWaste} onClose={() => setWasteModal(null)} />
      )}

      {deleteId && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header"><span className="modal-title">تأكيد الحذف</span></div>
            <div className="modal-body">
              <div className="alert alert-danger"><Icon name="warning" size={16} />هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>إلغاء</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteId)}><Icon name="trash" size={16} />حذف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== POS ====================
function POSPage({ products, setProducts, customers, invoices, setInvoices, showNotif, customerTypes, wasteLogs, setWasteLogs }) {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [customerType, setCustomerType] = useState("client");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paidAmount, setPaidAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(null);
  const [isSharing, setIsSharing] = useState(false);

  const handleShareInvoice = async (invoice) => {
    setIsSharing(true);
    try {
      showNotif("جاري توليد ملف الـ PDF والرفع للغيمة... ⏳", "info");
      const pdfBlob = await downloadInvoicePDF(invoice, true);
      
      const formData = new FormData();
      formData.append("file", pdfBlob, `invoice-${invoice.id}.pdf`);
      
      const res = await fetch("https://tmpfiles.org/api/v1/upload", {
        method: "POST",
        body: formData
      });
      
      if (!res.ok) throw new Error("فشل رفع الملف");
      const data = await res.json();
      
      const shareUrl = data.data.url;
      const directDownloadUrl = shareUrl.replace("tmpfiles.org/", "tmpfiles.org/dl/");
      
      await navigator.clipboard.writeText(directDownloadUrl);
      showNotif("تم نسخ رابط تحميل الفاتورة المباشر! 📋", "success");
      
      const message = `مرحباً ${invoice.customerName || "عميلنا العزيز"}،\nيسعدنا تعاملك مع ASH PURE.\nإليك رابط تحميل فاتورتك الرقمية (PDF) صالحة للتحميل لمدة ساعة:\n${directDownloadUrl}\nشكراً لك! ✨`;
      const whatsappUrl = `https://wa.me/${invoice.customerPhone || ""}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, "_blank");
    } catch (e) {
      console.error(e);
      showNotif("فشل توليد أو رفع رابط الفاتورة", "error");
    } finally {
      setIsSharing(false);
    }
  };

  const priceKey = customerTypes.find(t => t.id === customerType)?.priceKey || "clientPrice";

  const getSpecialPriceFromMock = (customerId, productId) => {
    const sp = INITIAL_SPECIAL_PRICES.find(s => s.customerId === customerId && s.productId === productId);
    return sp ? sp.specialPrice : null;
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode.includes(search) || p.sku.includes(search)
  );

  const addToCart = (product) => {
    if (product.qty === 0) return showNotif("المنتج نفذ من المخزون", "error");
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        if (existing.qty >= product.qty) return showNotif("لا توجد كمية كافية", "error"), prev;
        return prev.map(i => i.productId === product.id ? { ...i, qty: i.qty + 1, total: (i.qty + 1) * i.price } : i);
      }
      // If customer has a special price for this product, use it
      const special = selectedCustomer ? getSpecialPriceFromMock(selectedCustomer.id, product.id) : null;
      const basePrice = special != null ? special : (product[priceKey] || product.clientPrice);
      return [...prev, { productId: product.id, name: product.name, qty: 1, price: basePrice, total: basePrice, maxQty: product.qty, movement_type: 'sale' }];
    });
  };

  const updateQty = (productId, delta) => {
    setCart(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const newQty = i.qty + delta;
      if (newQty <= 0) return null;
      if (newQty > i.maxQty) return showNotif("لا توجد كمية كافية", "warning"), i;
      return { ...i, qty: newQty, total: newQty * i.price };
    }).filter(Boolean));
  };

  const removeFromCart = (productId) => setCart(prev => prev.filter(i => i.productId !== productId));

  useEffect(() => {
    setCart(prev => prev.map(i => {
      if (i.isCustomPrice) return i;
      const p = products.find(pr => pr.id === i.productId);
      const special = selectedCustomer ? getSpecialPriceFromMock(selectedCustomer.id, i.productId) : null;
      const price = i.movement_type === 'sale' ? (special != null ? special : (p ? (p[priceKey] || p.clientPrice) : i.price)) : 0;
      return { ...i, price, total: i.qty * price };
    }));
  }, [customerType, priceKey, selectedCustomer, products]);

  // subtotal counts only actual sales
  const subtotal = cart.reduce((s, i) => s + (i.movement_type === 'sale' ? i.total : 0), 0);
  const discountAmt = discount;
  const taxAmt = ((subtotal - discountAmt) * tax) / 100;
  const total = subtotal - discountAmt + taxAmt;
  const remaining = paymentMethod === "deferred" ? total - (+paidAmount || 0) : 0;
  const totalCartQty = cart.reduce((s, item) => s + item.qty, 0);

  const handleCheckout = () => {
    if (cart.length === 0) return showNotif("السلة فارغة", "warning");
    if (paymentMethod === "deferred" && !selectedCustomer) return showNotif("اختر العميل للدفع الآجل", "warning");

    const invoiceItems = cart.map(i => ({ ...i }));

    const invoice = {
      id: generateId("INV"), customerId: selectedCustomer?.id || null,
      customerName: selectedCustomer?.name || "عميل نقدي", customerType,
      customerPhone: selectedCustomer?.phone || "",
      items: invoiceItems, subtotal, discount, tax, total,
      paid: paymentMethod === "deferred" ? (+paidAmount || 0) : total,
      remaining, paymentMethod, date: new Date().toISOString().split("T")[0],
      dueDate: dueDate || null, status: remaining > 0 ? "partial" : "paid"
    };

    setInvoices(prev => [invoice, ...prev]);
    setProducts(prev => prev.map(p => {
      const cartItem = cart.find(i => i.productId === p.id);
      return cartItem ? { ...p, qty: p.qty - cartItem.qty } : p;
    }));
    // Create waste/gift logs locally and prepend to wasteLogs
    const newLogs = [];
    cart.forEach(i => {
      if (i.movement_type === 'gift' || i.movement_type === 'waste') {
        const product = products.find(p => p.id === i.productId);
        const costPerUnit = product ? product.buyPrice : 0;
        const cost = costPerUnit * i.qty;
        newLogs.push({ id: generateId('WST'), productId: i.productId, qty: i.qty, type: i.movement_type, cost, created_by: user?.id || 'local', created_at: new Date().toISOString(), notes: i.notes || '' });
      }
    });
    if (newLogs.length > 0 && setWasteLogs) setWasteLogs(prev => [...newLogs, ...prev]);
    if (selectedCustomer && remaining > 0) {
      // Update customer balance - in real app this would update DB
    }

    setShowSuccess(invoice);
    setCart([]);
    setSearch("");
    setDiscount(0);
    setTax(0);
    setPaidAmount("");
    showNotif(`تم إنشاء الفاتورة ${invoice.id} بنجاح`, "success");
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>نقطة البيع</h2>
      </div>
      <div className="pos-layout">
        <div className="pos-products">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div className="search-bar" style={{ flex: 1 }}>
              <Icon name="search" size={16} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الباركود..." />
              {search && <button className="btn-icon" style={{ padding: 2 }} onClick={() => setSearch("")}><Icon name="close" size={12} /></button>}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {customerTypes.map(t => (
                <button key={t.id} className={`btn btn-sm ${customerType === t.id ? "btn-primary" : "btn-secondary"}`} onClick={() => {
                  setCustomerType(t.id);
                  setCart(prev => prev.map(item => ({ ...item, isCustomPrice: false })));
                }}>{t.label}</button>
              ))}
            </div>
          </div>
          <div className="pos-grid">
            {filtered.map(p => {
              const price = p[priceKey] || p.clientPrice;
              return (
                <div key={p.id} className={`pos-product-card ${p.qty === 0 ? "out" : ""}`} onClick={() => addToCart(p)}>
                  <div className="pos-product-img">{getProductIcon(p)}</div>
                  <div className="pos-product-name">{p.name}</div>
                  <div className="pos-product-price">{formatCurrency(price)}</div>
                  <div className="pos-product-qty">{p.qty === 0 ? "نفذ" : `متوفر: ${p.qty}`}</div>
                </div>
              );
            })}
          </div>
          
          {window.innerWidth <= 768 && (
            <button className="btn btn-primary" onClick={() => setMobileCartOpen(true)} style={{ position: 'absolute', bottom: 20, left: 20, right: 20, zIndex: 1000, height: 56, borderRadius: 28, fontSize: 16 }}>
              <Icon name="cart" size={20} /> عرض السلة ({totalCartQty}) - {formatCurrency(total)}
            </button>
          )}
        </div>

        <div className={`cart ${mobileCartOpen ? 'open' : ''}`}>
          <div className="cart-header">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="cart-toggle-btn" onClick={() => setMobileCartOpen(false)}><Icon name="close" size={24} /></button>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>🛒 السلة</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{cart.length} منتج • {totalCartQty} قطعة</div>
                </div>
              </div>
              {cart.length > 0 && <button className="btn btn-danger btn-sm" style={{ fontSize: 11 }} onClick={() => setCart([])}>مسح الكل</button>}
            </div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label">العميل</label>
              <select className="form-control" value={selectedCustomer?.id || ""} onChange={e => {
                setSelectedCustomer(customers.find(c => c.id === +e.target.value) || null);
                setCart(prev => prev.map(item => ({ ...item, isCustomPrice: false })));
              }}>
                <option value="">عميل نقدي / بدون حساب</option>
                {customers.filter(c => c.type === customerType).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="cart-items">
            {cart.length === 0 ? (
              <div className="empty"><div className="empty-icon">🛒</div><div>السلة فارغة</div><div style={{ fontSize: 12, marginTop: 4 }}>اختر منتجاً للبدء</div></div>
            ) : (
              cart.map(item => (
                <div className="cart-item" key={item.productId} style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 12, 
                  padding: 16, 
                  borderRadius: 'var(--radius)', 
                  border: '1px solid var(--border)', 
                  background: 'var(--card2)',
                  transition: 'border-color 0.2s',
                  position: 'relative'
                }}>
                  {/* Top Row: Name, Badges and Delete Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <div className="cart-item-name" style={{ 
                        overflow: "hidden", 
                        textOverflow: "ellipsis", 
                        whiteSpace: "nowrap", 
                        fontWeight: 700, 
                        fontSize: 14,
                        color: 'var(--text)'
                      }}>
                        {item.name}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {item.movement_type === 'gift' && <span className="badge badge-green" style={{ fontSize: 10, padding: '2px 8px' }}>هدية 🎁</span>}
                        {item.movement_type === 'waste' && <span className="badge badge-red" style={{ fontSize: 10, padding: '2px 8px' }}>هالك 🗑️</span>}
                        {item.movement_type === 'sale' && <span className="badge badge-gold" style={{ fontSize: 10, padding: '2px 8px' }}>بيع 💰</span>}
                      </div>
                    </div>
                    <button className="btn-icon" style={{ 
                      width: 28, 
                      height: 28, 
                      borderRadius: '50%', 
                      color: 'var(--red)', 
                      borderColor: 'transparent',
                      background: 'rgba(224,90,90,0.1)' 
                    }} onClick={() => removeFromCart(item.productId)} title="إزالة من السلة">
                      <Icon name="close" size={12} />
                    </button>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

                  {/* Bottom Row: Qty Controls, Price Input, Movement Toggle, Total Price */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    {/* Qty Controls */}
                    <div className="cart-item-qty" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button className="qty-btn" style={{ width: 28, height: 28 }} onClick={() => updateQty(item.productId, -1)}>−</button>
                      <span style={{ fontSize: 14, fontWeight: 800, minWidth: 20, textAlign: "center" }}>{item.qty}</span>
                      <button className="qty-btn" style={{ width: 28, height: 28 }} onClick={() => updateQty(item.productId, 1)}>+</button>
                    </div>

                    {/* Price Input or Label */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {item.movement_type === 'sale' ? (
                        <>
                          <input 
                            type="number" 
                            value={item.price} 
                            onChange={(e) => {
                              const newPrice = parseFloat(e.target.value) || 0;
                              setCart(prev => prev.map(ci => ci.productId === item.productId ? { ...ci, price: newPrice, total: ci.qty * newPrice, isCustomPrice: true } : ci));
                            }} 
                            style={{ 
                              width: 65, 
                              background: 'var(--card)', 
                              border: '1px solid var(--border)', 
                              borderRadius: 'var(--radius-sm)', 
                              color: 'var(--gold)', 
                              padding: '4px 6px',
                              textAlign: 'center',
                              fontFamily: 'inherit',
                              fontSize: 12,
                              fontWeight: 700,
                              outline: 'none'
                            }}
                          />
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>ج.م</span>
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>مجانًا</span>
                      )}
                    </div>

                    {/* Movement Type Toggle Button Group */}
                    <div style={{ display: 'flex', background: 'var(--card)', padding: 2, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      {[['sale', 'بيع'], ['gift', 'هدية'], ['waste', 'هالك']].map(([type, label]) => {
                        const active = (item.movement_type || 'sale') === type;
                        let activeColor = 'var(--gold)';
                        let activeBg = 'rgba(212, 175, 55, 0.15)';
                        if (type === 'gift') { activeColor = 'var(--green)'; activeBg = 'rgba(76, 175, 133, 0.15)'; }
                        if (type === 'waste') { activeColor = 'var(--red)'; activeBg = 'rgba(224, 90, 90, 0.15)'; }
                        return (
                          <button 
                            key={type} 
                            onClick={() => setCart(prev => prev.map(ci => ci.productId === item.productId ? { 
                              ...ci, 
                              movement_type: type, 
                              price: type === 'sale' ? (ci.price || 0) : 0, 
                              total: ci.qty * (type === 'sale' ? (ci.price || 0) : 0),
                              isCustomPrice: type === 'sale' ? ci.isCustomPrice : false
                            } : ci))}
                            style={{
                              border: 'none',
                              background: active ? activeBg : 'transparent',
                              color: active ? activeColor : 'var(--text3)',
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '4px 8px',
                              borderRadius: 4,
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Total Price */}
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--gold)', minWidth: 60, textAlign: 'left' }}>
                      {formatCurrency(item.total)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="cart-footer">
            <div className="grid grid-2" style={{ marginBottom: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">خصم ج.م</label>
                <input className="form-control" type="number" min="0" value={discount} onChange={e => setDiscount(+e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">ضريبة %</label>
                <input className="form-control" type="number" min="0" value={tax} onChange={e => setTax(+e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div className="form-label" style={{ marginBottom: 8 }}>طريقة الدفع</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {PAYMENT_METHODS.map(m => (
                  <button key={m.id} className={`btn btn-sm ${paymentMethod === m.id ? "btn-primary" : "btn-secondary"}`} style={{ flexDirection: "column", gap: 2, padding: "8px 6px" }} onClick={() => setPaymentMethod(m.id)}>
                    <span style={{ fontSize: 16 }}>{m.icon}</span>
                    <span style={{ fontSize: 10 }}>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === "deferred" && (
              <div className="grid grid-2" style={{ marginBottom: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">المبلغ المدفوع</label>
                  <input className="form-control" type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder="0" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">تاريخ الاستحقاق</label>
                  <input className="form-control" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
              </div>
            )}

            <div style={{ padding: "12px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", marginBottom: 12 }}>
              <div className="total-row"><span>المجموع الفرعي</span><span>{formatCurrency(subtotal)}</span></div>
              {discount > 0 && <div className="total-row" style={{ color: "var(--green)" }}><span>خصم</span><span>- {formatCurrency(discountAmt)}</span></div>}
              {tax > 0 && <div className="total-row" style={{ color: "var(--text2)" }}><span>ضريبة ({tax}%)</span><span>+ {formatCurrency(taxAmt)}</span></div>}
              {paymentMethod === "deferred" && paidAmount && <div className="total-row" style={{ color: "var(--green)" }}><span>المدفوع</span><span>{formatCurrency(+paidAmount)}</span></div>}
              {remaining > 0 && <div className="total-row" style={{ color: "var(--red)" }}><span>المتبقي</span><span>{formatCurrency(remaining)}</span></div>}
              <div className="total-row" style={{ marginTop: 8 }}><span style={{ fontSize: 16, fontWeight: 700 }}>الإجمالي</span><span className="total-final">{formatCurrency(total)}</span></div>
            </div>

            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: "16px", fontSize: 16, fontWeight: 800, borderRadius: 12, letterSpacing: 0.5, boxShadow: "0 8px 25px rgba(212,175,55,0.35)" }} onClick={handleCheckout} disabled={cart.length === 0}>
              <Icon name="check" size={20} /> إتمام البيع وطباعة الفاتورة
            </button>
          </div>
        </div>
      </div>

      {showSuccess && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <span className="modal-title">✅ تم إنشاء الفاتورة بنجاح</span>
              <button className="btn-icon" onClick={() => setShowSuccess(null)}><Icon name="close" size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--gold)" }}>{showSuccess.id}</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{formatCurrency(showSuccess.total)}</div>
                <div style={{ color: "var(--text2)", marginTop: 4 }}>{showSuccess.customerName} • {formatDate(showSuccess.date)}</div>
              </div>
              <div style={{ background: "var(--card)", borderRadius: "var(--radius-sm)", padding: 16, marginBottom: 16 }}>
                {showSuccess.items.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                    <span>{item.name} × {item.qty}</span>
                    <span>{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer" style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", width: "100%" }}>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-secondary" onClick={() => downloadInvoicePDF(showSuccess)} style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }}>
                  <Icon name="download" size={16} /> تحميل PDF
                </button>
                <button className="btn btn-secondary" onClick={() => handleShareInvoice(showSuccess)} disabled={isSharing} style={{ background: "var(--gold-bg)", color: "var(--gold)", border: "1px solid var(--gold)" }}>
                  <Icon name="link" size={16} /> {isSharing ? "جاري الرفع..." : "مشاركة و WhatsApp"}
                </button>
              </div>
              <button className="btn btn-primary" onClick={() => setShowSuccess(null)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== CUSTOMERS ====================
function CustomerModal({ customer, onSave, onClose }) {
  const isCustomInitial = customer ? (customer.type !== "client" && customer.type !== "specialist" && customer.type !== "trader") : false;

  const [form, setForm] = useState(customer || { name: "", phone: "", address: "", type: "client", priceKey: "clientPrice", notes: "" });
  const [isCustomSelected, setIsCustomSelected] = useState(isCustomInitial);
  const [customTypeName, setCustomTypeName] = useState(isCustomInitial ? customer.type : "");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleTypeChange = (val) => {
    if (val === "custom") {
      setIsCustomSelected(true);
      const newTypeName = customTypeName || "عميل مخصص";
      setForm(f => ({ ...f, type: newTypeName, priceKey: f.priceKey || "clientPrice" }));
    } else {
      setIsCustomSelected(false);
      const standardPriceKeys = { client: "clientPrice", specialist: "specialistPrice", trader: "traderPrice" };
      setForm(f => ({ ...f, type: val, priceKey: standardPriceKeys[val] }));
    }
  };

  const handleCustomNameChange = (val) => {
    setCustomTypeName(val);
    setForm(f => ({ ...f, type: val }));
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{customer ? "تعديل العميل" : "إضافة عميل جديد"}</span>
          <button className="btn-icon" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">الاسم *</label>
            <input className="form-control" value={form.name} onChange={e => set("name", e.target.value)} placeholder="اسم العميل أو الشركة" />
          </div>
          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">رقم الهاتف</label>
              <input className="form-control" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="01xxxxxxxxx" />
            </div>
            <div className="form-group">
              <label className="form-label">نوع العميل</label>
              <select className="form-control" value={isCustomSelected ? "custom" : form.type} onChange={e => handleTypeChange(e.target.value)}>
                {CUSTOMER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                <option value="custom">نوع مخصص...</option>
              </select>
            </div>
          </div>

          {isCustomSelected && (
            <div className="grid grid-2" style={{ animation: "slideUp 0.2s", background: "var(--card)", padding: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", marginBottom: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">اسم النوع المخصص *</label>
                <input className="form-control" value={customTypeName} onChange={e => handleCustomNameChange(e.target.value)} placeholder="مثال: موزع، VIP، خارجي" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">فئة السعر المطبقة</label>
                <select className="form-control" value={form.priceKey || "clientPrice"} onChange={e => set("priceKey", e.target.value)}>
                  <option value="clientPrice">سعر العميل العادي</option>
                  <option value="specialistPrice">سعر المتخصصة</option>
                  <option value="traderPrice">سعر التاجر</option>
                </select>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">العنوان</label>
            <input className="form-control" value={form.address} onChange={e => set("address", e.target.value)} placeholder="المدينة - المنطقة" />
          </div>
          <div className="form-group">
            <label className="form-label">ملاحظات</label>
            <textarea className="form-control" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="أي ملاحظات خاصة..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>إلغاء</button>
          <button className="btn btn-primary" onClick={() => { if (!form.name) return; onSave({ ...form, id: customer?.id || Date.now(), balance: customer?.balance || 0, totalPurchases: customer?.totalPurchases || 0 }); }}>
            <Icon name="check" size={16} />{customer ? "تحديث" : "إضافة"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomersPage({ customers, setCustomers, invoices, showNotif, customerTypes }) {
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("الكل");
  const [viewCustomer, setViewCustomer] = useState(null);

  const filtered = customers.filter(c =>
    (typeFilter === "الكل" || c.type === typeFilter) &&
    (c.name.includes(search) || c.phone.includes(search))
  );

  const getCustomerInvoices = (id) => invoices.filter(inv => inv.customerId === id);

  const handleSave = (c) => {
    if (customers.find(x => x.id === c.id)) {
      setCustomers(cs => cs.map(x => x.id === c.id ? c : x));
      showNotif("تم تحديث بيانات العميل", "success");
    } else {
      setCustomers(cs => [...cs, c]);
      showNotif("تم إضافة العميل بنجاح", "success");
    }
    setModal(null);
  };

  const typeLabel = (type) => customerTypes.find(t => t.id === type)?.label || type;
  const typeBadge = (type) => {
    if (type === "trader") return "badge-gold";
    if (type === "specialist") return "badge-purple";
    if (type === "client") return "badge-blue";
    return "badge-gold";
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>إدارة العملاء</h2>
          <p style={{ color: "var(--text2)", fontSize: 13 }}>{customers.length} عميل مسجل</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal("new")}><Icon name="plus" size={16} />إضافة عميل</button>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: "14px 20px" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
            <Icon name="search" size={16} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الهاتف..." />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["الكل", ...customerTypes.map(t => t.label)].map((label, i) => {
              const typeId = i === 0 ? "الكل" : customerTypes[i - 1].id;
              return (
                <button key={label} className={`btn btn-sm ${typeFilter === typeId ? "btn-primary" : "btn-secondary"}`} onClick={() => setTypeFilter(typeId)}>{label}</button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>العميل</th><th>النوع</th><th>الهاتف</th><th>العنوان</th><th>إجمالي المشتريات</th><th>الرصيد المتبقي</th><th>إجراءات</th></tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td data-label="العميل">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, var(--gold), var(--gold-dark))", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#000" }}>
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                        {c.notes && <div style={{ fontSize: 11, color: "var(--text3)" }}>{c.notes}</div>}
                      </div>
                    </div>
                  </td>
                  <td data-label="النوع"><span className={`badge ${typeBadge(c.type)}`}>{typeLabel(c.type)}</span></td>
                  <td data-label="الهاتف" style={{ direction: "ltr", textAlign: "right" }}>{c.phone}</td>
                  <td data-label="العنوان" style={{ color: "var(--text2)", fontSize: 12 }}>{c.address}</td>
                  <td data-label="إجمالي المشتريات" style={{ color: "var(--gold)", fontWeight: 600 }}>{formatCurrency(c.totalPurchases)}</td>
                  <td data-label="الرصيد المتبقي">
                    {c.balance > 0
                      ? <span className="badge badge-red">{formatCurrency(c.balance)}</span>
                      : <span className="badge badge-green">لا يوجد</span>}
                  </td>
                  <td data-label="إجراءات">
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn-icon" onClick={() => setViewCustomer(c)} title="عرض"><Icon name="eye" size={14} /></button>
                      <button className="btn-icon" onClick={() => setModal(c)} title="تعديل"><Icon name="edit" size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(modal === "new" || (modal && modal.id)) && (
        <CustomerModal customer={modal === "new" ? null : modal} onSave={handleSave} onClose={() => setModal(null)} />
      )}

      {viewCustomer && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewCustomer(null)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">ملف العميل — {viewCustomer.name}</span>
              <button className="btn-icon" onClick={() => setViewCustomer(null)}><Icon name="close" size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="grid grid-3" style={{ marginBottom: 20 }}>
                {[
                  { label: "النوع", value: typeLabel(viewCustomer.type) },
                  { label: "الهاتف", value: viewCustomer.phone },
                  { label: "العنوان", value: viewCustomer.address },
                  { label: "إجمالي المشتريات", value: formatCurrency(viewCustomer.totalPurchases) },
                  { label: "الرصيد المتبقي", value: formatCurrency(viewCustomer.balance) },
                  { label: "عدد الفواتير", value: getCustomerInvoices(viewCustomer.id).length },
                ].map((s, i) => (
                  <div key={i} className="card" style={{ padding: "12px 16px" }}>
                    <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontWeight: 700, color: "var(--gold)" }}>{s.value || "—"}</div>
                  </div>
                ))}
              </div>
              <div className="section-title">سجل الفواتير</div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>المبلغ</th><th>الحالة</th></tr></thead>
                  <tbody>
                    {getCustomerInvoices(viewCustomer.id).length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text3)", padding: 24 }}>لا توجد فواتير</td></tr>
                    ) : getCustomerInvoices(viewCustomer.id).map(inv => (
                      <tr key={inv.id}>
                        <td style={{ color: "var(--gold)", fontWeight: 600 }}>{inv.id}</td>
                        <td>{formatDate(inv.date)}</td>
                        <td>{formatCurrency(inv.total)}</td>
                        <td><span className={`badge ${inv.status === "paid" ? "badge-green" : "badge-red"}`}>{inv.status === "paid" ? "مدفوعة" : "آجل"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 16 }}>
                <CustomerSpecialPrices customerId={viewCustomer.id} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== INVOICES ====================
function InvoicesPage({ invoices, customers, showNotif, customerTypes }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("الكل");
  const [viewInvoice, setViewInvoice] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    if (invoices.length === 0) return showNotif("لا توجد فواتير للتصدير", "warning");
    setIsExporting(true);
    try {
      await exportInvoicesToExcel(invoices, customers);
      showNotif("تم تصدير الفواتير بنجاح ✅", "success");
    } catch (e) {
      showNotif("فشل التصدير: " + e.message, "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareInvoice = async (invoice) => {
    setIsSharing(true);
    try {
      showNotif("جاري توليد ملف الـ PDF والرفع للغيمة... ⏳", "info");
      const pdfBlob = await downloadInvoicePDF(invoice, true);
      
      const formData = new FormData();
      formData.append("file", pdfBlob, `invoice-${invoice.id}.pdf`);
      
      const res = await fetch("https://tmpfiles.org/api/v1/upload", {
        method: "POST",
        body: formData
      });
      
      if (!res.ok) throw new Error("فشل رفع الملف");
      const data = await res.json();
      
      const shareUrl = data.data.url;
      const directDownloadUrl = shareUrl.replace("tmpfiles.org/", "tmpfiles.org/dl/");
      
      await navigator.clipboard.writeText(directDownloadUrl);
      showNotif("تم نسخ رابط تحميل الفاتورة المباشر! 📋", "success");
      
      const message = `مرحباً ${invoice.customerName || "عميلنا العزيز"}،\nيسعدنا تعاملك مع ASH PURE.\nإليك رابط تحميل فاتورتك الرقمية (PDF) صالحة للتحميل لمدة ساعة:\n${directDownloadUrl}\nشكراً لك! ✨`;
      const whatsappUrl = `https://wa.me/${invoice.customerPhone || ""}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, "_blank");
    } catch (e) {
      console.error(e);
      showNotif("فشل رفع أو مشاركة الفاتورة", "error");
    } finally {
      setIsSharing(false);
    }
  };

  const filtered = invoices.filter(inv =>
    (statusFilter === "الكل" || (statusFilter === "مدفوعة" && inv.status === "paid") || (statusFilter === "آجل" && inv.status !== "paid")) &&
    (inv.id.includes(search) || inv.customerName.includes(search))
  );

  const paymentLabel = (m) => PAYMENT_METHODS.find(x => x.id === m)?.label || m;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>إدارة الفواتير</h2>
          <p style={{ color: "var(--text2)", fontSize: 13 }}>{invoices.length} فاتورة إجمالية</p>
        </div>
        <button className="btn btn-secondary" onClick={handleExportExcel} disabled={isExporting}>
          <Icon name="download" size={16} />{isExporting ? "جاري التصدير..." : "تصدير Excel"}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: "14px 20px" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
            <Icon name="search" size={16} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم الفاتورة أو العميل..." />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["الكل", "مدفوعة", "آجل"].map(s => (
              <button key={s} className={`btn btn-sm ${statusFilter === s ? "btn-primary" : "btn-secondary"}`} onClick={() => setStatusFilter(s)}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>رقم الفاتورة</th><th>العميل</th><th>النوع</th><th>المبلغ</th><th>المدفوع</th><th>المتبقي</th><th>طريقة الدفع</th><th>التاريخ</th><th>الحالة</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id}>
                  <td data-label="رقم الفاتورة"><span style={{ fontWeight: 700, color: "var(--gold)" }}>{inv.id}</span></td>
                  <td data-label="العميل">{inv.customerName}</td>
                  <td data-label="النوع"><span className="badge badge-blue" style={{ fontSize: 10 }}>{customerTypes.find(t => t.id === inv.customerType)?.label || inv.customerType}</span></td>
                  <td data-label="المبلغ" style={{ fontWeight: 600 }}>{formatCurrency(inv.total)}</td>
                  <td data-label="المدفوع" style={{ color: "var(--green)" }}>{formatCurrency(inv.paid)}</td>
                  <td data-label="المتبقي" style={{ color: inv.remaining > 0 ? "var(--red)" : "var(--text3)" }}>{formatCurrency(inv.remaining)}</td>
                  <td data-label="طريقة الدفع"><span className="tag">{paymentLabel(inv.paymentMethod)}</span></td>
                  <td data-label="التاريخ" style={{ color: "var(--text2)", fontSize: 12 }}>{formatDate(inv.date)}</td>
                  <td data-label="الحالة"><span className={`badge ${inv.status === "paid" ? "badge-green" : inv.status === "partial" ? "badge-gold" : "badge-red"}`}>{inv.status === "paid" ? "مدفوعة" : inv.status === "partial" ? "جزئي" : "آجل"}</span></td>
                  <td data-label="إجراءات">
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn-icon" onClick={() => setViewInvoice(inv)} title="عرض الفاتورة"><Icon name="eye" size={14} /></button>
                      <button className="btn-icon" onClick={() => downloadInvoicePDF(inv)} title="تحميل PDF"><Icon name="download" size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewInvoice && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewInvoice(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">فاتورة {viewInvoice.id}</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button className="btn btn-secondary btn-sm" onClick={() => downloadInvoicePDF(viewInvoice)} style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <Icon name="download" size={14} /> تحميل PDF
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleShareInvoice(viewInvoice)} disabled={isSharing} style={{ background: "var(--gold-bg)", color: "var(--gold)", border: "1px solid var(--gold)" }}>
                  <Icon name="link" size={14} /> {isSharing ? "جاري الرفع..." : "مشاركة و WhatsApp"}
                </button>
                <button className="btn-icon" onClick={() => setViewInvoice(null)}><Icon name="close" size={16} /></button>
              </div>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: "center", marginBottom: 20, padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
                <div className="logo-brand" style={{ fontSize: 24 }}>ASH PURE</div>
                <div style={{ color: "var(--text3)", fontSize: 12 }}>فاتورة ضريبية</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--gold)", marginTop: 8 }}>{viewInvoice.id}</div>
              </div>
              <div className="grid grid-2" style={{ marginBottom: 16 }}>
                <div><div className="form-label">العميل</div><div style={{ fontWeight: 600 }}>{viewInvoice.customerName}</div></div>
                <div><div className="form-label">التاريخ</div><div style={{ fontWeight: 600 }}>{formatDate(viewInvoice.date)}</div></div>
                <div><div className="form-label">طريقة الدفع</div><div style={{ fontWeight: 600 }}>{paymentLabel(viewInvoice.paymentMethod)}</div></div>
                <div><div className="form-label">الحالة</div><span className={`badge ${viewInvoice.status === "paid" ? "badge-green" : "badge-red"}`}>{viewInvoice.status === "paid" ? "مدفوعة" : "آجل"}</span></div>
              </div>
              <div className="table-wrap" style={{ marginBottom: 16 }}>
                <table>
                  <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
                  <tbody>
                    {viewInvoice.items.map((item, i) => {
                      const prod = products.find(p => p.id === item.productId) || {};
                      const defaultPrice = viewInvoice.customerType === 'trader' ? prod.traderPrice : viewInvoice.customerType === 'specialist' ? prod.specialistPrice : prod.clientPrice;
                      const isSpecial = defaultPrice != null && item.price !== defaultPrice && item.price > 0;
                      return (
                        <tr key={i}>
                          <td style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span>{item.name}</span>
                            {item.movement_type === 'gift' && <span style={{ padding: '2px 6px', borderRadius: 6, background: '#1E90FF', color: '#fff', fontSize: 12 }}>هدية</span>}
                            {item.movement_type === 'waste' && <span style={{ padding: '2px 6px', borderRadius: 6, background: '#FF4D4F', color: '#fff', fontSize: 12 }}>هالك</span>}
                            {isSpecial && <span style={{ padding: '2px 6px', borderRadius: 6, background: 'gold', color: '#000', fontSize: 12 }}>سعر خاص</span>}
                          </td>
                          <td>{item.qty}</td>
                          <td>{item.movement_type === 'sale' ? (isSpecial ? <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ textDecoration: 'line-through', color: '#888' }}>{formatCurrency(defaultPrice)}</span><span style={{ color: 'gold', fontWeight: 800 }}>{formatCurrency(item.price)}</span></span> : formatCurrency(item.price)) : '-'}</td>
                          <td style={{ fontWeight: 600, color: "var(--gold)" }}>{formatCurrency(item.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ background: "var(--card)", borderRadius: "var(--radius-sm)", padding: 16 }}>
                <div className="total-row"><span>المجموع الفرعي</span><span>{formatCurrency(viewInvoice.subtotal)}</span></div>
                {viewInvoice.discount > 0 && <div className="total-row" style={{ color: "var(--green)" }}><span>خصم</span><span>- {formatCurrency(viewInvoice.discount)}</span></div>}
                <div className="total-row" style={{ fontSize: 16, fontWeight: 800, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}><span>الإجمالي</span><span style={{ color: "var(--gold)" }}>{formatCurrency(viewInvoice.total)}</span></div>
                {viewInvoice.remaining > 0 && <div className="total-row" style={{ color: "var(--red)" }}><span>المتبقي</span><span>{formatCurrency(viewInvoice.remaining)}</span></div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== REPORTS ====================
function ReportsPage({ invoices, products, customers, wasteLogs = [] }) {
  const [tab, setTab] = useState("sales");

  const gifts = (wasteLogs || []).filter(w => w.type === 'gift');
  const wastes = (wasteLogs || []).filter(w => w.type === 'waste');
  const wastedByProduct = products.map(p => ({ product: p, wastedQty: wastes.filter(w => w.productId === p.id).reduce((s, x) => s + (x.qty || 0), 0) })).sort((a,b)=>b.wastedQty-a.wastedQty).slice(0,10);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = invoices.filter(inv => {
    if (dateFrom && inv.date < dateFrom) return false;
    if (dateTo && inv.date > dateTo) return false;
    return true;
  });

  const totalSales = filtered.reduce((s, i) => s + i.total, 0);
  const totalCost = filtered.reduce((s, inv) => {
    return s + inv.items.reduce((c, item) => {
      const p = products.find(pr => pr.id === item.productId);
      return c + (p ? p.buyPrice * item.qty : 0);
    }, 0);
  }, 0);
  const totalProfit = totalSales - totalCost;
  const profitMargin = totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0;

  const topCustomers = customers.map(c => ({
    ...c,
    invoiceCount: filtered.filter(inv => inv.customerId === c.id).length,
    totalAmount: filtered.filter(inv => inv.customerId === c.id).reduce((s, inv) => s + inv.total, 0)
  })).sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 5);

  const debtCustomers = customers.filter(c => c.balance > 0).sort((a, b) => b.balance - a.balance);

  const productSales = products.map(p => ({
    ...p,
    soldQty: filtered.reduce((s, inv) => s + inv.items.filter(i => i.productId === p.id).reduce((q, i) => q + i.qty, 0), 0),
    revenue: filtered.reduce((s, inv) => s + inv.items.filter(i => i.productId === p.id).reduce((r, i) => r + i.total, 0), 0),
  })).sort((a, b) => b.soldQty - a.soldQty);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>التقارير والإحصائيات</h2>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: "14px 20px" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">من تاريخ</label>
            <input className="form-control" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">إلى تاريخ</label>
            <input className="form-control" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <button className="btn btn-secondary" onClick={() => { setDateFrom(""); setDateTo(""); }}><Icon name="refresh" size={16} />إعادة تعيين</button>
          <button className="btn btn-primary" style={{ marginRight: "auto" }}><Icon name="download" size={16} />تصدير PDF</button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: "إجمالي المبيعات", value: formatCurrency(totalSales), color: "var(--gold)" },
          { label: "إجمالي التكلفة", value: formatCurrency(totalCost), color: "var(--red)" },
          { label: "صافي الربح", value: formatCurrency(totalProfit), color: "var(--green)" },
          { label: "هامش الربح", value: `${profitMargin}%`, color: "var(--blue)" },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="tabs">
        {[["sales", "تقارير المبيعات"], ["products", "تقارير المنتجات"], ["customers", "تقارير العملاء"], ["stock", "تقارير المخزون"]].map(([id, label]) => (
          <div key={id} className={`tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{label}</div>
        ))}
      </div>

      {tab === "sales" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">سجل المبيعات</span>
            <button className="btn btn-secondary btn-sm"><Icon name="download" size={14} />Excel</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>رقم الفاتورة</th><th>العميل</th><th>المبلغ</th><th>التكلفة</th><th>الربح</th><th>التاريخ</th><th>الحالة</th></tr></thead>
              <tbody>
                {filtered.map(inv => {
                  const cost = inv.items.reduce((c, item) => {
                    const p = products.find(pr => pr.id === item.productId);
                    return c + (p ? p.buyPrice * item.qty : 0);
                  }, 0);
                  const profit = inv.total - cost;
                  return (
                    <tr key={inv.id}>
                      <td style={{ color: "var(--gold)", fontWeight: 600 }}>{inv.id}</td>
                      <td>{inv.customerName}</td>
                      <td>{formatCurrency(inv.total)}</td>
                      <td style={{ color: "var(--red)" }}>{formatCurrency(cost)}</td>
                      <td style={{ color: "var(--green)", fontWeight: 600 }}>{formatCurrency(profit)}</td>
                      <td style={{ color: "var(--text2)", fontSize: 12 }}>{formatDate(inv.date)}</td>
                      <td><span className={`badge ${inv.status === "paid" ? "badge-green" : "badge-red"}`}>{inv.status === "paid" ? "مدفوعة" : "آجل"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "products" && (
        <div className="card">
          <div className="card-header"><span className="card-title">تقرير المنتجات</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>المنتج</th><th>الكمية المباعة</th><th>الإيراد</th><th>التكلفة</th><th>الربح</th><th>هامش الربح</th></tr></thead>
              <tbody>
                {productSales.map(p => {
                  const cost = p.buyPrice * p.soldQty;
                  const profit = p.revenue - cost;
                  const margin = p.revenue > 0 ? ((profit / p.revenue) * 100).toFixed(1) : 0;
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>{p.soldQty} قطعة</td>
                      <td style={{ color: "var(--gold)" }}>{formatCurrency(p.revenue)}</td>
                      <td style={{ color: "var(--red)" }}>{formatCurrency(cost)}</td>
                      <td style={{ color: "var(--green)" }}>{formatCurrency(profit)}</td>
                      <td><span className="badge badge-blue">{margin}%</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "customers" && (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-header"><span className="card-title">أفضل العملاء</span></div>
            {topCustomers.map((c, i) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, var(--gold), var(--gold-dark))", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: "#000" }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{c.invoiceCount} فاتورة</div>
                </div>
                <span style={{ color: "var(--gold)", fontWeight: 700 }}>{formatCurrency(c.totalAmount)}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">المديونيات</span><span className="badge badge-red">{debtCustomers.length}</span></div>
            {debtCustomers.length === 0 ? (
              <div className="empty"><div>✅</div><div>لا توجد مديونيات</div></div>
            ) : debtCustomers.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{c.phone}</div>
                </div>
                <span className="badge badge-red">{formatCurrency(c.balance)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "stock" && (
        <div className="card">
          <div className="card-header"><span className="card-title">تقرير المخزون</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>المنتج</th><th>SKU</th><th>الكمية</th><th>الحد الأدنى</th><th>قيمة المخزون</th><th>تاريخ الصلاحية</th><th>الحالة</th></tr></thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td><span className="tag">{p.sku}</span></td>
                    <td style={{ fontWeight: 600 }}>{p.qty}</td>
                    <td style={{ color: "var(--text3)" }}>{p.minQty}</td>
                    <td style={{ color: "var(--gold)" }}>{formatCurrency(p.qty * p.buyPrice)}</td>
                    <td style={{ color: "var(--text2)", fontSize: 12 }}>{formatDate(p.expiry)}</td>
                    <td>
                      <span className={`badge ${p.qty === 0 ? "badge-red" : p.qty <= p.minQty ? "badge-gold" : "badge-green"}`}>
                        {p.qty === 0 ? "نفذ" : p.qty <= p.minQty ? "منخفض" : "متوفر"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== SETTINGS ====================
// ==================== SETTINGS PAGE ====================
const PAGE_LABELS = {
  dashboard: "الرئيسية",
  pos:       "نقطة البيع",
  products:  "المنتجات",
  customers: "العملاء",
  invoices:  "الفواتير",
  reports:   "التقارير",
  settings:  "الإعدادات",
};

function SettingsPage({ user, showNotif, onUserUpdated }) {
  const isAdmin = user.role === "admin";
  const [activeTab, setActiveTab] = useState("general");
  const [settings, setSettings] = useState({
    companyName: "Ash Pure", taxRate: 14, currency: "ج.م", lowStockAlert: 10,
    address: "القاهرة، مصر", phone: "01000000000", email: "honda229204@gmail.com"
  });

  // ── Users Management State ──
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // profile being edited
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", full_name: "", password: "", role: "sales", permissions: { dashboard: true, pos: true, products: true, customers: true, invoices: true, reports: false, settings: false } });
  const [savingUser, setSavingUser] = useState(false);

  const loadUsers = async () => {
    setUsersLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, role, permissions, is_active, created_at")
      .order("created_at", { ascending: true });
    if (!error && data) setUsers(data);
    setUsersLoading(false);
  };

  useEffect(() => {
    if (activeTab === "users" && isAdmin) loadUsers();
  }, [activeTab]);

  // ── إضافة مستخدم جديد (الأدمن بس) ──
  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password) return showNotif("أدخل اسم المستخدم وكلمة المرور", "error");
    if (newUser.password.length < 8) return showNotif("كلمة المرور لازم تكون 8 أحرف على الأقل", "error");
    setSavingUser(true);

    const fakeEmail = `${newUser.username.trim().toLowerCase()}@ashpure.internal`;

    // إنشاء اليوزر في auth عبر Supabase Admin API (بس متاح من server side)
    // بديل: نستخدم signUp عادي وبعدين نحدث الـ profile
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: fakeEmail,
      password: newUser.password,
      options: {
        data: {
          username: newUser.username.trim().toLowerCase(),
          full_name: newUser.full_name,
          role: newUser.role,
        }
      }
    });

    if (authError) {
      showNotif(authError.message, "error");
      setSavingUser(false);
      return;
    }

    // تحديث الـ profile بالبيانات الصحيحة (الـ trigger هيعملها تلقائي بس نحدث الصلاحيات)
    if (authData?.user) {
      await supabase.from("profiles").upsert({
        id: authData.user.id,
        username: newUser.username.trim().toLowerCase(),
        full_name: newUser.full_name,
        role: newUser.role,
        permissions: newUser.permissions,
        is_active: true,
      });
    }

    showNotif(`تم إضافة المستخدم @${newUser.username} بنجاح`, "success");
    setShowAddUser(false);
    setNewUser({ username: "", full_name: "", password: "", role: "sales", permissions: { dashboard: true, pos: true, products: true, customers: true, invoices: true, reports: false, settings: false } });
    loadUsers();
    setSavingUser(false);
  };

  // ── تحديث صلاحيات مستخدم ──
  const handleSaveUserPerms = async (profileId, updatedFields) => {
    setSavingUser(true);
    const { error } = await supabase
      .from("profiles")
      .update(updatedFields)
      .eq("id", profileId);

    if (error) showNotif("فشل حفظ التغييرات: " + error.message, "error");
    else {
      showNotif("تم حفظ الصلاحيات بنجاح", "success");
      // لو عدلنا على نفس المستخدم الحالي → نحدث الـ state
      if (profileId === user.id && onUserUpdated) {
        const refreshed = await getCurrentUserProfile();
        if (refreshed) onUserUpdated(refreshed);
      }
      loadUsers();
    }
    setEditingUser(null);
    setSavingUser(false);
  };

  // ── تفعيل / إيقاف مستخدم ──
  const handleToggleActive = async (profileId, currentStatus) => {
    if (profileId === user.id) return showNotif("لا تقدر توقف حسابك الخاص", "warning");
    const { error } = await supabase.from("profiles").update({ is_active: !currentStatus }).eq("id", profileId);
    if (error) showNotif("فشل التعديل", "error");
    else { showNotif(!currentStatus ? "تم تفعيل الحساب" : "تم إيقاف الحساب", "success"); loadUsers(); }
  };

  const tabs = isAdmin
    ? [["general", "عام"], ["users", "إدارة المستخدمين"], ["backup", "النسخ الاحتياطي"]]
    : [["general", "عام"], ["backup", "النسخ الاحتياطي"]];

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>الإعدادات</h2>
      <div className="tabs">
        {tabs.map(([id, label]) => (
          <div key={id} className={`tab ${activeTab === id ? "active" : ""}`} onClick={() => setActiveTab(id)}>{label}</div>
        ))}
      </div>

      {/* ── عام ── */}
      {activeTab === "general" && (
        <div className="card" style={{ maxWidth: 600 }}>
          <div className="card-header"><span className="card-title">إعدادات النظام</span></div>
          <div className="form-group">
            <label className="form-label">اسم الشركة / البراند</label>
            <input className="form-control" value={settings.companyName} onChange={e => setSettings(s => ({ ...s, companyName: e.target.value }))} />
          </div>
          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">نسبة الضريبة (%)</label>
              <input className="form-control" type="number" value={settings.taxRate} onChange={e => setSettings(s => ({ ...s, taxRate: +e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">العملة</label>
              <select className="form-control" value={settings.currency} onChange={e => setSettings(s => ({ ...s, currency: e.target.value }))}>
                <option>ج.م</option><option>USD</option><option>EUR</option><option>SAR</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">حد التنبيه لنقص المخزون</label>
            <input className="form-control" type="number" value={settings.lowStockAlert} onChange={e => setSettings(s => ({ ...s, lowStockAlert: +e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">العنوان</label>
            <input className="form-control" value={settings.address} onChange={e => setSettings(s => ({ ...s, address: e.target.value }))} />
          </div>
          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label">الهاتف</label>
              <input className="form-control" value={settings.phone} onChange={e => setSettings(s => ({ ...s, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">البريد الإلكتروني</label>
              <input className="form-control" type="email" value={settings.email} onChange={e => setSettings(s => ({ ...s, email: e.target.value }))} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => showNotif("تم حفظ الإعدادات", "success")}><Icon name="check" size={16} />حفظ الإعدادات</button>
        </div>
      )}

      {/* ── إدارة المستخدمين (الأدمن بس) ── */}
      {activeTab === "users" && isAdmin && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* زر إضافة مستخدم */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primary" onClick={() => setShowAddUser(true)}>
              <Icon name="plus" size={16} /> إضافة مستخدم جديد
            </button>
          </div>

          {/* قائمة المستخدمين */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">المستخدمون ({users.length})</span>
              <button className="btn btn-ghost btn-sm" onClick={loadUsers}><Icon name="refresh" size={14} />تحديث</button>
            </div>
            {usersLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>جاري التحميل...</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {users.map(u => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: u.role === "admin" ? "linear-gradient(135deg, var(--gold), var(--gold-dark))" : "linear-gradient(135deg, var(--blue), #3a6baa)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "#000", flexShrink: 0 }}>
                      {(u.full_name || u.username || "?").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{u.full_name || u.username}</div>
                      <div style={{ fontSize: 12, color: "var(--text3)" }}>@{u.username}</div>
                      {/* صلاحيات المستخدم */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {u.role === "admin" ? (
                          <span className="badge badge-gold" style={{ fontSize: 10 }}>كل الصلاحيات</span>
                        ) : (
                          Object.entries(PAGE_LABELS).map(([key, label]) => (
                            <span key={key} className={`badge ${(u.permissions || {})[key] ? "badge-green" : "badge-red"}`} style={{ fontSize: 10, opacity: (u.permissions || {})[key] ? 1 : 0.45 }}>
                              {(u.permissions || {})[key] ? "✓" : "✗"} {label}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span className={`badge ${u.role === "admin" ? "badge-gold" : "badge-green"}`}>
                        {u.role === "admin" ? "مدير" : "موظف"}
                      </span>
                      <span className={`badge ${u.is_active ? "badge-green" : "badge-red"}`} style={{ cursor: "pointer" }} onClick={() => handleToggleActive(u.id, u.is_active)}>
                        {u.is_active ? "نشط" : "موقوف"}
                      </span>
                      {u.id !== user.id && u.role !== "admin" && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingUser({ ...u, permissions: { ...{ dashboard: true, pos: true, products: true, customers: true, invoices: true, reports: false, settings: false }, ...(u.permissions || {}) } })}>
                          <Icon name="edit" size={14} />تعديل
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── نسخ احتياطي ── */}
      {activeTab === "backup" && (
        <div className="card" style={{ maxWidth: 600 }}>
          <div className="card-header"><span className="card-title">النسخ الاحتياطي والاستعادة</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button className="btn btn-secondary" onClick={() => showNotif("جاري تحميل النسخة الاحتياطية...", "success")} style={{ justifyContent: "flex-start" }}>
              <Icon name="download" size={16} />تحميل نسخة احتياطية (JSON)
            </button>
            <button className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>
              <Icon name="download" size={16} />تصدير قاعدة البيانات (Excel)
            </button>
            <div className="alert alert-warning"><Icon name="warning" size={14} />يُنصح بأخذ نسخة احتياطية أسبوعياً. Supabase يحتفظ بنسخ احتياطية تلقائية.</div>
          </div>
        </div>
      )}

      {/* ── Modal تعديل صلاحيات مستخدم ── */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">تعديل صلاحيات @{editingUser.username}</span>
              <button className="btn-icon btn-sm" onClick={() => setEditingUser(null)}><Icon name="close" size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">الدور الوظيفي</label>
                <select className="form-control" value={editingUser.role} onChange={e => setEditingUser(u => ({ ...u, role: e.target.value }))}>
                  <option value="sales">موظف مبيعات</option>
                  <option value="warehouse">مدير مخزن</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: 12 }}>الصلاحيات</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {Object.entries(PAGE_LABELS).map(([key, label]) => (
                    <label key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--card2)", borderRadius: 8, cursor: "pointer", border: `1px solid ${editingUser.permissions[key] ? "rgba(76,175,133,0.3)" : "var(--border)"}` }}>
                      <span style={{ fontWeight: 600 }}>{label}</span>
                      <div
                        onClick={() => setEditingUser(u => ({ ...u, permissions: { ...u.permissions, [key]: !u.permissions[key] } }))}
                        style={{
                          width: 44, height: 24, borderRadius: 12, transition: "all 0.25s",
                          background: editingUser.permissions[key] ? "var(--green)" : "var(--border)",
                          position: "relative", cursor: "pointer", flexShrink: 0
                        }}
                      >
                        <div style={{
                          position: "absolute", top: 3, transition: "left 0.25s",
                          left: editingUser.permissions[key] ? 23 : 3,
                          width: 18, height: 18, borderRadius: "50%", background: "#fff",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.3)"
                        }} />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingUser(null)}>إلغاء</button>
              <button className="btn btn-primary" disabled={savingUser}
                onClick={() => handleSaveUserPerms(editingUser.id, { role: editingUser.role, permissions: editingUser.permissions })}>
                {savingUser ? "جاري الحفظ..." : <><Icon name="check" size={16} />حفظ الصلاحيات</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal إضافة مستخدم جديد ── */}
      {showAddUser && (
        <div className="modal-overlay" onClick={() => setShowAddUser(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">إضافة مستخدم جديد</span>
              <button className="btn-icon btn-sm" onClick={() => setShowAddUser(false)}><Icon name="close" size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">اسم المستخدم *</label>
                  <input className="form-control" value={newUser.username} onChange={e => setNewUser(u => ({ ...u, username: e.target.value.toLowerCase().replace(/\s/g, "") })} placeholder="ahmed_sales" />
                </div>
                <div className="form-group">
                  <label className="form-label">الاسم الكامل</label>
                  <input className="form-control" value={newUser.full_name} onChange={e => setNewUser(u => ({ ...u, full_name: e.target.value }))} placeholder="أحمد محمد" />
                </div>
              </div>
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">كلمة المرور *</label>
                  <input className="form-control" type="password" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} placeholder="8 أحرف على الأقل" />
                </div>
                <div className="form-group">
                  <label className="form-label">الدور</label>
                  <select className="form-control" value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                    <option value="sales">موظف مبيعات</option>
                    <option value="warehouse">مدير مخزن</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: 10 }}>الصلاحيات</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {Object.entries(PAGE_LABELS).map(([key, label]) => (
                    <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--card2)", borderRadius: 8, cursor: "pointer", border: `1px solid ${newUser.permissions[key] ? "rgba(76,175,133,0.3)" : "var(--border)"}` }}>
                      <div
                        onClick={() => setNewUser(u => ({ ...u, permissions: { ...u.permissions, [key]: !u.permissions[key] } }))}
                        style={{ width: 38, height: 20, borderRadius: 10, background: newUser.permissions[key] ? "var(--green)" : "var(--border)", position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}
                      >
                        <div style={{ position: "absolute", top: 2, left: newUser.permissions[key] ? 20 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddUser(false)}>إلغاء</button>
              <button className="btn btn-primary" disabled={savingUser} onClick={handleAddUser}>
                {savingUser ? "جاري الإضافة..." : <><Icon name="plus" size={16} />إضافة المستخدم</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== NOTIFICATIONS ====================
function Notifications({ notifs }) {
  return (
    <div className="notification">
      {notifs.map(n => (
        <div key={n.id} className={`notif notif-${n.type}`}>{n.message}</div>
      ))}
    </div>
  );
}

// ==================== PERMISSION GUARD ====================
function usePermission(user, page) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const perms = user.permissions || {};
  return !!perms[page];
}

// ==================== LOADING SCREEN ====================
function LoadingScreen() {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "var(--bg)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, zIndex: 9999
    }}>
      <div className="logo-brand" style={{ fontSize: 28 }}>ASH PURE</div>
      <div style={{
        width: 40, height: 40,
        border: "3px solid rgba(212,175,55,0.2)",
        borderTop: "3px solid var(--gold)",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite"
      }} />
      <div style={{ fontSize: 13, color: "var(--text3)" }}>جاري التحقق من الجلسة...</div>
    </div>
  );
}

// ==================== MAIN APP ====================
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [customers, setCustomers] = useState(INITIAL_CUSTOMERS);
  const [invoices, setInvoices] = useState(INITIAL_INVOICES);
  const [wasteLogs, setWasteLogs] = useState(INITIAL_WASTE_LOGS);
  const [notifs, setNotifs] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");

  // ── استعادة الجلسة عند تحميل الصفحة ──
  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      const profile = await getCurrentUserProfile();
      if (mounted) {
        setUser(profile);
        setAuthLoading(false);
      }
    };

    restoreSession();

    // الاستماع لتغييرات الـ auth state (تسجيل دخول/خروج من تاب تانية)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        if (mounted) setUser(null);
      } else if (event === "TOKEN_REFRESHED" && session) {
        // تحديث بيانات المستخدم عند تجديد التوكن
        const profile = await getCurrentUserProfile();
        if (mounted && profile) setUser(profile);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPage("dashboard");
  };

  const dynamicCustomerTypes = useMemo(() => {
    const list = [...CUSTOMER_TYPES];
    customers.forEach(c => {
      if (c.type && !list.some(t => t.id === c.type)) {
        list.push({ id: c.type, label: c.type, priceKey: c.priceKey || "clientPrice" });
      }
    });
    return list;
  }, [customers]);

  const showNotif = useCallback((message, type = "success") => {
    const id = Date.now();
    setNotifs(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifs(prev => prev.filter(n => n.id !== id)), 3500);
  }, []);

  const lowStockCount = products.filter(p => p.qty <= p.minQty).length;
  const debtCount = customers.filter(c => c.balance > 0).length;

  // ── شاشة التحميل أثناء التحقق من الجلسة ──
  if (authLoading) return (
    <>
      <style>{styles}</style>
      <LoadingScreen />
    </>
  );

  // ── إذا مفيش جلسة → صفحة تسجيل الدخول ──
  if (!user) return (
    <>
      <style>{styles}</style>
      <LoginPage onLogin={setUser} />
    </>
  );

  // ── قائمة الصفحات مع فلترة الصلاحيات ──
  const allNavItems = [
    { id: "dashboard",  label: "الرئيسية",            icon: "dashboard" },
    { id: "pos",        label: "نقطة البيع",           icon: "pos" },
    { id: "products",   label: "المنتجات والمخزون",    icon: "products", badge: lowStockCount > 0 ? lowStockCount : null },
    { id: "customers",  label: "العملاء",              icon: "customers" },
    { id: "invoices",   label: "الفواتير",             icon: "invoices" },
    { id: "reports",    label: "التقارير",             icon: "reports" },
    { id: "settings",   label: "الإعدادات",            icon: "settings" },
  ];

  const navItems = allNavItems.filter(item => {
    if (user.role === "admin") return true;
    const perms = user.permissions || {};
    return !!perms[item.id];
  });

  // إذا الصفحة الحالية مش مسموح بيها → ارجع للـ dashboard
  const canAccessPage = user.role === "admin" || !!(user.permissions || {})[page];

  const pageTitle = allNavItems.find(n => n.id === page)?.label || "";

  const renderPage = () => {
    if (!canAccessPage) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16 }}>
          <div style={{ fontSize: 48 }}>🔒</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>ليس لديك صلاحية لهذه الصفحة</div>
          <div style={{ color: "var(--text3)", fontSize: 14 }}>تواصل مع مدير النظام لمنح الصلاحية</div>
          <button className="btn btn-primary" onClick={() => setPage("dashboard")}>العودة للرئيسية</button>
        </div>
      );
    }
    switch (page) {
      case "dashboard": return <Dashboard products={products} customers={customers} invoices={invoices} wasteLogs={wasteLogs} />;
      case "pos":       return <POSPage products={products} setProducts={setProducts} customers={customers} invoices={invoices} setInvoices={setInvoices} showNotif={showNotif} customerTypes={dynamicCustomerTypes} wasteLogs={wasteLogs} setWasteLogs={setWasteLogs} />;
      case "products":  return <ProductsPage products={products} setProducts={setProducts} wasteLogs={wasteLogs} setWasteLogs={setWasteLogs} user={user} showNotif={showNotif} />;
      case "customers": return <CustomersPage customers={customers} setCustomers={setCustomers} invoices={invoices} showNotif={showNotif} customerTypes={dynamicCustomerTypes} />;
      case "invoices":  return <InvoicesPage invoices={invoices} customers={customers} showNotif={showNotif} customerTypes={dynamicCustomerTypes} />;
      case "reports":   return <ReportsPage invoices={invoices} products={products} customers={customers} wasteLogs={wasteLogs} />;
      case "settings":  return <SettingsPage user={user} showNotif={showNotif} onUserUpdated={setUser} />;
      default:          return null;
    }
  };

  return (
    <>
      <style>{styles}</style>
      <Notifications notifs={notifs} />

      <div className="app">
        {/* SIDEBAR */}
        <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="logo-area">
            <div>
              <div className="logo-brand">ASH PURE</div>
              <div className="logo-sub">نظام إدارة المبيعات</div>
            </div>
            <button className="close-sidebar-btn" onClick={() => setSidebarOpen(false)}><Icon name="close" size={24} /></button>
          </div>

          <nav className="nav">
            <div className="nav-section">القائمة الرئيسية</div>
            {navItems.slice(0, 2).map(item => (
              <div key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => { setPage(item.id); if (window.innerWidth < 900) setSidebarOpen(false); }}>
                <Icon name={item.icon} size={18} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && <span style={{ background: "var(--red)", color: "#fff", fontSize: 10, padding: "2px 6px", borderRadius: 10 }}>{item.badge}</span>}
              </div>
            ))}

            <div className="nav-section">الإدارة</div>
            {navItems.slice(2, 6).map(item => (
              <div key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => { setPage(item.id); if (window.innerWidth < 900) setSidebarOpen(false); }}>
                <Icon name={item.icon} size={18} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && <span style={{ background: "var(--red)", color: "#fff", fontSize: 10, padding: "2px 6px", borderRadius: 10 }}>{item.badge}</span>}
              </div>
            ))}

            <div className="nav-section">النظام</div>
            {navItems.slice(6).map(item => (
              <div key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => { setPage(item.id); if (window.innerWidth < 900) setSidebarOpen(false); }}>
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            {debtCount > 0 && (
              <div className="alert alert-danger" style={{ marginBottom: 10, padding: "8px 12px", fontSize: 12 }}>
                <Icon name="warning" size={14} /> {debtCount} عميل لديه مديونيات
              </div>
            )}
            <div className="user-info">
              <div className="user-avatar">{user.name?.charAt(0) || "A"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="user-name">{user.name}</div>
                <div className="user-role">{user.role === "admin" ? "مدير النظام" : "موظف مبيعات"}</div>
              </div>
              <button className="btn-icon" title="تسجيل الخروج" onClick={handleLogout}><Icon name="logout" size={16} /></button>
            </div>
          </div>
        </div>
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />

        {/* MAIN */}
        <div className="main">
          <header className="header">
            <div className="header-left">
              <button className="menu-toggle" onClick={() => setSidebarOpen(true)}><Icon name="menu" size={24} /></button>
              <span className="header-title">{pageTitle}</span>
            </div>
            <div className="header-actions">
              <div className="search-bar">
                <Icon name="search" size={16} />
                <input value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} placeholder="بحث سريع..." />
              </div>
              <button className="btn-icon" style={{ position: "relative" }} title="الإشعارات" onClick={() => setPage("products")}>
                <Icon name="bell" size={18} />
                {lowStockCount > 0 && <span style={{ position: "absolute", top: -4, left: -4, width: 16, height: 16, background: "var(--red)", borderRadius: "50%", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>{lowStockCount}</span>}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setPage("pos")}><Icon name="cart" size={16} />بيع جديد</button>
            </div>
          </header>

          <div className="content">
            {renderPage()}
          </div>
        </div>
      </div>
    </>
  );
}
