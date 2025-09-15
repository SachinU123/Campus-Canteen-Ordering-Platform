/* cart.js — VPP Canteen (rewritten with item-page deep links) */
(function () {
  // ------------------ Config ------------------
  const API_BASE     = "http://localhost:3001";
  const CURRENCY     = "₹";
  const PLATFORM_FEE = 0;
  const TAX_RATE     = 0;

  const CART_KEY     = "vpp_canteen_cart";
  const PENDING_KEY  = "vpp_pending_order";

  // ------------------ Tiny DOM helpers ------------------
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  // ------------------ Money & math ------------------
  const INR      = (n) => `${CURRENCY}${Number(n || 0).toFixed(0)}`;
  const sumItems = (cart) => cart.reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0);
  const totalQty = (cart) => cart.reduce((s, it) => s + Number(it.qty||0), 0);

  // ------------------ Storage ------------------
  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
  }
  function writeCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateBadge(cart);
  }

  // ------------------ Utils ------------------
  const pad2 = (n) => String(n).padStart(2, "0");
  function escapeHtml(s = "") {
    return s.replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  }
  function safeId(name, price) {
    return `${(name || "item").toLowerCase().replace(/\s+/g, "-")}--${Number(price || 0)}`;
  }
  function parsePriceText(text) {
    const n = (text || "").replace(/[^\d.]/g, "");
    return Number(n || 0);
  }

  // ------------------ Catalog helpers (require food-items.js) ------------------
  const hasCatalog = typeof window.getItem === "function" && typeof window.getItemUrl === "function";
  function getItemByName(name) {
    if (!hasCatalog || !name) return null;
    const want = name.trim().toLowerCase();
    const list = typeof window.allItems === "function" ? window.allItems() : [];
    return list.find(it => (it.name||"").trim().toLowerCase() === want) || null;
  }
  function resolveCatalogRef(cartItem) {
    // Prefer direct id → catalog
    if (hasCatalog && cartItem?.id) {
      const byId = window.getItem(cartItem.id);
      if (byId) return byId;
    }
    // Try by name when legacy/derived id
    if (hasCatalog && cartItem?.name) {
      const byName = getItemByName(cartItem.name);
      if (byName) return byName;
    }
    return null;
  }
  function getDetailsUrl(cartItem) {
    const ref = resolveCatalogRef(cartItem);
    return ref ? window.getItemUrl(ref.id) : null;
  }

  // ------------------ Fetch helper ------------------
  async function fetchJSON(url, opts = {}, timeoutMs = 10000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, data };
    } catch (err) {
      return { ok: false, data: null, err };
    } finally {
      clearTimeout(t);
    }
  }

  // ------------------ Server time / IST helpers ------------------
  async function getAuthoritativeNowMs(timeoutMs = 2000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${API_BASE}/api/now`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error("now endpoint failed");
      const { nowUtcMs } = await res.json();
      return { nowMs: Number(nowUtcMs) || Date.now(), source: "server" };
    } catch {
      clearTimeout(t);
      return { nowMs: Date.now(), source: "client" };
    }
  }
  async function detectClockSkewAndPickBaseNow() {
    const clientNow = Date.now();
    const { nowMs: serverNow, source } = await getAuthoritativeNowMs();
    const skewMs = Math.abs(serverNow - clientNow);
    const SKEW_LIMIT = 2 * 60 * 1000;
    if (skewMs > SKEW_LIMIT) {
      console.warn("⚠️ Device clock appears skewed by ~", Math.round(skewMs/1000), "s. Using server time.");
      return { baseNowMs: serverNow, used: "server", skewMs };
    }
    return { baseNowMs: clientNow, used: source, skewMs };
  }
  function fmtIST(ts) {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: true, hour: "2-digit", minute: "2-digit"
    }).format(new Date(ts));
  }
  function timeStringToTodayTs(hhmm) {
    const [h=0, m=0] = (hhmm || "").split(":").map(Number);
    const d = new Date();
    d.setSeconds(0,0); d.setHours(h, m, 0, 0);
    return d.getTime();
  }

  // ------------------ Prep time estimation ------------------
  function parsePrepMinutesFromItem(it) {
    const t = (it.time || it.meta || "").toString();
    const m = t.match(/(\d+)\s*[-–]\s*(\d+)/) || t.match(/(\d+)/);
    if (!m) return 20;
    if (m[2]) return Math.max(Number(m[1]), Number(m[2]));
    return Number(m[1]);
  }
  function estimatePrepMinutes(cart) {
    if (!cart.length) return 20;
    return Math.max(...cart.map(parsePrepMinutesFromItem));
  }

  // ------------------ Cart seed from DOM (fallback) ------------------
  function seedCartFromDOMIfNeeded() {
    const cart = readCart();
    if (cart.length) return;

    const items = [];
    $$(".items .cart-item").forEach((el) => {
      const name  = $(".name", el)?.textContent?.trim() || "Item";
      const price = parsePriceText($(".price", el)?.textContent || "0");
      const qty   = Number($(".qty .val", el)?.textContent || "1");
      const desc  = $(".desc", el)?.textContent?.trim() || "";
      const img   = $(".thumb img", el)?.getAttribute("src") || "";
      const alt   = $(".thumb img", el)?.getAttribute("alt") || name;
      const meta  = $(".meta", el)?.textContent?.trim() || "";
      const time  = $(".time", el)?.textContent?.trim() || "";
      const veg   = !!$(".veg-dot", el);
      items.push({
        id: safeId(name, price),
        name, price,
        qty: Math.max(1, qty),
        desc, img, alt, meta, time, veg
      });
    });

    if (items.length) writeCart(items);
  }

  // ------------------ Rendering ------------------
  function itemHTML(it) {
    const vegDot = it.veg
      ? `<span class="veg-dot" aria-hidden="true"></span>`
      : `<span style="width:10px;height:10px;border-radius:50%;background:#ff7043;box-shadow:0 0 8px rgba(255,112,67,.8)"></span>`;

    const meta = it.meta || `${it.veg ? "Veg" : "Non-veg"} • ${it.time || "20–25 mins"} · ★ 4.5`;
    const desc = it.desc || "";

    // NEW: resolve details link from catalog (by id or by name). If not available, hide link.
    const detailsUrl = getDetailsUrl(it);

    return `
      <article class="cart-item" data-id="${escapeHtml(it.id)}">
        <div class="thumb">
          <img src="${it.img || ""}" alt="${escapeHtml(it.alt || it.name)}" loading="lazy">
        </div>

        <div class="content">
          <div class="meta">${vegDot}<span>${escapeHtml(meta)}</span></div>

          <h3 class="name">
            ${detailsUrl ? `<a class="name-link" href="${detailsUrl}" target="_blank" rel="noopener">` : ``}
              ${escapeHtml(it.name)}
            ${detailsUrl ? `</a>` : ``}
          </h3>

          ${desc ? `<p class="desc">${escapeHtml(desc)}</p>` : ""}

          <div class="line">
            <div class="qty" role="group" aria-label="Quantity">
              <button class="btn-icon" data-action="dec" aria-label="Decrease quantity">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </button>
              <span class="val" aria-live="polite">${it.qty}</span>
              <button class="btn-icon" data-action="inc" aria-label="Increase quantity">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </button>
            </div>

            <div class="price">${INR(it.price)}</div>
          </div>

          ${detailsUrl ? `<div class="row" style="margin-top:8px">
            <a class="btn-link" href="${detailsUrl}" target="_blank" rel="noopener">View details page</a>
          </div>` : ``}
        </div>

        <div class="side">
          <button class="remove" aria-label="Remove item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 7l-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7m3 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 7h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Remove
          </button>
          <span class="muted" style="font-size:13px;">Subtotal: <strong style="color:#eafff3">${INR(it.price * it.qty)}</strong></span>
        </div>
      </article>
    `;
  }

  function renderCart() {
    const container = $(".items");
    if (!container) return;

    const cart = readCart();

    if (cart.length === 0) {
      container.innerHTML = `
        <div class="card" style="padding:24px; text-align:center">
          <p class="muted" style="margin-bottom:10px">Your cart is empty.</p>
          <a class="btn" href="menu.html" style="display:inline-block">Browse Menu</a>
        </div>
      `;
      updateSummary(cart);
      updateBadge(cart);
      return;
    }

    container.innerHTML = cart.map(itemHTML).join("");
    updateSummary(cart);
    updateBadge(cart);
  }

  // ------------------ Summary & Badge ------------------
  function updateSummary(cart) {
    const itemsCountEl = $(".summary .head .muted");
    const totals = $$(".summary .split strong");
    const itemsTotalEl = totals[0] || null;
    const payableEl    = totals[totals.length - 1] || itemsTotalEl;

    const count = totalQty(cart);
    const sub   = sumItems(cart);
    const tax   = Math.round(sub * TAX_RATE);
    const total = sub + PLATFORM_FEE + tax;

    if (itemsCountEl) itemsCountEl.textContent = `${count} item${count !== 1 ? "s" : ""}`;
    if (itemsTotalEl) itemsTotalEl.textContent = INR(sub);
    if (payableEl)    payableEl.textContent    = INR(total);
  }
  function updateBadge(cart = readCart()) {
    const badge = document.querySelector(".nav .tab.active .badge")
              || document.querySelector(".nav .tab .badge");
    if (!badge) return;

    // Count unique line items (not total qty)
    const n = cart.filter(it => (it?.qty || 0) > 0).length;

    badge.textContent = n > 99 ? "99+" : String(n);
    badge.style.visibility = n ? "visible" : "hidden";
  }

  // ------------------ Cart mutations ------------------
  function changeQty(id, delta) {
    const cart = readCart();
    const i = cart.findIndex((x) => x.id === id);
    if (i < 0) return;
    cart[i].qty = Math.max(1, Number(cart[i].qty||1) + Number(delta||0));
    writeCart(cart);
    renderCart();
  }
  function removeItem(id) {
    const cart = readCart().filter((x) => x.id !== id);
    writeCart(cart);
    renderCart();
  }

  // ------------------ Schedule modal ------------------
  let scheduledForTs = null;
  function ensureScheduleModal() {
    let modal = $("#schedule-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "schedule-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:10000;";
    modal.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="sched-title"
           style="background:#0f1316;color:#e8f2ec;max-width:560px;width:94%;border-radius:16px;border:1px solid #2a2e35;box-shadow:0 20px 60px rgba(0,0,0,.35);overflow:hidden">
        <div style="padding:18px 18px 0">
          <h3 id="sched-title" style="margin:0 0 8px;font-family:Poppins,Inter,sans-serif">Schedule Order</h3>
          <p class="muted" style="margin:0 0 12px">Choose a time within the next 2 hours.</p>
        </div>
        <div style="padding:0 18px 18px; display:grid; gap:12px">
          <label style="display:grid;gap:8px">
            <span>Delivery/Pickup time</span>
            <input id="sched-time" type="time" style="all:unset;background:#0b0d11;border:1px solid #2a2e35;border-radius:10px;padding:10px 12px;font-weight:700;letter-spacing:.3px;color:#e8f2ec" />
            <small id="sched-hint" class="muted"></small>
            <div id="sched-error" style="color:#ff7a90;font-size:13px;min-height:18px"></div>
          </label>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">
            <button id="sched-cancel" class="btn" style="background:#111827;color:#fff;border:none;border-radius:10px;padding:8px 14px;cursor:pointer">Cancel</button>
            <button id="sched-continue" class="btn" style="background:linear-gradient(90deg, var(--accent, #00ff80), #43ffa9);color:#032012;border:none;border-radius:10px;padding:8px 14px;cursor:pointer">Continue to Pay</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => { if (e.target === modal) hideScheduleModal(); });
    $("#sched-cancel", modal).addEventListener("click", hideScheduleModal);
    $("#sched-continue", modal).addEventListener("click", onScheduleContinue);

    return modal;
  }
  async function initScheduleTimeBounds() {
    const input = $("#sched-time");
    const hint  = $("#sched-hint");
    const errEl = $("#sched-error");
    if (!input) return;

    const { baseNowMs } = await detectClockSkewAndPickBaseNow();

    const MIN_OFFSET = 5 * 60 * 1000;
    const MAX_OFFSET = 2 * 60 * 60 * 1000;
    const minTs = baseNowMs + MIN_OFFSET;
    const maxTs = baseNowMs + MAX_OFFSET;

    const roundTo = 5 * 60 * 1000;
    const defTs = Math.ceil(minTs / roundTo) * roundTo;
    const def = new Date(defTs);

    const minD = new Date(minTs), maxD = new Date(maxTs);
    const defH = pad2(def.getHours()),   defM = pad2(def.getMinutes());
    const minH = pad2(minD.getHours()),  minM = pad2(minD.getMinutes());
    const maxH = pad2(maxD.getHours()),  maxM = pad2(maxD.getMinutes());

    input.value = `${defH}:${defM}`;
    input.setAttribute("data-min", `${minH}:${minM}`);
    input.setAttribute("data-max", `${maxH}:${maxM}`);
    if (hint) hint.textContent = `Allowed: ${fmtIST(minTs)} – ${fmtIST(maxTs)} (today, IST)`;

    const clamp = () => {
      const v = input.value; if (!v) return;
      const chosen = timeStringToTodayTs(v);
      if (chosen < minTs) {
        input.value = `${minH}:${minM}`; if (errEl) errEl.textContent = "";
      } else if (chosen > maxTs) {
        input.value = `${maxH}:${maxM}`; if (errEl) errEl.textContent = "";
      }
    };
    input.addEventListener("input", clamp);
    input.addEventListener("change", clamp);
  }
  function showScheduleModal() {
    ensureScheduleModal();
    initScheduleTimeBounds();
    const modal = $("#schedule-modal");
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
  }
  function hideScheduleModal() {
    const modal = $("#schedule-modal");
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }
  async function onScheduleContinue() {
    const input = $("#sched-time");
    const errEl = $("#sched-error");
    if (!input) return;

    const value = input.value;
    if (!value) {
      errEl.textContent = "Please choose a time.";
      return;
    }

    const { baseNowMs } = await detectClockSkewAndPickBaseNow();
    const minTs = baseNowMs + 5 * 60 * 1000;
    const maxTs = baseNowMs + 2 * 60 * 60 * 1000;

    const chosen = timeStringToTodayTs(value);
    if (chosen < minTs) {
      errEl.textContent = `Time must be after ${fmtIST(minTs)}.`;
      const md = new Date(minTs);
      input.value = `${pad2(md.getHours())}:${pad2(md.getMinutes())}`;
      return;
    }
    if (chosen > maxTs) {
      errEl.textContent = `Time must be before ${fmtIST(maxTs)}.`;
      const xd = new Date(maxTs);
      input.value = `${pad2(xd.getHours())}:${pad2(xd.getMinutes())}`;
      return;
    }
    if (chosen <= Date.now()) {
      errEl.textContent = "Time must be in the future.";
      return;
    }

    scheduledForTs = chosen;
    hideScheduleModal();
    showPaymentModal();
  }

  // ------------------ Payment modal (dummy) ------------------
  function ensurePaymentModal() {
    let modal = $("#pay-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "pay-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:10000;";
    modal.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="pay-title"
           style="background:#fff;max-width:520px;width:92%;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden">
        <div style="padding:18px 18px 0">
          <h3 id="pay-title" style="margin:0 0 8px;font-family:Poppins,Inter,sans-serif">Choose Payment Method</h3>
          <p class="muted" style="margin:0 0 12px">Demo checkout (no real payment).</p>
        </div>
        <div style="padding:0 18px 18px; display:grid; gap:10px">
          <label style="display:flex;gap:10px;align-items:center;cursor:pointer">
            <input type="radio" name="pay" value="upi" checked>
            <span>UPI (GPay / PhonePe / BHIM)</span>
          </label>
          <label style="display:flex;gap:10px;align-items:center;cursor:pointer">
            <input type="radio" name="pay" value="card">
            <span>Card (Visa / MasterCard / RuPay)</span>
          </label>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
            <button id="pay-cancel" class="btn" style="background:#fff;border:1px solid #e5e7eb;color:#111827;border-radius:10px;padding:8px 12px;cursor:pointer">Cancel</button>
            <button id="pay-now" class="btn" style="background:#111827;color:#fff;border:none;border-radius:10px;padding:8px 14px;cursor:pointer">Pay Now</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => { if (e.target === modal) hidePaymentModal(); });
    $("#pay-cancel", modal).addEventListener("click", hidePaymentModal);

    const payNow = $("#pay-now", modal);
    if (!payNow.dataset.bound) {
      payNow.addEventListener("click", onPayNowClick);
      payNow.dataset.bound = "1";
    }
    return modal;
  }
  function showPaymentModal() {
    const modal = ensurePaymentModal();
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
  }
  function hidePaymentModal() {
    const modal = $("#pay-modal");
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }

  let paying = false;
  async function onPayNowClick() {
    if (paying) return;
    paying = true;

    try {
      const cart = readCart();
      if (!cart.length) { alert("Your cart is empty."); return; }
      if (!navigator.onLine) { alert("You appear to be offline. Please check your internet."); return; }

      const rupees = Math.round(sumItems(cart));

      const { ok, data } = await fetchJSON(`${API_BASE}/api/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: rupees })
      }, 10000);
      if (!ok || !data || !data.orderId) {
        alert("Could not create order. Check backend (CORS / server down).");
        return;
      }

      const whenText = scheduledForTs ? `Scheduled for ${fmtIST(scheduledForTs)}` : "Order now";
      const confirmed = confirm(
        `Dummy Payment\n\nOrder: ${data.orderId}\nAmount: ₹${rupees}\n${whenText}\n\nPress OK to simulate success.`
      );
      if (!confirmed) { alert("Dummy payment cancelled."); return; }

      const ver = await fetchJSON(`${API_BASE}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: data.orderId })
      }, 10000);
      if (!(ver.ok && ver.data && ver.data.verified)) {
        alert("Dummy verification failed.");
        return;
      }

      savePendingOrderSnapshot();
      writeCart([]);
      hidePaymentModal();
      hideScheduleModal();
      window.location.href = "orders.html";
    } finally {
      paying = false;
    }
  }

  // ------------------ Orders snapshot ------------------
  function savePendingOrderSnapshot() {
    const items = readCart().map(it => ({
      name:  it.name,
      qty:   it.qty  || 1,
      price: it.price || 0,
      time:  it.time || ""
    }));
    if (!items.length) return;

    const prepMin = estimatePrepMinutes(readCart());
    const baseTs = scheduledForTs && scheduledForTs > Date.now() ? scheduledForTs : Date.now();
    const readyAtTs = baseTs + prepMin * 60 * 1000;

    localStorage.setItem(PENDING_KEY, JSON.stringify({
      items,
      createdAt: Date.now(),
      status: scheduledForTs ? "scheduled" : "placed",
      scheduledFor: scheduledForTs || null,
      estimatedReadyAt: readyAtTs
    }));
  }

  // ------------------ Events ------------------
  function onClick(e) {
    // Qty controls
    const incBtn = e.target.closest(".btn-icon[data-action='inc']");
    const decBtn = e.target.closest(".btn-icon[data-action='dec']");
    if (incBtn || decBtn) {
      const itemEl = e.target.closest(".cart-item");
      if (!itemEl) return;
      const id = itemEl.getAttribute("data-id");
      changeQty(id, incBtn ? +1 : -1);
      e.preventDefault();
      return;
    }

    // Remove
    const removeBtn = e.target.closest(".remove");
    if (removeBtn) {
      const itemEl = e.target.closest(".cart-item");
      if (!itemEl) return;
      const id = itemEl.getAttribute("data-id");
      removeItem(id);
      e.preventDefault();
      return;
    }

    // (Optional) Intercept details link for analytics etc.
    const nameLink = e.target.closest(".name-link, .btn-link");
    if (nameLink) {
      // allow default navigation to the per-item HTML page
      return;
    }

    // Summary buttons
    const btn = e.target.closest(".summary .btn");
    if (btn) {
      e.preventDefault();
      const label = btn.textContent.trim().toLowerCase();
      if (label.includes("schedule")) {
        showScheduleModal();
      } else {
        scheduledForTs = null;
        showPaymentModal();
      }
      return;
    }

    // Header nav (if present)
    const tab = e.target.closest(".header .nav .tab, .brand");
    if (tab) {
      e.preventDefault();
      const text = tab.textContent.trim().toLowerCase();
      if (text.startsWith("index"))         window.location.href = "../index.html";
      else if (text.startsWith("menu"))     window.location.href = "menu.html";
      else if (text.startsWith("orders"))   window.location.href = "orders.html";
      else if (text.startsWith("cart"))     window.location.href = "cart.html";
      else                                  window.location.href = "../index.html";
      return;
    }
  }

  function onKeydown(e) {
    if (!document.activeElement) return;
    const inItem = document.activeElement.closest?.(".cart-item");
    if (!inItem) return;

    const id = inItem.getAttribute("data-id");
    if (!id) return;

    if (e.key === "+" || e.key === "=") {
      e.preventDefault(); changeQty(id, +1);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault(); changeQty(id, -1);
    } else if (e.key === "Delete") {
      e.preventDefault(); removeItem(id);
    }
  }

  // ------------------ Init ------------------
  function updateBadge(cart = readCart()) {
    const badge = document.querySelector(".nav .tab.active .badge")
              || document.querySelector(".nav .tab .badge");
    if (!badge) return;
    const n = cart.filter(it => (it?.qty || 0) > 0).length;
    badge.textContent = n > 99 ? "99+" : String(n);
    badge.style.visibility = n ? "visible" : "hidden";
  }

  function updateBadgeAndHealth() {
    updateBadge();
    fetchJSON(`${API_BASE}/api/health`).then(({ ok }) => {
      if (!ok) console.warn("⚠️ Backend health check failed");
    });
  }

  function init() {
    seedCartFromDOMIfNeeded();
    renderCart();
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown);
    updateBadgeAndHealth();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
