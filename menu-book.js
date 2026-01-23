// Menu Book JavaScript
// ======================

// Configuration
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === '';

const API_BASE_URL = isLocalhost 
    ? 'http://localhost:5000'
    : 'https://web-production-f1d28.up.railway.app';

// State
let menuItems = [];
let originalDishes = []; // Store original dish data before flattening
let pages = [];
let currentPageIndex = 0;
// Items per page: 3 for mobile, 4 for desktop
function getItemsPerPage() {
    return window.innerWidth <= 768 ? 3 : 4;
}
let cartItems = [];
let translatedDishMap = {};
let translatedLanguage = 'en';
const TRANSLATION_CACHE_KEY = 'menu_translation_cache_v1';
const LANGUAGE_CODE_MAP = {
    zh: 'zh-TW',
    zhCN: 'zh-CN',
    en: 'en'
};

// Category order (traditional menu order)
const CATEGORY_ORDER = ['appetizers', 'mains', 'desserts', 'drinks'];
const CATEGORY_NAMES = {
    'appetizers': 'Appetizers',
    'mains': 'Main Courses',
    'desserts': 'Desserts',
    'drinks': 'Drinks'
};

function getCurrentLanguage() {
    return window.currentLanguage || localStorage.getItem('language') || 'en';
}

function translateUi(key) {
    if (typeof window.t === 'function') {
        return window.t(key);
    }
    return key;
}

function formatTemplate(template, vars) {
    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

function getCategoryLabel(category) {
    switch (category) {
        case 'appetizers':
            return translateUi('categoryAppetizers');
        case 'mains':
            return translateUi('categoryMains');
        case 'desserts':
            return translateUi('categoryDesserts');
        case 'drinks':
            return translateUi('categoryDrinks');
        default:
            return CATEGORY_NAMES[category] || category;
    }
}

// Touch/swipe support
let touchStartX = 0;
let touchEndX = 0;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadMenu();
    await applyTranslationsForLanguage(getCurrentLanguage());
    organizeDishesByCategory();
    createPages();
    renderPages();
    setupTableOfContents();
    setupNavigation();
    setupKeyboardNavigation();
    setupTouchNavigation();
    setupCartHandlers();
    
    // Setup dish card click handlers for nutrition info
    setupDishCardClickHandlers();
    
    // Listen for recommendation changes
    setupRecommendationListener();
    
    // Handle window resize to recreate pages with correct items per page
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const prevPageIndex = currentPageIndex;
            organizeDishesByCategory();
            createPages();
            renderPages();
            // Try to restore to same page if possible
            if (prevPageIndex < pages.length) {
                showPage(prevPageIndex, 'right');
            }
        }, 250);
    });
    
    // Hide loading overlay
    document.getElementById('loadingOverlay').classList.add('hidden');
    
    // Show welcome window for 2 seconds, then fade out
    showWelcomeWindow();
});

// Show welcome window
function showWelcomeWindow() {
    const welcomeWindow = document.getElementById('welcomeWindow');
    if (!welcomeWindow) return;
    
    // Show the window
    welcomeWindow.style.display = 'flex';
    
    // After 2.5 seconds, fade out
    setTimeout(() => {
        welcomeWindow.classList.add('fade-out');
        // Remove from DOM after fade completes
        setTimeout(() => {
            welcomeWindow.style.display = 'none';
        }, 800); // Match fade-out transition duration
    }, 2500);
}

// Load menu from API
async function loadMenu() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/menu`, {
            method: 'GET',
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.dishes) {
            menuItems = data.dishes;
            originalDishes = data.dishes; // Store original dishes
            console.log(`✅ Loaded ${menuItems.length} dishes from database`);
        } else {
            throw new Error('Invalid response format');
        }
    } catch (error) {
        console.error('❌ Error loading menu:', error);
        menuItems = [];
        showError('Unable to load menu. Please check your connection.');
    }
}

function buildTranslationCacheKey(lang, dishes) {
    const payload = dishes.map(dish => `${dish.id}:${dish.name}|${dish.description || ''}|${(dish.ingredients || []).join(',')}`).join('||');
    return `${TRANSLATION_CACHE_KEY}:${lang}:${payload.length}:${payload}`;
}

function extractTranslations(data) {
    if (!data) return [];
    if (Array.isArray(data)) {
        return data.map(item => item.translatedText || item.text || item);
    }
    if (Array.isArray(data.translatedText)) {
        return data.translatedText;
    }
    if (typeof data.translatedText === 'string') {
        return [data.translatedText];
    }
    if (Array.isArray(data.translations)) {
        return data.translations.map(item => item.text || item.translatedText || '');
    }
    return [];
}

async function translateTexts(texts, targetLang) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let response;
    try {
        response = await fetch(`${API_BASE_URL}/api/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                texts,
                source: 'en',
                target: targetLang
            }),
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }
    if (!response.ok) {
        throw new Error(`Translation error: ${response.status}`);
    }
    const data = await response.json();
    const translated = extractTranslations(data);
    if (translated.length !== texts.length) {
        throw new Error('Translation response length mismatch');
    }
    return translated;
}

async function applyTranslationsForLanguage(lang) {
    translatedLanguage = lang;
    translatedDishMap = {};
    applyBookTranslations(lang);

    if (lang === 'en') {
        return;
    }

    const target = LANGUAGE_CODE_MAP[lang] || lang;
    const allHaveTranslations = originalDishes.length > 0 && originalDishes.every(dish => dish.translations && dish.translations[lang]);
    if (allHaveTranslations) {
        return;
    }
    const cacheKey = buildTranslationCacheKey(target, originalDishes);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            translatedDishMap = JSON.parse(cached);
            return;
        } catch (error) {
            console.warn('Failed to parse translation cache:', error);
        }
    }

    const texts = [];
    originalDishes.forEach(dish => {
        texts.push(dish.name);
        texts.push(dish.description || '');
        const ingredients = Array.isArray(dish.ingredients) ? dish.ingredients.join(', ') : '';
        texts.push(ingredients);
    });

    try {
        const translated = await translateTexts(texts, target);
        const map = {};
        let idx = 0;
        originalDishes.forEach(dish => {
            map[dish.id] = {
                name: translated[idx++] || dish.name,
                description: translated[idx++] || dish.description || '',
                ingredients: translated[idx++] || (dish.ingredients || []).join(', ')
            };
        });
        translatedDishMap = map;
        localStorage.setItem(cacheKey, JSON.stringify(map));
    } catch (error) {
        console.warn('Translation failed, falling back to English:', error);
        translatedDishMap = {};
    }
}

function getTranslatedDish(dish) {
    if (!dish || translatedLanguage === 'en') return dish;
    const fromDb = dish.translations && dish.translations[translatedLanguage];
    if (fromDb) {
        return {
            ...dish,
            name: fromDb.name || dish.name,
            description: fromDb.description || dish.description,
            ingredients: fromDb.ingredients ? fromDb.ingredients.split(',').map(item => item.trim()) : dish.ingredients
        };
    }
    const translated = translatedDishMap[dish.id];
    if (!translated) return dish;
    return {
        ...dish,
        name: translated.name || dish.name,
        description: translated.description || dish.description,
        ingredients: translated.ingredients ? translated.ingredients.split(',').map(item => item.trim()) : dish.ingredients
    };
}

function applyBookTranslations(lang) {
    const headerTitle = document.querySelector('.book-header h1');
    if (headerTitle) {
        const logoImg = headerTitle.querySelector('img.logo-icon');
        if (logoImg) {
            headerTitle.innerHTML = `${logoImg.outerHTML} ${translateUi('title')}`;
        } else {
            headerTitle.textContent = translateUi('title');
        }
    }

    const subtitle = document.querySelector('.book-header .subtitle');
    if (subtitle) subtitle.textContent = translateUi('bookSubtitle');

    const tocTitle = document.querySelector('.table-of-contents h2');
    if (tocTitle) tocTitle.textContent = translateUi('tocTitle');

    const loadingText = document.querySelector('#loadingOverlay p');
    if (loadingText) loadingText.textContent = translateUi('loadingMenu');

    const cartTitle = document.querySelector('#cartModal h2');
    if (cartTitle) cartTitle.textContent = translateUi('cartTitleBook');

    const cartTotalLabel = document.querySelector('.cart-total span');
    if (cartTotalLabel) cartTotalLabel.textContent = translateUi('cartTotalLabel');

    const paymentLabel = document.querySelector('label[for="paymentMethod"]');
    if (paymentLabel) paymentLabel.textContent = translateUi('paymentMethodLabel');

    const confirmPayBtn = document.getElementById('cartPayBtn');
    if (confirmPayBtn) confirmPayBtn.textContent = translateUi('confirmPayment');

    const paymentSelect = document.getElementById('paymentMethod');
    if (paymentSelect) {
        const options = paymentSelect.querySelectorAll('option');
        options.forEach(option => {
            if (option.value === 'card') option.textContent = translateUi('paymentCard');
            if (option.value === 'cash') option.textContent = translateUi('paymentCash');
            if (option.value === 'mobile') option.textContent = translateUi('paymentMobile');
        });
    }

    const prevText = document.querySelector('.prev-btn .nav-text');
    if (prevText) prevText.textContent = translateUi('navPrev');

    const nextText = document.querySelector('.next-btn .nav-text');
    if (nextText) nextText.textContent = translateUi('navNext');

    const input = document.getElementById('chatbotInputBook');
    if (input) input.placeholder = translateUi('chatbotPlaceholder');
    const sendBtn = document.getElementById('sendMessageBtnBook');
    if (sendBtn) sendBtn.textContent = translateUi('chatbotSend');

    const micBtn = document.getElementById('voiceInputBtnBook');
    if (micBtn) micBtn.title = translateUi('micTitle');

    createPages();
    renderPages();
    setupTableOfContents();
}

window.onLanguageChange = async (lang) => {
    await applyTranslationsForLanguage(lang);
    organizeDishesByCategory();
    createPages();
    renderPages();
    setupTableOfContents();
};

// Organize dishes by category in traditional menu order
function organizeDishesByCategory() {
    const organized = [];
    const sourceDishes = originalDishes.length > 0 ? originalDishes : menuItems;
    
    // Sort dishes by category order
    CATEGORY_ORDER.forEach(category => {
        const categoryDishes = sourceDishes.filter(item => item.category === category && !item.type);
        if (categoryDishes.length > 0) {
            organized.push({
                category: category,
                categoryName: getCategoryLabel(category),
                dishes: categoryDishes
            });
        }
    });
    
    // Flatten into single array with category markers
    const flattened = [];
    organized.forEach(group => {
        // Add category header as a special item
        flattened.push({
            type: 'category-header',
            category: group.category,
            categoryName: group.categoryName
        });
        // Add dishes
        group.dishes.forEach(dish => {
            flattened.push({
                ...dish,
                type: 'dish'
            });
        });
    });
    
    menuItems = flattened;
}

// Create pages - cover page is added separately
function createPages() {
    pages = [];
    
    // First page is always the cover (empty array with type 'cover')
    pages.push([{ type: 'cover' }]);
    
    let currentPageItems = [];
    
    menuItems.forEach((item, index) => {
        // If it's a category header and current page has items, start new page
        if (item.type === 'category-header' && currentPageItems.length > 0) {
            pages.push([...currentPageItems]);
            currentPageItems = [];
        }
        
        currentPageItems.push(item);
        
        // If page is full, start new page
        const dishCount = currentPageItems.filter(i => i.type === 'dish').length;
        if (dishCount >= getItemsPerPage()) {
            pages.push([...currentPageItems]);
            currentPageItems = [];
        }
    });
    
    // Add remaining items
    if (currentPageItems.length > 0) {
        pages.push(currentPageItems);
    }
    
    // Ensure we have at least cover + one content page
    if (pages.length === 1) {
        pages.push([]);
    }
    
    console.log(`📖 Created ${pages.length} pages (1 cover + ${pages.length - 1} content pages) from ${menuItems.length} items`);
}

// Render all pages
function renderPages() {
    const bookPages = document.getElementById('bookPages');
    if (!bookPages) return;
    
    // Store the current page index before clearing
    const previousPageIndex = currentPageIndex;
    
    // Clear all pages
    bookPages.innerHTML = '';
    
    pages.forEach((pageItems, pageIndex) => {
        const page = document.createElement('div');
        page.className = 'book-page';
        page.id = `page-${pageIndex}`;
        page.dataset.pageIndex = pageIndex;
        
        // Set initial state: hide all pages immediately to prevent flashing
        page.style.display = 'none';
        page.style.opacity = '1';
        page.classList.remove('active', 'flip-out-left', 'flip-out-right', 'flip-in-left', 'flip-in-right');
        
        // Check if this is the cover page
        const isCover = pageItems.length === 1 && pageItems[0].type === 'cover';
        
        if (isCover) {
            // Render cover page
            page.classList.add('book-cover');
            page.innerHTML = createCoverHTML();
        } else {
            // Render content page
            // Determine category for this page
            let pageCategory = null;
            let pageCategoryName = 'Menu';
            
            // Find the category header in this page
            const categoryHeader = pageItems.find(item => item.type === 'category-header');
            if (categoryHeader) {
                pageCategory = categoryHeader.category;
                pageCategoryName = categoryHeader.categoryName;
            } else {
                // Look at previous pages to find the category (skip cover)
                for (let i = pageIndex - 1; i > 0; i--) {
                    const prevCategoryHeader = pages[i].find(item => item.type === 'category-header');
                    if (prevCategoryHeader) {
                        pageCategory = prevCategoryHeader.category;
                        pageCategoryName = prevCategoryHeader.categoryName;
                        break;
                    }
                }
            }
            
            // Page header
            const pageHeader = `
                <div class="page-header">
                    <h2 class="page-title">${pageCategoryName}</h2>
                    <p class="page-subtitle">${getPageSubtitle(pageIndex)}</p>
                </div>
            `;
            
            // Dishes grid
            const dishes = pageItems.filter(item => item.type === 'dish');
            const dishesGrid = `
                <div class="dishes-grid">
                    ${dishes.map(dish => createDishHTML(dish)).join('')}
                </div>
            `;
            
            // Fill empty slots if needed
            const emptySlots = getItemsPerPage() - dishes.length;
            let emptySlotsHTML = '';
            for (let i = 0; i < emptySlots; i++) {
                emptySlotsHTML += '<div class="dish-item" style="visibility: hidden;"></div>';
            }
            
            // Page footer (adjust page number to exclude cover)
            const contentPageNum = pageIndex;
            const totalContentPages = pages.length - 1;
            const pageFooter = `
                <div class="page-footer">
                    Page ${contentPageNum} of ${totalContentPages}
                </div>
            `;
            
            page.innerHTML = pageHeader + dishesGrid + emptySlotsHTML + pageFooter;
        }
        
        bookPages.appendChild(page);
    });
    
    // Reset currentPageIndex to 0 (cover page) - always start at cover after render
    currentPageIndex = 0;
    
    // Use requestAnimationFrame to ensure DOM is ready before showing cover
    requestAnimationFrame(() => {
        // Show cover page (page 0) initially - after all pages are created
        const coverPage = document.getElementById('page-0');
        if (coverPage) {
            coverPage.style.display = 'block';
            coverPage.style.opacity = ''; // Reset to CSS default
            coverPage.classList.add('active');
        }
        
        // Ensure all other pages are hidden (double-check)
        document.querySelectorAll('.book-pages .book-page').forEach(page => {
            if (!page.classList.contains('active')) {
                page.style.display = 'none';
                page.style.opacity = ''; // Reset to CSS default
            }
        });
        
        updatePageIndicator();
        updateTableOfContentsVisibility();
    });
}
function setupCartHandlers() {
    const bookPages = document.getElementById('bookPages');
    const cartShortcut = document.getElementById('cartShortcut');
    const cartModal = document.getElementById('cartModal');
    const cartCloseBtn = document.getElementById('cartCloseBtn');
    const cartPayBtn = document.getElementById('cartPayBtn');
    const cartItemsEl = document.getElementById('cartItems');

    if (bookPages) {
        bookPages.addEventListener('click', (event) => {
            const button = event.target.closest('.dish-add-btn');
            if (!button) return;
            const dishId = button.dataset.dishId;
            addToCart(dishId);
        });
    }

    if (cartShortcut) {
        cartShortcut.addEventListener('click', () => {
            renderCart();
            cartModal.style.display = 'flex';
        });
    }

    if (cartCloseBtn) {
        cartCloseBtn.addEventListener('click', () => {
            cartModal.style.display = 'none';
        });
    }

    if (cartModal) {
        cartModal.addEventListener('click', (event) => {
            if (event.target === cartModal) {
                cartModal.style.display = 'none';
            }
        });
    }

    if (cartItemsEl) {
        cartItemsEl.addEventListener('click', (event) => {
            const removeBtn = event.target.closest('.cart-remove-btn');
            if (!removeBtn) return;
            const dishId = removeBtn.dataset.dishId;
            removeFromCart(dishId);
        });
    }

    if (cartPayBtn) {
        cartPayBtn.addEventListener('click', () => {
            if (cartItems.length === 0) {
                alert('Your cart is empty.');
                return;
            }
            clearCart();
            alert('Payment confirmed (demo). Thank you!');
            cartModal.style.display = 'none';
            if (typeof resetRecommendations === 'function') {
                resetRecommendations();
            }
            if (window.chatbotApi && typeof window.chatbotApi.resetSession === 'function') {
                window.chatbotApi.resetSession();
            }
        });
    }
}

function addToCart(dishId) {
    const dish = getDishById(dishId);
    if (!dish) return;

    const existing = cartItems.find(item => String(item.id) === String(dish.id));
    if (existing) {
        existing.quantity += 1;
    } else {
        cartItems.push({
            id: dish.id,
            name: dish.name,
            price: parseFloat(dish.price || 0),
            emoji: dish.emoji || '🍽️',
            quantity: 1
        });
    }
    updateCartCount();
}

function addToCartQuantity(dishId, quantity) {
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    for (let i = 0; i < qty; i += 1) {
        addToCart(dishId);
    }
}

function removeFromCart(dishId) {
    cartItems = cartItems.filter(item => String(item.id) !== String(dishId));
    updateCartCount();
    renderCart();
}

function updateCartQuantity(dishId, quantity) {
    const qty = Math.max(0, parseInt(quantity, 10) || 0);
    const item = cartItems.find(cartItem => String(cartItem.id) === String(dishId));
    if (!item) return;
    if (qty === 0) {
        removeFromCart(dishId);
        return;
    }
    item.quantity = qty;
    updateCartCount();
    renderCart();
}

function clearCart() {
    cartItems = [];
    updateCartCount();
    renderCart();
}

function updateCartCount() {
    const bubble = document.getElementById('cartCountBubble');
    if (!bubble) return;
    const count = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    bubble.textContent = String(count);
    bubble.style.display = count > 0 ? 'inline-flex' : 'none';
}

function renderCart() {
    const cartItemsEl = document.getElementById('cartItems');
    const cartTotalEl = document.getElementById('cartTotal');
    if (!cartItemsEl || !cartTotalEl) return;

    if (cartItems.length === 0) {
        cartItemsEl.innerHTML = `<p class="cart-empty">${translateUi('emptyCart')}</p>`;
        cartTotalEl.textContent = '$0.00';
        return;
    }

    cartItemsEl.innerHTML = cartItems.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <span class="cart-item-emoji">${item.emoji}</span>
                <div>
                    <div class="cart-item-name">${getTranslatedDish(getDishById(item.id))?.name || item.name}</div>
                    <div class="cart-item-meta">x${item.quantity} · $${item.price.toFixed(2)}</div>
                </div>
            </div>
            <button class="cart-remove-btn" data-dish-id="${item.id}">${translateUi('remove')}</button>
        </div>
    `).join('');

    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    cartTotalEl.textContent = `$${total.toFixed(2)}`;
}

function getDishById(dishId) {
    const idStr = String(dishId);
    const fromOriginal = originalDishes.find(item => String(item.id) === idStr);
    if (fromOriginal) return fromOriginal;
    const fromFlattened = menuItems.find(item => item.type === 'dish' && String(item.id) === idStr);
    return fromFlattened || null;
}

function findDishByName(name) {
    if (!name) return null;
    const needle = name.toLowerCase().trim();
    if (!needle) return null;
    // Prefer exact match
    const exact = originalDishes.find(item => item.name.toLowerCase() === needle);
    if (exact) return exact;
    // Fallback to partial match
    return originalDishes.find(item => item.name.toLowerCase().includes(needle)) || null;
}

// Expose helpers for chatbot nutrition descriptions
window.getDishById = getDishById;
window.findDishByName = findDishByName;

// Setup dish card click handlers to show nutrition info
function setupDishCardClickHandlers() {
    // Use event delegation since dishes are dynamically rendered
    document.addEventListener('click', (e) => {
        const dishItem = e.target.closest('.dish-item');
        if (!dishItem) return;
        
        // Don't trigger if clicking the add button
        if (e.target.closest('.dish-add-btn')) return;
        
        // Check if click is in the center area (ignore edges - 10% margin on each side)
        const rect = dishItem.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const itemWidth = rect.width;
        const itemHeight = rect.height;
        
        // Define edge margin (10% on each side)
        const edgeMargin = 0.1;
        const minX = itemWidth * edgeMargin;
        const maxX = itemWidth * (1 - edgeMargin);
        const minY = itemHeight * edgeMargin;
        const maxY = itemHeight * (1 - edgeMargin);
        
        // Only trigger if click is in the center area (not on edges)
        if (clickX >= minX && clickX <= maxX && clickY >= minY && clickY <= maxY) {
            const dishId = dishItem.dataset.dishId;
            const mongoId = dishItem.dataset.dishMongoId;
            
            if (dishId) {
                e.stopPropagation(); // Prevent page turning
                showNutritionPopup(dishId, mongoId);
            }
        }
    });
}

// Show nutrition popup window
function showNutritionPopup(dishId, mongoId) {
    let dish = getDishById(dishId);
    
    // If not found by ID, try mongoId
    if (!dish && mongoId) {
        dish = originalDishes.find(d => String(d.mongoId) === String(mongoId));
    }
    
    if (!dish) {
        console.error('Dish not found:', dishId, mongoId);
        return;
    }
    
    const displayDish = getTranslatedDish(dish);
    const nutrition = dish.nutrition || {};
    const iddsiLevel = dish.iddsi_level;
    
    // Create or get popup element
    let popup = document.getElementById('nutritionPopup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'nutritionPopup';
        popup.className = 'nutrition-popup-overlay';
        document.body.appendChild(popup);
    }
    
    // Build nutrition info HTML - only show fields that have values
    const iddsiHtml = typeof iddsiLevel === 'number' 
        ? `<div class="nutrition-iddsi">
            <span class="nutrition-label">IDDSI Level:</span>
            <span class="nutrition-value iddsi-value">${iddsiLevel}</span>
           </div>`
        : '';
    
    // Build nutrition items - only include fields with actual values
    // Check both database field names (energy_kcal, protein_g, etc.) and alternative names (calories, protein, etc.)
    const nutritionItems = [];
    const nutritionFields = [
        { keys: ['energy_kcal', 'calories'], label: 'Calories', unit: 'kcal' },
        { keys: ['protein_g', 'protein'], label: 'Protein', unit: 'g' },
        { keys: ['fat_g', 'fat'], label: 'Fat', unit: 'g' },
        { keys: ['saturated_fat_g', 'saturated_fat'], label: 'Saturated Fat', unit: 'g' },
        { keys: ['carbohydrates_g', 'carbs'], label: 'Carbs', unit: 'g' },
        { keys: ['sugars_g', 'sugar'], label: 'Sugar', unit: 'g' },
        { keys: ['sodium_mg', 'sodium'], label: 'Sodium', unit: 'mg' }
    ];
    
    nutritionFields.forEach(field => {
        // Try each possible key name
        let value = null;
        for (const key of field.keys) {
            if (nutrition[key] !== null && nutrition[key] !== undefined && nutrition[key] !== '') {
                value = nutrition[key];
                break;
            }
        }
        
        // Only add if value exists
        if (value !== null && value !== undefined && value !== '') {
            nutritionItems.push(`
                <div class="nutrition-item">
                    <span class="nutrition-label">${field.label}:</span>
                    <span class="nutrition-value">${value} ${field.unit}</span>
                </div>
            `);
        }
    });
    
    const nutritionGridHtml = nutritionItems.length > 0
        ? `<div class="nutrition-section">
            <h4>Nutrition (per serving)</h4>
            <div class="nutrition-grid">
                ${nutritionItems.join('')}
            </div>
        </div>`
        : '';
    
    popup.innerHTML = `
        <div class="nutrition-popup-content" onclick="event.stopPropagation()">
            <div class="nutrition-popup-header">
                <h3>${displayDish.name}</h3>
                <button class="nutrition-popup-close" aria-label="Close">✕</button>
            </div>
            <div class="nutrition-popup-body">
                ${iddsiHtml}
                ${nutritionGridHtml}
                ${dish.ingredients && dish.ingredients.length > 0 ? `
                <div class="nutrition-section">
                    <h4>Ingredients</h4>
                    <p class="nutrition-ingredients">${dish.ingredients.join(', ')}</p>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    // Show popup
    popup.style.display = 'flex';
    
    // Close handlers
    const closeBtn = popup.querySelector('.nutrition-popup-close');
    const closePopup = () => {
        popup.style.display = 'none';
    };
    
    closeBtn.addEventListener('click', closePopup);
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            closePopup();
        }
    });
}

function openCartModal() {
    const cartModal = document.getElementById('cartModal');
    if (!cartModal) return;
    renderCart();
    cartModal.style.display = 'flex';
}

function checkoutCart() {
    if (cartItems.length === 0) {
        return { ok: false, reason: 'empty' };
    }
    clearCart();
    return { ok: true };
}

// Expose a small API for the chatbot
window.cartApi = {
    addById: (dishId, quantity = 1) => addToCartQuantity(dishId, quantity),
    addByName: (dishName, quantity = 1) => {
        const dish = findDishByName(dishName);
        if (!dish) return { ok: false, reason: 'not_found' };
        addToCartQuantity(dish.id, quantity);
        return { ok: true, dish };
    },
    removeByName: (dishName) => {
        const dish = findDishByName(dishName);
        if (!dish) return { ok: false, reason: 'not_found' };
        removeFromCart(dish.id);
        return { ok: true, dish };
    },
    updateQuantityByName: (dishName, quantity) => {
        const dish = findDishByName(dishName);
        if (!dish) return { ok: false, reason: 'not_found' };
        updateCartQuantity(dish.id, quantity);
        return { ok: true, dish, quantity };
    },
    openCart: () => openCartModal(),
    checkout: () => checkoutCart()
};

window.menuBookApi = {
    resetRecommendations: () => resetRecommendations(),
    clearCart: () => clearCart(),
    refreshRecommendations: (showRecommendedPage = false) => refreshRecommendedPage(showRecommendedPage)
};

// Create cover page HTML
function createCoverHTML() {
    return `
        <div class="cover-content">
            <div class="cover-logo">
                <img src="icon-new.jpg" alt="Restaurant logo" class="cover-logo-img">
            </div>
            <h1 class="cover-title">${translateUi('coverTitle')}</h1>
            <h2 class="cover-subtitle">${translateUi('coverSubtitle')}</h2>
            <div class="cover-divider"></div>
            <p class="cover-tagline">${translateUi('coverTagline')}</p>
            <p class="cover-instruction">${translateUi('coverInstruction')}</p>
        </div>
    `;
}

// Create HTML for a single dish
function createDishHTML(dish) {
    const displayDish = getTranslatedDish(dish);
    // Check if this dish is recommended
    const recommendedItems = window.recommendedItems || [];
    const recommendationsApplied = window.recommendationsApplied || false;
    
    const isRecommended = () => {
        if (!recommendationsApplied) {
            return false;
        }
        const idsToCheck = [];
        if (typeof dish.id !== 'undefined') {
            idsToCheck.push(String(dish.id));
        }
        if (dish.mongoId) {
            idsToCheck.push(String(dish.mongoId));
        }
        const isRec = recommendedItems.some(recId => idsToCheck.includes(String(recId)));
        if (isRec) {
            console.log(`✅ Dish "${displayDish.name}" is recommended. IDs:`, idsToCheck, 'Recommended IDs:', recommendedItems);
        }
        return isRec;
    };
    
    const badgeHtml = isRecommended() 
        ? `<span class="recommendation-badge-book">${translateUi('recommended')}</span>`
        : '';
    const iddsiBadge = typeof dish.iddsi_level === 'number'
        ? `<span class="iddsi-badge" title="IDDSI Level ${dish.iddsi_level}">IDDSI ${dish.iddsi_level}</span>`
        : '';
    
    // Get image path - check both dish.image and displayDish.image
    const dishImage = dish.image || displayDish.image || '';
    const imageClass = dishImage ? 'dish-item-with-image' : '';
    const imageStyle = dishImage ? `--dish-image: url('${dishImage}');` : '';
    
    return `
        <div class="dish-item ${imageClass}" data-dish-id="${dish.id}" data-dish-mongo-id="${dish.mongoId || ''}" style="${imageStyle}">
            ${iddsiBadge}
            <div class="dish-content">
                <h3 class="dish-name">
                    ${displayDish.name}
                    ${badgeHtml}
                </h3>
                <p class="dish-description">${displayDish.description || ''}</p>
                <div class="dish-price">$${parseFloat(displayDish.price || 0).toFixed(2)}</div>
                <button class="dish-add-btn" data-dish-id="${dish.id}">+ ${translateUi('addToCart')}</button>
            </div>
        </div>
    `;
}

// Get page subtitle
function getPageSubtitle(pageIndex) {
    // Skip cover page (index 0) when calculating
    const contentPageIndex = pageIndex - 1;
    if (contentPageIndex < 0) return '';
    
    const totalDishes = menuItems.filter(item => item.type === 'dish').length;
    const itemsPerPage = getItemsPerPage();
    const startDish = contentPageIndex * itemsPerPage + 1;
    const endDish = Math.min((contentPageIndex + 1) * itemsPerPage, totalDishes);
    
    if (totalDishes === 0) {
        return translateUi('noItems');
    }

    const template = translateUi('itemsRange');
    return formatTemplate(template, { start: startDish, end: endDish, total: totalDishes });
}

// Show specific page with realistic page-turning animation
function showPage(pageIndex, direction = 'right') {
    if (pageIndex < 0 || pageIndex >= pages.length) return;
    
    // Don't animate if already on this page (unless it's the initial render)
    if (pageIndex === currentPageIndex) {
        // If no active page exists, show it without animation (initial state)
        const activePage = document.querySelector('.book-page.active');
        if (!activePage) {
            const targetPage = document.getElementById(`page-${pageIndex}`);
            if (targetPage) {
                targetPage.style.display = 'block';
                targetPage.style.opacity = ''; // Reset to CSS default
                targetPage.classList.add('active');
            }
        }
        return;
    }
    
    
    const isNext = pageIndex > currentPageIndex;
    const actualDirection = isNext ? 'right' : 'left';
    
    // Animate current page out
    const currentPage = document.querySelector('.book-page.active');
    if (currentPage) {
        currentPage.classList.remove('active');
        // Remove any previous animation classes
        currentPage.classList.remove('flip-out-left', 'flip-out-right', 'flip-in-left', 'flip-in-right');
        
        // Add appropriate flip-out animation
        if (actualDirection === 'right') {
            currentPage.classList.add('flip-out-right');
        } else {
            currentPage.classList.add('flip-out-left');
        }
        
        // Clean up animation classes after animation completes
        setTimeout(() => {
            currentPage.classList.remove('flip-out-left', 'flip-out-right');
            currentPage.style.display = 'none';
        }, 1000);
    }
    
    // Show new page directly (no animation - appears immediately)
    const newPage = document.getElementById(`page-${pageIndex}`);
    if (newPage) {
        // Reset all pages
        document.querySelectorAll('.book-page').forEach(page => {
            page.classList.remove('active', 'flip-out-left', 'flip-out-right', 'flip-in-left', 'flip-in-right');
            if (page !== newPage && page !== currentPage) {
                page.style.display = 'none';
            }
        });
        
        // Show new page directly without animation
        newPage.style.display = 'block';
        newPage.style.opacity = '1';
        newPage.classList.add('active');
        newPage.classList.remove('flip-out-left', 'flip-out-right', 'flip-in-left', 'flip-in-right');
        
        currentPageIndex = pageIndex;
        updatePageIndicator();
        updateTableOfContents();
        updateTableOfContentsVisibility();
    }
}

// Show/hide table of contents based on current page
function updateTableOfContentsVisibility() {
    const bookContainer = document.querySelector('.book-container');
    if (currentPageIndex === 0) {
        bookContainer.classList.add('on-cover');
    } else {
        bookContainer.classList.remove('on-cover');
    }
}

// Update page indicator
function updatePageIndicator() {
    // For display, show content page numbers (excluding cover)
    const contentPageNumber = currentPageIndex === 0 ? 0 : currentPageIndex;
    const totalContentPages = pages.length - 1;
    
    if (currentPageIndex === 0) {
        document.getElementById('pageNumber').textContent = 'Cover';
        document.getElementById('totalPages').textContent = totalContentPages;
    } else {
        document.getElementById('pageNumber').textContent = contentPageNumber;
        document.getElementById('totalPages').textContent = totalContentPages;
    }
    
    // Update navigation buttons
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    prevBtn.disabled = currentPageIndex === 0;
    nextBtn.disabled = currentPageIndex >= pages.length - 1;
}

// Setup table of contents
function setupTableOfContents() {
    const tocList = document.getElementById('tocList');
    tocList.innerHTML = '';
    
    // Find first page of each category (skip cover page at index 0)
    const categoryPages = {};
    
    pages.forEach((pageItems, pageIndex) => {
        // Skip cover page
        if (pageIndex === 0) return;
        
        const categoryHeader = pageItems.find(item => item.type === 'category-header');
        if (categoryHeader && !categoryPages[categoryHeader.category]) {
            categoryPages[categoryHeader.category] = {
                name: categoryHeader.categoryName,
                pageIndex: pageIndex
            };
        }
    });
    
    // Add Recommended category first if it exists
    if (categoryPages['recommended']) {
        const li = createTOCItem(translateUi('recommendedCategory'), categoryPages['recommended'].pageIndex, 'recommended');
        tocList.appendChild(li);
    }
    
    // Add TOC items in category order
    CATEGORY_ORDER.forEach(category => {
        if (categoryPages[category]) {
            const li = createTOCItem(categoryPages[category].name, categoryPages[category].pageIndex, category);
            tocList.appendChild(li);
        }
    });
    
    updateTableOfContents();
}

// Create TOC item with green circle for recommended count
function createTOCItem(name, pageIndex, category) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#';
    
    // Get recommended count for this category
    const recommendedItems = window.recommendedItems || [];
    const recommendationsApplied = window.recommendationsApplied || false;
    
    let recommendedCount = 0;
    if (recommendationsApplied && recommendedItems.length > 0) {
        // Count recommended dishes in this category
        const categoryDishes = menuItems.filter(item => 
            item.type === 'dish' && item.category === category
        );
        
        recommendedCount = categoryDishes.filter(item => {
            const idsToCheck = [];
            if (typeof item.id !== 'undefined') {
                idsToCheck.push(String(item.id));
            }
            if (item.mongoId) {
                idsToCheck.push(String(item.mongoId));
            }
            return recommendedItems.some(recId => idsToCheck.includes(String(recId)));
        }).length;
    }
    
    // Create TOC item with green circle if there are recommendations
    if (recommendedCount > 0) {
        a.innerHTML = `${name} <span class="toc-recommended-count">${recommendedCount}</span>`;
    } else {
        a.textContent = name;
    }
    
    a.dataset.pageIndex = pageIndex;
    a.addEventListener('click', (e) => {
        e.preventDefault();
        const targetPage = parseInt(a.dataset.pageIndex);
        const direction = targetPage > currentPageIndex ? 'right' : 'left';
        showPage(targetPage, direction);
    });
    li.appendChild(a);
    return li;
}

// Update table of contents active state
function updateTableOfContents() {
    const tocLinks = document.querySelectorAll('.toc-nav a');
    const currentCategory = getCurrentCategory();
    
    tocLinks.forEach(link => {
        const linkCategory = getCategoryForPage(parseInt(link.dataset.pageIndex));
        if (linkCategory === currentCategory) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Get current category
function getCurrentCategory() {
    return getCategoryForPage(currentPageIndex);
}

// Get category for a specific page
function getCategoryForPage(pageIndex) {
    if (pageIndex < 0 || pageIndex >= pages.length) return null;
    
    // Cover page has no category
    if (pageIndex === 0) return null;
    
    const pageItems = pages[pageIndex];
    const categoryHeader = pageItems.find(item => item.type === 'category-header');
    if (categoryHeader) {
        return categoryHeader.category;
    }
    
    // Look at previous pages (skip cover)
    for (let i = pageIndex - 1; i > 0; i--) {
        const prevCategoryHeader = pages[i].find(item => item.type === 'category-header');
        if (prevCategoryHeader) {
            return prevCategoryHeader.category;
        }
    }
    
    return null;
}

// Setup navigation buttons
function setupNavigation() {
    document.getElementById('prevBtn').addEventListener('click', () => {
        if (currentPageIndex > 0) {
            showPage(currentPageIndex - 1, 'left');
        }
    });
    
    document.getElementById('nextBtn').addEventListener('click', () => {
        if (currentPageIndex < pages.length - 1) {
            showPage(currentPageIndex + 1, 'right');
        }
    });
    
    // Click on page to turn - left side = previous, right side = next
    document.getElementById('bookPages').addEventListener('click', (e) => {
        // Don't handle clicks on interactive elements
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.closest('button') || e.target.closest('a')) {
            return;
        }
        
        // Don't handle clicks on dish cards - they have their own click handler
        if (e.target.closest('.dish-item')) {
            return;
        }
        
        // Don't handle clicks on dishes grid or its children (except empty areas)
        if (e.target.closest('.dishes-grid')) {
            // Only allow page turning if clicking the grid container itself, not dish items
            if (e.target.classList.contains('dishes-grid')) {
                // Continue to page turning logic
            } else {
                return; // Clicked on a dish item or its children
            }
        }
        
        const page = e.target.closest('.book-page');
        if (page && page.classList.contains('active')) {
            const rect = page.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pageWidth = rect.width;
            const clickPosition = clickX / pageWidth; // 0 = left edge, 1 = right edge
            
            // Left half: previous page
            if (clickPosition < 0.5 && currentPageIndex > 0) {
                e.preventDefault();
                e.stopPropagation();
                showPage(currentPageIndex - 1, 'left');
            }
            // Right half: next page
            else if (clickPosition >= 0.5 && currentPageIndex < pages.length - 1) {
                e.preventDefault();
                e.stopPropagation();
                showPage(currentPageIndex + 1, 'right');
            }
        }
    });
}

// Setup keyboard navigation
function setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch(e.key) {
            case 'ArrowLeft':
                if (currentPageIndex > 0) {
                    showPage(currentPageIndex - 1, 'left');
                }
                break;
            case 'ArrowRight':
                if (currentPageIndex < pages.length - 1) {
                    showPage(currentPageIndex + 1, 'right');
                }
                break;
            case 'Home':
                e.preventDefault();
                showPage(0, 'left');
                break;
            case 'End':
                e.preventDefault();
                showPage(pages.length - 1, 'right');
                break;
        }
    });
}

// Setup touch/swipe navigation
function setupTouchNavigation() {
    const bookPages = document.getElementById('bookPages');
    let touchStartY = 0;
    let touchEndY = 0;
    
    bookPages.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    
    bookPages.addEventListener('touchmove', (e) => {
        // Track movement to distinguish horizontal vs vertical
        touchEndY = e.changedTouches[0].screenY;
    }, { passive: true });
    
    bookPages.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe(touchStartY, touchEndY);
    }, { passive: true });
}

// Handle swipe gesture - only trigger on horizontal swipes
function handleSwipe(startY, endY) {
    const swipeThreshold = 50;
    const diffX = touchStartX - touchEndX;
    const diffY = Math.abs(startY - endY);
    
    // Only handle horizontal swipes if horizontal movement is greater than vertical
    // This allows vertical scrolling to work normally
    if (Math.abs(diffX) > diffY && Math.abs(diffX) > swipeThreshold) {
        // Swipe left (next page)
        if (diffX < -swipeThreshold && currentPageIndex < pages.length - 1) {
            showPage(currentPageIndex + 1, 'right');
        }
        // Swipe right (previous page)
        else if (diffX > swipeThreshold && currentPageIndex > 0) {
            showPage(currentPageIndex - 1, 'left');
        }
    }
}

// Show error message
function showError(message) {
    const bookPages = document.getElementById('bookPages');
    bookPages.innerHTML = `
        <div class="book-page active">
            <div class="page-header">
                <h2 class="page-title">Error</h2>
            </div>
            <div style="text-align: center; padding: 50px 20px;">
                <p style="font-size: 1.2em; color: #666; margin-bottom: 20px;">${message}</p>
                <button onclick="location.reload()" style="padding: 15px 30px; background: #8b4513; color: white; border: none; border-radius: 25px; font-size: 1.1em; cursor: pointer;">
                    Reload Page
                </button>
            </div>
        </div>
    `;
}

// Setup recommendation buttons (APPLY and RESET)
function setupRecommendationButtons() {
    const applyBtn = document.getElementById('applyRecommendationsBtnBook');
    const resetBtn = document.getElementById('resetRecommendationsBtnBook');
    
    if (applyBtn) {
        applyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.applyingRecommendationsBook) {
                console.log('⚠️ Already applying recommendations, ignoring click');
                return;
            }
            window.applyingRecommendationsBook = true;
            console.log('🔘 APPLY button clicked in menu-book');
            applyRecommendationsBook();
            setTimeout(() => {
                window.applyingRecommendationsBook = false;
            }, 1000);
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 RESET button clicked in menu-book');
            resetRecommendations();
        });
    }
    
    // Update button state initially
    updateRecommendationButtonState();
}

// Apply recommendations (menu-book version)
function applyRecommendationsBook() {
    const recommendedItems = window.recommendedItems || [];
    
    if (recommendedItems.length === 0) {
        console.log('⚠️ No recommendations to apply');
        return;
    }
    
    // Set applied flag
    window.recommendationsApplied = true;
    if (typeof recommendation !== 'undefined' && recommendation.recommendationsApplied !== undefined) {
        recommendation.recommendationsApplied = true;
    }
    
    console.log('✅ Applying recommendations (menu-book):', recommendedItems);
    console.log('✅ Recommendations applied flag:', window.recommendationsApplied);
    
    // Create recommended page and update TOC
    createRecommendedPage();
    
    // Re-render all pages to show badges
    console.log('🔄 Re-rendering pages with badges...');
    renderPages();
    setupTableOfContents();
    
    // Show recommended page
    if (pages.length > 1) {
        showPage(1, 'right');
    }
    
    console.log('✅ Recommendations applied successfully');
}

function refreshRecommendedPage(showRecommendedPage = false) {
    removeRecommendedPage();
    createRecommendedPage();
    renderPages();
    setupTableOfContents();

    const targetPage = showRecommendedPage && pages.length > 1 ? 1 : currentPageIndex;
    if (typeof targetPage === 'number' && targetPage >= 0 && targetPage < pages.length) {
        const prev = currentPageIndex;
        currentPageIndex = 0;
        showPage(targetPage, targetPage >= prev ? 'right' : 'left');
    }
}

// Reset recommendations
function resetRecommendations() {
    // Reset applied flag
    window.recommendationsApplied = false;
    if (typeof recommendation !== 'undefined' && recommendation.recommendationsApplied !== undefined) {
        recommendation.recommendationsApplied = false;
    }
    
    // Clear recommended items
    window.recommendedItems = [];
    if (typeof recommendation !== 'undefined' && recommendation.recommendedItems !== undefined) {
        recommendation.recommendedItems = [];
    }
    
    console.log('🔄 Resetting recommendations');
    
    // Remove recommended page and update TOC
    removeRecommendedPage();
    renderPages();
    setupTableOfContents();
    
    // Hide action buttons in cloud
    const cloudButtons = document.getElementById('cloudActionButtons');
    if (cloudButtons) {
        cloudButtons.style.display = 'none';
    }
    
    // Return to cover page
    showPage(0, 'left');
}

// Create recommended page at the start (after cover)
function createRecommendedPage() {
    const recommendedItems = window.recommendedItems || [];
    if (recommendedItems.length === 0) return;
    
    // Check if recommended page already exists
    if (pages.length > 1 && pages[1].length > 0 && pages[1][0].type === 'category-header' && pages[1][0].category === 'recommended') {
        return; // Already exists
    }
    
    // Get all dishes from original dishes (before flattening)
    const allDishes = originalDishes.filter(item => item.category);
    
    // Get recommended dishes by matching IDs
    const recommendedDishes = allDishes.filter(item => {
        const idsToCheck = [];
        if (typeof item.id !== 'undefined') {
            idsToCheck.push(String(item.id));
        }
        if (item.mongoId) {
            idsToCheck.push(String(item.mongoId));
        }
        return recommendedItems.some(recId => idsToCheck.includes(String(recId)));
    });
    
    if (recommendedDishes.length === 0) return;
    
    // Create recommended page items - split into multiple pages if needed
    const recommendedPages = [];
    let currentPageItems = [
        {
            type: 'category-header',
            category: 'recommended',
            categoryName: translateUi('recommendedCategory')
        }
    ];
    
    recommendedDishes.forEach((dish, index) => {
        currentPageItems.push({
            ...dish,
            type: 'dish'
        });
        
        // If page is full or last item, create page
        const dishCount = currentPageItems.filter(i => i.type === 'dish').length;
        if (dishCount >= getItemsPerPage() || index === recommendedDishes.length - 1) {
            recommendedPages.push([...currentPageItems]);
            currentPageItems = [];
            // Add category header to next page if there are more dishes
            if (index < recommendedDishes.length - 1) {
                currentPageItems.push({
                    type: 'category-header',
                    category: 'recommended',
                    categoryName: 'Recommended'
                });
            }
        }
    });
    
    // Insert all recommended pages after cover page (index 1)
    recommendedPages.reverse().forEach(pageItems => {
        pages.splice(1, 0, pageItems);
    });
    
    console.log(`📄 Created ${recommendedPages.length} recommended page(s) with ${recommendedDishes.length} dishes`);
}

// Remove recommended page
function removeRecommendedPage() {
    // Remove all recommended pages (they start at index 1, after cover)
    let removed = 0;
    while (pages.length > 1) {
        const firstPage = pages[1];
        if (firstPage.length > 0 && firstPage[0].type === 'category-header' && firstPage[0].category === 'recommended') {
            pages.splice(1, 1);
            removed++;
        } else {
            break; // Stop when we hit a non-recommended page
        }
    }
    if (removed > 0) {
        console.log(`🗑️ Removed ${removed} recommended page(s)`);
    }
}

// Update recommendation button state
function updateRecommendationButtonState() {
    const applyBtn = document.getElementById('applyRecommendationsBtnBook');
    const cloudButtons = document.getElementById('cloudActionButtons');
    const recommendedItems = window.recommendedItems || [];
    
    if (applyBtn && cloudButtons) {
        if (recommendedItems.length > 0) {
            applyBtn.disabled = false;
            cloudButtons.style.display = 'flex';
        } else {
            applyBtn.disabled = true;
            cloudButtons.style.display = 'none';
        }
    }
}

// Setup listener for recommendation changes
function setupRecommendationListener() {
    // Poll for changes in window.recommendedItems
    setInterval(() => {
        updateRecommendationButtonState();
    }, 500);
    
    // Listen for apply event from recommendation.js (only if not already applying)
    window.addEventListener('applyRecommendationsToBook', () => {
        if (window.applyingRecommendationsBook) {
            console.log('⚠️ Already applying recommendations, ignoring event');
            return;
        }
        window.applyingRecommendationsBook = true;
        console.log('📨 Received applyRecommendationsToBook event');
        applyRecommendationsBook();
        setTimeout(() => {
            window.applyingRecommendationsBook = false;
        }, 1000);
    });
    
    // Also listen for custom events if recommendation.js fires them
    window.addEventListener('recommendationsUpdated', () => {
        updateRecommendationButtonState();
    });
}