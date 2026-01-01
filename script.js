// Menu data - loaded from MongoDB via API
let menuItems = [];

// Cart state
let cart = [];
let currentCategory = 'all';

// API Configuration - Auto-detect environment
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === '';

// Make isLocalhost globally accessible to avoid duplicate declarations
window.isLocalhost = isLocalhost;

const API_BASE_URL = isLocalhost 
    ? 'http://localhost:5000'  // Local development
    : 'https://web-production-f1d28.up.railway.app';  // Production (GitHub Pages)

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    await loadMenuFromAPI();
    setupEventListeners();
});

// Load menu from MongoDB via API
async function loadMenuFromAPI() {
    try {
        // Add cache-busting and no-cache headers to always get fresh data
        const response = await fetch(`${API_BASE_URL}/api/menu`, {
            method: 'GET',
            cache: 'no-store' // Don't use cache (browser will handle this)
            // Removed custom headers to avoid CORS preflight issues
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.dishes) {
            menuItems = data.dishes;
            console.log(`✅ Loaded ${menuItems.length} dishes from database`);
            
            // Make menuItems globally accessible for recommendation.js
            window.menuItems = menuItems;
            
            // Dispatch event to notify that menu is loaded
            window.dispatchEvent(new CustomEvent('menuLoaded', { detail: menuItems }));
            
            renderMenu();
        } else {
            throw new Error('Invalid response format');
        }
    } catch (error) {
        console.error('❌ Error loading menu from API:', error);
        console.error('❌ Full error details:', error);
        console.log('⚠️ Falling back to empty menu. Please check:');
        console.log('   1. Backend server is running on http://localhost:5000');
        console.log('   2. MongoDB is connected');
        console.log('   3. Database has been seeded with dishes');
        console.log('   4. API URL:', `${API_BASE_URL}/api/menu`);
        
        // Set empty array for menuItems
        menuItems = [];
        window.menuItems = [];
        
        // Show error message to user with more details
        const menuGrid = document.getElementById('menuGrid');
        if (menuGrid) {
            menuGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                    <h3>⚠️ Unable to load menu</h3>
                    <p>Please check that the server is running and MongoDB is connected.</p>
                    <p style="color: #666; font-size: 0.9rem;">Error: ${error.message}</p>
                    <p style="color: #666; font-size: 0.9rem;">API URL: ${API_BASE_URL}/api/menu</p>
                    <button onclick="refreshMenu()" style="margin-top: 10px; padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        🔄 Try Again
                    </button>
                </div>
            `;
        }
    }
}

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

// Function to manually refresh menu from database
async function refreshMenu() {
    console.log('🔄 Refreshing menu from database...');
    const menuGrid = document.getElementById('menuGrid');
    if (menuGrid) {
        menuGrid.innerHTML = '<div style="text-align: center; padding: 2rem;">🔄 Refreshing menu...</div>';
    }
    await loadMenuFromAPI();
    // Show success message briefly
    setTimeout(() => {
        console.log('✅ Menu refreshed successfully!');
    }, 500);
}

// Make functions globally accessible for onclick handlers
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.refreshMenu = refreshMenu;

