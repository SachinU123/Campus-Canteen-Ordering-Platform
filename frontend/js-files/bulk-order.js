// Bulk Order JavaScript
class BulkOrderManager {
  constructor() {
    this.items = new Map()
    this.init()
  }

  init() {
    this.setupEventListeners()
    this.updateSummary()
    this.loadCartCount()
  }

  setupEventListeners() {
    // Quantity controls
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("qty-btn")) {
        this.handleQuantityChange(e)
      }
    })

    // Direct input changes
    document.addEventListener("input", (e) => {
      if (e.target.classList.contains("qty-input")) {
        this.handleDirectInput(e)
      }
    })

    // Category filters
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("filter-btn")) {
        this.handleCategoryFilter(e)
      }
    })

    // Add to cart button
    document.getElementById("add-bulk-to-cart").addEventListener("click", () => {
      this.addBulkToCart()
    })
  }

  handleQuantityChange(e) {
    const action = e.target.dataset.action
    const bulkItem = e.target.closest(".bulk-item")
    const input = bulkItem.querySelector(".qty-input")
    const currentValue = Number.parseInt(input.value) || 0

    if (action === "increase") {
      input.value = Math.min(currentValue + 1, 50)
    } else if (action === "decrease") {
      input.value = Math.max(currentValue - 1, 0)
    }

    this.updateItemTotal(bulkItem)
    this.updateSummary()
  }

  handleDirectInput(e) {
    const bulkItem = e.target.closest(".bulk-item")
    const value = Number.parseInt(e.target.value) || 0

    // Ensure value is within bounds
    e.target.value = Math.max(0, Math.min(value, 50))

    this.updateItemTotal(bulkItem)
    this.updateSummary()
  }

  updateItemTotal(bulkItem) {
    const input = bulkItem.querySelector(".qty-input")
    const price = Number.parseInt(bulkItem.dataset.price)
    const quantity = Number.parseInt(input.value) || 0
    const total = price * quantity

    const totalElement = bulkItem.querySelector(".item-total")
    totalElement.textContent = `₹${total}`

    // Store item data
    const name = bulkItem.dataset.name
    if (quantity > 0) {
      this.items.set(name, {
        name,
        price,
        quantity,
        total,
      })
    } else {
      this.items.delete(name)
    }
  }

  updateSummary() {
    let totalItems = 0
    let totalAmount = 0

    this.items.forEach((item) => {
      totalItems += item.quantity
      totalAmount += item.total
    })

    document.getElementById("total-items").textContent = totalItems
    document.getElementById("total-amount").textContent = `₹${totalAmount}`

    const addButton = document.getElementById("add-bulk-to-cart")
    addButton.disabled = totalItems === 0
  }

  handleCategoryFilter(e) {
    const category = e.target.dataset.category

    // Update active filter
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.classList.remove("active")
    })
    e.target.classList.add("active")

    // Filter items
    document.querySelectorAll(".bulk-item").forEach((item) => {
      if (category === "all" || item.dataset.category === category) {
        item.style.display = "flex"
      } else {
        item.style.display = "none"
      }
    })
  }

  addBulkToCart() {
    if (this.items.size === 0) return

    const cart = JSON.parse(localStorage.getItem("vpp_canteen_cart") || "[]")

    // Add bulk items to cart with proper structure matching cart.js
    this.items.forEach((item) => {
      // Generate proper ID for cart compatibility
      const itemId = this.generateItemId(item.name, item.price)

      // Check if item already exists in cart
      const existingIndex = cart.findIndex((cartItem) => cartItem.id === itemId)

      if (existingIndex >= 0) {
        // Update quantity if item exists
        cart[existingIndex].qty += item.quantity
      } else {
        // Add new item to cart with full structure
        cart.push({
          id: itemId,
          name: item.name,
          price: item.price,
          qty: item.quantity,
          desc: this.getItemDescription(item.name),
          img: this.getItemImage(item.name),
          alt: item.name,
          meta: this.getItemMeta(item.name),
          time: this.getItemTime(item.name),
          veg: this.isVegetarian(item.name),
        })
      }
    })

    // Save updated cart using the same key as cart.js
    localStorage.setItem("vpp_canteen_cart", JSON.stringify(cart))

    // Show success message
    this.showSuccessMessage()

    // Reset bulk order
    this.resetBulkOrder()

    // Update cart count
    this.updateCartCount()
  }

  generateItemId(name, price) {
    return `${name.toLowerCase().replace(/\s+/g, "-")}--${price}`
  }

  getItemDescription(name) {
    const descriptions = {
      "Masala Dosa": "Crispy dosa with spiced potato filling",
      "Butter Masala Dosa": "Buttery masala dosa with extra flavor",
      Poha: "Flattened rice with vegetables and spices",
      Upma: "Semolina dish with vegetables",
      "Veg Thali": "Complete vegetarian meal with variety",
      "Paneer Biryani": "Fragrant rice with paneer and spices",
      "Pav Bhaji": "Spiced vegetable curry with bread",
      "Veg Fried Rice": "Stir-fried rice with vegetables",
      Samosa: "Crispy fried pastry with spiced filling",
      "Vada Pav": "Mumbai street food special",
      "Idli Sambar": "Steamed rice cakes with lentil curry",
      Tea: "Hot Indian tea with spices",
      Coffee: "Fresh brewed coffee",
      Lassi: "Refreshing yogurt-based drink",
    }
    return descriptions[name] || "Delicious food item"
  }

  getItemImage(name) {
    // Return placeholder images for now
    return `/placeholder.svg?height=80&width=80&query=${encodeURIComponent(name)}`
  }

  getItemMeta(name) {
    return `${this.isVegetarian(name) ? "Veg" : "Non-veg"} • ${this.getItemTime(name)} • ★ 4.5`
  }

  getItemTime(name) {
    const times = {
      "Masala Dosa": "15-20 mins",
      "Butter Masala Dosa": "15-20 mins",
      Poha: "10-15 mins",
      Upma: "10-15 mins",
      "Veg Thali": "20-25 mins",
      "Paneer Biryani": "25-30 mins",
      "Pav Bhaji": "15-20 mins",
      "Veg Fried Rice": "15-20 mins",
      Samosa: "5-10 mins",
      "Vada Pav": "5-10 mins",
      "Idli Sambar": "10-15 mins",
      Tea: "5 mins",
      Coffee: "5 mins",
      Lassi: "2 mins",
    }
    return times[name] || "15-20 mins"
  }

  isVegetarian(name) {
    // All items in this demo are vegetarian
    return true
  }

  showSuccessMessage() {
    const button = document.getElementById("add-bulk-to-cart")
    const originalText = button.textContent

    button.textContent = "✓ Added to Cart!"
    button.style.background = "var(--success)"

    setTimeout(() => {
      button.textContent = originalText
      button.style.background = "var(--accent)"
    }, 2000)
  }

  resetBulkOrder() {
    // Reset all quantities
    document.querySelectorAll(".qty-input").forEach((input) => {
      input.value = "0"
    })

    // Reset all totals
    document.querySelectorAll(".item-total").forEach((total) => {
      total.textContent = "₹0"
    })

    // Clear items map
    this.items.clear()

    // Update summary
    this.updateSummary()
  }

  loadCartCount() {
    this.updateCartCount()
  }

  updateCartCount() {
    const cart = JSON.parse(localStorage.getItem("vpp_canteen_cart") || "[]")
    const totalItems = cart.filter((item) => (item?.qty || 0) > 0).length
    const cartCountElement = document.getElementById("cart-count")
    if (cartCountElement) {
      cartCountElement.textContent = totalItems
    }
  }
}

// Initialize bulk order manager when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new BulkOrderManager()
})

// Update cart count when page becomes visible (in case cart was updated in another tab)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    const manager = new BulkOrderManager()
    manager.updateCartCount()
  }
})
