// Language translations
const translations = {
    en: {
        // Header
        title: "🍽️ Delicious Bites Restaurant",
        tagline: "Order your favorite meals online",
        specialNeeds: "Do you have any special dietary needs or allergies?",
        specialNeedsBtn: "Yes, I have special needs",
        
        // Menu
        menuTitle: "Our Menu",
        categoryAll: "All",
        categoryAppetizers: "Appetizers",
        categoryMains: "Main Courses",
        categoryDesserts: "Desserts",
        categoryDrinks: "Drinks",
        addToCart: "Add to Cart",
        recommended: "✓ Recommended for you",
        
        // Cart
        cartTitle: "Your Order",
        emptyCart: "Your cart is empty",
        total: "Total",
        checkout: "Checkout",
        
        // Chatbot
        chatbotTitle: "🤖 Dietary Assistant",
        chatbotPlaceholder: "Type your dietary needs here...",
        chatbotSend: "Send",
        chatbotApply: "Apply Recommendations",
        chatbotClear: "Clear Chat",
        chatbotWelcome: "Hello! I'm here to help you find meals that suit your dietary needs and feelings. Please tell me about any allergies, health conditions, dietary preferences, or how you're feeling. For example: \"I'm upset\" or \"I have diabetes and a peanut allergy\" or \"I'm vegetarian and have a sore throat.\"",
        
        // Checkout
        checkoutTitle: "Order Confirmation",
        confirmOrder: "Confirm Order",
        
        // Language
        language: "Language",
        langEn: "English",
        langZh: "繁體中文",
        langZhCN: "简体中文"
    },
    zh: { // Cantonese (Traditional Chinese)
        // Header
        title: "🍽️ Delicious Bites Restaurant",
        tagline: "Order your favorite meals online",
        specialNeeds: "Do you have any special dietary needs or allergies?",
        specialNeedsBtn: "Yes, I have special needs",
        
        // Menu
        menuTitle: "Our Menu",
        categoryAll: "All",
        categoryAppetizers: "Appetizers",
        categoryMains: "Main Courses",
        categoryDesserts: "Desserts",
        categoryDrinks: "Drinks",
        addToCart: "Add to Cart",
        recommended: "✓ Recommended for you",
        
        // Cart
        cartTitle: "Your Order",
        emptyCart: "Your cart is empty",
        total: "Total",
        checkout: "Checkout",
        
        // Chatbot
        chatbotTitle: "🤖 Dietary Assistant",
        chatbotPlaceholder: "Type your dietary needs here...",
        chatbotSend: "Send",
        chatbotApply: "Apply Recommendations",
        chatbotClear: "Clear Chat",
        chatbotWelcome: "Hello! I'm here to help you find meals that suit your dietary needs and feelings. Please tell me about any allergies, health conditions, dietary preferences, or how you're feeling. For example: \"I'm upset\" or \"I have diabetes and a peanut allergy\" or \"I'm vegetarian and have a sore throat.\"",
        
        // Checkout
        checkoutTitle: "Order Confirmation",
        confirmOrder: "Confirm Order",
        
        // Language
        language: "Language",
        langEn: "English",
        langZh: "繁體中文"
    },
    zh: {
        // Header
        title: "🍽️ 美味餐廳",
        tagline: "在線訂購您喜愛的美食",
        specialNeeds: "您是否有任何特殊飲食需求或過敏？",
        specialNeedsBtn: "是的，我有特殊需求",
        
        // Menu
        menuTitle: "我們的菜單",
        categoryAll: "全部",
        categoryAppetizers: "開胃菜",
        categoryMains: "主菜",
        categoryDesserts: "甜品",
        categoryDrinks: "飲品",
        addToCart: "加入購物車",
        recommended: "✓ 為您推薦",
        
        // Cart
        cartTitle: "您的訂單",
        emptyCart: "您的購物車是空的",
        total: "總計",
        checkout: "結帳",
        
        // Chatbot
        chatbotTitle: "🤖 飲食助手",
        chatbotPlaceholder: "請輸入您的飲食需求...",
        chatbotSend: "發送",
        chatbotApply: "應用推薦",
        chatbotClear: "清除對話",
        chatbotWelcome: "您好！我是來幫助您找到適合您飲食需求和感受的餐點。請告訴我任何過敏、健康狀況、飲食偏好或您的感受。例如：「我很沮喪」或「我有糖尿病和花生過敏」或「我是素食主義者，而且喉嚨痛。」",
        chatbotApplyReady: "太好了！推薦已準備好。點擊「應用推薦」即可查看。",
        
        // Checkout
        checkoutTitle: "訂單確認",
        confirmOrder: "確認訂單",
        
        // Language
        language: "語言",
        langEn: "English",
        langZh: "繁體中文",
        langZhCN: "简体中文"
    },
    zhCN: { // Mandarin (Simplified Chinese)
        // Header
        title: "🍽️ 美味餐厅",
        tagline: "在线订购您喜爱的美食",
        specialNeeds: "您是否有任何特殊饮食需求或过敏？",
        specialNeedsBtn: "是的，我有特殊需求",
        
        // Menu
        menuTitle: "我们的菜单",
        categoryAll: "全部",
        categoryAppetizers: "开胃菜",
        categoryMains: "主菜",
        categoryDesserts: "甜品",
        categoryDrinks: "饮品",
        addToCart: "加入购物车",
        recommended: "✓ 为您推荐",
        
        // Cart
        cartTitle: "您的订单",
        emptyCart: "您的购物车是空的",
        total: "总计",
        checkout: "结账",
        
        // Chatbot
        chatbotTitle: "🤖 饮食助手",
        chatbotPlaceholder: "请输入您的饮食需求...",
        chatbotSend: "发送",
        chatbotApply: "应用推荐",
        chatbotClear: "清除对话",
        chatbotWelcome: "您好！我是来帮助您找到适合您饮食需求和感受的餐点。请告诉我任何过敏、健康状况、饮食偏好或您的感受。例如：「我很沮丧」或「我有糖尿病和花生过敏」或「我是素食主义者，而且喉咙痛。」",
        
        // Checkout
        checkoutTitle: "订单确认",
        confirmOrder: "确认订单",
        
        // Language
        language: "语言",
        langEn: "English",
        langZh: "繁體中文",
        langZhCN: "简体中文"
    }
};

// Current language (default: English)
// Language codes: 'en' = English, 'zh' = Cantonese (Traditional), 'zhCN' = Mandarin (Simplified)
let currentLanguage = localStorage.getItem('language') || 'en';

// Get translation
function t(key) {
    return translations[currentLanguage][key] || key;
}

// Switch language
function switchLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    updatePageLanguage();
    updateChatbotLanguage();
    updateVoiceRecognitionLanguage();
    updateLanguageSwitcher();
}

// Update language switcher active state
function updateLanguageSwitcher() {
    const langEn = document.getElementById('langEn');
    const langZh = document.getElementById('langZh');
    const langZhCN = document.getElementById('langZhCN');
    
    // Remove active class from all
    [langEn, langZh, langZhCN].forEach(btn => {
        if (btn) btn.classList.remove('active');
    });
    
    // Add active class to current language
    if (currentLanguage === 'en' && langEn) {
        langEn.classList.add('active');
    } else if (currentLanguage === 'zh' && langZh) {
        langZh.classList.add('active');
    } else if (currentLanguage === 'zhCN' && langZhCN) {
        langZhCN.classList.add('active');
    }
}

// Update page language
function updatePageLanguage() {
    // Update header
    const title = document.querySelector('header h1');
    if (title) title.textContent = t('title');
    
    const tagline = document.querySelector('.tagline');
    if (tagline) tagline.textContent = t('tagline');
    
    const specialNeedsText = document.querySelector('.special-needs-selector span');
    if (specialNeedsText) specialNeedsText.textContent = t('specialNeeds');
    
    const specialNeedsBtn = document.getElementById('specialNeedsBtn');
    if (specialNeedsBtn) specialNeedsBtn.textContent = t('specialNeedsBtn');
    
    // Update menu
    const menuTitle = document.querySelector('.menu-section h2');
    if (menuTitle) menuTitle.textContent = t('menuTitle');
    
    // Update category tabs
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        const category = tab.getAttribute('data-category');
        if (category === 'all') tab.textContent = t('categoryAll');
        else if (category === 'appetizers') tab.textContent = t('categoryAppetizers');
        else if (category === 'mains') tab.textContent = t('categoryMains');
        else if (category === 'desserts') tab.textContent = t('categoryDesserts');
        else if (category === 'drinks') tab.textContent = t('categoryDrinks');
    });
    
    // Update cart
    const cartTitle = document.querySelector('.cart-header h2');
    if (cartTitle) cartTitle.textContent = t('cartTitle');
    
    const emptyCart = document.querySelector('.empty-cart');
    if (emptyCart) emptyCart.textContent = t('emptyCart');
    
    const totalLabel = document.querySelector('.cart-total span');
    if (totalLabel) {
        const total = document.getElementById('cartTotal').textContent;
        totalLabel.innerHTML = `${t('total')}: $<span id="cartTotal">${total}</span>`;
    }
    
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) checkoutBtn.textContent = t('checkout');
    
    // Update checkout modal
    const checkoutModalTitle = document.querySelector('#checkoutModal h2');
    if (checkoutModalTitle) checkoutModalTitle.textContent = t('checkoutTitle');
    
    const confirmOrderBtn = document.getElementById('confirmOrder');
    if (confirmOrderBtn) confirmOrderBtn.textContent = t('confirmOrder');
    
    // Re-render menu to update button texts
    if (typeof renderMenu === 'function') {
        renderMenu();
    }
    
    // Update cart display
    if (typeof updateCartDisplay === 'function') {
        updateCartDisplay();
    }
}

// Update chatbot language
function updateChatbotLanguage() {
    const chatbotTitle = document.querySelector('.chatbot-header h2');
    if (chatbotTitle) chatbotTitle.textContent = t('chatbotTitle');
    
    const chatbotInput = document.getElementById('chatbotInput');
    if (chatbotInput) chatbotInput.placeholder = t('chatbotPlaceholder');
    
    const sendBtn = document.getElementById('sendMessageBtn');
    if (sendBtn) sendBtn.textContent = t('chatbotSend');
    
    const applyBtn = document.getElementById('applyRecommendationsBtn');
    if (applyBtn) applyBtn.textContent = t('chatbotApply');
    
    const clearBtn = document.getElementById('clearChatBtn');
    if (clearBtn) clearBtn.textContent = t('chatbotClear');
    
    // Update welcome message if chat is empty
    const messagesContainer = document.getElementById('chatbotMessages');
    if (messagesContainer && messagesContainer.children.length === 1) {
        const welcomeMsg = messagesContainer.querySelector('.bot-message p');
        if (welcomeMsg) welcomeMsg.textContent = t('chatbotWelcome');
    }
}

// Update voice recognition language
function updateVoiceRecognitionLanguage() {
    if (typeof recognition !== 'undefined' && recognition !== null) {
        // Set language based on current language
        // 'en' = English (en-US), 'zh' = Cantonese (zh-HK), 'zhCN' = Mandarin (zh-CN)
        if (currentLanguage === 'zh') {
            recognition.lang = 'zh-HK'; // Cantonese (Hong Kong)
        } else if (currentLanguage === 'zhCN') {
            recognition.lang = 'zh-CN'; // Mandarin (Simplified Chinese)
        } else {
            recognition.lang = 'en-US'; // English
        }
        console.log('Voice recognition language set to:', recognition.lang);
    }
}

// Initialize language on page load
document.addEventListener('DOMContentLoaded', () => {
    updatePageLanguage();
    updateChatbotLanguage();
    updateVoiceRecognitionLanguage();
    updateLanguageSwitcher();
});

// Export for global access
window.translations = translations;
window.t = t;
window.switchLanguage = switchLanguage;
window.currentLanguage = currentLanguage;

