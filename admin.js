import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const config = window.MAZAREEN_CONFIG || {};
const configured = Boolean(config.url && config.anonKey && config.anonKey !== "ADD_SUPABASE_PUBLISHABLE_KEY");
const supabase = configured ? createClient(config.url, config.anonKey) : null;
const loginCard = document.querySelector("#login-card");
const loginForm = document.querySelector("#login-form");
const dashboard = document.querySelector("#records-dashboard");
const loginStatus = document.querySelector("#login-status");
const recordsStatus = document.querySelector("#records-status");
const search = document.querySelector("#record-search");
const heads = document.querySelector("#table-head");
const body = document.querySelector("#table-body");
let activeType = "farmers";
let cache = { farmers: [], machines: [] };

function message(el, text, kind) {
  el.textContent = text;
  el.className = "status " + (kind || "");
}
function filteredRows() {
  const query = search.value.trim().toLowerCase();
  return cache[activeType].filter(row => !query || row.name.toLowerCase().includes(query) || row.phone.includes(query) || (row.registration_number || "").includes(query));
}
function render() {
  const farmers = activeType === "farmers";
  const rows = filteredRows();
  heads.innerHTML = farmers
    ? "<tr><th>رقم التسجيل</th><th>الاسم</th><th>الجوال</th><th>عدد المزارع</th><th>الموقع</th><th>تاريخ التسجيل</th></tr>"
    : "<tr><th>رقم التسجيل</th><th>الاسم</th><th>الجوال</th><th>نوع الآلة</th><th>تاريخ التسجيل</th></tr>";
  if (!rows.length) {
    body.innerHTML = '<tr><td class="empty-cell" colspan="' + (farmers ? "6" : "5") + '">لا توجد سجلات مطابقة.</td></tr>';
    return;
  }
  body.innerHTML = rows.map(row => {
    const date = new Date(row.created_at).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
    const cells = farmers
      ? [row.registration_number || "—", row.name, row.phone, row.farm_count, row.location, date]
      : [row.registration_number || "—", row.name, row.phone, row.machine_type, date];
    return "<tr>" + cells.map(value => "<td>" + escapeHtml(String(value)) + "</td>").join("") + "</tr>";
  }).join("");
}
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
}
async function loadRecords() {
  message(recordsStatus, "جارٍ تحميل السجلات…", "");
  let [farmers, machines] = await Promise.all([
    supabase.from("farmer_registrations").select("id,registration_number,name,phone,farm_count,location,created_at").order("created_at", { ascending: false }),
    supabase.from("machine_registrations").select("id,registration_number,name,phone,machine_type,created_at").order("created_at", { ascending: false })
  ]);
  const missingRegistrationColumn = [farmers.error, machines.error].some(error => error && ["42703", "PGRST204"].includes(error.code));
  if (missingRegistrationColumn) {
    [farmers, machines] = await Promise.all([
      supabase.from("farmer_registrations").select("id,name,phone,farm_count,location,created_at").order("created_at", { ascending: false }),
      supabase.from("machine_registrations").select("id,name,phone,machine_type,created_at").order("created_at", { ascending: false })
    ]);
  }
  if (farmers.error || machines.error) {
    message(recordsStatus, "تعذر تحميل السجلات. تأكد من إعداد صلاحيات المسؤول في قاعدة البيانات.", "error");
    console.error(farmers.error || machines.error);
    return;
  }
  cache = { farmers: farmers.data || [], machines: machines.data || [] };
  document.querySelector("#farmer-count").textContent = cache.farmers.length;
  document.querySelector("#machine-count").textContent = cache.machines.length;
  message(recordsStatus, "", "");
  render();
}
function showDashboard() {
  loginCard.classList.add("hidden");
  dashboard.classList.remove("hidden");
  loadRecords();
}
async function initialize() {
  if (!configured) {
    message(loginStatus, "أضف مفتاح Supabase العام في config.js لإكمال الربط.", "error");
    return;
  }
  const { data } = await supabase.auth.getSession();
  if (data.session) showDashboard();
}
document.querySelectorAll("[data-record-tab]").forEach(tab => {
  tab.addEventListener("click", () => {
    activeType = tab.dataset.recordTab;
    document.querySelectorAll("[data-record-tab]").forEach(item => {
      item.classList.toggle("active", item === tab);
      item.setAttribute("aria-selected", String(item === tab));
    });
    render();
  });
});
loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!configured) {
    message(loginStatus, "أضف مفتاح Supabase العام في config.js لإكمال الربط.", "error");
    return;
  }
  const values = new FormData(loginForm);
  const { error } = await supabase.auth.signInWithPassword({
    email: String(values.get("email") || ""),
    password: String(values.get("password") || "")
  });
  if (error) {
    message(loginStatus, "تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور.", "error");
    return;
  }
  message(loginStatus, "", "");
  showDashboard();
});
document.querySelector("#sign-out").addEventListener("click", async () => {
  await supabase.auth.signOut();
  dashboard.classList.add("hidden");
  loginCard.classList.remove("hidden");
  loginForm.reset();
});
document.querySelector("#refresh-records").addEventListener("click", loadRecords);
search.addEventListener("input", render);
document.querySelector("#export-excel").addEventListener("click", () => {
  const rows = filteredRows();
  if (!rows.length) {
    message(recordsStatus, "لا توجد سجلات لتصديرها.", "error");
    return;
  }
  if (!window.XLSX) {
    message(recordsStatus, "تعذر تحميل أداة Excel. تحقق من اتصال الإنترنت ثم أعد المحاولة.", "error");
    return;
  }
  const farmers = activeType === "farmers";
  const exportRows = rows.map(row => farmers
    ? { "رقم التسجيل": row.registration_number, "الاسم": row.name, "الجوال": row.phone, "عدد المزارع": String(row.farm_count), "الموقع": row.location, "تاريخ التسجيل": new Date(row.created_at).toLocaleDateString("ar-SA") }
     : { "رقم التسجيل": row.registration_number, "الاسم": row.name, "الجوال": row.phone, "نوع الآلة": row.machine_type, "تاريخ التسجيل": new Date(row.created_at).toLocaleDateString("ar-SA") });
  const worksheet = window.XLSX.utils.json_to_sheet(exportRows);
  worksheet["!views"] = [{ rightToLeft: true }];
  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, worksheet, farmers ? "المزارعون" : "أصحاب الآلات");
  const date = new Date().toISOString().slice(0, 10);
  window.XLSX.writeFile(workbook, (farmers ? "سجل_المزارعين_" : "سجل_الآلات_") + date + ".xlsx");
  message(recordsStatus, "تم تجهيز ملف Excel للسجلات الظاهرة.", "success");
});
document.querySelector("#export-pdf").addEventListener("click", () => {
  if (!filteredRows().length) {
    message(recordsStatus, "لا توجد سجلات للطباعة.", "error");
    return;
  }
  document.querySelector("#print-title").textContent = activeType === "farmers" ? "سجل المزارعين" : "سجل أصحاب الآلات";
  window.print();
});
initialize();
