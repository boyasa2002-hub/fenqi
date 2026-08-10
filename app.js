const API_BASE = window.API_BASE || (location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "http://localhost:3001" : "https://admin.femyshop.click");
function getOrderCode() {
  const fromPath = location.pathname.match(/\/r\/([^/]+)/)?.[1];
  if (fromPath) return decodeURIComponent(fromPath);
  return new URLSearchParams(location.search).get("token");
}
const token = getOrderCode();

const CLEANING_LABELS = { standard: "取貨付款", deep: "銀行轉賬" };

const TERMS_CONTENT = `
<h4>爱心賣貨便服務條款</h4>
<p>爱心超商係依照本服務條款之約定及寄件者之委託提供「爱心賣貨便」之服務（以下稱本服務）。</p>
<h4>一、買家和賣家必須對交易之履行負完全的責任。</h4>
<p>衛生福利部國民健康署提醒，菸害防制法修法於112年3月22日施行，電子煙、加熱菸於施行後屬於類菸品，將比照菸品進行管理；賣貨便仍將惟持管制菸害之高標準，對上述商品（含電子煙、加熱菸及其必要組合元件）仍繼續維持不得販售，在此提醒買賣家，請勿觸法。</p>
<h4>二、買家和賣家必須了解並遵守相關法律規定。</h4>
<p>為確保交易之順利履行，買賣或其他合約均僅存買賣兩造之間。賣方將就其商品、服務或其他交易標的物之品質、內容、運送、保證事項與瑕疵擔保責任等，向買方事先詳細闡釋與說明並履行，本服務不介入買方與賣方間的任何買賣、服務或其他交易行為，一但成交，買賣合約即存在買賣雙方間，雙方各自負擔給付價款及交付商品之責任，除法令另有規定外，任一方均不得以任何理由反悔。</p>
<h4>三、違約及服務之終止</h4>
<p>寄件者違反本服務條款(包括「爱心賣貨便-低溫寄取件」寄貨規則)，或有違反法令之情形時，爱心超商得不經事先通知，暫停、拒絕或終止寄件者使用本服務之全部或一部。</p>
<h4>四、寄件者應保證事項</h4>
<p>爱心超商門市人員或物流中心於收寄後發現或認定為下列拒絕受理之禁運品，因屬於禁止運送之商品，爱心超商得逕將該貨品退回原寄件門市(或指定退回門市)，且不返還運費，寄件者亦不得再為任何主張；如為活體動植物、昆蟲、易腐壞商品或生鮮食品、對人身危害物或不易保存之商品等致爱心超商門市人員或物流中心有受到損害之虞者包裹得由物流中心逕為處理(包括但不限於拋棄、銷毀或送交相關得收受之單位處理等)，無須取得寄件者同意，處理費由寄件者支付，且不返還運費，寄件者亦不得再為任何主張</p>
<h4>五、個人資料</h4>
<p>您提供的聯絡資訊僅用於本次服務聯繫，不會提供予第三方作行銷用途。</p>
`;

const POLICY_CONTENT = `
<h4>禁止和限制商品政策</h4>
<p>本平台僅提供合法之居家清潔服務預約，禁止以下行為：</p>
<p>1. 以本服務從事任何違法或不當用途。</p>
<p>2. 預約後惡意取消或提供虛假聯絡資訊。</p>
<p>3. 要求師傅從事與廚房清潔無關之危險或非法工作。</p>
<p>4. 於現場對服務人員進行騷擾或不當要求。</p>
<p>違反上述規定者，本平台保留取消訂單及拒絕提供服務之權利。</p>
`;

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
  if (!state.order) return "廚房清潔";
  return state.order.detail_name || state.order.service.name;
}

function renderPrices() {
  const amount = Number(state.order?.amount) || 0;
  const ship = shippingFee();
  const total = totalAmount();
  const fmt = formatMoney(amount);
  const totalFmt = formatMoney(total);

  $("#product-name-1").textContent = productName();
  $("#unit-price-1").textContent = `NT$ ${fmt}`;
  $("#subtotal-1").textContent = `NT$${Math.round(amount)}`;
  $("#summary-items").textContent = `NT $${Math.round(amount)}`;
  const shipText = ship > 0 ? `基本運費 NT$${Math.round(ship)}` : "基本運費0元 NT$0";
  $("#shipping-fee").textContent = shipText;
  if ($("#shipping-echo")) $("#shipping-echo").textContent = shipText;
  $("#total-amount-1").textContent = `NT $ ${totalFmt}`;

  $("#sidebar-name").textContent = productName();
  $("#sidebar-subtotal").textContent = `NT$ ${Math.round(amount)}`;
  $("#sidebar-shipping").textContent = ship > 0 ? `基本運費 NT$${Math.round(ship)}` : "基本運費0元";
  if ($("#sidebar-shipping-echo")) {
    $("#sidebar-shipping-echo").textContent = ship > 0 ? `基本運費 NT$${Math.round(ship)}` : "基本運費0元";
  }
  $("#sidebar-total").textContent = `NT ${totalFmt}`;
  $("#sidebar-cleaning-amount").textContent = `${Math.round(total)}元`;
}

function renderCleaningLabels() {
  const label = cleaningLabel();
  if ($("#cleaning-echo")) $("#cleaning-echo").textContent = label;
  if ($("#sidebar-cleaning")) $("#sidebar-cleaning").textContent = label;
  $("#sidebar-cleaning-amount").textContent = `${Math.round(totalAmount())}元`;
  $("#detail-title").textContent = `訂單明細-${label}`;
  $("#detail-cleaning").textContent = label;

  const isDeep = state.cleaningType === "deep";
  $("#deep-level-work-stack").hidden = !isDeep;
  $("#deep-level-clean-stack").hidden = !isDeep;
  $("#deep-upload-section").hidden = !isDeep;
  updateUploadUI();
  updateSubmitButton();
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

  $$(".steps li").forEach((li) => {
    const s = Number(li.dataset.step);
    li.classList.remove("active", "done");
    if (n >= 4) {
      li.classList.add("done");
    } else if (s === n) {
      li.classList.add("active");
    } else if (s < n) {
      li.classList.add("done");
    }
  });

  const crumbs = { 1: "確認訂單", 2: "填寫資料", 3: "完成訂購", 4: "預約完成" };
  $("#breadcrumb-current").textContent = crumbs[n] || "";
  document.body.classList.toggle("completion-mode", n === 4);

  if (n === 3) populateStep3();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function populateStep3() {
  if (!state.orderNo) {
    state.orderNo = generateOrderNo();
    state.orderTime = formatDateTime(new Date());
  }
  $("#order-no").textContent = state.orderNo;
  $("#order-time").textContent = state.orderTime;
  $("#detail-amount").textContent = formatMoney(totalAmount());

  const noteEl = $("#order-note").value.trim();
  const apiNote = state.order?.notes || "";
  $("#detail-notes").textContent = noteEl || apiNote || "無";

  renderCleaningLabels();
  updateUploadUI();
}

function updateSubmitButton() {
  const btn = $("#btn-submit");
  if (state.cleaningType === "deep" && !state.deepPhotoUploaded) {
    btn.disabled = true;
  } else {
    btn.disabled = false;
  }
}

async function loadOrder() {
  if (!token) throw new Error("缺少訂單 token");
  const res = await fetch(`${API_BASE}/api/public/order-links/${token}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "訂單鏈接無效");
  state.order = data;
  renderPrices();
  if (data.appointment && !state.bookingSubmitted) showExistingCompletion(data.appointment);
}

function validateStep2() {
  const name = $("#customer_name").value.trim();
  const phone = $("#customer_phone").value.trim();
  const store = state.selectedStore;

  if (!name) return "請填寫姓名";
  if (!phone) return "請填寫手機號碼";
  if (!store) return "請選擇取貨門市";
  return null;
}

function showError(msg) {
  const el = state.step === 3 ? $("#message-3") : $("#message");
  if (el) el.textContent = msg;
}

async function submitBooking() {
  const err = validateStep2();
  if (err) {
    showError(err);
    return;
  }

  if (state.cleaningType === "deep" && !state.deepPhotoUploaded) {
    showError("銀行轉賬請上傳轉賬照片");
    return;
  }

  $("#message").textContent = "";
  $("#message-3").textContent = "";
  $("#btn-submit").disabled = true;

  const fd = new FormData();
  fd.append("customer_name", $("#customer_name").value.trim());
  fd.append("customer_phone", $("#customer_phone").value.trim());
  fd.append("address", `${state.selectedStore.name} ${state.selectedStore.address}`);
  const photo = $("#deep-photo").files[0];
  if (photo) fd.append("item_photo", photo);
  fd.append("submitted_at", new Date().toISOString());

  try {
    const res = await fetch(`${API_BASE}/api/public/order-links/${token}/appointments`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    if (res.status === 409) {
      const refresh = await fetch(`${API_BASE}/api/public/order-links/${token}`);
      const refreshed = await refresh.json();
      if (refresh.ok && refreshed.appointment) {
        state.order = refreshed;
        showExistingCompletion(refreshed.appointment);
      } else {
        showError(data.error || "此鏈接已提交過預約");
      }
      updateSubmitButton();
      return;
    }
    if (!res.ok) {
      showError(data.error || "提交失敗");
      updateSubmitButton();
      return;
    }

    state.orderNo = formatOrderNo(data.appointment_id);
    state.orderTime = formatAppointmentTime(data.created_at);
    state.bookingSubmitted = true;
    showCompletionPage();
    showLineModal();
  } catch {
    showError("網路錯誤，請稍後再試");
    updateSubmitButton();
  }
}

function showExistingCompletion(appointment) {
  state.orderNo = formatOrderNo(appointment.id);
  state.orderTime = formatAppointmentTime(appointment.created_at);
  showCompletionPage();
}

function showCompletionPage() {
  $("#done-order-no").textContent = state.orderNo;
  $("#done-product").textContent = productName();
  $("#done-cleaning").textContent = cleaningLabel();
  $("#done-amount").textContent = `NT$ ${formatMoney(totalAmount())}`;
  $("#done-time").textContent = state.orderTime;
  goStep(4);
}

function showLineModal() {
  $("#line-modal-overlay").hidden = false;
}

async function openLineUrl(event) {
  try {
    if (!window.openChatwootSupport) throw new Error("Chatwoot helper is not loaded");
    await window.openChatwootSupport?.({ token, button: event?.currentTarget });
  } catch (error) {
    showError(error.message || "客服連線失敗，請稍後再試");
  }
}

function showLineAddButton() {
  state.lineDeferred = true;
  const btn = $("#btn-add-line");
  if (btn) btn.hidden = false;
}

/* Store picker */
function parseCity(addr) {
  const m = addr.match(/^(.+?[縣市])/);
  return m ? m[1] : "";
}

function parseDistrict(addr) {
  const city = parseCity(addr);
  if (!city) return "";
  const m = addr.slice(city.length).match(/^(.+?[區鄉鎮市])/);
  return m ? m[1] : "";
}

function parseStreet(addr) {
  const prefix = parseCity(addr) + parseDistrict(addr);
  const rest = addr.slice(prefix.length);
  const m = rest.match(/^(.+?(?:路|街|道|巷))/);
  return m ? m[1] : (rest.split(/\d/)[0].trim() || "其他");
}

function buildStoreIndex() {
  state.storeIndex = {};
  Object.entries(state.stores).forEach(([id, s]) => {
    const city = parseCity(s.address);
    const district = parseDistrict(s.address);
    const street = parseStreet(s.address);
    if (!city) return;
    if (!state.storeIndex[city]) state.storeIndex[city] = {};
    if (!state.storeIndex[city][district]) state.storeIndex[city][district] = {};
    if (!state.storeIndex[city][district][street]) state.storeIndex[city][district][street] = [];
    state.storeIndex[city][district][street].push([id, s]);
  });
}

async function loadStores() {
  if (state.stores) return;
  $("#store-loading").hidden = false;
  const res = await fetch("/data/stores.json");
  state.stores = await res.json();
  buildStoreIndex();
  state.cities = Object.keys(state.storeIndex).sort();
  const sel = $("#store-city");
  sel.innerHTML = '<option value="">請選擇縣市</option>';
  state.cities.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
  $("#store-loading").hidden = true;
}

function fillSelect(el, placeholder, items) {
  el.innerHTML = `<option value="">${placeholder}</option>`;
  items.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    el.appendChild(opt);
  });
  el.disabled = items.length === 0;
}

function onCityChange() {
  const city = $("#store-city").value;
  fillSelect($("#store-district"), "請選擇鄉、鎮、市、區", city ? Object.keys(state.storeIndex[city] || {}).sort() : []);
  fillSelect($("#store-street"), "請選擇街道", []);
  renderStoreCards();
}

function onDistrictChange() {
  const city = $("#store-city").value;
  const district = $("#store-district").value;
  const streets = city && district ? Object.keys(state.storeIndex[city][district] || {}).sort() : [];
  fillSelect($("#store-street"), "請選擇街道", streets);
  renderStoreCards();
}

function renderStoreCards() {
  const city = $("#store-city").value;
  const district = $("#store-district").value;
  const street = $("#store-street").value;
  const list = $("#store-list");
  list.innerHTML = "";

  if (!city || !street) return;

  let entries = [];
  if (district && state.storeIndex[city][district]?.[street]) {
    entries = state.storeIndex[city][district][street];
  } else {
    Object.values(state.storeIndex[city] || {}).forEach((districtMap) => {
      if (districtMap[street]) entries = entries.concat(districtMap[street]);
    });
  }

  if (entries.length === 0) {
    list.innerHTML = "<li style='cursor:default;color:#999;border:none'>找不到符合的門市</li>";
    return;
  }

  entries.slice(0, 50).forEach(([id, s]) => {
    const li = document.createElement("li");
    li.className = "store-card-item";
    li.innerHTML = `
      <div class="store-card">
        <div class="store-card-name">${s.store}</div>
        <div class="store-card-id">店號 ${id}</div>
        <div class="store-card-addr">${s.address}</div>
      </div>`;
    li.addEventListener("click", () => pickStoreCandidate(id, s));
    list.appendChild(li);
  });
}

function closeAllStoreOverlays() {
  $("#store-picker-screen").hidden = true;
  $("#store-privacy-screen").hidden = true;
  $("#store-confirm-overlay").hidden = true;
  document.body.style.overflow = "";
}

function openStorePicker() {
  $("#store-picker-screen").hidden = false;
  $("#store-privacy-screen").hidden = true;
  $("#store-confirm-overlay").hidden = true;
  document.body.style.overflow = "hidden";
}

function pickStoreCandidate(id, s) {
  state.pendingStore = { id, name: s.store, address: s.address };
  $("#store-picker-screen").hidden = true;
  $("#store-privacy-screen").hidden = false;
}

function showStoreConfirm() {
  const s = state.pendingStore;
  if (!s) return;
  $("#confirm-store-id").textContent = s.id;
  $("#confirm-store-name").textContent = s.name;
  $("#confirm-store-addr").textContent = s.address;
  $("#store-privacy-screen").hidden = true;
  $("#store-confirm-overlay").hidden = false;
}

function finalizeStoreSelection() {
  const s = state.pendingStore;
  if (!s) return;
  state.selectedStore = s;
  $("#store-display").value = `${s.name} - ${s.address}`;
  state.pendingStore = null;
  closeAllStoreOverlays();
}

/* Event bindings */
function bindEvents() {
  $("#menu-btn").addEventListener("click", () => {
    $("#side-menu").hidden = false;
    $("#menu-overlay").hidden = false;
  });
  $("#menu-close").addEventListener("click", closeMenu);
  $("#menu-overlay").addEventListener("click", closeMenu);

  $("#agree-terms").addEventListener("change", () => {
    $("#btn-next-1").disabled = !$("#agree-terms").checked;
  });

  $$('input[name="cleaning_type"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      state.cleaningType = e.target.value;
      renderCleaningLabels();
    });
  });

  $("#btn-next-1").addEventListener("click", () => goStep(2));
  $("#btn-back-2").addEventListener("click", () => goStep(1));
  $("#btn-next-2").addEventListener("click", () => {
    const err = validateStep2();
    if (err) {
      $("#message").textContent = err;
      return;
    }
    $("#message").textContent = "";

    if (state.cleaningType === "standard") {
      submitBooking();
    } else {
      goStep(3);
    }
  });
  $("#btn-back-3").addEventListener("click", () => goStep(2));
  $("#btn-submit").addEventListener("click", submitBooking);

  $("#same-as-buyer").addEventListener("change", (e) => {
    if (e.target.checked) {
      $("#recipient_name").value = $("#customer_name").value;
      $("#recipient_phone").value = $("#customer_phone").value;
      $("#recipient_mobile").value = $("#customer_phone").value;
    }
  });

  $("#btn-pick-store").addEventListener("click", async () => {
    await loadStores();
    openStorePicker();
  });

  $("#store-city").addEventListener("change", onCityChange);
  $("#store-district").addEventListener("change", onDistrictChange);
  $("#store-street").addEventListener("change", renderStoreCards);
  $("#store-picker-close").addEventListener("click", closeAllStoreOverlays);
  $("#store-privacy-disagree").addEventListener("click", () => {
    state.pendingStore = null;
    openStorePicker();
  });
  $("#store-privacy-agree").addEventListener("click", showStoreConfirm);
  $("#confirm-cancel").addEventListener("click", () => {
    $("#store-confirm-overlay").hidden = true;
    openStorePicker();
  });
  $("#confirm-ok").addEventListener("click", finalizeStoreSelection);

  $$(".modal-close, [data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.close;
      if (id) document.getElementById(id).close();
    });
  });

  $$(".terms-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const type = link.dataset.modal;
      if (type === "policy") {
        $("#text-modal-title").textContent = "禁止和限制商品政策";
        $("#text-modal-body").innerHTML = POLICY_CONTENT;
      } else {
        $("#text-modal-title").textContent = "服務條款";
        $("#text-modal-body").innerHTML = TERMS_CONTENT;
      }
      $("#text-modal").showModal();
    });
  });

  $("#text-modal-ack").addEventListener("click", () => $("#text-modal").close());

  $("#btn-upload").addEventListener("click", () => $("#deep-photo").click());
  $("#deep-photo").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    $("#preview-img").src = url;
    state.deepPhotoUploaded = true;
    updateUploadUI();
    updateSubmitButton();
  });
  $("#remove-preview").addEventListener("click", () => {
    $("#deep-photo").value = "";
    state.deepPhotoUploaded = false;
    updateUploadUI();
    updateSubmitButton();
  });

  $("#line-later").addEventListener("click", () => {
    $("#line-modal-overlay").hidden = true;
    showLineAddButton();
  });
  $("#line-confirm").addEventListener("click", () => {
    openLineUrl();
    $("#line-modal-overlay").hidden = true;
  });
  $("#btn-add-line").addEventListener("click", openLineUrl);
}

function closeMenu() {
  $("#side-menu").hidden = true;
  $("#menu-overlay").hidden = true;
}

function showLoadError(msg) {
  $("#load-error").hidden = false;
  $("#load-error").textContent = msg;
  $$(".step-panel").forEach((el) => { el.hidden = true; });
}

bindEvents();
renderCleaningLabels();

loadOrder().catch((error) => showLoadError(error.message));
