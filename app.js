import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const config = window.MAZAREEN_CONFIG || {};
const statusBox = document.querySelector("#form-status");
const form = document.querySelector("#registration-form");
const farmerTab = document.querySelector("#farmer-tab");
const machineTab = document.querySelector("#machine-tab");
const farmerFields = document.querySelectorAll(".farmer-field");
const machineFields = document.querySelectorAll(".machine-field");
const title = document.querySelector("#form-title");
const kicker = document.querySelector("#form-kicker");
let currentKind = "farmer";
document.querySelector("#year").textContent = new Date().getFullYear();

const configured = Boolean(config.url && config.anonKey && config.anonKey !== "ADD_SUPABASE_PUBLISHABLE_KEY");
const supabase = configured ? createClient(config.url, config.anonKey) : null;

function showStatus(message, kind) {
  statusBox.textContent = message;
  statusBox.className = "status " + (kind || "");
}
function switchKind(kind) {
  currentKind = kind;
  const farmer = kind === "farmer";
  farmerTab.classList.toggle("active", farmer);
  machineTab.classList.toggle("active", !farmer);
  farmerTab.setAttribute("aria-selected", String(farmer));
  machineTab.setAttribute("aria-selected", String(!farmer));
  farmerFields.forEach(el => el.classList.toggle("hidden", !farmer));
  machineFields.forEach(el => el.classList.toggle("hidden", farmer));
  document.querySelector('[name="farm_count"]').required = farmer;
  document.querySelector('[name="location"]').required = farmer;
  document.querySelector('[name="machine_type"]').required = !farmer;
  title.textContent = farmer ? "أهلاً بك في سجل المزارعين" : "سجّل بيانات الآلة الزراعية";
  kicker.textContent = farmer ? "بيانات المزارع" : "بيانات صاحب الآلة";
  form.reset();
  showStatus("", "");
}
farmerTab.addEventListener("click", () => switchKind("farmer"));
machineTab.addEventListener("click", () => switchKind("machine"));
form.addEventListener("submit", async event => {
  event.preventDefault();
  showStatus("", "");
  if (!configured) {
    showStatus("لم يكتمل ربط قاعدة البيانات بعد. أضف مفتاح Supabase العام في ملف config.js.", "error");
    return;
  }
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  const phone = String(data.get("phone") || "").replace(/[\s()-]/g, "");
  if (name.length < 3 || phone.length < 8) {
    showStatus("تحقق من الاسم ورقم الجوال ثم أعد المحاولة.", "error");
    return;
  }
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  button.innerHTML = '<span>جارٍ إرسال التسجيل…</span>';
  let table, record;
  if (currentKind === "farmer") {
    const farmCount = Number(data.get("farm_count"));
    const location = String(data.get("location") || "").trim();
    if (!Number.isInteger(farmCount) || farmCount < 1 || !location) {
      showStatus("أدخل عدد المزارع والموقع بشكل صحيح.", "error");
      button.disabled = false;
      button.innerHTML = '<span>إرسال التسجيل</span><span aria-hidden="true">←</span>';
      return;
    }
    table = "farmer_registrations";
    record = { name, phone, farm_count: farmCount, location };
  } else {
    const machineType = String(data.get("machine_type") || "").trim();
    if (!machineType) {
      showStatus("أدخل نوع الآلة الزراعية.", "error");
      button.disabled = false;
      button.innerHTML = '<span>إرسال التسجيل</span><span aria-hidden="true">←</span>';
      return;
    }
    table = "machine_registrations";
    record = { name, phone, machine_type: machineType };
  }
  const result = await supabase.from(table).insert(record);
  button.disabled = false;
  button.innerHTML = '<span>إرسال التسجيل</span><span aria-hidden="true">←</span>';
  if (result.error) {
    showStatus("تعذر حفظ التسجيل الآن. حاول مرة أخرى بعد قليل.", "error");
    console.error(result.error);
    return;
  }
  form.reset();
  showStatus("تم استلام تسجيلك بنجاح، شكرًا لك.", "success");
});
