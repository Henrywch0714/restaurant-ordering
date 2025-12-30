// Menu data with dietary tags
const menuItems = [
    // Appetizers
    { id: 1, name: "Caesar Salad", description: "Fresh romaine lettuce with caesar dressing, croutons, and parmesan", price: 8.99, category: "appetizers", emoji: "🥗", tags: ["vegetarian", "gluten-free-option"], allergens: ["dairy"], restrictions: [] },
    { id: 2, name: "Bruschetta", description: "Toasted bread topped with fresh tomatoes, basil, and mozzarella", price: 7.99, category: "appetizers", emoji: "🍞", tags: ["vegetarian"], allergens: ["gluten", "dairy"], restrictions: [] },
    { id: 3, name: "Chicken Wings", description: "Crispy chicken wings with your choice of sauce", price: 10.99, category: "appetizers", emoji: "🍗", tags: [], allergens: [], restrictions: [] },
    { id: 4, name: "Spring Rolls", description: "Vegetable spring rolls with sweet and sour sauce", price: 6.99, category: "appetizers", emoji: "🥟", tags: ["vegetarian"], allergens: [], restrictions: [] },
    
    // Main Courses
    { id: 5, name: "Grilled Salmon", description: "Fresh salmon fillet with lemon butter sauce and vegetables", price: 18.99, category: "mains", emoji: "🐟", tags: ["low-carb", "high-protein"], allergens: ["fish"], restrictions: [] },
    { id: 6, name: "Beef Steak", description: "Tender ribeye steak cooked to perfection with mashed potatoes", price: 24.99, category: "mains", emoji: "🥩", tags: ["high-protein", "low-carb"], allergens: [], restrictions: [] },
    { id: 7, name: "Chicken Pasta", description: "Creamy pasta with grilled chicken and parmesan cheese", price: 14.99, category: "mains", emoji: "🍝", tags: ["high-protein"], allergens: ["gluten", "dairy"], restrictions: [] },
    { id: 8, name: "Margherita Pizza", description: "Classic pizza with tomato, mozzarella, and fresh basil", price: 12.99, category: "mains", emoji: "🍕", tags: ["vegetarian"], allergens: ["gluten", "dairy"], restrictions: [] },
    { id: 9, name: "Burger Deluxe", description: "Juicy beef burger with cheese, lettuce, tomato, and special sauce", price: 13.99, category: "mains", emoji: "🍔", tags: [], allergens: ["gluten", "dairy"], restrictions: [] },
    { id: 10, name: "Vegetable Curry", description: "Spicy vegetable curry with rice and naan bread", price: 11.99, category: "mains", emoji: "🍛", tags: ["vegetarian", "vegan-option"], allergens: ["gluten"], restrictions: [] },
    
    // Desserts
    { id: 11, name: "Chocolate Cake", description: "Rich chocolate layer cake with vanilla frosting", price: 7.99, category: "desserts", emoji: "🍰", tags: ["vegetarian"], allergens: ["gluten", "dairy", "eggs"], restrictions: ["high-sugar"] },
    { id: 12, name: "Ice Cream Sundae", description: "Vanilla ice cream with chocolate sauce and whipped cream", price: 6.99, category: "desserts", emoji: "🍨", tags: ["vegetarian"], allergens: ["dairy"], restrictions: ["high-sugar"] },
    { id: 13, name: "Cheesecake", description: "New York style cheesecake with berry compote", price: 8.99, category: "desserts", emoji: "🧁", tags: ["vegetarian"], allergens: ["gluten", "dairy", "eggs"], restrictions: ["high-sugar"] },
    { id: 14, name: "Tiramisu", description: "Classic Italian dessert with coffee and mascarpone", price: 9.99, category: "desserts", emoji: "☕", tags: ["vegetarian"], allergens: ["gluten", "dairy", "eggs"], restrictions: ["high-sugar", "caffeine"] },
    
    // Drinks
    { id: 15, name: "Fresh Orange Juice", description: "Freshly squeezed orange juice", price: 4.99, category: "drinks", emoji: "🍹", tags: ["vegetarian", "vegan"], allergens: [], restrictions: ["high-sugar"] },
    { id: 16, name: "Iced Coffee", description: "Cold brew coffee with ice and cream", price: 5.99, category: "drinks", emoji: "🧊", tags: ["vegetarian"], allergens: ["dairy"], restrictions: ["caffeine"] },
    { id: 17, name: "Lemonade", description: "Fresh lemonade with mint leaves", price: 4.99, category: "drinks", emoji: "🍋", tags: ["vegetarian", "vegan"], allergens: [], restrictions: ["high-sugar"] },
    { id: 18, name: "Soda", description: "Assorted soft drinks", price: 3.99, category: "drinks", emoji: "🥤", tags: ["vegetarian", "vegan"], allergens: [], restrictions: ["high-sugar"] }
];

// Cart state
let cart = [];
let currentCategory = 'all';

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    renderMenu();
    setupEventListeners();
});

// Render menu items
function renderMenu() {
    const menuGrid = document.getElementById('menuGrid');
    if (!menuGrid) {
        console.error('Menu grid element not found');
        return;
    }
    
    const filteredItems = currentCategory === 'all' 
        ? menuItems 
        : menuItems.filter(item => item.category === currentCategory);
    
    // Get recommended items from recommendation system
    const recommendedItems = window.recommendedItems || [];
    const isRecommended = (itemId) => recommendedItems.includes(itemId);
    
    menuGrid.innerHTML = filteredItems.map(item => `
        <div class="menu-item" data-item-id="${item.id}">
            <div class="menu-item-image">${item.emoji}</div>
            <h3>${item.name}</h3>
            <p>${item.description}</p>
            ${isRecommended(item.id) ? `<div class="recommendation-badge">${window.t ? window.t('recommended') : '✓ Recommended for you'}</div>` : ''}
            <div class="menu-item-footer">
                <span class="price">$${item.price.toFixed(2)}</span>
                <button class="add-btn" onclick="addToCart(${item.id}, event)">${window.t ? window.t('addToCart') : 'Add to Cart'}</button>
            </div>
        </div>
    `).join('');
}

// Setup event listeners
function setupEventListeners() {
    // Category tabs
    const tabButtons = document.querySelectorAll('.tab-btn');
    if (tabButtons.length === 0) {
        console.warn('Tab buttons not found');
    } else {
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                currentCategory = e.target.dataset.category;
                renderMenu();
            });
        });
    }
    
    // Checkout button
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', showCheckoutModal);
    }
    
    // Modal close
    const closeModalBtn = document.getElementById('closeModal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }
    
    const checkoutModal = document.getElementById('checkoutModal');
    if (checkoutModal) {
        checkoutModal.addEventListener('click', (e) => {
            if (e.target.id === 'checkoutModal') {
                closeModal();
            }
        });
    }
    
    // Confirm order
    const confirmOrderBtn = document.getElementById('confirmOrder');
    if (confirmOrderBtn) {
        confirmOrderBtn.addEventListener('click', confirmOrder);
    }
}

// Add item to cart - Fixed: event parameter added
function addToCart(itemId, event) {
    const item = menuItems.find(i => i.id === itemId);
    if (!item) {
        console.error('Item not found:', itemId);
        return;
    }
    
    const existingItem = cart.find(i => i.id === itemId);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ ...item, quantity: 1 });
    }
    
    updateCart();
    
    // Visual feedback
    if (event && event.target) {
        const addBtn = event.target;
        const originalText = addBtn.textContent;
        addBtn.textContent = 'Added!';
        addBtn.style.background = '#28a745';
        setTimeout(() => {
            addBtn.textContent = originalText;
            addBtn.style.background = '';
        }, 1000);
    }
}

// Remove item from cart
function removeFromCart(itemId) {
    cart = cart.filter(item => item.id !== itemId);
    updateCart();
}

// Update quantity
function updateQuantity(itemId, change) {
    const item = cart.find(i => i.id === itemId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(itemId);
        } else {
            updateCart();
        }
    }
}

// Update cart display
function updateCart() {
    const cartItems = document.getElementById('cartItems');
    const cartCount = document.getElementById('cartCount');
    const cartTotal = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    if (!cartItems || !cartCount || !cartTotal || !checkoutBtn) {
        console.error('Cart elements not found');
        return;
    }
    
    // Update count
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
    
    // Calculate total
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cartTotal.textContent = total.toFixed(2);
    
    // Update cart items display
    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
        checkoutBtn.disabled = true;
    } else {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</div>
                </div>
                <div class="cart-item-controls">
                    <button class="quantity-btn" onclick="updateQuantity(${item.id}, -1)">-</button>
                    <span class="quantity">${item.quantity}</span>
                    <button class="quantity-btn" onclick="updateQuantity(${item.id}, 1)">+</button>
                    <button class="remove-btn" onclick="removeFromCart(${item.id})">Remove</button>
                </div>
            </div>
        `).join('');
        checkoutBtn.disabled = false;
    }
}

// Show checkout modal
function showCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    const orderSummary = document.getElementById('orderSummary');
    const modalTotal = document.getElementById('modalTotal');
    
    if (!modal || !orderSummary || !modalTotal) {
        console.error('Modal elements not found');
        return;
    }
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    modalTotal.textContent = total.toFixed(2);
    
    if (cart.length === 0) {
        orderSummary.innerHTML = '<p>Your cart is empty</p>';
        return;
    }
    
    orderSummary.innerHTML = cart.map(item => `
        <div class="order-item">
            <span>${item.name} x${item.quantity}</span>
            <span>$${(item.price * item.quantity).toFixed(2)}</span>
        </div>
    `).join('');
    
    modal.style.display = 'block';
}

// Close modal
function closeModal() {
    const modal = document.getElementById('checkoutModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Confirm order
function confirmOrder() {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    alert(`Order confirmed! Total: $${total.toFixed(2)}\n\nThank you for your order!`);
    cart = [];
    updateCart();
    closeModal();
}

// Make functions globally accessible for onclick handlers
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;

