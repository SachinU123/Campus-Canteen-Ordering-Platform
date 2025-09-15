(function () {
  // ------------ Utilities ------------
  const $  = (s, ctx=document) => ctx.querySelector(s);
  const $$ = (s, ctx=document) => Array.from(ctx.querySelectorAll(s));

  const CART_KEY = "vpp_canteen_cart";
  const CATALOG  = (typeof allItems === "function") ? allItems() : [];

  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
  }
  function writeCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadge(cart);
  }
  function updateCartBadge(cart = readCart()) {
    const cartBtn = $(".cart-btn");
    if (!cartBtn) return;
    let badge = cartBtn.querySelector(".cart-badge");
    const total = cart.reduce((s, x) => s + (x.qty || 0), 0);
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "cart-badge";
      badge.style.cssText =
        "display:inline-flex;min-width:18px;height:18px;padding:0 5px;border-radius:9px;" +
        "align-items:center;justify-content:center;font-size:11px;background:#22c55e;color:#0b0f12;margin-left:6px;";
      cartBtn.appendChild(badge);
    }
    badge.textContent = total > 99 ? "99+" : String(total);
    badge.style.visibility = total ? "visible" : "hidden";
  }

  function parsePrice(n) {
    if (n == null) return 0;
    if (typeof n === "number") return n;
    const s = String(n).replace(/[^\d.]/g, "");
    return Number(s || 0);
  }

  // ------------ Cart ops ------------
  function addToCart(item, qty = 1) {
    const cart = readCart();
    const i = cart.findIndex(x => x.id === item.id);
    if (i >= 0) cart[i].qty += qty;
    else        cart.push({ id:item.id, name:item.name, price:item.price||0, img:item.img||"", qty });
    writeCart(cart);
    toast(`${item.name} added to cart`);
  }

  // ------------ Toast ------------
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
    el.role = "status";
    el.style.cssText =
      "background:#0b0f12;color:#e5fbee;padding:10px 14px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.25);" +
      "font-size:14px;opacity:0;transition:opacity .2s, transform .2s;transform:translateY(10px)";
    host.appendChild(el);
    requestAnimationFrame(()=>{ el.style.opacity="1"; el.style.transform="translateY(0)"; });
    setTimeout(()=>{
      el.style.opacity="0"; el.style.transform="translateY(10px)";
      setTimeout(()=>el.remove(), 200);
    }, ms);
  }

  // ------------ Modal ------------
  function ensureModal() {
    let modal = $("#item-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "item-modal";
      modal.setAttribute("aria-hidden","true");
      modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:10000;";
      modal.innerHTML = `
        <div id="item-modal-card" role="dialog" aria-modal="true" aria-labelledby="item-modal-title"
             style="background:#111418;color:#e7f7ee;max-width:560px;width:92%;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.35);overflow:hidden">
          <div id="item-modal-hero" style="height:180px;background:#0f1520;display:flex;align-items:center;justify-content:center">
            <span style="opacity:.6">No image</span>
          </div>
          <div style="padding:16px 18px 18px">
            <h3 id="item-modal-title" style="margin:0 0 6px;font-size:20px;line-height:1.2"></h3>
            <div id="item-modal-meta" style="font-size:13px;color:#9fb8aa;margin-bottom:12px"></div>
            <div id="item-modal-price" style="font-weight:700;font-size:18px;margin-bottom:14px"></div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
              <button id="item-modal-cancel" class="btn-outline">Close</button>
              <div class="qty" style="display:flex;gap:8px;align-items:center;margin-right:auto">
                <button id="qty-dec" class="btn-mini">−</button>
                <span id="qty-val">1</span>
                <button id="qty-inc" class="btn-mini">+</button>
              </div>
              <button id="item-modal-add" class="btn-primary">Add to Cart</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.addEventListener("click", (e) => { if (e.target === modal) hideModal(); });
      $("#item-modal-cancel", modal).addEventListener("click", hideModal);
    }
    return modal;
  }

  let currentItem = null;
  function showModal(item) {
    const modal = ensureModal();
    currentItem = item;

    const hero  = $("#item-modal-hero", modal);
    const title = $("#item-modal-title", modal);
    const meta  = $("#item-modal-meta",  modal);
    const price = $("#item-modal-price", modal);
    const add   = $("#item-modal-add",   modal);
    const qv    = $("#qty-val",          modal);
    const qi    = $("#qty-inc",          modal);
    const qd    = $("#qty-dec",          modal);

    // Image
    hero.innerHTML = "";
    if (item.img) {
      const img = new Image();
      img.alt = item.name;
      img.src = item.img;
      img.style = "width:100%;height:100%;object-fit:cover;";
      hero.appendChild(img);
    } else {
      hero.innerHTML = `<span style="opacity:.6">No image</span>`;
    }

    // Text
    title.textContent = item.name;
    const badges = [ item.veg ? "🟢 Veg" : "🟠 Non-Veg" ];
    if (item.eta)    badges.push(item.eta);
    if (item.rating) badges.push(`★ ${item.rating}`);
    meta.textContent = badges.join(" · ");
    price.textContent = "₹" + (parsePrice(item.price) || 0);

    // Qty controls
    let qty = 1;
    qv.textContent = qty;
    qi.onclick = () => { qty = Math.min(99, qty + 1); qv.textContent = qty; };
    qd.onclick = () => { qty = Math.max(1,  qty - 1); qv.textContent = qty; };

    // Add
    add.onclick = () => { addToCart(item, qty); hideModal(); };

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden","false");
  }
  function hideModal() {
    const modal = $("#item-modal");
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden","true");
    currentItem = null;
  }

  // ------------ Card rendering ------------
  /**
   * Renders all items into #home-cards (or any container passed).
   * Works even if price/img/eta/rating are missing right now.
   */
  function renderHomeCards(containerId="home-cards") {
    const mount = document.getElementById(containerId);
    if (!mount) return;

    // Sort nicely by name
    const items = [...CATALOG].sort((a,b)=>a.name.localeCompare(b.name));

    const frag = document.createDocumentFragment();
    items.forEach(it => {
      const price = parsePrice(it.price);
      const card = document.createElement("article");
      card.className = "food-card";
      card.tabIndex = 0;
      card.setAttribute("role","button");
      card.setAttribute("aria-label", `${it.name} details`);

      card.innerHTML = `
        <div class="food-img">${it.img ? `<img src="${it.img}" alt="${it.name}" loading="lazy">` : ""}</div>
        <div class="food-info">
          <div class="top">
            <h3>${it.name}</h3>
            <span class="price">${price ? "₹"+price : "₹—"}</span>
          </div>
          <div class="meta">
            <span class="veg">${it.veg ? "🟢 Veg" : "🟠 Non-Veg"}</span>
            ${it.eta ? `<span class="time">${it.eta}</span>` : ""}
            ${it.rating ? `<span class="rating">★ ${it.rating}</span>` : ""}
          </div>
          <div class="actions">
            <button class="add-btn">Add</button>
            <a class="details-link" href="${(typeof getItemUrl==='function') ? getItemUrl(it.id) : '#'}" target="_blank" rel="noopener">Details</a>
          </div>
        </div>
      `;
      frag.appendChild(card);
    });
    mount.replaceChildren(frag);
  }

  // ------------ Events ------------
  function onDocClick(e) {
    // Add button
    const add = e.target.closest(".add-btn");
    if (add) {
      const card = add.closest(".food-card");
      if (!card) return;
      const name = $("h3", card)?.textContent?.trim() || "Item";
      const priceText = $(".price", card)?.textContent || "₹0";
      const price = parsePrice(priceText);
      const veg = $(".veg", card)?.textContent?.includes("Veg");
      const id = name.toLowerCase().replace(/\s+/g, "-"); // simple id if missing in DOM

      // Prefer catalog item by id if available
      const fromCatalog = (typeof getItem === "function") ? getItem(id) : null;
      const item = fromCatalog || { id, name, price, veg, img: $("img", card)?.src || "" };

      addToCart(item, 1);
      return;
    }

    // Clicking a card (not the add button) opens modal
    const card = e.target.closest(".food-card");
    if (card && !e.target.closest(".add-btn")) {
      const name = $("h3", card)?.textContent?.trim() || "Item";
      const id   = name.toLowerCase().replace(/\s+/g,"-");
      const it   = (typeof getItem==="function" && getItem(id)) || {
        id,
        name,
        veg: $(".veg", card)?.textContent?.includes("Veg"),
        price: parsePrice($(".price", card)?.textContent || 0),
        eta: $(".time", card)?.textContent || "",
        rating: ($(".rating", card)?.textContent || "").replace(/[^0-9.]/g,""),
        img: $("img", card)?.src || ""
      };
      showModal(it);
    }
  }

  function onDocKeydown(e) {
    if ((e.key === "Enter" || e.key === " ") && document.activeElement) {
      const card = document.activeElement.closest?.(".food-card");
      if (card) {
        e.preventDefault();
        card.click();
      }
    }
    if (e.key === "Escape") hideModal();
  }

  function wireHamburger() {
    const burger = $(".hamburger");
    const nav = $(".nav-links");
    if (!burger || !nav) return;
    burger.addEventListener("click", () => {
      const open = nav.classList.toggle("show");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // ------------ Init ------------
  function init() {
    renderHomeCards("home-cards");   // <div id="home-cards"></div> in home.html
    updateCartBadge();
    wireHamburger();
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onDocKeydown);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
