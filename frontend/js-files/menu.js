
(function () {
  // --------------- Utils ---------------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const CART_KEY = "vpp_canteen_cart";
  const CURRENCY = "₹";

  const INR = (n) => `${CURRENCY}${Number(n || 0).toFixed(0)}`;
  const parsePriceText = (t) => Number((t || "").replace(/[^\d.]/g, "") || 0);
  const safeId = (name, price) => `${(name || "item").toLowerCase().replace(/\s+/g, "-")}--${Number(price || 0)}`;

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
  function addToCart(item, qty = 1) {
    const cart = readCart();
    const i = cart.findIndex((x) => x.id === item.id);
    if (i >= 0) cart[i].qty += qty;
    else cart.push({ ...item, qty });
    writeCart(cart);
    toast(`${item.name} added to cart`);
  }
  function totalQty(cart = readCart()) {
    return cart.reduce((s, it) => s + (it.qty || 0), 0);
  }

  // --------------- Header routing + badge ---------------
  function wireHeader() {
    document.addEventListener("click", (e) => {
      const tab = e.target.closest(".header .nav .tab, .brand");
      if (!tab) return;
      e.preventDefault();
      const txt = tab.textContent.trim().toLowerCase();
      if (txt.startsWith("home")) window.location.href = "home.html";
      else if (txt.startsWith("menu")) window.location.href = "menu.html";
      else if (txt.startsWith("orders")) window.location.href = "orders.html";
      else if (txt.startsWith("cart")) window.location.href = "cart.html";
      else window.location.href = "home.html";
    });
  }

  function updateBadge(cart = readCart()) {
    const badge = $(".nav .tab.active .badge") || $(".nav .tab .badge");
    if (!badge) return;
    const n = totalQty(cart);
    badge.textContent = n > 99 ? "99+" : String(n);
    badge.style.visibility = n ? "visible" : "hidden";
  }

  // --------------- Toast ---------------
  function ensureToastHost() {
    let host = $("#toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.style.cssText =
        "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:8px;z-index:9999;";
      document.body.appendChild(host);
    }
    return host;
  }
  function toast(msg, ms = 1600) {
    const host = ensureToastHost();
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.cssText =
      "background:#111827;color:#fff;padding:10px 14px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.25);font-size:14px;opacity:0;transition:opacity .2s, transform .2s;transform:translateY(10px)";
    host.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(10px)"; setTimeout(() => el.remove(), 200); }, ms);
  }

  // --------------- Modal (Item Details) ---------------
  function ensureModal() {
    let modal = $("#menu-item-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "menu-item-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:10000;";
    modal.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="mi-title"
           style="background:#fff;max-width:560px;width:92%;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden">
        <div id="mi-hero" style="height:150px;background:#f3f4f6"></div>
        <div style="padding:16px 18px 18px">
          <h3 id="mi-title" style="margin:0 0 6px;font-size:20px"></h3>
          <div id="mi-meta" class="muted" style="font-size:14px;margin:0 0 10px"></div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
            <div id="mi-price" style="font-weight:700;font-size:18px"></div>
            <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
              <button id="mi-dec" aria-label="Decrease" style="border:1px solid #e5e7eb;background:#fff;border-radius:8px;padding:6px 8px;cursor:pointer">−</button>
              <span id="mi-qty" aria-live="polite" style="min-width:22px;text-align:center">1</span>
              <button id="mi-inc" aria-label="Increase" style="border:1px solid #e5e7eb;background:#fff;border-radius:8px;padding:6px 8px;cursor:pointer">+</button>
            </div>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end">
            <button id="mi-cancel" style="padding:8px 12px;border-radius:10px;border:1px solid #e5e7eb;background:#fff;cursor:pointer">Close</button>
            <button id="mi-add" style="padding:8px 14px;border-radius:10px;border:none;background:#111827;color:#fff;cursor:pointer">Add to Cart</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) hideModal();
    });
    $("#mi-cancel", modal).addEventListener("click", hideModal);

    $("#mi-dec", modal).addEventListener("click", () => {
      const q = $("#mi-qty");
      const n = Math.max(1, Number(q.textContent) - 1);
      q.textContent = String(n);
    });
    $("#mi-inc", modal).addEventListener("click", () => {
      const q = $("#mi-qty");
      const n = Number(q.textContent) + 1;
      q.textContent = String(n);
    });

    return modal;
  }

  let modalItem = null;

  function showModal(item) {
    const modal = ensureModal();
    modalItem = item;

    const hero = $("#mi-hero", modal);
    const title = $("#mi-title", modal);
    const meta = $("#mi-meta", modal);
    const price = $("#mi-price", modal);
    const qty = $("#mi-qty", modal);
    const addBtn = $("#mi-add", modal);

    // Basic hero: if you add CSS bg by class (e.g., .pancakes-hero) set hero.className = that
    hero.className = "";
    hero.style.background = "#f3f4f6";

    title.textContent = item.name;
    meta.textContent = item.category ? `${capitalize(item.category)} · ★ 4.5` : "★ 4.5";
    price.textContent = INR(item.price);
    qty.textContent = "1";

    addBtn.onclick = () => {
      const n = Number(qty.textContent) || 1;
      addToCart(item, n);
      hideModal();
    };

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
  }

  function hideModal() {
    const modal = $("#menu-item-modal");
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    modalItem = null;
  }

  // --------------- Flip logic ---------------
  function wireFlip() {
    const book = $("#book");
    const right = $("#page-right");
    if (!book || !right) return;

    let flipped = false;
    const setAria = () => right.setAttribute("aria-hidden", (!flipped).toString());
    setAria();

    book.addEventListener("click", (e) => {
      if ((e.target.closest("button") || e.target.closest("a"))) return;
      const rect = book.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const half = rect.width / 2;
      if (!flipped && x > half) {
        right.classList.add("flipped");
        flipped = true;
        setAria();
      } else if (flipped && x < half) {
        right.classList.remove("flipped");
        flipped = false;
        setAria();
      }
    });
  }

  // --------------- Filters ---------------
  function wireFilters() {
    const filters = $("#filters");
    if (!filters) return;
    const chips = $$(".chip", filters);
    const items = $$(".menu-item");

    function apply(filter) {
      chips.forEach((c) => {
        const active = c.dataset.filter === filter;
        c.classList.toggle("active", active);
        c.setAttribute("aria-selected", active ? "true" : "false");
      });
      items.forEach((el) => {
        const show = filter === "all" || el.classList.contains(filter);
        el.style.display = show ? "flex" : "none";
      });
    }

    filters.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      apply(btn.dataset.filter);
    });

    // default
    apply("all");
  }

  // --------------- Menu Item -> Modal ---------------
  function wireMenuClicks() {
    document.addEventListener("click", (e) => {
      const el = e.target.closest(".menu-item");
      if (!el) return;

      const name = $(".name", el)?.textContent?.trim() || "Item";
      const price = parsePriceText($(".price", el)?.textContent || "0");
      const category = (["breakfast","meals","snacks","beverages"].find(c => el.classList.contains(c))) || "";
      const id = safeId(name, price);

      const item = { id, name, price, category, veg: true, desc: "" };
      showModal(item);
    });

    // Keyboard: Enter/Space opens modal
    $$(".menu-item").forEach((el) => {
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          el.click();
        }
      });
    });
  }

  // --------------- Helpers ---------------
  const capitalize = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);

  // --------------- Init ---------------
  function init() {
    wireHeader();
    wireFlip();
    wireFilters();
    wireMenuClicks();
    updateBadge();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
