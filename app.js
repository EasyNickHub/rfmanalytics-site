// Бэкенд оплаты ЮKassa (ShopID 1533215) и автовыдачи ключей на Yandex Cloud Functions (работает в РФ и с VPN).
const BACKEND_BASE_URL = "https://functions.yandexcloud.net/d4epu0v4ct5u3ra03esg";

// Предварительно прогреваем функцию при открытии сайта
fetch(`${BACKEND_BASE_URL}?action=health`, { mode: "cors" }).catch(() => {});

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

  document.getElementById("modalPlan").textContent = state.planTitle;
  document.getElementById("modalDevice").textContent = rawDevice;
  document.getElementById("modalMethod").textContent = state.methodLabel;
  document.getElementById("modalAmount").textContent = formatRub(state.price);

  const payQuery = new URLSearchParams({
    action: "pay",
    plan: state.planId,
    device: rawDevice,
    method: state.method
  });
  const actionLink = document.getElementById("checkoutActionLink");
  actionLink.href = `${BACKEND_BASE_URL}?${payQuery.toString()}`;
  actionLink.target = "_self";

  const supportMsg = encodeURIComponent(
    `Здравствуйте! Хочу оплатить RfmAnalytics PRO (${state.planTitle}, ${state.price} ₽) для устройства ${rawDevice}.`
  );
  const supportLink = document.getElementById("checkoutSupportLink");
  if (supportLink) {
    supportLink.href = `https://t.me/rfmpro_support_bot?text=${supportMsg}`;
  }
  openModal("checkoutModal");
});

// Проверка статуса оплаты и автовыдача лицензионного ключа при возврате с ЮKassa (?order=...)
const orderToken = (urlParams.get("order") || "").trim();
if (orderToken) {
  const orderStatusTitle = document.getElementById("orderStatusTitle");
  const orderStatusText = document.getElementById("orderStatusText");
  const orderSummaryBox = document.getElementById("orderSummaryBox");
  const licenseKeyBox = document.getElementById("licenseKeyBox");
  const issuedLicenseKey = document.getElementById("issuedLicenseKey");
  const copyBtn = document.getElementById("copyLicenseKeyBtn");
  const copyFeedback = document.getElementById("copyLicenseFeedback");
  const payAgainLink = document.getElementById("orderPayAgainLink");

  openModal("orderStatusModal");

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const keyValue = issuedLicenseKey.textContent.trim();
      if (!keyValue) return;
      try {
        await navigator.clipboard.writeText(keyValue);
      } catch (_err) {
        const ta = document.createElement("textarea");
        ta.value = keyValue;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      copyFeedback.hidden = false;
    });
  }

  let pollAttempts = 0;
  const maxPollAttempts = 40;

  async function pollOrderStatus() {
    pollAttempts += 1;
    try {
      const resp = await fetch(
        `${BACKEND_BASE_URL}?action=order&order=${encodeURIComponent(orderToken)}`,
        { mode: "cors", cache: "no-store" }
      );
      const data = await resp.json();

      if (resp.status === 404 && pollAttempts <= 3) {
        setTimeout(pollOrderStatus, 2500);
        return;
      }

      if (!resp.ok || !data.ok) {
        orderStatusTitle.textContent = "Ошибка проверки заказа";
        orderStatusText.textContent = data.error || "Не удалось получить статус платежа. Обратитесь в поддержку.";
        return;
      }

      document.getElementById("orderResultPlan").textContent = data.plan_title || "—";
      document.getElementById("orderResultDevice").textContent = data.device_id || "—";
      document.getElementById("orderResultAmount").textContent = data.amount ? formatRub(data.amount) : "—";
      orderSummaryBox.hidden = false;

      if (data.status === "succeeded" && data.paid && data.license_key) {
        orderStatusTitle.textContent = "Лицензионный ключ готов";
        orderStatusText.textContent = "Сохраните или скопируйте ключ. При обновлении этой страницы ключ останется доступен.";
        issuedLicenseKey.textContent = data.license_key;
        licenseKeyBox.hidden = false;
        payAgainLink.hidden = true;
        return;
      }

      if (data.status === "canceled") {
        orderStatusTitle.textContent = "Оплата не завершена";
        orderStatusText.textContent = "Платёж был отменён или истёк срок оплаты. Вы можете оформить заказ заново на сайте.";
        payAgainLink.hidden = true;
        return;
      }

      orderStatusTitle.textContent = "Ожидаем подтверждение оплаты";
      orderStatusText.textContent = "ЮKassa ещё обрабатывает платёж. Страница проверяет статус автоматически каждые 3 секунды...";
      if (data.confirmation_url) {
        payAgainLink.href = data.confirmation_url;
        payAgainLink.hidden = false;
      }

      if (pollAttempts < maxPollAttempts) {
        setTimeout(pollOrderStatus, 3000);
      } else {
        orderStatusText.textContent = "Платёж всё ещё в обработке. Обновите страницу через минуту или напишите в поддержку.";
      }
    } catch (_err) {
      if (pollAttempts < maxPollAttempts) {
        orderStatusText.textContent = "Сервер оплаты запускается или временно недоступен, повторяем проверку...";
        setTimeout(pollOrderStatus, 3000);
      } else {
        orderStatusTitle.textContent = "Сервер оплаты не ответил";
        orderStatusText.textContent = "Не удалось связаться с сервером проверки оплаты. Попробуйте обновить страницу или напишите в поддержку.";
      }
    }
  }

  pollOrderStatus();
}
