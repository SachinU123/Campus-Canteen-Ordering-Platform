// js-files/food-items.js — robust IDs, absolute /assets images, consistent cart fields
(function () {
  // ---------- Small helpers ----------
  const $ = (s, ctx = document) => ctx.querySelector(s);
  const num = (t) => Number(String(t || "").replace(/[^\d.]/g, "")) || 0;
  const slugify = (s = "") => s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");

  function toAbsoluteURL(src = "") {
    try { return new URL(src, location.origin).toString(); }
    catch { return src || "/assets/images/food/placeholder.png"; }
  }
  function basenameNoExt(url = "") {
    try {
      const u = new URL(url, location.origin);
      const base = u.pathname.split("/").pop() || "";
      return base.replace(/\.[a-z0-9]+$/i, "");
    } catch {
      const base = (url.split("/").pop() || "");
      return base.replace(/\.[a-z0-9]+$/i, "");
    }
  }

  // ---------- Cart helpers (match home/cart) ----------
  const CART_KEY = "vpp_canteen_cart";
  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { return []; }
  }
  function writeCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    // update badge on pages that have a cart button
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
  function addToCartMerged(item, qty) {
    const cart = readCart();
    const i = cart.findIndex(x => x.id === item.id);
    if (i > -1) {
      cart[i].qty = Math.min(999, (Number(cart[i].qty) || 0) + qty);
      // fill missing fields just in case
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

  // ---------- Init after DOM ready ----------
  function init() {
    const article = $("article.sheet[itemtype*='MenuItem']");
    if (!article) return;

    // DOM sources
    const nameEl   = $("#title");
    const priceEl  = $("#price span[itemprop='price']");
    const imgEl    = $(".hero img[itemprop='image']") || $(".hero img");
    const vegEl    = $(".badge .veg");
    const descEl   = document.querySelector("[itemprop='description'], .description, .muted");
    const etaEl    = $("#eta");
    const timeEl   = $("#prep") || $("#eta");

    // Basic fields
    const name = (nameEl?.textContent || "Menu Item").trim();
    const price = num(priceEl?.textContent);
    const veg = !!vegEl;

    // Image: prefer hero img src, else build from /assets
    const imgSrcDom = imgEl?.getAttribute("src") || "";
    const imgSrc = imgSrcDom
      ? toAbsoluteURL(imgSrcDom)
      : toAbsoluteURL(`/assets/images/food/${slugify(name)}.jpg`);
    const imgBase = basenameNoExt(imgSrc);

    // console.log(imgBase)

    // Meta/time strings (free-form, used by cart summary)
    const eta = (etaEl?.textContent || "").replace(/^⏱\s*/,"").trim();
    const time = (timeEl?.textContent || "").trim(); // e.g., "20–25 mins"
    const meta = `${veg ? "Veg" : "Non-veg"}${eta ? " • " + eta : time ? " • " + time : ""}`;
    const desc = (descEl?.textContent || "").trim();

    // Robust ID preference: article id or data-sku, else slug+price+imgBase
    const preferredId = article.id || article.getAttribute("data-sku") || "";
    const fallbackId  = `${slugify(name)}--${price}--${imgBase}`;
    const id = (preferredId && preferredId.trim()) || fallbackId;

    const ITEM = { id, name, price, img: imgSrc, veg, meta, time, desc };

    // ---- UI wiring ----
    const incBtn   = $("#inc");
    const decBtn   = $("#dec");
    const qtyEl    = $("#qty");
    const totalEl  = $("#totalPrice");
    const addBtn   = $("#addBtn");
    const closeBtn = $("#closeBtn");
    const closeBtn2= $("#closeBtn2");

    if (!incBtn || !decBtn || !qtyEl || !totalEl || !addBtn) return;

    const CURRENCY = "₹";
    let qty = Math.max(1, parseInt(qtyEl.textContent, 10) || 1);

    function renderTotal() {
      totalEl.textContent = CURRENCY + (ITEM.price * qty);
    }
    renderTotal();

    incBtn.addEventListener("click", () => {
      qty = Math.min(99, qty + 1);
      qtyEl.textContent = String(qty);
      renderTotal();
    });

    decBtn.addEventListener("click", () => {
      qty = Math.max(1, qty - 1);
      qtyEl.textContent = String(qty);
      renderTotal();
    });

    addBtn.addEventListener("click", (e) => {
      e.preventDefault();
      addToCartMerged(ITEM, qty);
      // If opened as modal (?modal=1), close; else stay on page
      if (document.body.classList.contains("modal")) {
        history.back();
      }
    });

    function closePage() {
      if (document.body.classList.contains("modal")) {
        history.back();
      } else {
        // navigate back to menu by default
        location.href = "/index.html";
      }
    }
    closeBtn?.addEventListener("click", closePage);
    closeBtn2?.addEventListener("click", closePage);

    // Modal mode via ?modal=1
    const params = new URLSearchParams(location.search);
    if (params.get("modal") === "1") {
      document.body.classList.add("modal");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
