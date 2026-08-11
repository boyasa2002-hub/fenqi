const API_BASE = window.API_BASE || (location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "http://localhost:3001" : "https://admin.femyshop.click");
function getOrderCode() {
  const fromPath = location.pathname.match(/\/r\/([^/]+)/)?.[1];
  if (fromPath) return decodeURIComponent(fromPath);
  return new URLSearchParams(location.search).get("token");
}
const token = getOrderCode();

const CLEANING_LABELS = { standard: "取貨付款", deep: "銀行轉賬" };

const TERMS_CONTENT = `...`;
const POLICY_CONTENT = `...`;

const state = {
  step: 1,
  cleaningType: "standard",
  order: null,
  selectedStore: null,
  orderNo: null,
  orderTime: null,
  deepPhotoUploaded: false,
  stores: null,
  storeIndex: null,
  pendingStore: null,
  cities: [],
  lineDeferred: false,
  bookingSubmitted: false,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function formatMoney(amount) {
  const n = Number(amount) || 0;
  return n.toFixed(2);
}

function cleaningLabel() {
  return CLEANING_LABELS[state.cleaningType];
}

function shippingFee() {
  if (!state.order) return 0;
  return Number(state.order.tip) || 0;
}

function totalAmount() {
  if (!state.order) return 0;
  return Number(state.order.amount) + shippingFee();
}

function formatOrderNo(id) {
  return `GM${String(id).padStart(9, "0")}`;
}

function generateOrderNo() {
  const ts = Date.now().toString().slice(-9);
  return `GM${ts}`;
}

function formatDateTime(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatAppointmentTime(value) {
  if (!value) return "—";
  const s = String(value);
  const normalized = /[Z+\-]/.test(s) ? s : s.replace(" ", "T") + "Z";
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return s;
  return formatDateTime(d);
}

function productName() {
  if (!state.order) return "愛心店到店寄件";
  return state.order.detail_name || state.order.service?.name || "愛心店到店寄件";
}

// Update UI prices and button amount from backend data
function renderPrices() {
  const amount = Number(state.order?.amount) || 0;
  const ship = shippingFee();
  const total = totalAmount();
  const fmt = formatMoney(amount);
  const totalFmt = formatMoney(total);

  const elName = $("#product-name-1");
  if (elName) elName.textContent = productName();
  const elUnit = $("#unit-price-1");
  if (elUnit) elUnit.textContent = `NT$ ${fmt}`;
  const elSub = $("#subtotal-1");
  if (elSub) elSub.textContent = `NT$${Math.round(amount)}`;
  const elSummary = $("#summary-items");
  if (elSummary) elSummary.textContent = `NT $${Math.round(amount)}`;

  const shipText = ship > 0 ? `基本運費 NT$${Math.round(ship)}` : "基本運費0元 NT$0";
  const elShip = $("#shipping-fee");
  if (elShip) elShip.textContent = shipText;
  if ($("#shipping-echo")) $("#shipping-echo").textContent = shipText;

  const elTotal = $("#total-amount-1");
  if (elTotal) elTotal.textContent = `NT $ ${totalFmt}`;

  // update button amount if present
  const btnAmount = $("#btn-amount");
  if (btnAmount) btnAmount.textContent = `NT$ ${Math.round(total)}`;

  // sidebar/backups (if present)
  if ($("#sidebar-name")) $("#sidebar-name").textContent = productName();
  if ($("#sidebar-subtotal")) $("#sidebar-subtotal").textContent = `NT$ ${Math.round(amount)}`;
  if ($("#sidebar-shipping")) $("#sidebar-shipping").textContent = ship > 0 ? `基本運費 NT$${Math.round(ship)}` : "基本運費0元";
  if ($("#sidebar-total")) $("#sidebar-total").textContent = `NT ${totalFmt}`;
}

// Render promotions, points and payment methods from backend
function renderPromos() {
  if (!state.order) return;
  const promo = state.order.promo_text || "尚無";
  const points = state.order.points_available ? (state.order.points_available + " 點") : "不可用";
  const elPromo = $("#promo-text");
  if (elPromo) elPromo.textContent = promo;
  const elPoints = $("#points-available");
  if (elPoints) elPoints.textContent = points;

  // render payment methods if provided
  const methods = state.order.payment_methods || ["取貨付款", "銀行轉帳"];
  const container = $("#payment-methods-list");
  if (container) {
    container.innerHTML = "";
    methods.forEach((m, idx) => {
      const id = `pm_${idx}`;
      const label = document.createElement('label');
      label.innerHTML = `<input type="radio" name="pay_method" value="${m}" ${idx===0? 'checked': ''}> ${m}`;
      container.appendChild(label);
    });
  }
}

function renderCleaningLabels() {
  const label = cleaningLabel();
  if ($("#cleaning-echo")) $("#cleaning-echo").textContent = label;
}

function updateUploadUI() {
  const hasPhoto = state.deepPhotoUploaded;
  if ($("#btn-upload")) $("#btn-upload").hidden = hasPhoto;
  if ($("#upload-preview")) $("#upload-preview").hidden = !hasPhoto;
}

function goStep(n) {
  state.step = n;
  $$(".step-panel").forEach((el) => {
    el.hidden = Number(el.dataset.step) !== n;
  });

  // keep steps minimal per design: hide multi-step if needed
  $$(".steps").forEach ? null : null;

  const crumbs = { 1: "確認訂單", 2: "填寫資料", 3: "完成訂購", 4: "預約完成", 5: "訂單詳情" };
  if ($("#breadcrumb-current")) $("#breadcrumb-current").textContent = crumbs[n] || "";

  if (n === 3) populateStep3();
  if (n === 5) populateStep5();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function populateStep3() {
  if (!state.orderNo) {
    state.orderNo = generateOrderNo();
    state.orderTime = formatDateTime(new Date());
  }
  if ($("#order-no")) $("#order-no").textContent = state.orderNo;
  if ($("#order-time")) $("#order-time").textContent = state.orderTime;
  if ($("#detail-amount")) $("#detail-amount").textContent = formatMoney(totalAmount());
}

function populateStep5() {
  if (!state.orderNo) {
    state.orderNo = generateOrderNo();
  }
  if ($("#view-order-no")) $("#view-order-no").textContent = state.orderNo;
  if ($("#view-order-amount")) $("#view-order-amount").textContent = `NT$ ${formatMoney(totalAmount())}`;
  if ($("#view-order-product")) $("#view-order-product").textContent = productName();
}

function validateStep2() {
  const name = $("#customer_name")?.value.trim();
  const phone = $("#customer_phone")?.value.trim();
  if (!name) return "請填寫姓名";
  if (!phone) return "請填寫手機號碼";
  return null;
}

function showError(msg) {
  const el = state.step === 3 ? $("#message-3") : $("#message");
  if (el) el.textContent = msg;
}

async function submitBooking() {
  const err = validateStep2();
  if (err) { showError(err); return; }
  if (state.cleaningType === "deep" && !state.deepPhotoUploaded) { showError("銀行轉賬請上傳轉賬照片"); return; }

  if ($("#message")) $("#message").textContent = "";
  if ($("#message-3")) $("#message-3").textContent = "";
  if ($("#btn-submit")) $("#btn-submit").disabled = true;

  const fd = new FormData();
  if ($("#customer_name")) fd.append("customer_name", $("#customer_name").value.trim());
  if ($("#customer_phone")) fd.append("customer_phone", $("#customer_phone").value.trim());
  fd.append("submitted_at", new Date().toISOString());

  try {
    const res = await fetch(`${API_BASE}/api/public/order-links/${token}/appointments`, { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) { showError(data.error || "提交失敗"); if ($("#btn-submit")) $("#btn-submit").disabled = false; return; }
    state.orderNo = data.appointment_id ? formatOrderNo(data.appointment_id) : generateOrderNo();
    state.orderTime = data.created_at ? formatAppointmentTime(data.created_at) : formatDateTime(new Date());
    state.bookingSubmitted = true;
    showCompletionPage();
  } catch (e) {
    showError("網路錯誤，請稍後再試"); if ($("#btn-submit")) $("#btn-submit").disabled = false;
  }
}

function showCompletionPage() {
  if ($("#done-order-no")) $("#done-order-no").textContent = state.orderNo;
  if ($("#done-product")) $("#done-product").textContent = productName();
  if ($("#done-cleaning")) $("#done-cleaning").textContent = cleaningLabel();
  if ($("#done-amount")) $("#done-amount").textContent = `NT$ ${formatMoney(totalAmount())}`;
  goStep(4);
}

async function loadOrder() {
  // keep backend call intact — development testing excluded per instruction
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE}/api/public/order-links/${token}`);
    if (!res.ok) return;
    const data = await res.json();
    state.order = data;
    // render dynamic pieces
    renderPrices();
    renderPromos();
    if (data.appointment && !state.bookingSubmitted) {
      state.orderNo = data.appointment.id ? formatOrderNo(data.appointment.id) : state.orderNo;
      state.orderTime = data.appointment.created_at || state.orderTime;
      showCompletionPage();
    }
  } catch (e) {
    console.debug('loadOrder error', e);
  }
}

// Comment out store picker event bindings (view removed) — keep functions for later restore
function buildStoreIndex() { /* preserved but inactive on UI */ }
function loadStores() { /* preserved but inactive on UI */ }
function openStorePicker() { /* preserved but inactive on UI */ }

function bindEvents() {
  // header menu
  const menuBtn = $("#menu-btn");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => { $("#side-menu").hidden = false; $("#menu-overlay").hidden = false; });
  }
  $("#menu-close")?.addEventListener("click", () => { closeMenu(); });
  $("#menu-overlay")?.addEventListener("click", () => { closeMenu(); });

  // agreement enables next
  $("#agree-terms")?.addEventListener("change", () => { const btn = $("#btn-next-1"); if (btn) btn.disabled = !$("#agree-terms").checked; });

  // next/back buttons
  $("#btn-next-1")?.addEventListener("click", () => goStep(2));
  $("#btn-back-2")?.addEventListener("click", () => goStep(1));
  $("#btn-next-2")?.addEventListener("click", () => {
    const err = validateStep2();
    if (err) { showError(err); return; }
    showError('');
    submitBooking();
  });
  $("#btn-back-3")?.addEventListener("click", () => goStep(2));
  $("#btn-submit")?.addEventListener("click", submitBooking);

  $("#btn-view-order")?.addEventListener('click', () => { populateStep5(); goStep(5); });
  $("#btn-close-view")?.addEventListener('click', () => { goStep(4); });

  // terms modal
  $$(".terms-link")?.forEach?.((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const type = link.dataset.modal;
      if (type === 'policy') { $('#text-modal-title').textContent = '禁止和限制商品政策'; $('#text-modal-body').innerHTML = POLICY_CONTENT; }
      else { $('#text-modal-title').textContent = '服務條款'; $('#text-modal-body').innerHTML = TERMS_CONTENT; }
      $('#text-modal').showModal();
    });
  });

  $("#text-modal-ack")?.addEventListener('click', () => { $('#text-modal').close(); });
}

function closeMenu() { $("#side-menu").hidden = true; $("#menu-overlay").hidden = true; }

bindEvents();
renderCleaningLabels();
loadOrder();
