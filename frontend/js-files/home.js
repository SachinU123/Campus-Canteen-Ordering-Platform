
(function () {
  // ---------- Utilities ----------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const CART_KEY = "vpp_canteen_cart";

  function readCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch {
      return [];
    }
  }

  function writeCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadge(cart);
  }

  function addToCart(item) {
    const cart = readCart();
    const idx = cart.findIndex((x) => x.id === item.id);
    if (idx >= 0) {
      cart[idx].qty += 1;
    } else {
      cart.push({ ...item, qty: 1 });
    }
    writeCart(cart);
    toast(`${item.name} added to cart`);
  }

  function updateCartBadge(cart = readCart()) {
    const cartBtn = $(".cart-btn");
    if (!cartBtn) return;

    let badge = cartBtn.querySelector(".cart-badge");
    const total = cart.reduce((s, x) => s + (x.qty || 0), 0);

    if (!badge) {
      badge = document.createElement("span");
      badge.className =
        "cart-badge";
      // Minimal inline styles to avoid needing CSS:
      badge.style.cssText =
        "display:inline-flex;min-width:18px;height:18px;padding:0 5px;border-radius:9px;align-items:center;justify-content:center;font-size:11px;background:#e11d48;color:#fff;margin-left:6px;";
      cartBtn.appendChild(badge);
    }
    badge.textContent = total > 99 ? "99+" : String(total);
    badge.style.visibility = total ? "visible" : "hidden";
  }

  function parsePrice(text) {
    // e.g., "₹120"
    const n = (text || "").replace(/[^\d.]/g, "");
    return Number(n || 0);
  }

  function getCardItem(card) {
    const title = $("h3", card)?.textContent?.trim() || "Item";
    const priceText = $(".price", card)?.textContent || "₹0";
    const price = parsePrice(priceText);
    const time = $(".time", card)?.textContent?.trim() || "";
    const rating = $(".rating", card)?.textContent?.trim() || "";
    // Try to capture the first image div class for styling reference
    const imgDiv =
      card.querySelector("[class^='food-img']") || card.querySelector("div");
    const imgClass = imgDiv ? imgDiv.className : "";
    // Generate a stable id from title + price
    const id = `${title.toLowerCase().replace(/\s+/g, "-")}--${price}`;

    return {
      id,
      name: title,
      price,
      time,
      rating,
      imgClass,
    };
  }

  // ---------- Toasts ----------
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

  function toast(message, duration = 1800) {
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

  // ---------- Modal (Item Details) ----------
  function ensureModal() {
    let modal = $("#item-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "item-modal";
      modal.setAttribute("aria-hidden", "true");
      modal.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:10000;";
      modal.innerHTML = `
        <div id="item-modal-card" role="dialog" aria-modal="true" aria-labelledby="item-modal-title"
             style="background:#fff;max-width:560px;width:92%;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden">
          <div id="item-modal-hero" style="height:180px;background:#f3f4f6;"></div>
          <div style="padding:16px 18px 18px">
            <h3 id="item-modal-title" style="margin:0 0 6px;font-size:20px;line-height:1.2"></h3>
            <div id="item-modal-meta" style="font-size:14px;color:#374151;margin-bottom:12px"></div>
            <div id="item-modal-price" style="font-weight:600;font-size:18px;margin-bottom:14px"></div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
              <button id="item-modal-cancel" style="padding:8px 12px;border-radius:10px;border:1px solid #e5e7eb;background:#fff;cursor:pointer">Close</button>
              <button id="item-modal-add" style="padding:8px 14px;border-radius:10px;border:none;background:#111827;color:#fff;cursor:pointer">Add to Cart</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.addEventListener("click", (e) => {
        if (e.target === modal) hideModal();
      });
      $("#item-modal-cancel", modal).addEventListener("click", hideModal);
    }
    return modal;
  }

  let currentModalItem = null;

  function showModal(item) {
    const modal = ensureModal();
    currentModalItem = item;

    const hero = $("#item-modal-hero", modal);
    const title = $("#item-modal-title", modal);
    const meta = $("#item-modal-meta", modal);
    const price = $("#item-modal-price", modal);
    const addBtn = $("#item-modal-add", modal);

    // Render hero using the card's image class if available
    hero.className = item.imgClass || "";
    // If hero has no bg from CSS, ensure a neutral fallback:
    hero.style.background = hero.className ? "" : "#f3f4f6";

    title.textContent = item.name;
    meta.textContent = [item.time, item.rating].filter(Boolean).join(" · ");
    price.textContent = `₹${item.price}`;

    addBtn.onclick = () => {
      addToCart(item);
      hideModal();
    };

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    // Focus trap start:
    $("#item-modal-card", modal).focus?.();
  }

  function hideModal() {
    const modal = $("#item-modal");
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    currentModalItem = null;
  }

  // ---------- Event Delegation ----------
  function onDocumentClick(e) {
    const addBtn = e.target.closest(".add-btn");
    if (addBtn) {
      const card = addBtn.closest(".food-card");
      if (!card) return;
      const item = getCardItem(card);
      addToCart(item);
      return;
    }

    // Clicking a food card (but not when the click was on the add button)
    const card = e.target.closest(".food-card");
    if (card && !e.target.closest(".add-btn")) {
      const item = getCardItem(card);
      showModal(item);
      return;
    }

    // Nav behavior: prefer in-page sections (#home, #menu, #orders, #cart)
    const navLink = e.target.closest(".nav-links a");
    if (navLink) {
      const href = navLink.getAttribute("href") || "#";
      if (href.startsWith("#")) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          history.replaceState(null, "", href);
        }
        // If section not present, default browser navigation (no-op)
      }
    }
  }

  function onDocumentKeydown(e) {
    // Open details with Enter/Space when focusing a card
    if ((e.key === "Enter" || e.key === " ") && document.activeElement) {
      const card = document.activeElement.closest?.(".food-card");
      if (card) {
        e.preventDefault();
        const item = getCardItem(card);
        showModal(item);
      }
    }
    // Close modal with Escape
    if (e.key === "Escape") hideModal();
  }

  // ---------- Hamburger Toggle (keeps your existing behavior) ----------
  function wireHamburger() {
    const hamburger = $(".hamburger");
    const nav = $(".nav-links");
    if (!hamburger || !nav) return;

    hamburger.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("show");
      hamburger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  // ---------- Make cards focusable for a11y ----------
  function makeCardsFocusable() {
    $$(".food-card").forEach((card) => {
      if (!card.hasAttribute("tabindex")) {
        card.setAttribute("tabindex", "0");
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", `${$("h3", card)?.textContent || "Item"} details`);
      }
    });
  }

  // ---------- Init ----------
  function init() {
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onDocumentKeydown);
    wireHamburger();
    makeCardsFocusable();
    updateCartBadge();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
