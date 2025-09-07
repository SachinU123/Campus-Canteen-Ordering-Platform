// Select all "Add to Cart" buttons
const addToCartButtons = document.querySelectorAll(".add-to-cart");

// Cart & Orders containers
const cartItemsContainer = document.querySelector(".cart-items");
const orderItemsContainer = document.querySelector(".order-items");

// Totals
const cartTotalElement = document.querySelector(".cart-total");
const orderTotalElement = document.querySelector(".order-total");

// Store cart data
let cart = JSON.parse(localStorage.getItem("cart")) || [];

// Update Cart UI
function updateCart() {
    cartItemsContainer.innerHTML = "";
    let total = 0;

    cart.forEach((item, index) => {
        const cartItem = document.createElement("div");
        cartItem.classList.add("cart-item");

        cartItem.innerHTML = `
            <span>${item.name}</span>
            <span>₹${item.price}</span>
            <button class="remove-btn" data-index="${index}">Remove</button>
        `;

        cartItemsContainer.appendChild(cartItem);
        total += item.price;
    });

    cartTotalElement.textContent = `₹${total}`;
    localStorage.setItem("cart", JSON.stringify(cart));

    attachRemoveListeners();
    updateOrders();
}

// Update Orders UI (Live Orders Section)
function updateOrders() {
    orderItemsContainer.innerHTML = "";
    let total = 0;

    cart.forEach(item => {
        const orderItem = document.createElement("div");
        orderItem.classList.add("order-item");

        orderItem.innerHTML = `
            <span>${item.name}</span>
            <span>₹${item.price}</span>
        `;

        orderItemsContainer.appendChild(orderItem);
        total += item.price;
    });

    orderTotalElement.textContent = `₹${total}`;
}

// Attach Remove Event Listeners
function attachRemoveListeners() {
    const removeButtons = document.querySelectorAll(".remove-btn");
    removeButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            const index = e.target.dataset.index;
            cart.splice(index, 1);
            updateCart();
        });
    });
}

// Add Item to Cart on Button Click
addToCartButtons.forEach(button => {
    button.addEventListener("click", () => {
        const item = {
            name: button.dataset.name,
            price: parseInt(button.dataset.price),
        };

        cart.push(item);
        updateCart();
    });
});

// Initialize Cart on Page Load
updateCart();
