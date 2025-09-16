// Admin Panel JavaScript
class AdminPanel {
  constructor() {
    this.menuItems = this.loadMenuItems()
    this.orders = this.loadOrders()
    this.specialDishes = this.loadSpecialDishes()
    this.init()
  }

  init() {
    this.setupEventListeners()
    this.loadDashboardStats()
    this.renderMenuTable()
    this.renderOrders()
    this.renderSpecialDishes()
  }

  setupEventListeners() {
    // Navigation
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("nav-btn")) {
        this.switchSection(e.target.dataset.section)
      }
    })

    // Menu search and filter
    document.getElementById("menu-search").addEventListener("input", (e) => {
      this.filterMenuItems()
    })

    document.getElementById("category-filter").addEventListener("change", (e) => {
      this.filterMenuItems()
    })

    // Forms
    document.getElementById("add-item-form").addEventListener("submit", (e) => {
      e.preventDefault()
      this.addMenuItem()
    })

    document.getElementById("edit-item-form").addEventListener("submit", (e) => {
      e.preventDefault()
      this.updateMenuItem()
    })

    document.getElementById("add-special-form").addEventListener("submit", (e) => {
      e.preventDefault()
      this.addSpecialDish()
    })

    // Order filters
    document.getElementById("order-status-filter").addEventListener("change", (e) => {
      this.filterOrders()
    })

    document.getElementById("order-date-filter").addEventListener("change", (e) => {
      this.filterOrders()
    })
  }

  switchSection(sectionId) {
    // Update navigation
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.remove("active")
    })
    document.querySelector(`[data-section="${sectionId}"]`).classList.add("active")

    // Update sections
    document.querySelectorAll(".admin-section").forEach((section) => {
      section.classList.remove("active")
    })
    document.getElementById(sectionId).classList.add("active")
  }

  loadMenuItems() {
    const defaultItems = [
      {
        id: 1,
        name: "Masala Dosa",
        category: "breakfast",
        price: 100,
        status: "available",
        description: "Crispy dosa with spiced potato filling",
      },
      {
        id: 2,
        name: "Butter Masala Dosa",
        category: "breakfast",
        price: 100,
        status: "available",
        description: "Buttery masala dosa",
      },
      {
        id: 3,
        name: "Poha",
        category: "breakfast",
        price: 20,
        status: "available",
        description: "Flattened rice with vegetables",
      },
      {
        id: 4,
        name: "Veg Thali",
        category: "meals",
        price: 200,
        status: "available",
        description: "Complete vegetarian meal",
      },
      {
        id: 5,
        name: "Paneer Biryani",
        category: "meals",
        price: 120,
        status: "available",
        description: "Fragrant rice with paneer",
      },
      {
        id: 6,
        name: "Pav Bhaji",
        category: "meals",
        price: 50,
        status: "available",
        description: "Spiced vegetable curry with bread",
      },
      {
        id: 7,
        name: "Samosa",
        category: "snacks",
        price: 40,
        status: "available",
        description: "Crispy fried pastry with filling",
      },
      {
        id: 8,
        name: "Vada Pav",
        category: "snacks",
        price: 15,
        status: "available",
        description: "Mumbai street food special",
      },
      { id: 9, name: "Tea", category: "beverages", price: 30, status: "available", description: "Hot Indian tea" },
      {
        id: 10,
        name: "Coffee",
        category: "beverages",
        price: 50,
        status: "available",
        description: "Fresh brewed coffee",
      },
    ]

    return JSON.parse(localStorage.getItem("adminMenuItems") || JSON.stringify(defaultItems))
  }

  saveMenuItems() {
    localStorage.setItem("adminMenuItems", JSON.stringify(this.menuItems))
  }

  loadOrders() {
    const defaultOrders = [
      {
        id: "ORD001",
        items: ["Masala Dosa", "Tea"],
        total: 130,
        status: "pending",
        date: new Date().toISOString(),
        customer: "John Doe",
      },
      {
        id: "ORD002",
        items: ["Veg Thali", "Lassi"],
        total: 260,
        status: "preparing",
        date: new Date().toISOString(),
        customer: "Jane Smith",
      },
      {
        id: "ORD003",
        items: ["Pav Bhaji", "Coffee"],
        total: 100,
        status: "ready",
        date: new Date().toISOString(),
        customer: "Mike Johnson",
      },
    ]

    return JSON.parse(localStorage.getItem("adminOrders") || JSON.stringify(defaultOrders))
  }

  saveOrders() {
    localStorage.setItem("adminOrders", JSON.stringify(this.orders))
  }

  loadSpecialDishes() {
    const defaultSpecials = [
      {
        id: 1,
        name: "Chef's Special Biryani",
        price: 180,
        description: "Today's special biryani with extra spices",
        availableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    ]

    return JSON.parse(localStorage.getItem("adminSpecialDishes") || JSON.stringify(defaultSpecials))
  }

  saveSpecialDishes() {
    localStorage.setItem("adminSpecialDishes", JSON.stringify(this.specialDishes))
  }

  loadDashboardStats() {
    const today = new Date().toDateString()
    const todayOrders = this.orders.filter((order) => new Date(order.date).toDateString() === today)

    document.getElementById("total-orders").textContent = todayOrders.length
    document.getElementById("total-revenue").textContent =
      `₹${todayOrders.reduce((sum, order) => sum + order.total, 0)}`
    document.getElementById("menu-items").textContent = this.menuItems.length
    document.getElementById("special-dishes").textContent = this.specialDishes.length
  }

  renderMenuTable() {
    const tbody = document.getElementById("menu-table-body")
    tbody.innerHTML = ""

    this.menuItems.forEach((item) => {
      const row = document.createElement("tr")
      row.innerHTML = `
        <td>${item.name}</td>
        <td><span class="category-badge">${item.category}</span></td>
        <td>₹${item.price}</td>
        <td><span class="status-badge status-${item.status}">${item.status}</span></td>
        <td>
          <div class="action-buttons">
            <button class="edit-btn" onclick="adminPanel.editMenuItem(${item.id})">Edit</button>
            <button class="toggle-btn" onclick="adminPanel.toggleItemStatus(${item.id})">
              ${item.status === "available" ? "Disable" : "Enable"}
            </button>
            <button class="delete-btn" onclick="adminPanel.deleteMenuItem(${item.id})">Delete</button>
          </div>
        </td>
      `
      tbody.appendChild(row)
    })
  }

  filterMenuItems() {
    const searchTerm = document.getElementById("menu-search").value.toLowerCase()
    const categoryFilter = document.getElementById("category-filter").value

    const filteredItems = this.menuItems.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm)
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter
      return matchesSearch && matchesCategory
    })

    const tbody = document.getElementById("menu-table-body")
    tbody.innerHTML = ""

    filteredItems.forEach((item) => {
      const row = document.createElement("tr")
      row.innerHTML = `
        <td>${item.name}</td>
        <td><span class="category-badge">${item.category}</span></td>
        <td>₹${item.price}</td>
        <td><span class="status-badge status-${item.status}">${item.status}</span></td>
        <td>
          <div class="action-buttons">
            <button class="edit-btn" onclick="adminPanel.editMenuItem(${item.id})">Edit</button>
            <button class="toggle-btn" onclick="adminPanel.toggleItemStatus(${item.id})">
              ${item.status === "available" ? "Disable" : "Enable"}
            </button>
            <button class="delete-btn" onclick="adminPanel.deleteMenuItem(${item.id})">Delete</button>
          </div>
        </td>
      `
      tbody.appendChild(row)
    })
  }

  addMenuItem() {
    const name = document.getElementById("item-name").value
    const category = document.getElementById("item-category").value
    const price = Number.parseInt(document.getElementById("item-price").value)
    const description = document.getElementById("item-description").value

    const newItem = {
      id: Date.now(),
      name,
      category,
      price,
      description,
      status: "available",
    }

    this.menuItems.push(newItem)
    this.saveMenuItems()
    this.renderMenuTable()
    this.loadDashboardStats()
    this.closeAddItemModal()

    // Reset form
    document.getElementById("add-item-form").reset()
  }

  editMenuItem(id) {
    const item = this.menuItems.find((item) => item.id === id)
    if (!item) return

    document.getElementById("edit-item-id").value = item.id
    document.getElementById("edit-item-name").value = item.name
    document.getElementById("edit-item-category").value = item.category
    document.getElementById("edit-item-price").value = item.price
    document.getElementById("edit-item-description").value = item.description || ""

    document.getElementById("edit-item-modal").classList.add("active")
  }

  updateMenuItem() {
    const id = Number.parseInt(document.getElementById("edit-item-id").value)
    const name = document.getElementById("edit-item-name").value
    const category = document.getElementById("edit-item-category").value
    const price = Number.parseInt(document.getElementById("edit-item-price").value)
    const description = document.getElementById("edit-item-description").value

    const itemIndex = this.menuItems.findIndex((item) => item.id === id)
    if (itemIndex >= 0) {
      this.menuItems[itemIndex] = {
        ...this.menuItems[itemIndex],
        name,
        category,
        price,
        description,
      }

      this.saveMenuItems()
      this.renderMenuTable()
      this.closeEditItemModal()
    }
  }

  toggleItemStatus(id) {
    const item = this.menuItems.find((item) => item.id === id)
    if (item) {
      item.status = item.status === "available" ? "unavailable" : "available"
      this.saveMenuItems()
      this.renderMenuTable()
    }
  }

  deleteMenuItem(id) {
    if (confirm("Are you sure you want to delete this item?")) {
      this.menuItems = this.menuItems.filter((item) => item.id !== id)
      this.saveMenuItems()
      this.renderMenuTable()
      this.loadDashboardStats()
    }
  }

  renderOrders() {
    const grid = document.getElementById("orders-grid")
    grid.innerHTML = ""

    this.orders.forEach((order) => {
      const orderCard = document.createElement("div")
      orderCard.className = "order-card"
      orderCard.innerHTML = `
        <div class="order-header">
          <span class="order-id">${order.id}</span>
          <span class="order-status status-${order.status}">${order.status}</span>
        </div>
        <div class="order-details">
          <p><strong>Customer:</strong> ${order.customer}</p>
          <p><strong>Items:</strong> ${order.items.join(", ")}</p>
          <p><strong>Total:</strong> ₹${order.total}</p>
          <p><strong>Date:</strong> ${new Date(order.date).toLocaleString()}</p>
        </div>
        <div class="order-actions">
          <select onchange="adminPanel.updateOrderStatus('${order.id}', this.value)">
            <option value="pending" ${order.status === "pending" ? "selected" : ""}>Pending</option>
            <option value="preparing" ${order.status === "preparing" ? "selected" : ""}>Preparing</option>
            <option value="ready" ${order.status === "ready" ? "selected" : ""}>Ready</option>
            <option value="completed" ${order.status === "completed" ? "selected" : ""}>Completed</option>
          </select>
        </div>
      `
      grid.appendChild(orderCard)
    })
  }

  updateOrderStatus(orderId, newStatus) {
    const order = this.orders.find((order) => order.id === orderId)
    if (order) {
      order.status = newStatus
      this.saveOrders()
      this.renderOrders()
    }
  }

  filterOrders() {
    const statusFilter = document.getElementById("order-status-filter").value
    const dateFilter = document.getElementById("order-date-filter").value

    let filteredOrders = this.orders

    if (statusFilter !== "all") {
      filteredOrders = filteredOrders.filter((order) => order.status === statusFilter)
    }

    if (dateFilter) {
      const filterDate = new Date(dateFilter).toDateString()
      filteredOrders = filteredOrders.filter((order) => new Date(order.date).toDateString() === filterDate)
    }

    const grid = document.getElementById("orders-grid")
    grid.innerHTML = ""

    filteredOrders.forEach((order) => {
      const orderCard = document.createElement("div")
      orderCard.className = "order-card"
      orderCard.innerHTML = `
        <div class="order-header">
          <span class="order-id">${order.id}</span>
          <span class="order-status status-${order.status}">${order.status}</span>
        </div>
        <div class="order-details">
          <p><strong>Customer:</strong> ${order.customer}</p>
          <p><strong>Items:</strong> ${order.items.join(", ")}</p>
          <p><strong>Total:</strong> ₹${order.total}</p>
          <p><strong>Date:</strong> ${new Date(order.date).toLocaleString()}</p>
        </div>
        <div class="order-actions">
          <select onchange="adminPanel.updateOrderStatus('${order.id}', this.value)">
            <option value="pending" ${order.status === "pending" ? "selected" : ""}>Pending</option>
            <option value="preparing" ${order.status === "preparing" ? "selected" : ""}>Preparing</option>
            <option value="ready" ${order.status === "ready" ? "selected" : ""}>Ready</option>
            <option value="completed" ${order.status === "completed" ? "selected" : ""}>Completed</option>
          </select>
        </div>
      `
      grid.appendChild(orderCard)
    })
  }

  addSpecialDish() {
    const name = document.getElementById("special-name").value
    const price = Number.parseInt(document.getElementById("special-price").value)
    const description = document.getElementById("special-description").value
    const availableUntil = document.getElementById("special-availability").value

    const newSpecial = {
      id: Date.now(),
      name,
      price,
      description,
      availableUntil,
    }

    this.specialDishes.push(newSpecial)
    this.saveSpecialDishes()
    this.renderSpecialDishes()
    this.loadDashboardStats()
    this.closeAddSpecialModal()

    // Reset form
    document.getElementById("add-special-form").reset()
  }

  renderSpecialDishes() {
    const grid = document.getElementById("specials-grid")
    grid.innerHTML = ""

    this.specialDishes.forEach((special) => {
      const specialCard = document.createElement("div")
      specialCard.className = "special-card"
      specialCard.innerHTML = `
        <div class="special-badge">Special</div>
        <h3>${special.name}</h3>
        <p class="price">₹${special.price}</p>
        <p class="description">${special.description}</p>
        <p class="availability">Available until: ${new Date(special.availableUntil).toLocaleString()}</p>
        <div class="special-actions">
          <button class="delete-btn" onclick="adminPanel.deleteSpecialDish(${special.id})">Remove</button>
        </div>
      `
      grid.appendChild(specialCard)
    })
  }

  deleteSpecialDish(id) {
    if (confirm("Are you sure you want to remove this special dish?")) {
      this.specialDishes = this.specialDishes.filter((special) => special.id !== id)
      this.saveSpecialDishes()
      this.renderSpecialDishes()
      this.loadDashboardStats()
    }
  }

  closeAddItemModal() {
    document.getElementById("add-item-modal").classList.remove("active")
  }

  closeEditItemModal() {
    document.getElementById("edit-item-modal").classList.remove("active")
  }

  closeAddSpecialModal() {
    document.getElementById("add-special-modal").classList.remove("active")
  }
}

// Global functions for modal management
function openAddItemModal() {
  document.getElementById("add-item-modal").classList.add("active")
}

function closeAddItemModal() {
  document.getElementById("add-item-modal").classList.remove("active")
}

function openAddSpecialModal() {
  document.getElementById("add-special-modal").classList.add("active")
}

function closeAddSpecialModal() {
  document.getElementById("add-special-modal").classList.remove("active")
}

function closeEditItemModal() {
  document.getElementById("edit-item-modal").classList.remove("active")
}

function logout() {
  if (confirm("Are you sure you want to logout?")) {
    // Redirect to login page or home page
    window.location.href = "../index.html"
  }
}

// Initialize admin panel
let adminPanel
document.addEventListener("DOMContentLoaded", () => {
  adminPanel = new AdminPanel()
})

// Close modals when clicking outside
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal")) {
    e.target.classList.remove("active")
  }
})
