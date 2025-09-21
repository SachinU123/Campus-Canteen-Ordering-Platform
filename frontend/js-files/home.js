/* home.js — VPP Canteen (fixed: no nav on add, robust IDs, absolute images, unique badge) */
(function () {
  // ------------------ Config ------------------
  const ITEM_PAGES_DIR = "html-files/food-items-files/"; // relative to index.html
  const CART_KEY = "vpp_canteen_cart";
  const AUTO_SWIPE_MS = 5000;

  // ------------------ Tiny DOM helpers ------------------
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  // ------------------ Utils ------------------
  const parsePrice = (text) =>
    Number((text || "").replace(/[^\d.]/g, "") || 0);

  const slugify = (s = "") =>
    s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");

  const INR = (n) => `₹${Number(n || 0).toFixed(0)}`;

  // Make any src absolute so it works from any page (e.g., cart.html)
  function toAbsoluteURL(src = "") {
    try { return new URL(src, location.origin).toString(); }
    catch { return src || "/assets/images/food/placeholder.png"; }
  }

  // Get a short basename (without extension) from a URL/path to help uniqueness
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

  // ------------------ Storage (same as cart.js) ------------------
  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
  }
  function writeCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadge(cart);
  }

  // ------------------ Cart badge (UNIQUE items, not quantities) ------------------
  function updateCartBadge(cart = readCart()) {
    const cartBtn = $(".cart-btn");
    if (!cartBtn) return;

    let badge = cartBtn.querySelector(".cart-badge");
    const uniqueCount = cart.filter(it => (Number(it?.qty) || 0) > 0).length;

    if (!badge) {
      badge = document.createElement("span");
      badge.className = "cart-badge";
      badge.style.cssText =
        "display:inline-flex;min-width:18px;height:18px;padding:0 5px;border-radius:9px;align-items:center;justify-content:center;font-size:11px;background:#e11d48;color:#fff;margin-left:6px;line-height:18px;";
      cartBtn.appendChild(badge);
    }
    badge.textContent = uniqueCount > 99 ? "99+" : String(uniqueCount);
    badge.style.visibility = uniqueCount ? "visible" : "hidden";
  }

  // ------------------ Toasts ------------------
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
  function toast(message, duration = 1600) {
    const host = ensureToastHost();
    const el = document.createElement("div");
    el.textContent = message;
    el.setAttribute("role", "status");
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
    }, duration);
  }

  // ------------------ Cart ops (consistent with cart.js) ------------------
  function addToCart(item) {
    const cart = readCart();
    const idx = cart.findIndex(x => x.id === item.id);
    if (idx >= 0) {
      // same SKU: increment only that one
      cart[idx].qty = Math.max(1, Number(cart[idx].qty || 1) + 1);
      // fill in missing fields if this invocation has more data
      cart[idx].img  = cart[idx].img  || item.img;
      cart[idx].veg  = (cart[idx].veg ?? item.veg) ?? false;
      cart[idx].meta = cart[idx].meta || item.meta;
      cart[idx].time = cart[idx].time || item.time;
      cart[idx].desc = cart[idx].desc || item.desc;
    } else {
      cart.push({ ...item, qty: 1 });
    }
    writeCart(cart);
    toast(`${item.name} added • ${INR(item.price)}`);
  }

  // ------------------ Item parsing from cards ------------------
  // Supports: data-id / data-sku on .food-card for stable IDs.
  function getCardItem(card) {
      const title = $("h3", card)?.textContent?.trim() || "Item";
      const price = parsePrice($(".price", card)?.textContent || "0");
      const veg = !!$(".veg-dot", card);
      const meta = $(".meta", card)?.textContent?.trim() || "";
      const time = $(".time", card)?.textContent?.trim() || "";
      const desc = $(".desc", card)?.textContent?.trim() || "";

      // --- CHANGED: only how imgAbs is derived ---
      const imgEl = $("img", card); // keep as-is
      const imgContainer = $(".food-img", card);

      // try data-img (your new HTML), then <img src>, then background-image, else fallback by title
      const fromData = imgContainer?.dataset?.img || "";
      const fromImgTag = imgEl?.getAttribute("src") || "";

      // parse url("...") from background-image if present
      const fromBg = (() => {
        if (!imgContainer) return "";
        const s = getComputedStyle(imgContainer).backgroundImage || "";
        const m = s.match(/url\((?:'|")?(.*?)(?:'|")?\)/i);
        return m ? m[1] : "";
      })();

      const relOrAbs = fromData || fromImgTag || fromBg || `assets/images/${slugify(title)}.jpg`;

      // make absolute so it works anywhere (modal, cart page, etc.)
      const imgAbs = (() => {
        try { return new URL(relOrAbs, document.baseURI).href; }
        catch { return relOrAbs; }
      })();

      const imgBase = basenameNoExt(imgAbs); // unchanged logs/use
      console.log(imgEl);
      console.log(imgBase);
      // --- END CHANGE ---

      // robust, collision-resistant ID (unchanged)
      const cards = $$(".food-card");
      const index = Math.max(0, cards.indexOf(card));
      const dataId = card.getAttribute("data-id") || card.getAttribute("data-sku");
      const fallbackId = `${slugify(title)}--${price}--${index}--${imgBase}`;
      const id = (dataId && String(dataId).trim()) || fallbackId;

      return { id, name: title, price, img: imgAbs, veg, meta, time, desc };
  }

  // ------------------ IFRAME modal for detail pages ------------------
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

    modal.addEventListener("click", (e) => { if (e.target === modal) hideModal(); });
    modal.querySelector("#mi-close").addEventListener("click", hideModal);
    return modal;
  }
  function showDetailInModal(url) {
    const modal = ensureModal();
    const frame = modal.querySelector("#mi-frame");
    frame.src = url.includes("?") ? `${url}&modal=1` : `${url}?modal=1`;
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
  }
  function hideModal() {
    const modal = document.getElementById("menu-item-modal");
    if (!modal) return;
    const frame = modal.querySelector("#mi-frame");
    if (frame) frame.src = "about:blank";
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }

  // ------------------ Click/Key handling (Add to Cart + open details) ------------------
  function wireCardInteractions() {
    document.addEventListener("click", (e) => {
      // Add to cart button
      const addBtn = e.target.closest(".add-btn");
      if (addBtn) {
        // prevent anchors or parent card handlers from hijacking
        e.preventDefault();
        e.stopPropagation();

        const card = addBtn.closest(".food-card");
        if (!card) return;

        const item = getCardItem(card);
        addToCart(item); // updates storage + unique badge
        return;
      }

      // Click on card itself (not on 'Add' button) -> open detail page in modal
      const card = e.target.closest(".food-card");
      if (card && !e.target.closest(".add-btn")) {
        const name = $("h3", card)?.textContent?.trim() || "item";
        const url  = ITEM_PAGES_DIR + slugify(name) + ".html";
        showDetailInModal(url);
        return;
      }
    });

    // Keyboard accessibility for cards
    $$(".food-card").forEach((card) => {
      if (!card.hasAttribute("tabindex")) card.setAttribute("tabindex", "0");
      card.setAttribute("role", "link");
      card.setAttribute("aria-label", `${$("h3", card)?.textContent || "Item"} details`);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const name = $("h3", card)?.textContent?.trim() || "item";
          const url  = ITEM_PAGES_DIR + slugify(name) + ".html";
          showDetailInModal(url);
        }
      });
    });

    // Escape closes modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideModal();
    });
  }

  // ------------------ Chinese auto-swipe (arrows, no dots) ------------------
  function wireChineseCarousel() {
    const section = document.querySelector(".food-sec");
    const grid = section?.querySelector(".food-grid-large");
    if (!grid) return;

    grid.style.overflowX = "auto";
    grid.style.scrollBehavior = "smooth";
    grid.style.scrollSnapType = "x mandatory";
    $$(".food-card", grid).forEach((c) => (c.style.scrollSnapAlign = "start"));

    const mkBtn = (label, dir) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `cn-arrow cn-${dir}`;
      b.setAttribute("aria-label", label);
      b.style.cssText = `
        position:absolute; top:50%; transform:translateY(-50%);
        ${dir === "prev" ? "left:8px" : "right:8px"};
        background:rgba(0,0,0,.55); color:#fff; border:1px solid rgba(255,255,255,.25);
        padding:8px 10px; border-radius:999px; cursor:pointer; z-index:2;
        backdrop-filter:saturate(140%) blur(4px);
      `;
      b.textContent = dir === "prev" ? "‹" : "›";
      return b;
    };

    section.style.position = section.style.position || "relative";
    const prevBtn = mkBtn("Previous", "prev");
    const nextBtn = mkBtn("Next", "next");
    section.appendChild(prevBtn);
    section.appendChild(nextBtn);

    const cards = $$(".food-card", grid);
    if (!cards.length) return;

    let index = 0, timer = null;

    function scrollToIndex(i) {
      index = (i + cards.length) % cards.length;
      const target = cards[index];
      if (!target) return;
      grid.scrollTo({ left: target.offsetLeft, top: 0, behavior: "smooth" });
    }
    function next() { scrollToIndex(index + 1); }
    function prev() { scrollToIndex(index - 1); }
    function start() { stop(); timer = setInterval(next, AUTO_SWIPE_MS); }
    function stop()  { if (timer) clearInterval(timer); timer = null; }

    prevBtn.addEventListener("click", () => { prev(); start(); });
    nextBtn.addEventListener("click", () => { next(); start(); });

    let userScrollTimeout = null;
    grid.addEventListener("scroll", () => {
      if (userScrollTimeout) clearTimeout(userScrollTimeout);
      userScrollTimeout = setTimeout(() => start(), 1200);
    }, { passive: true });

    grid.addEventListener("mouseenter", stop);
    grid.addEventListener("mouseleave", start);

    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".food-card");
      if (!card) return;
      const name = $("h3", card)?.textContent?.trim() || "item";
      const url  = ITEM_PAGES_DIR + slugify(name) + ".html";
      showDetailInModal(url);
    });

    scrollToIndex(0);
    start();

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => scrollToIndex(index), 200);
    });
  }

  // ------------------ Hamburger toggle (mobile) ------------------
  function wireHamburger() {
    const hamburger = $(".hamburger");
    const nav = $(".nav-links");
    if (!hamburger || !nav) return;

    hamburger.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("show");
      hamburger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  // ------------------ Init ------------------
  function init() {
    wireCardInteractions();
    wireChineseCarousel();
    wireHamburger();
    updateCartBadge(); // show unique-item badge on load
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else init();
})();
