// js-files/food-items.js — modal-safe add (postMessage), robust IDs, absolute images, fallback local add
(function () {
  // ---------------- Helpers ----------------
  const $ = (s, ctx = document) => ctx.querySelector(s);
  const text = (sel) => (document.querySelector(sel)?.textContent || "").trim();
  const num = (t) => Number(String(t || "").replace(/[^\d.]/g, "")) || 0;
  const slugify = (s = "") => s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
  const INR = (n) => `₹${Number(n || 0).toFixed(0)}`;

  function toAbsoluteURL(src = "") {
    try { return new URL(src, document.baseURI).href; }
    catch { return src || "/assets/images/food/placeholder.png"; }
  }
  function basenameNoExt(url = "") {
    try {
      const u = new URL(url, document.baseURI);
      const base = u.pathname.split("/").pop() || "";
      return base.replace(/\.[a-z0-9]+$/i, "");
    } catch {
      const base = (url.split("/").pop() || "");
      return base.replace(/\.[a-z0-9]+$/i, "");
    }
  }

  // ---------------- Cart fallback (only used when not inside our modal/parent) ----------------
  const CART_KEY = "vpp_canteen_cart";
  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { return []; }
  }
  function writeCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    // Update badge if the page actually has a .cart-btn (standalone viewing)
    const cartBtn = document.querySelector(".cart-btn");
    if (cartBtn) {
      const unique = cart.filter(it => (Number(it?.qty) || 0) > 0).length;
      let badge = cartBtn.querySelector(".cart-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "cart-badge";
        badge.style.cssText =
          "display:inline-flex;min-width:18px;height:18px;padding:0 5px;border-radius:9px;align-items:center;justify-content:center;font-size:11px;background:#e11d48;color:#fff;margin-left:6px;line-height:18px;";
        cartBtn.appendChild(badge);
      }
      badge.textContent = unique > 99 ? "99+" : String(unique);
      badge.style.visibility = unique ? "visible" : "hidden";
    }
  }
  function addToCartFallback(item, qty) {
    const cart = readCart();
    const i = cart.findIndex(x => x.id === item.id);
    if (i > -1) {
      cart[i].qty = Math.min(999, (Number(cart[i].qty) || 0) + qty);
      cart[i].img  = cart[i].img  || item.img;
      cart[i].veg  = (cart[i].veg ?? item.veg) ?? false;
      cart[i].meta = cart[i].meta || item.meta;
      cart[i].time = cart[i].time || item.time;
      cart[i].desc = cart[i].desc || item.desc;
    } else {
      cart.push({ ...item, qty });
    }
    writeCart(cart);
  }

  // ---------------- Build item payload from DOM ----------------
  function resolveImage() {
    // Prefer explicit hero <img>, else background-image, else assets fallback by slug
    const img = document.querySelector(".hero img[itemprop='image'], .hero img, img");
    if (img?.getAttribute("src")) return toAbsoluteURL(img.getAttribute("src"));
    const bg = document.querySelector(".hero, .food-hero, .food-img");
    if (bg) {
      const s = getComputedStyle(bg).backgroundImage || "";
      const m = s.match(/url\((?:'|")?(.*?)(?:'|")?\)/i);
      if (m) return toAbsoluteURL(m[1]);
    }
    const fallback = `/assets/images/food/${slugify(text("#title") || text("h1") || "item")}.jpg`;
    return toAbsoluteURL(fallback);
  }

  function buildItemPayload() {
    // Main container meta (if present)
    const article = document.querySelector("article.sheet[itemtype*='MenuItem']") || document.body;

    const name = (text("#title") || text("h1") || text("h2") || "Menu Item").trim();
    const price = num(document.querySelector("#price span[itemprop='price']")?.textContent);
    const veg = !!document.querySelector(".badge .veg, .veg-dot, .veg");

    const img = resolveImage();
    const imgBase = basenameNoExt(img);

    // meta/time/desc are optional but useful for cart UI
    const eta = (text("#eta") || "").replace(/^⏱\s*/, "").trim();
    const time = (text("#prep") || text("#eta") || "").trim();
    const desc = (text("[itemprop='description']") || text(".description") || text(".muted") || "").trim();
    const meta = `${veg ? "Veg" : "Non-veg"}${eta ? " • " + eta : time ? " • " + time : ""}`;

    // Prefer stable IDs embedded in page; fallback to slug+price+img
    const preferredId = article.id || article.getAttribute("data-sku") || document.documentElement.getAttribute("data-id") || "";
    const fallbackId = `${slugify(name)}--${price}--${imgBase}`;
    const id = (preferredId && preferredId.trim()) || fallbackId;

    return { id, name, price, img, veg, meta, time, desc };
  }

  // ---------------- UI wiring ----------------
  function init() {
    // Quantity controls (if present)
    const incBtn   = $("#inc");
    const decBtn   = $("#dec");
    const qtyEl    = $("#qty");
    const totalEl  = $("#totalPrice");
    const addBtn   = $("#addBtn, .add-btn, #addToCart");
    const closeBtn = $("#closeBtn");
    const closeBtn2= $("#closeBtn2");

    // Modal mode detection
    const params = new URLSearchParams(location.search);
    const isModal = params.get("modal") === "1";
    if (isModal) document.body.classList.add("modal");

    // Build item once
    const ITEM = buildItemPayload();

    // Renderers
    const CURRENCY = "₹";
    let qty = Math.max(1, parseInt(qtyEl?.textContent || "1", 10) || 1);

    function renderTotal() {
      if (totalEl) totalEl.textContent = CURRENCY + (ITEM.price * qty);
    }
    renderTotal();

    // Handlers
    incBtn?.addEventListener("click", () => {
      qty = Math.min(99, qty + 1);
      if (qtyEl) qtyEl.textContent = String(qty);
      renderTotal();
    });

    decBtn?.addEventListener("click", () => {
      qty = Math.max(1, qty - 1);
      if (qtyEl) qtyEl.textContent = String(qty);
      renderTotal();
    });

    // Close buttons behavior: in modal, stay within modal “history”; standalone -> go home
    function handleClose() {
      if (isModal) {
        // Let parent decide what to do (home.js listens for Escape/click-outside already).
        // We can optionally message parent to close, but you chose to keep modal open after add.
        // So here, only close when user hits explicit close buttons:
        window.parent?.postMessage({ type: "VPP_CLOSE_MODAL_REQUEST" }, window.location.origin);
      } else {
        // Standalone: go back or to home
        if (document.referrer) history.back();
        else location.href = "/index.html";
      }
    }
    closeBtn?.addEventListener("click", handleClose);
    closeBtn2?.addEventListener("click", handleClose);

    // Add-to-cart behavior
    (addBtn instanceof Element ? [addBtn] : Array.from(document.querySelectorAll("#addBtn, .add-btn, #addToCart"))).forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Always rebuild right before add in case DOM changed
        const item = buildItemPayload();

        if (isModal && window.parent) {
          // Same-origin message to parent; parent (home.js) updates cart + badge + toast; keep modal open (Option A)
          try {
            window.parent.postMessage({ type: "VPP_ADD_TO_CART", item: item, qty }, window.location.origin);
          } catch {
            // If something odd happens with postMessage, fallback locally
            addToCartFallback(item, qty);
          }
        } else {
          // Standalone or no parent: localStorage fallback + (optional) mini toast
          addToCartFallback(item, qty);
          // Optional: basic inline feedback
          try {
            let t = document.createElement("div");
            t.textContent = `${item.name} added • ${INR(item.price)} x${qty}`;
            t.style.cssText = "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#111827;color:#fff;padding:10px 14px;border-radius:10px;z-index:9999";
            document.body.appendChild(t);
            setTimeout(() => t.remove(), 1400);
          } catch {}
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
