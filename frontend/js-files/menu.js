// menu.js — VPP Canteen (robust, single-source-of-truth, a11y-friendly)
(() => {
  "use strict";

  // -------------------- Constants & tiny utils --------------------
  const CART_KEY  = "vpp_canteen_cart";
  const CURRENCY  = "₹";
  const BADGE_MAX = 99;

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const num = (t) => Number(String(t ?? "").replace(/[^\d.]/g, "")) || 0;

  const slug = (s = "") =>
    s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");

  const INR = (n) => `${CURRENCY}${Number(n || 0).toFixed(0)}`;

  // ID must be stable & unique across menu pages; include name, price, and a tail
  const safeId = (name, price, img = "", extra = "") => {
    const tail = (img.split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "");
    const base = `${slug(name || "item")}--${Number(price || 0)}`;
    const parts = [base];
    if (tail) parts.push(slug(tail));
    if (extra) parts.push(slug(extra));
    return parts.join("--");
  };

  // -------------------- Cart (single source of truth) --------------------
  function readCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CART_KEY));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateBadge(cart);
  }

  // Total quantity across all items
  function totalQty(cart = readCart()) {
    return cart.reduce((s, it) => s + (it.qty || 0), 0);
  }

  // Count of unique line items
  function uniqueCount(cart = readCart()) {
    return cart.length;
  }

  function addToCart(item, qty = 1) {
    const cart = readCart();
    const idx = cart.findIndex((x) => x.id === item.id);

    if (idx >= 0) {
      cart[idx].qty = Math.max(1, (cart[idx].qty || 0) + qty);
    } else {
      cart.push({ ...item, qty: Math.max(1, qty || 1) });
    }

    writeCart(cart);
    toast(`${item.name} added to cart`);
  }

  // -------------------- Header routing --------------------
  function wireHeader() {
    document.addEventListener(
      "click",
      (e) => {
        const tab = e.target.closest(".header .nav .tab, .brand, a[data-tab]");
        if (!tab) return;
        e.preventDefault();

        const dataTab = tab.getAttribute("data-tab")?.toLowerCase();
        const txt = (tab.textContent || "").trim().toLowerCase();
        const key = dataTab || txt;

        if (key.startsWith("index") || key.includes("home")) location.href = "../index.html";
        else if (key.startsWith("menu"))                    location.href = "menu.html";
        else if (key.startsWith("orders"))                  location.href = "orders.html";
        else if (key.startsWith("cart"))                    location.href = "cart.html";
        else                                                location.href = "../index.html";
      },
      { passive: true }
    );
  }

  // -------------------- Badge (unique items; tooltip shows qty) --------------------
  function findCartTab() {
    // Prefer explicit data attribute
    let tab = $('.nav .tab[data-tab="cart"]');
    if (tab) return tab;

    // Try common href to cart.html
    tab = $$('.nav .tab').find((t) => (t.getAttribute("href") || "").includes("cart.html"));
    if (tab) return tab;

    // Fallback to text contains "cart"
    return $$('.nav .tab').find((t) => (t.textContent || "").toLowerCase().includes("cart")) || null;
  }

  function ensureCartBadge() {
    const tab = findCartTab();
    if (!tab) return null;

    let badge = tab.querySelector(".badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "badge";
      badge.style.cssText =
        "margin-left:6px; min-width:18px; padding:0 6px; border-radius:10px; font-size:12px; line-height:18px; text-align:center; background:#111827; color:#fff; display:inline-block; visibility:hidden;";
      tab.appendChild(badge);
    }
    return badge;
  }

  function updateBadge(cart = readCart()) {
    const badge = ensureCartBadge();
    const tab = findCartTab();
    if (!badge || !tab) return;

    const uniques = uniqueCount(cart);
    const qty = totalQty(cart);

    badge.textContent = uniques > BADGE_MAX ? `${BADGE_MAX}+` : String(uniques);
    badge.style.visibility = uniques ? "visible" : "hidden";

    const label = `Cart: ${uniques} unique item${uniques === 1 ? "" : "s"} (${qty} total)`;
    badge.setAttribute("aria-label", label);
    tab.setAttribute("title", label);
  }

  // Keep badge in sync across tabs/pages
  function wireBadgeSync() {
    window.addEventListener("storage", (e) => {
      if (e.key === CART_KEY) updateBadge();
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) updateBadge();
    });
    window.addEventListener("pageshow", () => updateBadge());
  }

  // -------------------- Toast --------------------
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

  function toast(msg, ms = 1400) {
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

  // -------------------- Modal (detail inside iframe) --------------------
  function ensureModal() {
    let modal = $("#menu-item-modal");
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

    modal.addEventListener("click", (e) => {
      if (e.target === modal) hideModal();
    });
    modal.querySelector("#mi-close").addEventListener("click", hideModal);
    return modal;
  }

  function showDetailInModal(url) {
    const modal = ensureModal();
    const frame = modal.querySelector("#mi-frame");
    frame.src = url;
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function hideModal() {
    const modal = $("#menu-item-modal");
    if (!modal) return;
    const frame = modal.querySelector("#mi-frame");
    if (frame) frame.src = "about:blank";
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // -------------------- Flip (kept simple & safe) --------------------
  function wireFlip() {
    const book = $("#book");
    const right = $("#page-right");
    if (!book || !right) return;

    let flipped = false;
    const setAria = () => right.setAttribute("aria-hidden", (!flipped).toString());
    setAria();

    book.addEventListener(
      "click",
      (e) => {
        if (e.target.closest("button, a, [data-action]")) return;
        const rect = book.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const half = rect.width / 2;
        if (!flipped && x > half) {
          right.classList.add("flipped");
          flipped = true;
        } else if (flipped && x < half) {
          right.classList.remove("flipped");
          flipped = false;
        }
        setAria();
      },
      { passive: true }
    );
  }

  // -------------------- Filters --------------------
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

    filters.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest(".chip");
        if (!btn) return;
        apply(btn.dataset.filter);
      },
      { passive: true }
    );

    apply("all");
  }

  // -------------------- Extract item data robustly --------------------
  function getItemDataFrom(targetEl) {
    const container = targetEl.closest(".menu-item") || targetEl;
    const ds = container.dataset || {};

    const name  = (ds.name ?? container.querySelector(".name")?.textContent ?? "").trim();
    const price = num(ds.price ?? container.querySelector(".price")?.textContent ?? 0);
    const imgEl = container.querySelector("img");
    const img   = ds.img || (imgEl ? imgEl.getAttribute("src") || "" : "");
    const veg   = ds.veg ?? (container.classList.contains("veg") ? "veg" :
                              container.classList.contains("non-veg") ? "non-veg" : "");

    // Add a tiny extra discriminator from DOM (like a data-sku or index) to avoid rare collisions
    const extra = ds.sku || ds.id || container.getAttribute("id") || "";

    const id = ds.id || safeId(name, price, img, extra);

    return {
      id,
      name: name || "Item",
      price: price || 0,
      img,
      veg,
    };
  }

  // -------------------- Menu interactions --------------------
  function wireMenu() {
    // Open detail page inside modal on card click (not on add/controls)
    document.addEventListener("click", (e) => {
      const card = e.target.closest(".menu-item");
      if (!card) return;

      // If click was on an actionable control, don't open modal
      if (e.target.closest(".add, .add-to-cart, [data-action='add-to-cart'], button, .qty, .price")) return;

      const name = (card.querySelector(".name")?.textContent || "item").trim();
      const fileName = `${slug(name)}.html`;
      const url = `food-items-files/${fileName}`;
      showDetailInModal(url);
    });

    // Add-to-cart via button (supports multiple selectors)
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".add, .add-to-cart, [data-action='add-to-cart']");
      if (!btn) return;

      // Prevent the card click from also firing (which could open modal inadvertently)
      e.preventDefault();
      e.stopPropagation();

      const data = getItemDataFrom(btn);
      if (!data.price || !data.name) {
        toast("Unable to add this item (missing name/price)");
        return;
      }
      addToCart(data, 1);
    });

    // Keyboard: Enter/Space on .menu-item triggers modal
    document.addEventListener("keydown", (e) => {
      const el = e.target;
      if (!el || !el.classList || !el.classList.contains("menu-item")) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const name = (el.querySelector(".name")?.textContent || "item").trim();
        const fileName = `${slug(name)}.html`;
        const url = `food-items-files/${fileName}`;
        showDetailInModal(url);
      }
    });
  }

  // -------------------- Init (idempotent) --------------------
  function init() {
    if (window.__menuInitDone) return;
    window.__menuInitDone = true;

    wireHeader();
    wireBadgeSync();
    updateBadge(); // render badge immediately

    wireFlip();
    wireFilters();
    wireMenu();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
