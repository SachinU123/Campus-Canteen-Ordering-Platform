/* orders.js — VPP Canteen
   - Robust header nav + cart badge (total qty)
   - Safe localStorage helpers
   - Absorb pending order from cart
   - Live/Previous rendering with progress
   - Verification via localStorage + live re-render
   - No duplicate listeners / leaks
*/
(function () {
  // ----------------- Constants & tiny helpers -----------------
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const CART_KEY        = "vpp_canteen_cart";
  const ORDERS_KEY      = "vpp_orders";
  const ORDER_SEQ_KEY   = "vpp_order_seq";
  const PENDING_KEY     = "vpp_pending_order";
  const VERIFIED_KEY    = "vpp_verified_orders"; // set by staff app or dev button

  const CURRENCY = "₹";
  const now = () => Date.now();
  const pad = (n, w = 4) => String(n).padStart(w, "0");
  const INR = (n) => `${CURRENCY}${Number(n || 0).toFixed(0)}`;
  const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + f(x), 0);

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }
  function writeJSON(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  // ----------------- Cart badge (total quantity) -----------------
  function readCart() {
    return readJSON(CART_KEY, []);
  }
  function totalCartQty(cart = readCart()) {
    return cart.reduce((t, it) => t + Math.max(0, Number(it?.qty || 0)), 0);
  }
  function ensureBadgeHost() {
    // Prefer a dedicated .cart-btn if present, else attach to the nav "Cart" tab.
    let host = $(".cart-btn");
    if (host) return host;

    // Try to find a nav tab that contains the word "cart"
    const tabs = $$(".header .nav .tab, .nav .tab, nav .tab, .header a, nav a, .nav a");
    for (const t of tabs) {
      if ((t.textContent || "").toLowerCase().includes("cart")) return t;
    }
    // As a last resort, return null (no badge shown)
    return null;
  }
  function updateCartBadge() {
    const host = ensureBadgeHost();
    if (!host) return;

    let badge = host.querySelector(".cart-badge");
    const qty = totalCartQty();

    if (!badge) {
      badge = document.createElement("span");
      badge.className = "cart-badge";
      badge.style.cssText =
        "display:inline-flex;min-width:18px;height:18px;padding:0 5px;border-radius:9px;" +
        "align-items:center;justify-content:center;font-size:11px;background:#22c55e;color:#0a0f0d;" +
        "margin-left:6px;line-height:18px;font-weight:700;";
      host.appendChild(badge);
    }
    badge.textContent = qty > 99 ? "99+" : String(qty);
    badge.style.visibility = qty ? "visible" : "hidden";

    // If the host’s text literally includes “Cart” (no icon), keep it as is.
    // (We don’t mutate the innerText beyond adding the badge element.)
  }
  // Listen for cart changes fired by other pages (our cart writes dispatch 'vpp:cart-changed')
  window.addEventListener("vpp:cart-changed", updateCartBadge);
  // Also reflect cross-tab updates (e.g., cart modified in another tab)
  window.addEventListener("storage", (e) => { if (e.key === CART_KEY) updateCartBadge(); });

  // ----------------- Header links -----------------
  function wireHeaderNav() {
    document.addEventListener("click", (e) => {
      const link = e.target.closest(".header .nav .tab, .brand, nav a, .nav a");
      if (!link) return;
      const label = (link.getAttribute("data-nav") || link.textContent || "").trim().toLowerCase();
      if (!label) return;

      // Allow real anchors with href to work normally if present
      if (link.tagName === "A" && link.getAttribute("href")) return;

      e.preventDefault();
      if (label.startsWith("home"))  location.href = "../index.html";
      else if (label.startsWith("menu"))  location.href = "menu.html";
      else if (label.startsWith("orders")) location.href = "orders.html";
      else if (label.startsWith("cart"))   location.href = "cart.html";
    });
  }

  // ----------------- Orders store -----------------
  function readOrders() { return readJSON(ORDERS_KEY, []); }
  function writeOrders(orders) { writeJSON(ORDERS_KEY, orders); }

  function nextOrderNumber() {
    let seq = Number(localStorage.getItem(ORDER_SEQ_KEY) || "1000");
    if (!Number.isFinite(seq)) seq = 1000;
    seq += 1;
    localStorage.setItem(ORDER_SEQ_KEY, String(seq));
    return seq;
  }

  function parseRangeMins(txt) {
    // Accept: "10-15 mins", "10–15 mins", "15 min", "15mins"
    if (!txt) return { lo: 15, hi: 20 };
    const m = txt.match(/(\d+)\s*(?:[–-]\s*(\d+))?\s*min/i);
    if (!m) return { lo: 15, hi: 20 };
    const a = Number(m[1] || 0);
    const b = Number(m[2] || a);
    return { lo: Math.min(a, b), hi: Math.max(a, b) };
  }

  function createOrderFromPending(pending) {
    const items = Array.isArray(pending.items) ? pending.items : [];
    // Duration = max "hi" prep time across items + small buffer
    let maxHi = 0;
    for (const it of items) {
      const { hi } = parseRangeMins(it.time || "");
      if (hi > maxHi) maxHi = hi;
    }
    if (!maxHi) maxHi = 20;
    const durationMs = (maxHi + 5) * 60 * 1000;

    return {
      id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      number: nextOrderNumber(),
      items,
      startTs: pending.createdAt || now(),
      durationMs,
      status: "preparing", // preparing -> ready -> completed
    };
  }

  // If a pending order (set by cart checkout) exists, absorb it
  function absorbPendingOrder() {
    const pending = readJSON(PENDING_KEY, null);
    if (!pending || !Array.isArray(pending.items) || !pending.items.length) return false;

    const orders = readOrders();
    orders.unshift(createOrderFromPending(pending));
    writeOrders(orders);
    localStorage.removeItem(PENDING_KEY);
    return true;
  }

  // ----------------- Verification handling -----------------
  function moveVerifiedToPrevious() {
    const verifiedIds = new Set(readJSON(VERIFIED_KEY, []));
    if (!verifiedIds.size) return false;

    const orders = readOrders();
    let changed = false;
    for (const o of orders) {
      if (verifiedIds.has(o.id) && o.status !== "completed") {
        o.status = "completed";
        changed = true;
      }
    }
    if (changed) writeOrders(orders);
    return changed;
  }

  // ----------------- Rendering -----------------
  function escapeHtml(s = "") {
    return s.replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  }

  function orderCardHTML(o) {
    const itemsLine = o.items.map(it => `${escapeHtml(it.name)} × ${it.qty}`).join(" • ");
    const total = sum(o.items, it => (it.price || 0) * (it.qty || 1));
    const isLive = o.status === "preparing" || o.status === "ready";

    const statusChip =
      o.status === "completed"
        ? `<span class="order-status status-complete">Completed</span>`
        : `<span class="order-status status-live">${o.status === "ready" ? "Ready for Pickup" : "Preparing"}</span>`;

    const progressCol = isLive
      ? `
        <aside class="progress-col">
          <div class="progress-wrap" style="--pct:0%;" data-order-id="${o.id}">
            <div class="progress-fill"></div>
            <div class="progress-glow"></div>
          </div>
        </aside>
      `
      : `<aside class="progress-col"><div style="color:var(--muted);font-size:12px;">—</div></aside>`;

    // Dev-only button (remove in prod)
    const devBtn = isLive
      ? `<button class="dev-verify" data-id="${o.id}"
           style="margin-top:8px;padding:6px 10px;border:1px solid #2a2e35;background:#121418;color:#a9b3ad;border-radius:10px;cursor:pointer">
           Mark Verified (dev)
         </button>`
      : "";

    return `
      <article class="order-card">
        <div>
          <div class="order-head">
            <div>
              <strong>Order #${pad(o.number, 4)}</strong>
              <div class="order-meta">${itemsLine}</div>
            </div>
            ${statusChip}
          </div>
          <ul class="order-items">
            ${o.items.map(it => `<li>${escapeHtml(it.name)} × ${it.qty}</li>`).join("")}
          </ul>
          <div class="order-total">Total: ${INR(total)}</div>
          ${devBtn}
        </div>
        ${progressCol}
      </article>
    `;
  }

  function emptyHTML(text) {
    return `
      <article class="order-card" style="grid-template-columns:1fr; text-align:center;">
        <div class="order-total" style="margin:6px 0 4px">${escapeHtml(text)}</div>
      </article>
    `;
  }

  function render() {
    const liveWrap = $("#live");
    const prevWrap = $("#previous");
    if (!liveWrap || !prevWrap) return;

    const orders = readOrders();
    const live = orders.filter(o => o.status === "preparing" || o.status === "ready");
    const prev = orders.filter(o => o.status === "completed");

    liveWrap.innerHTML = live.length ? live.map(orderCardHTML).join("") : emptyHTML("No live orders.");
    prevWrap.innerHTML = prev.length ? prev.map(orderCardHTML).join("") : emptyHTML("No previous orders.");

    // Bind dev verify buttons once
    $$(".order-card .dev-verify").forEach(btn => {
      btn.addEventListener("click", () => devMarkVerified(btn.dataset.id));
    });

    // (Re)start progress bars for live orders
    live.forEach(o => startProgress(o.id, o.startTs, o.durationMs));
  }

  // ----------------- Progress animation -----------------
  const rafMap = new Map(); // orderId -> rafId

  function startProgress(orderId, startTs, durationMs) {
    cancelProgress(orderId);
    const bar = $(`.progress-wrap[data-order-id="${orderId}"]`);
    if (!bar) return;

    const tick = () => {
      const elapsed = Math.max(0, now() - startTs);
      const pct = Math.min(1, elapsed / durationMs);
      bar.style.setProperty("--pct", `${(pct * 100).toFixed(2)}%`);
      if (pct >= 1) {
        markReady(orderId);
        cancelProgress(orderId);
        return;
      }
      const id = requestAnimationFrame(tick);
      rafMap.set(orderId, id);
    };
    const id = requestAnimationFrame(tick);
    rafMap.set(orderId, id);
  }
  function cancelProgress(orderId) {
    const id = rafMap.get(orderId);
    if (id) cancelAnimationFrame(id);
    rafMap.delete(orderId);
  }

  function markReady(orderId) {
    const orders = readOrders();
    const o = orders.find(x => x.id === orderId);
    if (!o) return;
    if (o.status !== "completed") {
      o.status = "ready";
      writeOrders(orders);
    }
    // Update chip inline (avoid full re-render thrash)
    const card = $(`.progress-wrap[data-order-id="${orderId}"]`)?.closest(".order-card");
    if (card) {
      const chip = card.querySelector(".order-status");
      if (chip) {
        chip.classList.remove("status-complete");
        chip.classList.add("status-live");
        chip.textContent = "Ready for Pickup";
      }
    }
  }

  // ----------------- Dev verification helper -----------------
  function devMarkVerified(orderId) {
    const verified = new Set(readJSON(VERIFIED_KEY, []));
    verified.add(orderId);
    writeJSON(VERIFIED_KEY, Array.from(verified));
    // Trigger storage-like behavior locally
    applyVerificationAndRender();
  }

  function applyVerificationAndRender() {
    const changed = moveVerifiedToPrevious();
    if (changed) render();
  }

  // Apply verification updates coming from staff app (another tab/window)
  window.addEventListener("storage", (e) => {
    if (e.key === VERIFIED_KEY) applyVerificationAndRender();
  });

  // ----------------- Init -----------------
  function init() {
    wireHeaderNav();
    updateCartBadge(); // show cart total in nav immediately

    // Absorb a just-placed order (from cart)
    const absorbed = absorbPendingOrder();
    if (absorbed) updateCartBadge(); // cart would have been cleared by checkout flow

    // Apply any existing verification & render
    moveVerifiedToPrevious();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
