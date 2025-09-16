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
      if (txt.startsWith("index")) window.location.href = "../index.html";
      else if (txt.startsWith("menu")) window.location.href = "menu.html";
      else if (txt.startsWith("orders")) window.location.href = "orders.html";
      else if (txt.startsWith("cart")) window.location.href = "cart.html";
      else window.location.href = "../index.html";
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
// ===== Modal that hosts an IFRAME with the detail page =====
function ensureModal() {
  let modal = document.getElementById("menu-item-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "menu-item-modal";
  modal.setAttribute("aria-hidden", "true");
  modal.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,.55);
    display:none; align-items:center; justify-content:center; z-index:10000;
  `;
  modal.innerHTML = `
    <div role="dialog" aria-modal="true" aria-label="Item details"
         style="background:#fff; width:min(980px, 96vw); height:min(86vh, 900px);
                border-radius:18px; box-shadow:0 20px 60px rgba(0,0,0,.35);
                display:flex; flex-direction:column; overflow:hidden">
      <div style="display:flex; align-items:center; gap:10px; padding:10px 12px; border-bottom:1px solid #e5e7eb;">
        <strong style="font-family:Inter,system-ui; font-size:16px">Item Details</strong>
        <button id="mi-close"
                style="margin-left:auto; padding:8px 12px; border-radius:10px; border:1px solid #e5e7eb; background:#fff; cursor:pointer">
          Close
        </button>
      </div>
      <iframe id="mi-frame" title="Item detail"
              style="width:100%; height:100%; border:0; background:#fff"></iframe>
    </div>
  `;
  document.body.appendChild(modal);

  // close on backdrop click
  modal.addEventListener("click", (e) => { if (e.target === modal) hideModal(); });
  modal.querySelector("#mi-close").addEventListener("click", hideModal);

  return modal;
}

function showDetailInModal(url) {
  const modal = ensureModal();
  const frame = modal.querySelector("#mi-frame");
  frame.src = url;                    // <-- your page loads here with its own CSS/JS
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
}

function hideModal() {
  const modal = document.getElementById("menu-item-modal");
  if (!modal) return;
  const frame = modal.querySelector("#mi-frame");
  if (frame) frame.src = "about:blank"; // unload page on close
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
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

    // Get the item name from the clicked menu item
    const name = (el.querySelector(".name")?.textContent || "item").trim();

    // Convert name -> filename (e.g., "Alu Mutter" -> "alu-mutter.html")
    const fileName = name.toLowerCase().replace(/\s+/g, "-") + ".html";

    // Adjust path based on your folder structure
    const url = "food-items-files/" + fileName;

    // Open the detail page inside the popup iframe
    showDetailInModal(url);
  });

  // Keyboard accessibility: Enter/Space opens modal
  document.querySelectorAll(".menu-item").forEach((el) => {
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    el.setAttribute("role", "link");
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
