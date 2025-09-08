
(function () {
  // ----------------- Utils -----------------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const CART_KEY = "vpp_canteen_cart";
  const ORDERS_KEY = "vpp_orders";
  const ORDER_SEQ_KEY = "vpp_order_seq";
  const PENDING_KEY = "vpp_pending_order";
  const VERIFIED_KEY = "vpp_verified_orders";

  const CURRENCY = "₹";

  const now = () => Date.now();
  const pad = (n, w = 4) => String(n).padStart(w, "0");
  const INR = (n) => `${CURRENCY}${Number(n || 0).toFixed(0)}`;

  const parseRangeMins = (txt) => {
    // "20–25 mins" | "20-25 mins" | "25 min"
    if (!txt) return { lo: 15, hi: 20 };
    const m = txt.match(/(\d+)\s*(?:[–-]\s*(\d+))?\s*min/i);
    if (!m) return { lo: 15, hi: 20 };
    const a = Number(m[1] || 0);
    const b = Number(m[2] || a);
    return { lo: Math.min(a, b), hi: Math.max(a, b) };
  };

  const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + f(x), 0);

  function readJSON(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  }
  function writeJSON(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  // ----------------- Header links -----------------
  function wireHeader() {
    document.addEventListener("click", (e) => {
      const tab = e.target.closest(".header .nav .tab, .brand");
      if (!tab) return;
      e.preventDefault();
      const txt = tab.textContent.trim().toLowerCase();
      if (txt.startsWith("index")) window.location.href = "../index.html";
      else if (txt.startsWith("menu")) window.location.href = "menu.html";
      else if (txt.startsWith("orders")) window.location.href = "orders.html";
      else if (txt.startsWith("cart")) window.location.href = "cart.html";
      else window.location.href = "../index.html";
    });
  }

  // ----------------- Orders store -----------------
  function readOrders() {
    return readJSON(ORDERS_KEY, []);
  }
  function writeOrders(orders) {
    writeJSON(ORDERS_KEY, orders);
  }
  function nextOrderNumber() {
    let seq = Number(localStorage.getItem(ORDER_SEQ_KEY) || "1000");
    seq += 1;
    localStorage.setItem(ORDER_SEQ_KEY, String(seq));
    return seq;
  }

  // Turn a "pending order" into a live order object
  function createOrderFromPending(pending) {
    const items = pending.items || [];
    // duration: highest 'hi' time across items + 5 minutes buffer
    let maxHi = 0;
    items.forEach((it) => {
      const { hi } = parseRangeMins(it.time || "");
      if (hi > maxHi) maxHi = hi;
    });
    if (!maxHi) maxHi = 20; // sane default
    const durationMs = (maxHi + 5) * 60 * 1000;

    const number = nextOrderNumber();
    return {
      id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      number,
      items,
      startTs: pending.createdAt || now(),
      durationMs,
      status: "preparing", // preparing -> ready -> completed
    };
  }

  // Accept pending order if present (set by cart.js at checkout)
  function absorbPendingOrder() {
    const pending = readJSON(PENDING_KEY, null);
    if (!pending || !Array.isArray(pending.items) || !pending.items.length) return;

    const orders = readOrders();
    const o = createOrderFromPending(pending);
    orders.unshift(o);
    writeOrders(orders);

    localStorage.removeItem(PENDING_KEY); // clear pending
  }

  // Listen for staff verification from another app (localStorage)
  function wireVerificationListener() {
    window.addEventListener("storage", (e) => {
      if (e.key !== VERIFIED_KEY) return;
      moveVerifiedToPrevious();
    });
  }
  function moveVerifiedToPrevious() {
    const verified = new Set(readJSON(VERIFIED_KEY, []));
    if (!verified.size) return;

    const orders = readOrders();
    let changed = false;
    orders.forEach((o) => {
      if (verified.has(o.id)) {
        if (o.status !== "completed") {
          o.status = "completed";
          changed = true;
        }
      }
    });
    if (changed) {
      writeOrders(orders);
      render();
    }
  }

  // ----------------- Rendering -----------------
  function render() {
    const liveWrap = $("#live");
    const prevWrap = $("#previous");
    if (!liveWrap || !prevWrap) return;

    const orders = readOrders();
    const live = orders.filter((o) => o.status === "preparing" || o.status === "ready");
    const prev = orders.filter((o) => o.status === "completed");

    liveWrap.innerHTML = live.length ? live.map(orderCardHTML).join("") : emptyHTML("No live orders yet.");
    prevWrap.innerHTML = prev.length ? prev.map(orderCardHTML).join("") : emptyHTML("No previous orders.");

    // Start/refresh progress animations
    live.forEach((o) => startProgress(o.id, o.startTs, o.durationMs));

    // Dev-only: wire “Mark Verified” buttons (remove when staff app is ready)
    $$(".order-card .dev-verify").forEach((btn) => {
      btn.addEventListener("click", () => devMarkVerified(btn.dataset.id));
    });
  }

  function emptyHTML(text) {
    return `
      <article class="order-card" style="grid-template-columns:1fr; text-align:center;">
        <div class="order-total" style="margin:6px 0 4px">${text}</div>
      </article>
    `;
  }

  function orderCardHTML(o) {
    const itemsLine = o.items.map(it => `${escapeHtml(it.name)} × ${it.qty}`).join(" • ");
    const total = sum(o.items, it => (it.price || 0) * (it.qty || 1));
    const isLive = o.status === "preparing" || o.status === "ready";

    const statusChip =
      o.status === "completed"
        ? `<span class="order-status status-complete">Completed</span>`
        : `<span class="order-status status-live">${o.status === "ready" ? "Ready for Pickup" : "Preparing"}</span>`;

    // progress column shown only for live
    const progressCol = isLive
      ? `
      <aside class="progress-col">
        <div class="progress-wrap" style="--pct:0%;" data-order-id="${o.id}">
          <div class="progress-fill"></div>
          <div class="progress-glow"></div>
          <!-- Percentage chip intentionally removed per requirement -->
        </div>
      </aside>`
      : `<aside class="progress-col"><div style="color:var(--muted);font-size:12px;">—</div></aside>`;

    // Dev-only verify button for local testing
    const devVerifyBtn = isLive
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
          ${devVerifyBtn}
        </div>
        ${progressCol}
      </article>
    `;
  }

  function escapeHtml(s = "") {
    return s.replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  }

  // ----------------- Progress animation -----------------
  const rafMap = new Map(); // orderId -> raf handle

  function startProgress(orderId, startTs, durationMs) {
    const bar = $(`.progress-wrap[data-order-id="${orderId}"]`);
    if (!bar) return;

    cancelProgress(orderId);

    const tick = () => {
      const t = now();
      const elapsed = Math.max(0, t - startTs);
      const pct = Math.min(1, elapsed / durationMs);
      bar.style.setProperty("--pct", `${(pct * 100).toFixed(2)}%`);

      // when done, flip to "Ready for Pickup"
      if (pct >= 1) {
        markReady(orderId);
        cancelProgress(orderId);
        return;
      }
      const h = requestAnimationFrame(tick);
      rafMap.set(orderId, h);
    };
    const h = requestAnimationFrame(tick);
    rafMap.set(orderId, h);
  }

  function cancelProgress(orderId) {
    const h = rafMap.get(orderId);
    if (h) cancelAnimationFrame(h);
    rafMap.delete(orderId);
  }

  function markReady(orderId) {
    const orders = readOrders();
    const o = orders.find(x => x.id === orderId);
    if (!o) return;
    if (o.status !== "completed") o.status = "ready";
    writeOrders(orders);
    // update the status chip inline without re-rendering everything
    const card = findCard(orderId);
    if (card) {
      const chip = card.querySelector(".order-status");
      if (chip) {
        chip.classList.remove("status-live");
        chip.textContent = "Ready for Pickup";
        chip.classList.add("status-live");
      }
    }
  }

  function findCard(orderId) {
    const bar = $(`.progress-wrap[data-order-id="${orderId}"]`);
    return bar ? bar.closest(".order-card") : null;
  }

  // ----------------- Dev-only: mark verified locally -----------------
  function devMarkVerified(orderId) {
    const verified = new Set(readJSON(VERIFIED_KEY, []));
    verified.add(orderId);
    writeJSON(VERIFIED_KEY, Array.from(verified));
    moveVerifiedToPrevious();
  }

  // ----------------- Init -----------------
  function init() {
    wireHeader();

    // If Cart set a pending order, absorb it into live orders:
    absorbPendingOrder();

    // Apply verification updates (if any existing)
    moveVerifiedToPrevious();

    // Render lists + start progress
    render();

    // Listen for verification coming from staff app via storage event
    wireVerificationListener();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
