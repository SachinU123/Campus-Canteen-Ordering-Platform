// ---------- Config ----------
    const ITEM = {
      id: "vada-pav",
      name: "Vada Pav",
      price: 20,              // base price (₹)
      veg: true,
      img: "/images/food/vada-pav-hero.jpg",
      calories: null,         // fill later, e.g., 295
      eta: "20–25 mins",
      rating: "4.5",
    };

    // ---------- Helpers (safe fallbacks if your app functions don't exist) ----------
    const readCart = window.readCart || function(){
      try { return JSON.parse(localStorage.getItem("vpp-cart")||"[]"); } catch { return []; }
    };
    const writeCart = window.writeCart || function(cart){
      localStorage.setItem("vpp-cart", JSON.stringify(cart));
      (window.updateCartCounter||function(){})();
    };
    function addToCartFallback(item, qty){
      const cart = readCart();
      const i = cart.findIndex(x=>x.id===item.id);
      if(i>-1){ cart[i].qty += qty; } else { cart.push({id:item.id, name:item.name, price:item.price, img:item.img, qty}); }
      writeCart(cart);
    }
    const addToCart = window.addToCart || addToCartFallback;

    // ---------- UI wiring ----------
    const $ = (s)=>document.querySelector(s);
    const qtyEl = $("#qty");
    const totalEl = $("#totalPrice");
    const priceEl = $("#price span[itemprop='price']");
    const calEl = $("#calories");

    // fill placeholders
    priceEl.textContent = ITEM.price;
    $("#eta").innerHTML = "⏱ <strong>"+ITEM.eta+"</strong>";
    $("#rating").innerHTML = "⭐ <strong>"+ITEM.rating+"</strong>";
    if(ITEM.calories!=null) calEl.textContent = ITEM.calories+" kcal";

    let qty = 1;
    function renderTotal(){ totalEl.textContent = "₹"+(ITEM.price*qty); }
    renderTotal();

    $("#inc").onclick = ()=>{ qty = Math.min(99, qty+1); qtyEl.textContent = qty; renderTotal(); };
    $("#dec").onclick = ()=>{ qty = Math.max(1, qty-1); qtyEl.textContent = qty; renderTotal(); };

    $("#addBtn").onclick = ()=>{
      addToCart(ITEM, qty);
      // If opened as modal, close after add:
      if(document.body.classList.contains("modal")) window.history.back();
    };

    // Close buttons
    function closePage(){
      if (document.body.classList.contains("modal")) {
        window.history.back();
      } else {
        // navigate back to menu by default
        window.location.href = "/index.html";
      }
    }
    $("#closeBtn").onclick = closePage;
    $("#closeBtn2").onclick = closePage;

    // Modal mode if ?modal=1
    const params = new URLSearchParams(location.search);
    if (params.get("modal")==="1") {
      document.body.classList.add("modal");
    }
