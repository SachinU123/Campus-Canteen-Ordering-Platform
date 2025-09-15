<<<<<<< HEAD
=======
// /js-files/menu.js  (rewrite: keep modal popup on card click, richer details)
>>>>>>> 83c2bea014322e231824092f664e0d7f4efc0a42
(function () {
  // --------------- Utils ---------------
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const CART_KEY = "vpp_canteen_cart";
  const CURRENCY = "₹";
  const INR = (n) => `${CURRENCY}${Number(n || 0).toFixed(0)}`;
  const parsePriceText = (t) => Number((t || "").replace(/[^\d.]/g, "") || 0);
<<<<<<< HEAD
  const safeId = (name, price) =>
    `${(name || "item").toLowerCase().replace(/\s+/g, "-")}--${Number(price || 0)}`;
=======
  const safeId = (name, price) => `${(name || "item").toLowerCase().replace(/\s+/g, "-")}--${Number(price || 0)}`;
  const capitalize = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);
>>>>>>> 83c2bea014322e231824092f664e0d7f4efc0a42

  // --------------- Cart ---------------
  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
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
  function updateBadge(cart = readCart()) {
    const badge = $(".nav .tab.active .badge") || $(".nav .tab .badge");
    if (!badge) return;
    const n = totalQty(cart);
    badge.textContent = n > 99 ? "99+" : String(n);
    badge.style.visibility = n ? "visible" : "hidden";
  }

  // --------------- Header links ---------------
  function wireHeader() {
    document.addEventListener("click", (e) => {
      const tab = e.target.closest(".header .nav .tab, .brand");
      if (!tab) return;
      e.preventDefault();
      const txt = tab.textContent.trim().toLowerCase();
      if (txt.startsWith("home"))   window.location.href = "/frontend";
      else if (txt.startsWith("menu"))   window.location.href = "menu.html";
      else if (txt.startsWith("orders")) window.location.href = "orders.html";
      else if (txt.startsWith("cart"))   window.location.href = "cart.html";
    });
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
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(10px)";
      setTimeout(() => el.remove(), 200);
    }, ms);
  }

  // --------------- Catalog helpers (optional) ---------------
  const hasCatalog = typeof window.getItem === "function" && typeof window.allItems === "function";
  function findCatalogByName(name) {
    if (!hasCatalog || !name) return null;
    const want = name.trim().toLowerCase();
    return window.allItems().find(it => (it.name||"").trim().toLowerCase() === want) || null;
  }

  // --------------- Modal (Detailed Food Card) ---------------
  function ensureModal() {
    let modal = $("#menu-item-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "menu-item-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.style.cssText =
<<<<<<< HEAD
      "position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:10000;";
=======
      "position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;z-index:10000;";
>>>>>>> 83c2bea014322e231824092f664e0d7f4efc0a42
    modal.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="mi-title"
           style="background:#0f1316;color:#e8f2ec;max-width:620px;width:94%;border-radius:18px;border:1px solid #2a2e35;box-shadow:0 22px 70px rgba(0,0,0,.45);overflow:hidden">
        <div id="mi-hero" style="height:200px;background:#0b0f12;display:flex;align-items:center;justify-content:center">
          <span style="opacity:.6">No image</span>
        </div>

        <div style="padding:16px 18px 18px">
          <div style="display:flex;align-items:start;gap:12px">
            <div id="mi-badge" title="Veg/Non-veg" style="width:12px;height:12px;border-radius:3px;margin-top:6px;background:#21c55d;box-shadow:0 0 10px rgba(33,197,93,.6)"></div>
            <div style="flex:1">
              <h3 id="mi-title" style="margin:0 0 6px;font-size:22px;line-height:1.25"></h3>
              <div id="mi-meta" class="muted" style="font-size:13px;color:#9fb8aa"></div>
            </div>
            <div id="mi-price" style="font-weight:800;font-size:20px;white-space:nowrap"></div>
          </div>

          <p id="mi-desc" style="margin:10px 0 14px;color:#cfe6dc;display:none"></p>

          <div style="display:flex;gap:10px;align-items:center;justify-content:flex-end">
            <div class="qty" style="display:flex;gap:8px;align-items:center;margin-right:auto">
              <button id="mi-dec" aria-label="Decrease"
                      style="border:1px solid #2a2e35;background:#0b0f12;border-radius:10px;padding:6px 10px;cursor:pointer">−</button>
              <span id="mi-qty" aria-live="polite" style="min-width:22px;text-align:center">1</span>
              <button id="mi-inc" aria-label="Increase"
                      style="border:1px solid #2a2e35;background:#0b0f12;border-radius:10px;padding:6px 10px;cursor:pointer">+</button>
            </div>
            <a id="mi-details" href="#" target="_blank" rel="noopener"
               style="display:none;padding:8px 12px;border-radius:10px;border:1px solid #2a2e35;background:#0b0f12;color:#cdeee0;text-decoration:none">Open details page</a>
            <button id="mi-cancel" style="padding:8px 12px;border-radius:10px;border:1px solid #2a2e35;background:#0b0f12;color:#e8f2ec;cursor:pointer">Close</button>
            <button id="mi-add" style="padding:8px 14px;border-radius:10px;border:none;background:linear-gradient(90deg,#00ff80,#43ffa9);color:#032012;cursor:pointer;font-weight:800">Add to Cart</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => { if (e.target === modal) hideModal(); });
    $("#mi-cancel", modal).addEventListener("click", hideModal);

    const q = $("#mi-qty", modal);
    $("#mi-dec", modal).addEventListener("click", () => { q.textContent = String(Math.max(1, Number(q.textContent) - 1)); });
    $("#mi-inc", modal).addEventListener("click", () => { q.textContent = String(Number(q.textContent) + 1); });

    return modal;
  }

  let modalItem = null;

  function showModal(item) {
    const modal = ensureModal();
    modalItem = item;

    const hero   = $("#mi-hero", modal);
    const title  = $("#mi-title", modal);
    const meta   = $("#mi-meta", modal);
    const price  = $("#mi-price", modal);
    const qty    = $("#mi-qty", modal);
    const addBtn = $("#mi-add", modal);
    const badge  = $("#mi-badge", modal);
    const desc   = $("#mi-desc", modal);
    const link   = $("#mi-details", modal);

<<<<<<< HEAD
    hero.className = "";
    hero.style.background = "#f3f4f6";
=======
    // Image
    hero.innerHTML = "";
    if (item.img) {
      const img = new Image();
      img.src = item.img;
      img.alt = item.name;
      img.style = "width:100%;height:100%;object-fit:cover;";
      hero.appendChild(img);
    } else {
      hero.innerHTML = `<span style="opacity:.6">No image</span>`;
    }
>>>>>>> 83c2bea014322e231824092f664e0d7f4efc0a42

    // Main texts
    title.textContent = item.name;
    const chips = [];
    chips.push(item.veg ? "🟢 Veg" : "🟠 Non-Veg");
    if (item.eta)    chips.push(item.eta);
    if (item.rating) chips.push(`★ ${item.rating}`);
    meta.textContent = chips.join(" · ") || "—";

    price.textContent = INR(item.price || 0);
    qty.textContent = "1";

    // Badge color
    badge.style.background = item.veg ? "#21c55d" : "#ff7043";
    badge.style.boxShadow  = item.veg ? "0 0 10px rgba(33,197,93,.6)" : "0 0 10px rgba(255,112,67,.6)";

    // Desc
    if (item.description) {
      desc.textContent = item.description;
      desc.style.display = "block";
    } else {
      desc.style.display = "none";
    }

    // Details link (to per-item HTML) if catalog provides it
    if (hasCatalog) {
      const ref = window.getItem?.(item.id) || findCatalogByName(item.name);
      const url = ref ? window.getItemUrl?.(ref.id) : null;
      if (url) {
        link.href = url;
        link.style.display = "inline-block";
      } else {
        link.style.display = "none";
      }
    } else {
      link.style.display = "none";
    }

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

  // --------------- Flip logic (multi-page) ---------------
  function wireFlip() {
    const book = $("#book");
    const pages = $$(".page", book);
    if (!book || !pages.length) return;

    let current = 0; // current flip stage (0 = Breakfast/Meals, 1 = Snacks/Beverages)

    function updateFlip() {
      pages.forEach((p, i) => {
        if (i <= current * 2 - 1) {
          p.classList.add("flipped");
        } else {
          p.classList.remove("flipped");
        }
      });
    }

    book.addEventListener("click", (e) => {
<<<<<<< HEAD
      if (e.target.closest("button") || e.target.closest("a")) return;
=======
      if ((e.target.closest("button") || e.target.closest("a") || e.target.closest(".menu-item"))) return;
>>>>>>> 83c2bea014322e231824092f664e0d7f4efc0a42
      const rect = book.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const half = rect.width / 2;

      if (x > half && current < 1) {
        current++;
        updateFlip();
      } else if (x < half && current > 0) {
        current--;
        updateFlip();
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

<<<<<<< HEAD
    apply("all");
=======
    apply("all"); // default
>>>>>>> 83c2bea014322e231824092f664e0d7f4efc0a42
  }

  // --------------- Menu Item → Modal (keep popup) ---------------
  function wireMenuClicks() {
    document.addEventListener("click", (e) => {
      const el = e.target.closest(".menu-item");
      if (!el) return;

      const name = $(".name", el)?.textContent?.trim() || "Item";
      const price = parsePriceText($(".price", el)?.textContent || "0");
<<<<<<< HEAD
      const category =
        ["breakfast", "meals", "snacks", "beverages"].find((c) =>
          el.classList.contains(c)
        ) || "";
      const id = safeId(name, price);
=======
      const category = (["breakfast","meals","snacks","beverages"].find(c => el.classList.contains(c))) || "";
>>>>>>> 83c2bea014322e231824092f664e0d7f4efc0a42

      // Build item from DOM first
      let item = {
        id: safeId(name, price),
        name,
        price,
        category,
        veg: true,
        description: "",
        rating: "",
        eta: "",
        img: ""
      };

      // If catalog exists, enrich item (id/name match)
      if (hasCatalog) {
        const ref = window.getItem?.(item.id) || findCatalogByName(name);
        if (ref) {
          item = {
            ...item,
            id: ref.id || item.id,
            name: ref.name || item.name,
            price: Number(ref.price ?? item.price),
            veg: !!ref.veg,
            description: ref.description || item.description,
            rating: ref.rating || item.rating,
            eta: ref.eta || item.eta,
            img: ref.img || item.img
          };
        }
      }

      // Always open modal (no navigation)
      showModal(item);
    });

<<<<<<< HEAD
=======
    // Keyboard a11y: open modal on Enter/Space
>>>>>>> 83c2bea014322e231824092f664e0d7f4efc0a42
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

  // --------------- Init ---------------
  function init() {
    wireHeader();
    wireFlip();
    wireFilters();
    wireMenuClicks();
    updateBadge();
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
