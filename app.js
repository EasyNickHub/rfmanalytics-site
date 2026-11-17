// Точка подключения боевой платёжной ссылки или бэкенда кассы (Робокасса / ЮKassa / Т-Касса).
// Когда касса будет одобрена, замените пустую строку на URL создания платежа или форму шлюза.
const PAYMENT_GATEWAY_URL = "";

const tariffButtons = Array.from(document.querySelectorAll(".tariff-option"));
const payMethodButtons = Array.from(document.querySelectorAll(".pay-option"));
const submitPriceText = document.getElementById("submitPriceText");
const stickyPrice = document.getElementById("stickyPrice");
const stickyPlan = document.getElementById("stickyPlan");
const stickyBar = document.getElementById("stickyBar");

const orderForm = document.getElementById("orderForm");
const deviceIdInput = document.getElementById("deviceIdInput");
const agreeCheckbox = document.getElementById("agreeCheckbox");

const deviceIdError = document.getElementById("deviceIdError");
const agreeError = document.getElementById("agreeError");

let state = {
  planId: "pro_6m",
  planTitle: "6 месяцев (180 дней)",
  price: 1390,
  method: "sbp",
  methodLabel: "СБП (Система быстрых платежей)"
};

// Автозаполнение Device ID из ?device=RFM-XXXX-YYYY&plan=pro_1m при переходе из приложения
const urlParams = new URLSearchParams(window.location.search);
const paramDevice = urlParams.get("device") || urlParams.get("device_id");
if (paramDevice) {
  deviceIdInput.value = paramDevice.trim().toUpperCase();
}
const paramPlan = urlParams.get("plan");
if (paramPlan) {
  const matched = tariffButtons.find((btn) => btn.dataset.plan === paramPlan);
  if (matched) selectTariff(matched);
}

function formatRub(val) {
  return Number(val).toLocaleString("ru-RU") + " ₽";
}

function selectTariff(btn) {
  tariffButtons.forEach((b) => b.classList.remove("is-selected"));
  btn.classList.add("is-selected");
  state.planId = btn.dataset.plan;
  state.planTitle = btn.dataset.title;
  state.price = Number(btn.dataset.price);

  const formatted = formatRub(state.price);
  submitPriceText.textContent = formatted;
  stickyPrice.textContent = formatted;
  stickyPlan.textContent = btn.querySelector(".tariff-name").textContent;
}

tariffButtons.forEach((btn) => {
  btn.addEventListener("click", () => selectTariff(btn));
});

payMethodButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    payMethodButtons.forEach((b) => b.classList.remove("is-selected"));
    btn.classList.add("is-selected");
    state.method = btn.dataset.method;
    state.methodLabel =
      state.method === "sbp"
        ? "СБП (Система быстрых платежей)"
        : "Банковская карта РФ";
  });
});

// Sticky bottom bar visibility
window.addEventListener(
  "scroll",
  () => {
    const rect = orderForm.getBoundingClientRect();
    if (rect.bottom < 120) {
      stickyBar.classList.add("is-visible");
      stickyBar.setAttribute("aria-hidden", "false");
    } else {
      stickyBar.classList.remove("is-visible");
      stickyBar.setAttribute("aria-hidden", "true");
    }
  },
  { passive: true }
);

// Modals
function openModal(id) {
  document.getElementById(id).hidden = false;
}
function closeModal(id) {
  document.getElementById(id).hidden = true;
}

document.getElementById("openDeviceHelp").addEventListener("click", () => {
  openModal("deviceHelpModal");
});

document.querySelectorAll("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
});

document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.hidden = true;
  });
});

// Order form submit (no personal data collected on site)
orderForm.addEventListener("submit", (e) => {
  e.preventDefault();

  deviceIdError.hidden = true;
  agreeError.hidden = true;

  const rawDevice = deviceIdInput.value.trim().toUpperCase();

  let hasError = false;
  if (!/^RFM-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(rawDevice)) {
    deviceIdError.textContent = "Укажите корректный Device ID из приложения (например, RFM-3C9E-8977).";
    deviceIdError.hidden = false;
    hasError = true;
  }

  if (!agreeCheckbox.checked) {
    agreeError.textContent = "Необходимо ознакомиться с условиями публичной оферты.";
    agreeError.hidden = false;
    hasError = true;
  }

  if (hasError) return;

  if (PAYMENT_GATEWAY_URL) {
    const query = new URLSearchParams({
      plan: state.planId,
      amount: String(state.price),
      device: rawDevice,
      method: state.method
    });
    window.location.href = `${PAYMENT_GATEWAY_URL}?${query.toString()}`;
    return;
  }

  document.getElementById("modalPlan").textContent = state.planTitle;
  document.getElementById("modalDevice").textContent = rawDevice;
  document.getElementById("modalMethod").textContent = state.methodLabel;
  document.getElementById("modalAmount").textContent = formatRub(state.price);

  const supportMsg = encodeURIComponent(
    `Здравствуйте! Хочу оплатить RfmAnalytics PRO (${state.planTitle}, ${state.price} ₽) для устройства ${rawDevice}.`
  );
  document.getElementById("checkoutActionLink").href = `https://t.me/MaXXXim321?text=${supportMsg}`;
  openModal("checkoutModal");
});
