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
function showSuccess(kind, record, registrationNumber) {
  const tabs = document.querySelector("#registration-card .tabs");
  const formBody = document.querySelector("#registration-card .form-body");
  const panel = document.querySelector("#success-panel");
  tabs.classList.add("hidden");
  formBody.classList.add("hidden");
  panel.classList.remove("hidden");
  document.querySelector("#success-number").textContent = registrationNumber ? toEnglishDigits(registrationNumber) : "سيظهر بعد تحديث قاعدة البيانات";
  const details = kind === "farmer"
    ? [["الاسم", record.name], ["رقم الجوال", record.phone], ["عدد المزارع", String(record.farm_count)], ["الموقع", record.location]]
    : [["الاسم", record.name], ["رقم الجوال", record.phone], ["نوع الآلة", record.machine_type]];
  const list = document.querySelector("#success-details");
  list.replaceChildren(...details.flatMap(([label, value]) => {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    return [term, description];
  }));
}
document.querySelector("#new-registration").addEventListener("click", () => {
  document.querySelector("#registration-card .tabs").classList.remove("hidden");
  document.querySelector("#registration-card .form-body").classList.remove("hidden");
  document.querySelector("#success-panel").classList.add("hidden");
  switchKind("farmer");
});
function toEnglishDigits(value) {
  return value.replace(/[٠-٩۰-۹]/g, digit => {
    const code = digit.charCodeAt(0);
    return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
  });
}
form.addEventListener("input", event => {
  const input = event.target;
  if (!input || !["phone", "farm_count"].includes(input.name)) return;
  const cursor = input.selectionStart;
  const converted = toEnglishDigits(input.value);
  if (converted !== input.value) {
    input.value = converted;
    if (cursor !== null) input.setSelectionRange(cursor, cursor);
  }
});
form.addEventListener("submit", async event => {
  event.preventDefault();
  showStatus("", "");
  if (!configured) {
    showStatus("لم يكتمل ربط قاعدة البيانات بعد. أضف مفتاح Supabase العام في ملف config.js.", "error");
    return;
  }
  const phoneInput = form.querySelector('[name="phone"]');
  const farmCountInput = form.querySelector('[name="farm_count"]');
  phoneInput.value = toEnglishDigits(phoneInput.value);
  farmCountInput.value = toEnglishDigits(farmCountInput.value);
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
  let record;
  if (currentKind === "farmer") {
    const farmCount = Number(data.get("farm_count"));
    const location = String(data.get("location") || "").trim();
    if (!Number.isInteger(farmCount) || farmCount < 1 || !location) {
      showStatus("أدخل عدد المزارع والموقع بشكل صحيح.", "error");
      button.disabled = false;
      button.innerHTML = '<span>إرسال التسجيل</span><span aria-hidden="true">←</span>';
      return;
    }
    record = { name, phone, farm_count: farmCount, location };
  } else {
    const machineType = String(data.get("machine_type") || "").trim();
    if (!machineType) {
      showStatus("أدخل نوع الآلة الزراعية.", "error");
      button.disabled = false;
      button.innerHTML = '<span>إرسال التسجيل</span><span aria-hidden="true">←</span>';
      return;
    }
    record = { name, phone, machine_type: machineType };
  }
  const rpcName = currentKind === "farmer" ? "register_farmer" : "register_machine";
  const rpcArgs = currentKind === "farmer"
    ? { p_name: record.name, p_phone: record.phone, p_farm_count: record.farm_count, p_location: record.location }
    : { p_name: record.name, p_phone: record.phone, p_machine_type: record.machine_type };
  let result = await supabase.rpc(rpcName, rpcArgs);
  let registrationNumber = result.data;
  if (result.error?.code === "PGRST202") {
    const table = currentKind === "farmer" ? "farmer_registrations" : "machine_registrations";
    const legacySave = await supabase.from(table).insert(record);
    result = { error: legacySave.error };
    registrationNumber = "";
  }
  button.disabled = false;
  button.innerHTML = '<span>إرسال التسجيل</span><span aria-hidden="true">←</span>';
  if (result.error) {
    showStatus("تعذر حفظ التسجيل الآن. حاول مرة أخرى بعد قليل.", "error");
    console.error(result.error);
    return;
  }
  showSuccess(currentKind, record, registrationNumber ? String(registrationNumber) : "");
});
