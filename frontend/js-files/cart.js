/* cart.js — VPP Canteen
   - Renders cart from localStorage (fallback: parse current HTML)
   - Quantity +/- , Remove
   - Order Summary keeps in sync
   - Proceed to Payment -> saves a pending order snapshot for Orders page, then clears cart & redirects
   - Header tab routing + badge
*/

(function () {
  // ------------------ Utilities ------------------
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const CART_KEY    = "vpp_canteen_cart";
  const PENDING_KEY = "vpp_pending_order";

  const CURRENCY     = "₹";
  const PLATFORM_FEE = 0; // change easily later (in rupees)
  const TAX_RATE     = 0; // e.g. 0.05 for 5% tax, if you add a UI row

  const INR = (n) => `${CURRENCY}${Number(n || 0).toFixed(0)}`;

  function parsePriceText(text) {
    const n = (text || "").replace(/[^\d.]/g, "");
    return Number(n || 0);
  }

  function readCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch {
      return [];
    }
  }

  function writeCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateBadge(cart);
  }

  const sumItems  = (cart) => cart.reduce((s, it) => s + (it.price * it.qty), 0);
  const totalQty  = (cart) => cart.reduce((s, it) => s + it.qty, 0);
  const safeId    = (name, price) => `${(name || "item").toLowerCase().replace(/\s+/g, "-")}--${Number(price || 0)}`;

  // --- Pending order snapshot for Orders page ---
  function savePendingOrderSnapshot() {
    const items = readCart().map(it => ({
      name:  it.name,
      qty:   it.qty  || 1,
      price: it.price || 0,
      time:  it.time || "" // e.g. "20–25 mins"
    }));
    if (!items.length) return;
    localStorage.setItem(PENDING_KEY, JSON.stringify({
      items,
      createdAt: Date.now()
    }));
  }

  // ------------------ Seeding from existing HTML (fallback) ------------------
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
      const time  = $(".time", el)?.textContent?.trim() || ""; // capture prep-time for better ETA in Orders
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
  function renderCart() {
    const container = $(".items");
    if (!container) return;

    const cart = readCart();

    // Empty state
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

  function itemHTML(it) {
    const vegDot = it.veg
      ? `<span class="veg-dot" aria-hidden="true"></span>`
      : `<span style="width:10px;height:10px;border-radius:50%;background:#ff7043;box-shadow:0 0 8px rgba(255,112,67,.8)"></span>`;

    const meta = it.meta || `${it.veg ? "Veg" : "Non-veg"} • ${it.time || "20–25 mins"} · ★ 4.5`;
    const desc = it.desc || "";

    return `
      <article class="cart-item" data-id="${it.id}">
        <div class="thumb">
          <img src="${it.img || ""}" alt="${escapeHtml(it.alt || it.name)}" loading="lazy">
        </div>

        <div>
          <div class="meta">${vegDot}<span>${escapeHtml(meta)}</span></div>
          <h3 class="name">${escapeHtml(it.name)}</h3>
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
        </div>

        <div style="display:flex; flex-direction:column; gap:10px; align-items:flex-end;">
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

  function escapeHtml(s = "") {
    return s.replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  }

  // ------------------ Order Summary ------------------
  function updateSummary(cart) {
    const itemsCountEl = $(".summary .head .muted");
    const totals = $$(".summary .split strong"); // safer: last strong is "Payable now"
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

  // ------------------ Badge ------------------
  function updateBadge(cart = readCart()) {
    const badge = $(".nav .tab.active .badge") || $(".nav .tab .badge");
    if (!badge) return;
    const n = totalQty(cart);
    badge.textContent = n > 99 ? "99+" : String(n);
    badge.style.visibility = n ? "visible" : "hidden";
  }

  // ------------------ Cart Mutations ------------------
  function changeQty(id, delta) {
    const cart = readCart();
    const i = cart.findIndex((x) => x.id === id);
    if (i < 0) return;
    cart[i].qty = Math.max(1, cart[i].qty + delta);
    writeCart(cart);
    renderCart();
  }

  function removeItem(id) {
    const cart = readCart().filter((x) => x.id !== id);
    writeCart(cart);
    renderCart();
  }

  // ------------------ Payment Modal (Placeholder) ------------------
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
          <p class="muted" style="margin:0 0 12px">This is a placeholder. Integrate Razorpay/Stripe later.</p>
        </div>
        <div style="padding:0 18px 18px; display:grid; gap:10px">
          <label style="display:flex;gap:10px;align-items:center;cursor:pointer">
            <input type="radio" name="pay" value="upi" checked>
            <span>UPI (Gpay / PhonePe / BHIM)</span>
          </label>
          <label style="display:flex;gap:10px;align-items:center;cursor:pointer">
            <input type="radio" name="pay" value="card">
            <span>Card (Visa / MasterCard / RuPay)</span>
          </label>
          <label style="display:flex;gap:10px;align-items:center;cursor:pointer">
            <input type="radio" name="pay" value="cod" disabled>
            <span>Cash on Delivery (Not available)</span>
          </label>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
            <button id="pay-cancel" class="btn" style="background:#fff;border:1px solid #e5e7eb;color:#111827;border-radius:10px;padding:8px 12px;cursor:pointer">Cancel</button>
            <button id="pay-now" class="btn" style="background:#111827;color:#fff;border:none;border-radius:10px;padding:8px 14px;cursor:pointer">Pay Now</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Close by backdrop
    modal.addEventListener("click", (e) => {
      if (e.target === modal) hidePaymentModal();
    });
    $("#pay-cancel", modal).addEventListener("click", hidePaymentModal);

    // Bind Pay Now once
    const payNow = $("#pay-now", modal);
    if (!payNow.dataset.bound) {
      payNow.addEventListener("click", () => {
        const cart = readCart();
        if (!cart.length) {
          alert("Your cart is empty.");
          hidePaymentModal();
          return;
        }

        // 1) Save snapshot for Orders page (so Orders can build an accurate live order)
        savePendingOrderSnapshot();

        // 2) Optional: store last order summary counters
        localStorage.setItem("vpp_last_order_total", String(sumItems(cart)));
        localStorage.setItem("vpp_last_order_count", String(totalQty(cart)));

        // 3) Clear cart & redirect
        writeCart([]);
        hidePaymentModal();
        window.location.href = "orders.html";
      });
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

  // ------------------ Events (delegated) ------------------
  function onClick(e) {
    // Quantity buttons
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

    // Proceed to Payment
    const payBtn = e.target.closest(".summary .btn");
    if (payBtn) {
      e.preventDefault();
      showPaymentModal();
      return;
    }

    // Header tabs routing
    const tab = e.target.closest(".header .nav .tab, .brand");
    if (tab) {
      e.preventDefault();
      const text = tab.textContent.trim().toLowerCase();
      if (text.startsWith("index"))   window.location.href = "../index.html";
      else if (text.startsWith("menu"))   window.location.href = "menu.html";
      else if (text.startsWith("orders")) window.location.href = "orders.html";
      else if (text.startsWith("cart"))   window.location.href = "cart.html";
      else window.location.href = "../index.html";
      return;
    }
  }

  // Keyboard support for +/- inside a .cart-item
  function onKeydown(e) {
    if (!document.activeElement) return;
    const inItem = document.activeElement.closest?.(".cart-item");
    if (!inItem) return;

    const id = inItem.getAttribute("data-id");
    if (!id) return;

    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      changeQty(id, +1);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      changeQty(id, -1);
    } else if (e.key === "Delete") {
      e.preventDefault();
      removeItem(id);
    }
  }

  // ------------------ Init ------------------
  function init() {
    seedCartFromDOMIfNeeded(); // if localStorage empty, read from current HTML
    renderCart();

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown);

    // Ensure badge shows correctly even if header differs
    updateBadge();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
