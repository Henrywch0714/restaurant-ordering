// Recommendation System with AI Integration
// ============================================

// Configuration
// Auto-detect environment: use localhost for local development, Railway for production
// Use window.isLocalhost if already defined (from script.js), otherwise calculate it
// Don't redeclare - just use the value to avoid duplicate declaration error
const isLocalhostValue = typeof window.isLocalhost !== 'undefined' 
    ? window.isLocalhost 
    : (window.location.hostname === 'localhost' || 
       window.location.hostname === '127.0.0.1' ||
       window.location.hostname === '');

const AI_CONFIG = {
    // Qwen3 API Configuration (Alibaba Cloud DashScope)
    // Using proxy server to avoid CORS issues
    qwen: {
        apiKey: 'sk-ca0f66aeb99342bf9873e58007f0e829', // Get from https://dashscope.console.aliyun.com/
        model: 'qwen-turbo', // Options: 'qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen2.5-72b-instruct'
        // Automatically switches between localhost (for local testing) and Railway (for production)
        endpoint: isLocalhostValue 
            ? 'http://localhost:5000/api/qwen'  // Local development
            : 'https://web-production-f1d28.up.railway.app/api/qwen'  // Production (GitHub Pages)
    },
    
    // Weather API Configuration (optional - for weather-based recommendations)
    weather: {
        enabled: true, // Set to true to enable weather-based recommendations
        apiKey: '107d055a8ead7336cac0052897f1211d', // Get from https://openweathermap.org/api (free tier available)
        endpoint: 'https://api.openweathermap.org/data/2.5/weather'
    },

    // Embeddings (for retrieval)
    embeddings: {
        enabled: true,
        model: 'text-embedding-v1',
        topK: 12,
        endpoint: isLocalhostValue
            ? 'http://localhost:5000/api/embeddings'
            : 'https://web-production-f1d28.up.railway.app/api/embeddings'
    }
};

const AUTO_APPLY_RECOMMENDATIONS = true;
const USE_SESSION_MEMORY = false;
const NUTRITION_THRESHOLDS = {
    sodium_mg: 700,
    sugars_g: 15,
    fat_g: 20,
    saturated_fat_g: 6,
    energy_kcal: 700
};

const IDDSI_KEYWORDS = [
    'dysphagia',
    'swallow',
    'swallowing',
    'choking',
    'coughing',
    'food sticking',
    'stroke',
    'parkinson',
    'als',
    'dementia'
];

// Context data (weather, date, time, special dates)
let contextData = {
    date: null,
    time: null,
    dayOfWeek: null,
    month: null,
    season: null,
    weather: null,
    temperature: null,
    isSpecialDate: false,
    specialDateName: null
};

// Chat state
let chatHistory = [];
let userNeeds = {
    allergies: [],
    restrictions: [],
    healthConditions: [],
    preferences: [],
    emotions: [] // New: track emotions/feelings
};
let persistentNeeds = {
    allergies: [],
    restrictions: [],
    healthConditions: [],
    preferences: [],
    emotions: []
};
let sessionNeeds = {
    allergies: [],
    restrictions: [],
    healthConditions: [],
    preferences: [],
    emotions: []
};
let recommendedItems = [];
window.recommendedItems = recommendedItems;
let pendingConfirmation = null; // Track if we're waiting for recommendation confirmation
let pendingResetConfirmation = false; // Track if we're waiting to reset
let pendingToolAction = null; // Track tool confirmation flow (apply/reset/add)
let lastRecommendationIds = [];
let recommendationsGenerated = false; // Track if recommendations have been generated
let recommendationsApplied = false; // Track if user has clicked Apply (only show badges when true)
window.recommendationsApplied = recommendationsApplied; // Make it globally accessible

// Embedding cache (RAG)
let dishEmbeddings = null;
let dishEmbeddingHash = '';
const DISH_EMBEDDINGS_CACHE_KEY = 'dish_embeddings_cache_v1';
let embeddingStatusTimer = null;

// Session / idle handling
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const IDLE_GRACE_MS = 60 * 1000; // 60 seconds
let idleTimer = null;
let idleGraceTimer = null;
let idlePrompted = false;

    // Voice recognition setup
let recognition = null;
let isListening = false;

// Initialize voice recognition
function initVoiceRecognition() {
    // Check if browser supports Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        console.warn('Speech Recognition not supported in this browser');
        // Support both index.html and menu-book.html
        const voiceBtn = document.getElementById('voiceInputBtn') || document.getElementById('voiceInputBtnBook');
        if (voiceBtn) {
            voiceBtn.style.display = 'none'; // Hide button if not supported
        }
        return;
    }
    
    recognition = new SpeechRecognition();
    recognition.continuous = false; // Stop after one result
    recognition.interimResults = false; // Only final results
    // Set language based on current language setting
    // 'en' = English (en-US), 'zh' = Cantonese (zh-HK), 'zhCN' = Mandarin (zh-CN)
    const currentLang = window.currentLanguage || 'en';
    if (currentLang === 'zh') {
        recognition.lang = 'zh-HK'; // Cantonese (Hong Kong)
    } else if (currentLang === 'zhCN') {
        recognition.lang = 'zh-CN'; // Mandarin (Simplified Chinese)
    } else {
        recognition.lang = 'en-US'; // English
    }
    
    // Event handlers
    recognition.onstart = () => {
        isListening = true;
        resetIdleTimers();
        // Support all microphone buttons
        const voiceBtn = document.getElementById('voiceInputBtn') || 
                        document.getElementById('voiceInputBtnBook') ||
                        document.getElementById('voiceInputBtnCloud');
        const voiceStatus = document.getElementById('voiceStatus') || document.getElementById('voiceStatusBook');
        const voiceStatusText = document.getElementById('voiceStatusText') || document.getElementById('voiceStatusTextBook');
        
        // Add listening class to all microphone buttons
        document.querySelectorAll('.mic-btn-fixed, .mic-btn-book, .mic-btn-cloud, #voiceInputBtn').forEach(btn => {
            if (btn) {
                btn.classList.add('listening');
                btn.disabled = false;
            }
        });
        
        if (voiceStatus) {
            voiceStatus.style.display = 'flex';
        }
        if (voiceStatusText) {
            voiceStatusText.textContent = 'Listening...';
        }
        // Set robot to thinking state when listening
        setRobotState('thinking');
    };
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        // Support both index.html and menu-book.html
        const chatbotInput = document.getElementById('chatbotInput') || document.getElementById('chatbotInputBook');
        
        if (chatbotInput) {
            chatbotInput.value = transcript;
            // Auto-send the message
            sendMessage();
        }
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        // Support both index.html and menu-book.html
        const voiceStatusText = document.getElementById('voiceStatusText') || document.getElementById('voiceStatusTextBook');
        
        let errorMsg = 'Voice input error. ';
        switch(event.error) {
            case 'no-speech':
                errorMsg = 'No speech detected. Please try again.';
                break;
            case 'audio-capture':
                errorMsg = 'Microphone not found. Please check your microphone settings.';
                break;
            case 'not-allowed':
                errorMsg = 'Microphone permission denied. Please allow microphone access.';
                break;
            case 'network':
                errorMsg = 'Network error. Please check your connection.';
                break;
            default:
                errorMsg = 'Voice recognition error. Please try again.';
        }
        
        if (voiceStatusText) {
            voiceStatusText.textContent = errorMsg;
            setTimeout(() => {
                if (voiceStatusText) {
                    voiceStatusText.textContent = 'Click microphone to try again';
                }
            }, 3000);
        }
        
        stopListening();
    };
    
    recognition.onend = () => {
        stopListening();
    };
}

// Start voice recognition
function startListening() {
    if (!recognition) {
        alert('Voice recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
        return;
    }
    
    if (isListening) {
        stopListening();
        return;
    }
    
    try {
        recognition.start();
    } catch (error) {
        console.error('Error starting recognition:', error);
        if (error.message.includes('already started')) {
            stopListening();
            setTimeout(() => startListening(), 100);
        }
    }
}

// Stop voice recognition
function stopListening() {
    if (recognition && isListening) {
        try {
            recognition.stop();
        } catch (error) {
            console.error('Error stopping recognition:', error);
        }
    }
    
    isListening = false;
    // Remove listening class from all microphone buttons
    document.querySelectorAll('.mic-btn-fixed, .mic-btn-book, .mic-btn-cloud, #voiceInputBtn').forEach(btn => {
        if (btn) {
            btn.classList.remove('listening');
        }
    });
    
    const voiceStatus = document.getElementById('voiceStatus') || document.getElementById('voiceStatusBook');
    if (voiceStatus) {
        voiceStatus.style.display = 'none';
    }
    // Return robot to idle state when not listening
    // (will be changed to thinking/recommending by sendMessage)
}

// Initialize chatbot
document.addEventListener('DOMContentLoaded', async () => {
    // Display date/time immediately (don't wait for async operations)
    updateContextDisplay();
    
    setupChatbot();
    loadConversationState();
    const hasSavedState = !!localStorage.getItem('chatbotState');
    const lastActivityRaw = localStorage.getItem('lastActivityAt');
    let lastActivityAt = lastActivityRaw ? Number(lastActivityRaw) : 0;
    if (hasSavedState && !lastActivityAt) {
        lastActivityAt = Date.now();
        markSessionActive();
    }
    const isStale = lastActivityAt &&
        (Date.now() - lastActivityAt) > (IDLE_TIMEOUT_MS + IDLE_GRACE_MS);
    if (isStale) {
        resetSessionState();
    } else {
        refreshRecommendationView();
        updateApplyButtonState();
    }
    resetIdleTimers();
    initVoiceRecognition(); // Initialize voice recognition
    
    // Initialize robot to idle state
    setRobotState('idle');
    showChatBubble(null);
    showActionButtons(false);

    // Reset idle timer on basic interactions
    ['click', 'keydown', 'touchstart'].forEach(eventName => {
        document.addEventListener(eventName, () => resetIdleTimers(), { passive: true });
    });
    
    // Update context data in background (weather, special dates, etc.)
    updateContextData().then(() => {
        // Update display again after data is loaded
        updateContextDisplay();
    }).catch(error => {
        console.error('Error loading context data:', error);
        // Still show date/time even if weather fails
        updateContextDisplay();
    });
    
    // Update time every minute
    setInterval(updateContextDisplay, 60000);
});

// Robot state management (only for index.html, menu-book.html doesn't have robot)
function setRobotState(state) {
    const robotContainer = document.querySelector('.robot-container');
    if (!robotContainer) {
        // No robot on this page (menu-book.html), just return
        return;
    }
    
    // Remove all state classes
    robotContainer.classList.remove('idle', 'thinking', 'recommending');
    
    // Add new state class
    if (state) {
        robotContainer.classList.add(state);
    }
}

// Show/hide chat bubble (supports both index.html and menu-book.html)
function showChatBubble(content) {
    // Check for new conversation cloud overlay first
    const conversationCloudOverlay = document.getElementById('conversationCloudOverlay');
    const conversationCloudContent = document.getElementById('conversationCloudContent');
    if (conversationCloudOverlay && conversationCloudContent) {
        if (content) {
            conversationCloudContent.textContent = content;
            conversationCloudOverlay.style.display = 'flex';
        } else {
            conversationCloudOverlay.style.display = 'none';
        }
        return;
    }
    
    // Check for old menu-book.html chat cloud (fallback)
    const chatCloudBook = document.getElementById('chatCloudBook');
    const chatCloudContent = document.getElementById('chatCloudContent');
    if (chatCloudBook && chatCloudContent) {
        if (content) {
            chatCloudContent.textContent = content;
            chatCloudBook.style.display = 'block';
        } else {
            chatCloudBook.style.display = 'none';
        }
        return;
    }
    
    // Fallback to index.html chat bubble
    const chatBubble = document.getElementById('chatBubble');
    const chatBubbleContent = document.getElementById('chatBubbleContent');
    if (!chatBubble || !chatBubbleContent) return;
    
    if (content) {
        chatBubbleContent.textContent = content;
        chatBubble.style.display = 'block';
    } else {
        chatBubble.style.display = 'none';
    }
}

// Show/hide action buttons (supports both index.html and menu-book.html)
function showActionButtons(show) {
    // Check for menu-book.html cloud action buttons first
    const cloudActionButtons = document.getElementById('cloudActionButtons');
    if (cloudActionButtons) {
        // Only show if there are recommendations
        const recommendedItems = window.recommendedItems || [];
        cloudActionButtons.style.display = (show && recommendedItems.length > 0) ? 'flex' : 'none';
    }
    
    // Check for menu-book.html action buttons (old location)
    const actionButtonsBook = document.getElementById('actionButtonsBook');
    if (actionButtonsBook) {
        actionButtonsBook.style.display = show ? 'flex' : 'none';
    }
    
    // Fallback to index.html action buttons
    const actionButtons = document.getElementById('robotActionButtons');
    if (actionButtons) {
        actionButtons.style.display = show ? 'flex' : 'none';
    }
}

// Setup chatbot event listeners
function setupChatbot() {
    const specialNeedsBtn = document.getElementById('specialNeedsBtn');
    const chatbotModal = document.getElementById('chatbotModal');
    const closeChatbot = document.getElementById('closeChatbot');
    const sendBtn = document.getElementById('sendMessageBtn');
    const chatbotInput = document.getElementById('chatbotInput');
    const applyBtn = document.getElementById('applyRecommendationsBtn');
    const robotNoBtn = document.getElementById('robotNoBtn');

    if (specialNeedsBtn) {
        specialNeedsBtn.addEventListener('click', () => {
            chatbotModal.style.display = 'block';
            // Reset to initial state when opening (but keep recommendationsApplied if already set)
            setRobotState('idle');
            showChatBubble(null);
            // Only hide action buttons if recommendations haven't been applied yet
            if (!recommendationsApplied) {
                showActionButtons(false);
            }
        });
    }

    if (closeChatbot) {
        closeChatbot.addEventListener('click', () => {
            chatbotModal.style.display = 'none';
            stopListening();
            // Reset to initial state when closing
            setRobotState('idle');
            showChatBubble(null);
            showActionButtons(false);
        });
    }

    if (chatbotModal) {
        chatbotModal.addEventListener('click', (e) => {
            if (e.target.id === 'chatbotModal') {
                chatbotModal.style.display = 'none';
                stopListening();
                // Reset to initial state when closing
                setRobotState('idle');
                showChatBubble(null);
                showActionButtons(false);
            }
        });
    }

    // Setup for index.html
    if (sendBtn && chatbotInput) {
        sendBtn.addEventListener('click', sendMessage);
        chatbotInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', applyRecommendations);
    }

    // NO button - resets everything to initial state (index.html)
    if (robotNoBtn) {
        robotNoBtn.addEventListener('click', () => {
            // Reset applied flag - this will hide all badges
            recommendationsApplied = false;
            window.recommendationsApplied = false;
            console.log('🔄 NO button clicked - Resetting to initial state, hiding badges');
            
            // Clear chat and reset UI
            clearChat();
            setRobotState('idle');
            showChatBubble(null);
            showActionButtons(false);
            
            // Re-render menu to remove badges
            if (typeof renderMenu === 'function') {
                renderMenu();
            }
        });
    }
    
    // Setup for menu-book.html
    const sendBtnBook = document.getElementById('sendMessageBtnBook');
    const chatbotInputBook = document.getElementById('chatbotInputBook');
    const applyBtnBook = document.getElementById('applyRecommendationsBtnBook');
    const robotNoBtnBook = document.getElementById('robotNoBtnBook');
    const voiceBtnBook = document.getElementById('voiceInputBtnBook');
    
    if (sendBtnBook && chatbotInputBook) {
        sendBtnBook.addEventListener('click', sendMessage);
        chatbotInputBook.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    // Don't attach click handler for menu-book - menu-book.js handles it directly
    // The applyRecommendations function in recommendation.js will dispatch an event
    // that menu-book.js listens to, but button clicks are handled by menu-book.js
    
    if (robotNoBtnBook) {
        robotNoBtnBook.addEventListener('click', () => {
            // Reset applied flag - this will hide all badges
            recommendationsApplied = false;
            window.recommendationsApplied = false;
            console.log('🔄 NO button clicked - Resetting to initial state, hiding badges');
            
            // Clear chat and reset UI
            clearChat();
            setRobotState('idle');
            showChatBubble(null);
            showActionButtons(false);
            
            // Re-render menu to remove badges (if renderMenu exists)
            if (typeof renderMenu === 'function') {
                renderMenu();
            }
        });
    }
    
    // Voice input button (both pages)
    const voiceBtn = document.getElementById('voiceInputBtn');
    if (voiceBtn) {
        voiceBtn.addEventListener('click', startListening);
    }
    
    if (voiceBtnBook) {
        voiceBtnBook.addEventListener('click', startListening);
    }
    
    // New fixed microphone button
    const voiceBtnFixed = document.getElementById('voiceInputBtnBook');
    if (voiceBtnFixed) {
        voiceBtnFixed.addEventListener('click', startListening);
    }
    
    // Microphone button in conversation cloud
    const voiceBtnCloud = document.getElementById('voiceInputBtnCloud');
    if (voiceBtnCloud) {
        voiceBtnCloud.addEventListener('click', startListening);
    }
    
    // Message button handlers
    const messageBtnFixed = document.getElementById('messageBtnBook');
    const textInputOverlay = document.getElementById('textInputOverlay');
    if (messageBtnFixed && textInputOverlay) {
        messageBtnFixed.addEventListener('click', (e) => {
            e.stopPropagation();
            textInputOverlay.style.display = 'flex';
            const input = document.getElementById('chatbotInputBook');
            if (input) {
                setTimeout(() => input.focus(), 100);
            }
        });
    }
    
    // Message button in conversation cloud
    const messageBtnCloud = document.getElementById('messageBtnCloud');
    if (messageBtnCloud && textInputOverlay) {
        messageBtnCloud.addEventListener('click', (e) => {
            e.stopPropagation();
            // Hide conversation cloud and show text input
            const conversationCloudOverlay = document.getElementById('conversationCloudOverlay');
            if (conversationCloudOverlay) {
                conversationCloudOverlay.style.display = 'none';
            }
            textInputOverlay.style.display = 'flex';
            const input = document.getElementById('chatbotInputBook');
            if (input) {
                setTimeout(() => input.focus(), 100);
            }
        });
    }
    
    // Close text input overlay when clicking outside
    if (textInputOverlay) {
        textInputOverlay.addEventListener('click', (e) => {
            if (e.target === textInputOverlay) {
                textInputOverlay.style.display = 'none';
            }
        });
    }
    
    // Close conversation cloud when clicking outside
    const conversationCloudOverlay = document.getElementById('conversationCloudOverlay');
    if (conversationCloudOverlay) {
        conversationCloudOverlay.addEventListener('click', (e) => {
            if (e.target === conversationCloudOverlay) {
                conversationCloudOverlay.style.display = 'none';
            }
        });
    }
    
    // Stop listening when modal closes
    if (closeChatbot) {
        closeChatbot.addEventListener('click', () => {
            stopListening();
        });
    }
    
    // Stop listening when clicking outside modal
    if (chatbotModal) {
        chatbotModal.addEventListener('click', (e) => {
            if (e.target.id === 'chatbotModal') {
                stopListening();
            }
        });
    }
}

// Send message to chatbot (supports both index.html and menu-book.html)
async function sendMessage() {
    // Check for menu-book.html input first
    let input = document.getElementById('chatbotInputBook');
    let sendBtn = document.getElementById('sendMessageBtnBook');
    if (!input || !sendBtn) {
        // Fallback to index.html
        input = document.getElementById('chatbotInput');
        sendBtn = document.getElementById('sendMessageBtn');
    }
    
    if (!input || !sendBtn) return;
    
    // Close text input overlay if open
    const textInputOverlay = document.getElementById('textInputOverlay');
    if (textInputOverlay) {
        textInputOverlay.style.display = 'none';
    }
    
    const message = input.value.trim();
    if (!message) return;

    // Add user message to chat (hidden, but kept for history)
    addMessageToChat(message, 'user');
    input.value = '';
    resetIdleTimers();
    if (!USE_SESSION_MEMORY) {
        persistentNeeds = {
            allergies: [],
            restrictions: [],
            healthConditions: [],
            preferences: [],
            emotions: []
        };
        sessionNeeds = {
            allergies: [],
            restrictions: [],
            healthConditions: [],
            preferences: [],
            emotions: []
        };
        syncCombinedNeeds();
        chatHistory = [];
    }

    // Disable input while processing
    sendBtn.disabled = true;
    input.disabled = true;

    // Set robot to thinking state
    setRobotState('thinking');
    showChatBubble('Let me think...');
    showActionButtons(false);

    try {
        // Check if this is a confirmation response first
        const isConfirmation = extractUserNeeds(message);
        if (isConfirmation) {
            // Confirmation was processed, don't generate new response
            return;
        }
        
        // Extract user needs from conversation (update dynamically)
        extractUserNeeds(message);
        
        let response;
        
        // Use Qwen3 API
        try {
            response = await getQwenResponse(message);
        } catch (aiError) {
            console.error('Qwen API error:', aiError);
            console.error('Error message:', aiError.message);
            // Show more helpful error message
            let errorMsg = 'Sorry, I encountered an error connecting to the AI service. ';
            if (aiError.message.includes('401') || aiError.message.includes('Unauthorized')) {
                errorMsg += 'Please check your API key.';
            } else if (aiError.message.includes('429') || aiError.message.includes('rate limit')) {
                errorMsg += 'Too many requests. Please wait a moment and try again.';
            } else {
                errorMsg += 'Please check the browser console (F12) for details.';
            }
            response = errorMsg;
            addMessageToChat(response, 'bot');
            showChatBubble(errorMsg);
            setRobotState('idle');
            showActionButtons(false);
            return;
        }
        
        // Handle tool calls (cart actions) if present
        const { cleanedResponse, toolResult } = handleToolCall(response);
        response = cleanedResponse;
        if (toolResult) {
            showChatBubble(toolResult);
            addMessageToChat(toolResult, 'bot');
        }

        // Extract structured data from AI response
        const extractedData = extractFromAIResponse(response);
        console.log('🔍 Extracted data from AI:', extractedData);
        
        // Update user needs from AI extraction
        let aiProvidedDirectRecommendations = false;
        if (extractedData) {
            aiProvidedDirectRecommendations = updateUserNeedsFromAI(extractedData);
            console.log('✅ AI provided direct recommendations:', aiProvidedDirectRecommendations);
            console.log('📋 Recommended items:', recommendedItems);

            // Check if AI says direct activation (confirm:yes) or needs confirmation (confirm:no)
            if (extractedData.confirm === 'yes') {
                // Specific condition - direct activation, no confirmation needed
                pendingConfirmation = null;
                console.log('✅ Direct activation (confirm:yes)');
            } else {
                // Uncertain condition - needs confirmation
                const displayResponse = response.replace(/\[EXTRACT:.*?\]/g, '').trim();
                const responseLower = displayResponse.toLowerCase();
                if (responseLower.includes('okay') || responseLower.includes('ok?') || responseLower.includes('would that be') || responseLower.includes('is that ok')) {
                    pendingConfirmation = true;
                    console.log('⏳ Waiting for confirmation');
                }
            }

            // IMPORTANT: Update button state after AI provides recommendations
            updateApplyButtonState();
        } else {
            console.log('⚠️ No extraction data found in AI response');
        }
        
        // Remove extraction marker FIRST (before any other processing)
        // Use a more aggressive regex that handles multiline and various formats
        let displayResponse = response;
        
        // Remove [EXTRACT:...] tag (non-greedy, handles newlines)
        displayResponse = displayResponse.replace(/\[EXTRACT:[\s\S]*?\]/g, '').trim();
        
        // Also remove any remaining EXTRACT markers in various formats
        displayResponse = displayResponse.replace(/\[EXTRACT.*?\]/gi, '').trim();
        displayResponse = displayResponse.replace(/EXTRACT:.*$/gim, '').trim();
        
        console.log('🧹 Original response before cleaning:', response.substring(0, 200));
        console.log('🧹 After removing EXTRACT tag:', displayResponse.substring(0, 200));
        
        // Remove any ID numbers that might appear (comprehensive cleaning)
        displayResponse = displayResponse.replace(/\bID\s*:\s*\d+\b/gi, ''); // Remove "ID: 1", "ID:1", etc.
        displayResponse = displayResponse.replace(/\b(item|dish|ID|number|#)\s*\d+\b/gi, ''); // Remove "item 1", "dish 5", "#3", etc.
        displayResponse = displayResponse.replace(/\b\d+\s*(item|dish|ID|number)\b/gi, ''); // Remove "1 item", "5 dish", etc.
        displayResponse = displayResponse.replace(/\(\s*\d+\s*\)/g, ''); // Remove "(1)", "(5)", etc.
        displayResponse = displayResponse.replace(/\[\s*\d+\s*\]/g, ''); // Remove "[1]", "[5]", etc.
        // Remove MongoDB ObjectId patterns (24 hex characters)
        displayResponse = displayResponse.replace(/\b[0-9a-f]{24}\b/gi, ''); // Remove ObjectIds like "6957bd1be7b95b0ac8ca7b19"
        displayResponse = displayResponse.replace(/\s+/g, ' ').trim(); // Clean up extra spaces
        // Final pass: remove any standalone numbers that look like IDs (1-2 digits at start/end of sentences)
        displayResponse = displayResponse.replace(/^\d{1,2}\s*[.,:;]\s*/g, ''); // Remove "1.", "5:", etc. at start
        displayResponse = displayResponse.replace(/\s*[.,:;]\s*\d{1,2}$/g, ''); // Remove ".1", ":5", etc. at end
        // Additional: remove any number followed by period or colon that might be an ID reference
        displayResponse = displayResponse.replace(/\b\d{1,2}\s*[.:]\s*/g, ''); // Remove "1.", "5:", etc. anywhere
        displayResponse = displayResponse.trim();
        
        // Apply IDDSI safety filter for swallowing issues
        const iddsiResult = applyIddsiSafetyFilter(message, extractedData);
        if (iddsiResult.changed && iddsiResult.maxLevel !== null) {
            const thinNote = iddsiResult.excludedThin
                ? ' I’m not suggesting thin liquids (IDDSI 0) unless you say they’re safe for you.'
                : '';
            displayResponse = `${displayResponse} I’m keeping textures at IDDSI Level ${iddsiResult.maxLevel} or below for safer swallowing.${thinNote}`;
        }

        console.log('✨ Final cleaned response:', displayResponse);
        addMessageToChat(displayResponse, 'bot');
        
        // Show response in chat bubble and set robot to recommending state
        showChatBubble(displayResponse);
        setRobotState('recommending');
        
        // AI should provide recommendations; do not run local filtering
        if (aiProvidedDirectRecommendations) {
            console.log('🎯 Using AI direct recommendations:', recommendedItems);
            console.log('📋 Recommendations updated from conversation.');
            if (AUTO_APPLY_RECOMMENDATIONS) {
                applyRecommendations();
            } else {
                updateApplyButtonState();
                refreshRecommendationView();
            }
        } else {
            console.log('⚠️ No AI recommendations provided. Waiting for next user input.');
        }
        
        // Double-check button state after all processing
        console.log('🔘 Final button state check - Recommended items:', recommendedItems.length, 'Has needs:', hasUserNeeds());
        updateApplyButtonState();
        
        // Important: Don't call renderMenu() here - badges should only appear after Apply is clicked
        // The menu will be rendered when Apply button is clicked
    } catch (error) {
        console.error('Error processing message:', error);
        console.error('Error details:', error.stack);
        const errorMsg = 'Sorry, I encountered an error. Please try again.';
        addMessageToChat(errorMsg, 'bot');
        showChatBubble(errorMsg);
        setRobotState('idle');
        showActionButtons(false);
    } finally {
        // Re-enable inputs (supports both index.html and menu-book.html)
        if (sendBtn) sendBtn.disabled = false;
        if (input) {
            input.disabled = false;
            input.focus();
        }
    }
}

function handleToolCall(response) {
    const match = String(response || '').match(/\[TOOL_CALL\]([\s\S]*?)\[\/TOOL_CALL\]/);
    if (!match) {
        return { cleanedResponse: response, toolResult: null };
    }

    let toolPayload = null;
    try {
        toolPayload = JSON.parse(match[1]);
    } catch (error) {
        console.warn('Failed to parse tool call JSON:', error);
        return { cleanedResponse: response.replace(match[0], '').trim(), toolResult: null };
    }

    const cartApi = window.cartApi;
    if (!toolPayload || !toolPayload.tool) {
        return { cleanedResponse: response.replace(match[0], '').trim(), toolResult: null };
    }

    let toolMessage = null;
    if (toolPayload.tool === 'add_to_cart') {
        if (!cartApi) {
            toolMessage = 'Cart is not ready yet. Please try again.';
        } else {
            const dishName = toolPayload.args?.dish_name || '';
            const quantity = toolPayload.args?.quantity || 1;
            const result = cartApi.addByName(dishName, quantity);
            if (result.ok) {
                toolMessage = `Added ${quantity} × ${result.dish.name} to your cart.`;
                clearSessionNeeds();
                saveConversationState();
            } else {
                toolMessage = `I couldn't find "${dishName}" on the menu. Please check the name.`;
            }
        }
    } else if (toolPayload.tool === 'open_cart') {
        if (cartApi) {
            cartApi.openCart();
            toolMessage = 'Sure! I opened your cart.';
        } else {
            toolMessage = 'Cart is not ready yet. Please try again.';
        }
    } else if (toolPayload.tool === 'remove_from_cart') {
        if (!cartApi) {
            toolMessage = 'Cart is not ready yet. Please try again.';
        } else {
            const dishName = toolPayload.args?.dish_name || '';
            const result = cartApi.removeByName(dishName);
            if (result.ok) {
                toolMessage = `Removed ${result.dish.name} from your cart.`;
            } else {
                toolMessage = `I couldn't find "${dishName}" in your cart.`;
            }
        }
    } else if (toolPayload.tool === 'change_quantity') {
        if (!cartApi) {
            toolMessage = 'Cart is not ready yet. Please try again.';
        } else {
            const dishName = toolPayload.args?.dish_name || '';
            const quantity = toolPayload.args?.quantity || 1;
            const result = cartApi.updateQuantityByName(dishName, quantity);
            if (result.ok) {
                toolMessage = `Updated ${result.dish.name} to quantity ${result.quantity}.`;
            } else {
                toolMessage = `I couldn't find "${dishName}" in your cart.`;
            }
        }
    } else if (toolPayload.tool === 'checkout') {
        if (!cartApi) {
            toolMessage = 'Cart is not ready yet. Please try again.';
        } else {
            const result = cartApi.checkout();
            if (result.ok) {
                toolMessage = 'Payment confirmed (demo). Thank you!';
                resetSessionState();
            } else {
                toolMessage = 'Your cart is empty.';
            }
        }
    } else if (toolPayload.tool === 'describe_nutrition') {
        const dishName = toolPayload.args?.dish_name || '';
        const dishId = toolPayload.args?.dish_id;
        let dish = null;
        if (dishId != null && typeof window.getDishById === 'function') {
            dish = window.getDishById(dishId);
        }
        if (!dish && dishName && typeof window.findDishByName === 'function') {
            dish = window.findDishByName(dishName);
        }
        if (!dish) {
            toolMessage = `I couldn't find that dish on the menu. Could you tell me the exact name?`;
        } else {
            toolMessage = getDishNutritionDescription(dish);
        }
    } else if (toolPayload.tool === 'apply_recommendations') {
        if (typeof applyRecommendations === 'function') {
            applyRecommendations();
            toolMessage = null;
        }
    } else if (toolPayload.tool === 'reset_all') {
        if (typeof resetRecommendations === 'function') {
            resetRecommendations();
        }
        if (window.menuBookApi && typeof window.menuBookApi.clearCart === 'function') {
            window.menuBookApi.clearCart();
        }
        resetSessionState();
        toolMessage = 'All set. I reset recommendations and cleared your cart.';
    } else if (toolPayload.tool === 'goodbye_reset') {
        if (typeof resetRecommendations === 'function') {
            resetRecommendations();
        }
        if (window.menuBookApi && typeof window.menuBookApi.clearCart === 'function') {
            window.menuBookApi.clearCart();
        }
        resetSessionState();
        toolMessage = 'Thanks for visiting! I’ve reset the session for the next guest.';
    } else if (toolPayload.tool === 'refresh_recommendations') {
        if (window.menuBookApi && typeof window.menuBookApi.refreshRecommendations === 'function') {
            const showPage = toolPayload.args?.show_page === true;
            window.menuBookApi.refreshRecommendations(showPage);
            toolMessage = 'Refreshed the recommendation list.';
        } else {
            toolMessage = 'Recommendations are not ready yet. Please try again.';
        }
    } else if (toolPayload.tool === 'request_confirmation') {
        pendingToolAction = {
            action: toolPayload.args?.action,
            message: toolPayload.args?.message || 'Please confirm.'
        };
        toolMessage = pendingToolAction.message;
    } else if (toolPayload.tool === 'confirm_action') {
        const confirm = toolPayload.args?.confirm === true;
        const action = toolPayload.args?.action;
        if (confirm && pendingToolAction && action === pendingToolAction.action) {
            if (action === 'apply_recommendations' && typeof applyRecommendations === 'function') {
                applyRecommendations();
                toolMessage = null;
            } else if (action === 'reset_all') {
                if (typeof resetRecommendations === 'function') {
                    resetRecommendations();
                }
                if (window.menuBookApi && typeof window.menuBookApi.clearCart === 'function') {
                    window.menuBookApi.clearCart();
                }
                resetSessionState();
                toolMessage = 'Reset completed.';
            }
        } else {
            toolMessage = 'Okay, cancelled.';
        }
        pendingToolAction = null;
    }

    return {
        cleanedResponse: response.replace(match[0], '').trim(),
        toolResult: toolMessage
    };
}

// Update context data (date, time, weather, special dates)
async function updateContextData() {
    try {
        // Initialize contextData if not already initialized
        if (!contextData) {
            contextData = {
                date: '',
                time: '',
                weather: null,
                temperature: null,
                specialDates: [],
                season: '',
                dayOfWeek: '',
                month: ''
            };
        }
        
        // Get local date and time
        const now = new Date();
    contextData.date = now.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    contextData.time = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
    contextData.dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    contextData.month = now.toLocaleDateString('en-US', { month: 'long' });
    
    // Determine season (Northern Hemisphere)
    const monthNum = now.getMonth() + 1; // 1-12
    if (monthNum >= 3 && monthNum <= 5) contextData.season = 'spring';
    else if (monthNum >= 6 && monthNum <= 8) contextData.season = 'summer';
    else if (monthNum >= 9 && monthNum <= 11) contextData.season = 'autumn';
    else contextData.season = 'winter';
    
    // Check for special dates
    checkSpecialDates(now);
    
    // Get weather if enabled
    if (AI_CONFIG.weather.enabled && AI_CONFIG.weather.apiKey) {
        try {
            await getWeatherData();
        } catch (error) {
            console.warn('Weather API error:', error);
            // Continue without weather data
        }
    }
    
        console.log('Context data updated:', contextData);
        
        // Update display on homepage
        updateContextDisplay();
    } catch (error) {
        console.error('Error updating context data:', error);
        // Still try to display basic date/time even if something fails
        const now = new Date();
        if (!contextData) {
            contextData = {};
        }
        contextData.date = now.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        contextData.time = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
        updateContextDisplay();
    }
}

// Check for special dates (holidays, events, etc.)
function checkSpecialDates(date) {
    const month = date.getMonth() + 1; // 1-12
    const day = date.getDate();
    
    // Hong Kong/Chinese special dates
    const specialDates = {
        '1-1': 'New Year\'s Day', // 元旦
        '1-28': 'Chinese New Year', // 農曆新年 (approximate, varies by lunar calendar)
        '2-10': 'Chinese New Year', // 農曆新年 (alternative date, varies)
        '4-4': 'Ching Ming Festival', // 清明節 (approximate, varies by lunar calendar)
        '4-5': 'Ching Ming Festival', // 清明節 (alternative date)
        '5-5': 'Dragon Boat Festival', // 端午節 (approximate, varies by lunar calendar)
        '6-18': 'Dragon Boat Festival', // 端午節 (alternative date, varies)
        '8-15': 'Mid-Autumn Festival', // 中秋節 (approximate, varies by lunar calendar)
        '9-29': 'Mid-Autumn Festival', // 中秋節 (alternative date, varies)
        '10-1': 'National Day', // 國慶日
        '12-25': 'Christmas', // 聖誕節 (celebrated in Hong Kong)
        '12-31': 'New Year\'s Eve' // 除夕
    };
    
    const dateKey = `${month}-${day}`;
    if (specialDates[dateKey]) {
        contextData.isSpecialDate = true;
        contextData.specialDateName = specialDates[dateKey];
    } else {
        contextData.isSpecialDate = false;
        contextData.specialDateName = null;
    }
}

// Get weather data from OpenWeatherMap API
async function getWeatherData() {
    if (!AI_CONFIG.weather.apiKey) {
        return;
    }
    
    try {
        // Get user's location (requires permission or use default city)
        // For now, using a default city - you can enhance this with geolocation
        const city = 'Hong Kong'; // Default city, or get from user's location
        const url = `${AI_CONFIG.weather.endpoint}?q=${city}&appid=${AI_CONFIG.weather.apiKey}&units=metric`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Weather API error: ${response.status}`);
        }
        
        const data = await response.json();
        contextData.weather = data.weather[0].main.toLowerCase(); // e.g., 'rain', 'sunny', 'clouds'
        contextData.temperature = Math.round(data.main.temp); // Temperature in Celsius
        
        console.log('Weather data:', contextData.weather, contextData.temperature + '°C');
        
        // Update display after getting weather
        updateContextDisplay();
    } catch (error) {
        console.error('Failed to get weather:', error);
        // Set defaults
        contextData.weather = null;
        contextData.temperature = null;
        // Still update display (will hide weather if failed)
        updateContextDisplay();
    }
}

// ==================== EMBEDDING RETRIEVAL ====================

function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return String(hash);
}

function buildDishEmbeddingText(dish) {
    const ingredients = Array.isArray(dish.ingredients) ? dish.ingredients.join(', ') : '';
    const tags = Array.isArray(dish.tags) ? dish.tags.join(', ') : '';
    const allergens = Array.isArray(dish.allergens) ? dish.allergens.join(', ') : '';
    const restrictions = Array.isArray(dish.restrictions) ? dish.restrictions.join(', ') : '';
    const flavor = dish.flavor || dish.flavor_profile || dish.taste || dish.taste_profile || '';
    const cuisine = dish.cuisine || dish.country || dish.origin || '';
    const style = dish.style || dish.food_style || '';
    const nutrition = dish.nutrition || {};
    const iddsi = typeof dish.iddsi_level === 'number' ? `iddsi_level:${dish.iddsi_level}` : '';
    const nutritionSummary = [
        `energy_kcal:${nutrition.energy_kcal ?? ''}`,
        `protein_g:${nutrition.protein_g ?? ''}`,
        `fat_g:${nutrition.fat_g ?? ''}`,
        `saturated_fat_g:${nutrition.saturated_fat_g ?? ''}`,
        `trans_fat_g:${nutrition.trans_fat_g ?? ''}`,
        `carbohydrates_g:${nutrition.carbohydrates_g ?? ''}`,
        `sugars_g:${nutrition.sugars_g ?? ''}`,
        `sodium_mg:${nutrition.sodium_mg ?? ''}`
    ].join(', ');

    return [
        dish.name || '',
        dish.category || '',
        dish.description || '',
        ingredients,
        tags,
        allergens,
        restrictions,
        nutritionSummary,
        iddsi,
        flavor ? `flavor:${flavor}` : '',
        cuisine ? `cuisine:${cuisine}` : '',
        style ? `style:${style}` : ''
    ].filter(Boolean).join(' | ');
}

function extractEmbeddingArray(data) {
    if (!data) return null;
    if (data.output && Array.isArray(data.output.embeddings)) {
        return data.output.embeddings.map(item => item.embedding || item);
    }
    if (Array.isArray(data.embeddings)) {
        return data.embeddings.map(item => item.embedding || item);
    }
    if (Array.isArray(data.data)) {
        return data.data.map(item => item.embedding || item);
    }
    return null;
}

function showEmbeddingStatus(message) {
    const existing = document.getElementById('embeddingStatus');
    const text = message || 'Building knowledge...';
    if (existing) {
        existing.textContent = text;
        existing.style.opacity = '1';
        return;
    }

    const status = document.createElement('div');
    status.id = 'embeddingStatus';
    status.textContent = text;
    status.style.position = 'fixed';
    status.style.right = '18px';
    status.style.bottom = '18px';
    status.style.padding = '8px 12px';
    status.style.background = 'rgba(0, 0, 0, 0.55)';
    status.style.color = '#fff';
    status.style.fontSize = '12px';
    status.style.borderRadius = '12px';
    status.style.zIndex = '9999';
    status.style.backdropFilter = 'blur(6px)';
    status.style.boxShadow = '0 6px 18px rgba(0,0,0,0.25)';
    status.style.pointerEvents = 'none';
    document.body.appendChild(status);
}

function hideEmbeddingStatus() {
    const status = document.getElementById('embeddingStatus');
    if (!status) return;
    status.style.opacity = '0';
    if (embeddingStatusTimer) {
        clearTimeout(embeddingStatusTimer);
    }
    embeddingStatusTimer = setTimeout(() => {
        status.remove();
        embeddingStatusTimer = null;
    }, 800);
}

async function fetchEmbeddings(texts) {
    const response = await fetch(AI_CONFIG.embeddings.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            texts,
            model: AI_CONFIG.embeddings.model
        })
    });
    if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
    }
    const data = await response.json();
    const embeddings = extractEmbeddingArray(data);
    if (!embeddings) {
        throw new Error('Embedding API response format not recognized');
    }
    return embeddings;
}

async function ensureDishEmbeddings(items) {
    if (!AI_CONFIG.embeddings.enabled || !Array.isArray(items) || items.length === 0) {
        return null;
    }

    const cacheKey = items.map(item => buildDishEmbeddingText(item)).join('||');
    const currentHash = hashString(cacheKey);
    if (dishEmbeddings && dishEmbeddingHash === currentHash) {
        return dishEmbeddings;
    }

    const cached = localStorage.getItem(DISH_EMBEDDINGS_CACHE_KEY);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (parsed.hash === currentHash && Array.isArray(parsed.embeddings)) {
                dishEmbeddingHash = currentHash;
                dishEmbeddings = parsed.embeddings;
                return dishEmbeddings;
            }
        } catch (error) {
            console.warn('Failed to parse embeddings cache:', error);
        }
    }

    const texts = items.map(item => buildDishEmbeddingText(item));
    const batchSize = 16;
    const embeddings = [];
    showEmbeddingStatus('Building knowledge...');
    try {
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const batchEmbeddings = await fetchEmbeddings(batch);
            embeddings.push(...batchEmbeddings);
        }
    } finally {
        hideEmbeddingStatus();
    }

    dishEmbeddings = embeddings;
    dishEmbeddingHash = currentHash;
    localStorage.setItem(DISH_EMBEDDINGS_CACHE_KEY, JSON.stringify({
        hash: currentHash,
        embeddings
    }));
    return dishEmbeddings;
}

function cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getRelevantMenuItems(userMessage, items) {
    if (!AI_CONFIG.embeddings.enabled) return items;
    try {
        const dishVectors = await ensureDishEmbeddings(items);
        if (!dishVectors || dishVectors.length !== items.length) return items;
        const [queryVector] = await fetchEmbeddings([userMessage]);
        const scored = items.map((item, index) => ({
            item,
            score: cosineSimilarity(queryVector, dishVectors[index])
        }));
        scored.sort((a, b) => b.score - a.score);
        const topK = Math.min(AI_CONFIG.embeddings.topK, scored.length);
        return scored.slice(0, topK).map(entry => entry.item);
    } catch (error) {
        console.warn('Embedding retrieval failed, using full menu:', error);
        return items;
    }
}

function normalizeNeedList(values) {
    if (!Array.isArray(values)) return [];
    const cleaned = values
        .map(value => (value == null ? '' : String(value).trim()))
        .filter(value => value)
        .filter(value => !['undefined', 'null', 'none', 'no', 'n/a', 'na'].includes(value.toLowerCase()));
    return [...new Set(cleaned)];
}

function formatNaturalList(items) {
    if (!items || items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function mergeNeeds(persistent, session) {
    return {
        allergies: normalizeNeedList([...(persistent.allergies || []), ...(session.allergies || [])]),
        restrictions: normalizeNeedList([...(persistent.restrictions || []), ...(session.restrictions || [])]),
        healthConditions: normalizeNeedList([...(persistent.healthConditions || []), ...(session.healthConditions || [])]),
        preferences: normalizeNeedList([...(persistent.preferences || []), ...(session.preferences || [])]),
        emotions: normalizeNeedList([...(persistent.emotions || []), ...(session.emotions || [])])
    };
}

function syncCombinedNeeds() {
    userNeeds = mergeNeeds(persistentNeeds, sessionNeeds);
}

function clearSessionNeeds() {
    sessionNeeds = {
        allergies: [],
        restrictions: [],
        healthConditions: [],
        preferences: [],
        emotions: []
    };
    syncCombinedNeeds();
}

function mapNeedPhrase(value) {
    const lower = String(value).toLowerCase();
    if (lower.includes('swallow') || lower.includes('dysphagia') || lower.includes('choking')) {
        return 'easy-to-swallow textures';
    }
    if (lower.includes('iddsi')) {
        return '';
    }
    return value;
}

function buildHumanSummary(needs) {
    const parts = [];
    const preferences = formatNaturalList(normalizeNeedList(needs.preferences).map(mapNeedPhrase).filter(Boolean));
    const restrictions = formatNaturalList(normalizeNeedList(needs.restrictions).map(mapNeedPhrase).filter(Boolean));
    const allergies = formatNaturalList(normalizeNeedList(needs.allergies).map(mapNeedPhrase).filter(Boolean));
    const conditions = formatNaturalList(normalizeNeedList(needs.healthConditions).map(mapNeedPhrase).filter(Boolean));
    const emotions = formatNaturalList(normalizeNeedList(needs.emotions).map(mapNeedPhrase).filter(Boolean));

    if (preferences) parts.push(preferences);
    if (restrictions) parts.push(restrictions);
    if (conditions) parts.push(conditions);
    if (allergies) parts.push(`no ${allergies}`);
    if (emotions) parts.push(emotions);

    return formatNaturalList(parts);
}

function getDishNutritionDescription(dish) {
    if (!dish) return null;
    const nutrition = dish.nutrition || {};
    const parts = [];
    const tips = [];
    const benefits = [];

    const kcal = nutrition.energy_kcal;
    const protein = nutrition.protein_g;
    const fat = nutrition.fat_g;
    const satFat = nutrition.saturated_fat_g;
    const carbs = nutrition.carbohydrates_g;
    const sugars = nutrition.sugars_g;
    const sodium = nutrition.sodium_mg;

    if (kcal != null) parts.push(`${kcal} kcal`);
    if (protein != null) parts.push(`${protein}g protein`);
    if (fat != null) parts.push(`${fat}g fat`);
    if (carbs != null) parts.push(`${carbs}g carbs`);
    if (sugars != null) parts.push(`${sugars}g sugars`);
    if (sodium != null) parts.push(`${sodium}mg sodium`);

    if (protein != null && protein >= 18) {
        benefits.push('good protein for satiety and muscle support');
    }
    if (fat != null && fat <= 10 && kcal != null && kcal <= 450) {
        benefits.push('lighter option');
    }
    if (sodium != null && sodium <= 400) {
        benefits.push('lower sodium');
    }

    if (sodium != null && sodium >= NUTRITION_THRESHOLDS.sodium_mg) {
        tips.push('high sodium — drink water and balance with lower‑salt foods');
    }
    if (sugars != null && sugars >= NUTRITION_THRESHOLDS.sugars_g) {
        tips.push('higher sugar — better earlier in the day or with extra activity');
    }
    if (satFat != null && satFat >= NUTRITION_THRESHOLDS.saturated_fat_g) {
        tips.push('higher saturated fat — pair with veggies or lighter sides');
    }
    if (fat != null && fat >= NUTRITION_THRESHOLDS.fat_g) {
        tips.push('richer dish — consider a lighter main later');
    }
    if (kcal != null && kcal >= NUTRITION_THRESHOLDS.energy_kcal) {
        tips.push('higher calories — great as a main, keep other items light');
    }

    const ingredients = Array.isArray(dish.ingredients) ? dish.ingredients.join(', ') : '';
    const ingredientNote = ingredients ? `Key ingredients: ${ingredients}.` : '';
    const nutritionNote = parts.length > 0 ? `Per serving: ${parts.join(', ')}.` : '';
    const benefitNote = benefits.length > 0 ? `Benefits: ${benefits.join('; ')}.` : '';
    const tipNote = tips.length > 0 ? `Friendly tip: ${tips.join('; ')}.` : '';

    return `${dish.name}: ${ingredientNote} ${nutritionNote} ${benefitNote} ${tipNote}`.replace(/\s+/g, ' ').trim();
}

function getDishByIdForIddsi(dishId) {
    if (typeof window.getDishById === 'function') {
        return window.getDishById(dishId);
    }
    const items = typeof menuItems !== 'undefined' ? menuItems : (window.menuItems || []);
    return items.find(item => String(item.id) === String(dishId) || String(item.mongoId) === String(dishId));
}

function detectIddsiNeed(message, extractedData) {
    const text = String(message || '').toLowerCase();
    const hasKeyword = IDDSI_KEYWORDS.some(keyword => text.includes(keyword));
    const hasCondition = (extractedData?.persistent_conditions || extractedData?.session_conditions || extractedData?.conditions || [])
        .some(item => String(item).toLowerCase().includes('dysphagia') || String(item).toLowerCase().includes('swallow') || String(item).toLowerCase().includes('stroke'));
    return hasKeyword || hasCondition;
}

function getIddsiMaxLevel(message) {
    const text = String(message || '').toLowerCase();
    if (text.includes('stroke') || text.includes('solid food is hard to swallow') || text.includes('solid food') && text.includes('hard')) {
        return 4;
    }
    return 5;
}

function allowsThinLiquids(message) {
    const text = String(message || '').toLowerCase();
    return text.includes('thin liquids are ok') ||
        text.includes('thin liquids okay') ||
        text.includes('can drink thin liquids') ||
        text.includes('thin liquids fine');
}

function applyIddsiSafetyFilter(message, extractedData) {
    if (!recommendedItems || recommendedItems.length === 0) return { changed: false, maxLevel: null };
    if (!detectIddsiNeed(message, extractedData)) return { changed: false, maxLevel: null };
    const maxLevel = getIddsiMaxLevel(message);
    const allowThin = allowsThinLiquids(message);
    let excludedThin = false;
    const filtered = recommendedItems.filter(recId => {
        const dish = getDishByIdForIddsi(recId);
        if (!dish || typeof dish.iddsi_level !== 'number') return true;
        if (dish.iddsi_level === 0 && !allowThin) {
            excludedThin = true;
            return false;
        }
        return dish.iddsi_level <= maxLevel;
    });
    const changed = filtered.length !== recommendedItems.length;
    if (changed) {
        recommendedItems = filtered;
        window.recommendedItems = recommendedItems;
    }
    return { changed, maxLevel, excludedThin };
}

function markSessionActive() {
    try {
        localStorage.setItem('sessionActive', 'true');
        localStorage.setItem('lastActivityAt', String(Date.now()));
    } catch (error) {
        console.warn('Failed to mark session active:', error);
    }
}

function resetIdleTimers() {
    if (idleTimer) clearTimeout(idleTimer);
    if (idleGraceTimer) clearTimeout(idleGraceTimer);
    idlePrompted = false;
    markSessionActive();

    idleTimer = setTimeout(() => {
        idlePrompted = true;
        showChatBubble('Are you still there? I can complete checkout in 60 seconds if you’re done.');
        addMessageToChat('Are you still there? I can complete checkout in 60 seconds if you’re done.', 'bot');
        idleGraceTimer = setTimeout(() => {
            handleAutoCheckout();
        }, IDLE_GRACE_MS);
    }, IDLE_TIMEOUT_MS);
}

function handleAutoCheckout() {
    if (window.cartApi) {
        const result = window.cartApi.checkout();
        if (result?.ok) {
            showChatBubble('Thanks! I’ve completed checkout and reset the menu for the next guest.');
            addMessageToChat('Thanks! I’ve completed checkout and reset the menu for the next guest.', 'bot');
        } else {
            showChatBubble('No activity detected. I reset the session for the next guest.');
            addMessageToChat('No activity detected. I reset the session for the next guest.', 'bot');
        }
    }
    resetSessionState();
}

function resetSessionState() {
    chatHistory = [];
    persistentNeeds = {
        allergies: [],
        restrictions: [],
        healthConditions: [],
        preferences: [],
        emotions: []
    };
    sessionNeeds = {
        allergies: [],
        restrictions: [],
        healthConditions: [],
        preferences: [],
        emotions: []
    };
    syncCombinedNeeds();
    recommendedItems = [];
    window.recommendedItems = [];
    pendingConfirmation = null;
    recommendationsGenerated = false;
    recommendationsApplied = false;
    window.recommendationsApplied = false;
    lastRecommendationIds = [];
    pendingToolAction = null;

    clearConversationState();
    try {
        localStorage.removeItem('sessionActive');
        localStorage.removeItem('lastActivityAt');
    } catch (error) {
        console.warn('Failed to clear session flags:', error);
    }

    if (typeof resetRecommendations === 'function') {
        resetRecommendations();
    }
    if (window.menuBookApi && typeof window.menuBookApi.clearCart === 'function') {
        window.menuBookApi.clearCart();
    }
}

window.chatbotApi = {
    resetSession: () => resetSessionState()
};

// Get AI response from Qwen3 API (Alibaba Cloud DashScope)
async function getQwenResponse(userMessage) {
    if (!AI_CONFIG.qwen.apiKey) {
        throw new Error('Qwen API key not configured');
    }

    // Get menu items for AI context (check both local and window scope)
    const items = typeof menuItems !== 'undefined' ? menuItems : (window.menuItems || []);
    const recentHistory = USE_SESSION_MEMORY
        ? chatHistory.slice(-12).map(msg => `${msg.type.toUpperCase()}: ${msg.text}`).join('\n')
        : '';
    const historyContext = recentHistory ? `RECENT CONVERSATION:\n${recentHistory}` : 'RECENT CONVERSATION: none';
    const uiLanguage = window.currentLanguage || localStorage.getItem('language') || 'en';

    const relevantItems = items.length > 0 ? await getRelevantMenuItems(userMessage, items) : [];
    const menuContext = relevantItems.length > 0 ? relevantItems.map(item => {
        const ingredients = Array.isArray(item.ingredients) && item.ingredients.length > 0
            ? item.ingredients.join(', ')
            : 'unknown';
        const flavor = item.flavor || item.flavor_profile || item.taste || item.taste_profile || 'unknown';
        const cuisine = item.cuisine || item.country || item.origin || 'unknown';
        const style = item.style || item.food_style || 'unknown';
        const nutrition = item.nutrition || {};
        const iddsi = typeof item.iddsi_level === 'number' ? item.iddsi_level : 'unknown';
        const nutritionSummary = [
            `energy_kcal:${nutrition.energy_kcal ?? 'unknown'}`,
            `protein_g:${nutrition.protein_g ?? 'unknown'}`,
            `fat_g:${nutrition.fat_g ?? 'unknown'}`,
            `saturated_fat_g:${nutrition.saturated_fat_g ?? 'unknown'}`,
            `trans_fat_g:${nutrition.trans_fat_g ?? 'unknown'}`,
            `carbohydrates_g:${nutrition.carbohydrates_g ?? 'unknown'}`,
            `sugars_g:${nutrition.sugars_g ?? 'unknown'}`,
            `sodium_mg:${nutrition.sodium_mg ?? 'unknown'}`
        ].join(', ');
        return `ID:${item.id} "${item.name}" (${item.category}) - IDDSI:${iddsi} Tags:${item.tags?.join(',') || 'none'} Allergens:${item.allergens?.join(',') || 'none'} Restrictions:${item.restrictions?.join(',') || 'none'} Flavor:${flavor} Cuisine:${cuisine} Style:${style} Ingredients:${ingredients} Nutrition:${nutritionSummary}`;
    }).join('\n') : 'Menu is loading from database. Please wait a moment.';
    
    // Build context information string
    let contextInfo = `CURRENT CONTEXT:
- Date: ${contextData.date} (${contextData.dayOfWeek})
- Time: ${contextData.time}
- Season: ${contextData.season}
- Month: ${contextData.month}
- Language: ${uiLanguage}`;
    
    if (contextData.isSpecialDate) {
        contextInfo += `\n- Special Date: ${contextData.specialDateName} (consider special menu items)`;
    }
    
    if (contextData.weather && contextData.temperature !== null) {
        contextInfo += `\n- Weather: ${contextData.weather}, ${contextData.temperature}°C`;
    }

    if (pendingToolAction) {
        contextInfo += `\n- Pending Action: ${pendingToolAction.action} (waiting for user confirmation)`;
    }
    if (lastRecommendationIds.length > 0) {
        contextInfo += `\n- Last Recommendations: ${lastRecommendationIds.join(', ')}`;
    }
    if (USE_SESSION_MEMORY) {
        const persistentSummary = buildHumanSummary(persistentNeeds);
        const sessionSummary = buildHumanSummary(sessionNeeds);
        if (persistentSummary) {
            contextInfo += `\n- Persistent Needs: ${persistentSummary}`;
        }
        if (sessionSummary) {
            contextInfo += `\n- Session Needs: ${sessionSummary}`;
        }
    }

    // Specialized system prompt - AI handles EVERYTHING
    const systemPrompt = `You are a caring and empathetic dietary assistant for a restaurant ordering system. You understand customers' emotions, feelings, dietary needs, allergies, and health conditions to provide personalized meal recommendations.

YOUR TASKS:
1. Understand customer emotions, feelings, and mood (upset, sad, stressed, happy, tired, anxious, sick, etc.)
2. Understand dietary restrictions, allergies, and health conditions
3. Consider current context: weather, season, time of day, special dates
4. Provide empathetic, warm, and understanding responses
5. Give ABSTRACT descriptions (e.g., "warm comfort foods", "soft foods", "energizing meals") - DO NOT list specific dish names
6. Natural waiter style:
   - Vary your phrasing; do not use a fixed response template.
   - Briefly summarize what requirements you applied (e.g., "I’m focusing on vegetarian, light, and warm options").
   - Always invite changes or confirmation (e.g., "Want me to adjust anything?").
7. Smart confirmation logic:
   - If condition is VERY SPECIFIC and CLEAR (e.g., "I'm vegetarian", "I have peanut allergy") → Refresh recommendations immediately, then ask for confirmation or changes.
   - If condition is UNCERTAIN or needs interpretation (e.g., "I'm upset", "I feel tired") → Consider weather, time, and special dates, then ask: "I think you might like [abstract description based on context]. Would that be okay?"
7. Always respond in the user's selected language shown in CURRENT CONTEXT (en=English, zh=Traditional Chinese, zhCN=Simplified Chinese).
8. Classify user needs into two scopes:
   - Persistent needs: long-term identity/restrictions (vegetarian, allergies, religious rules, medical constraints). Keep until checkout/reset.
   - Session needs: current cravings or temporary choices (hot, Italian tonight, light, not sour right now). Clear after recommendations are applied.
8. After your response, ALWAYS include structured data in this EXACT format (classify each item as persistent vs session):
   [EXTRACT: persistent_emotions:...|persistent_allergies:...|persistent_restrictions:...|persistent_preferences:...|persistent_conditions:...|session_emotions:...|session_allergies:...|session_restrictions:...|session_preferences:...|session_conditions:...|session_remove_emotions:...|session_remove_allergies:...|session_remove_restrictions:...|session_remove_preferences:...|session_remove_conditions:...|clear_session:yes/no|recommendations:itemId1,itemId2,itemId3|confirm:yes/no]
9. Only recommend dishes that appear in CURRENT MENU. If nothing matches, say so and ask the user to loosen or clarify constraints.
10. When users mention nutrition constraints (e.g., low fat, high protein, low sodium), use the nutrition values in CURRENT MENU to filter and explain briefly.
11. When users mention taste preferences (e.g., not sour, spicy, sweet, bitter), use Flavor/Style/Cuisine/Ingredients to filter. If flavor data is missing, ask a quick follow-up.
12. When asked for dish nutrition or components, call describe_nutrition and reply naturally with benefits and friendly tips.
13. Interpret pronouns/adjectives without nouns (e.g., "that", "the same", "hot one") as follow‑ups to the most recent session request, unless the user clearly signals a new request ("next", "new", "another", "instead", "add to cart").
14. If the scope is ambiguous (persistent vs session), ask a short clarification once. Do NOT ask this every time—only when unclear.
15. Session needs should remain until the user adds to cart or clearly changes their mind. If the user regrets a specific feature, use session_remove_* to remove only that feature and keep other session needs.
16. If the user says “bye”, “goodbye”, “thank you, done”, or similar ending, use the goodbye_reset tool to clear the session.
16. IDDSI guidance: ALWAYS use the IDDSI level in CURRENT MENU when the user has swallowing issues. If the user mentions choking, dysphagia, stroke recovery, elderly care, or swallowing difficulty, assume an IDDSI need and default to safer textures (Level 4–5). Do not recommend foods above the tolerated level. For stroke or “solid food is hard to swallow,” DO NOT recommend Level 6 or 7; default to Level 4 unless the user explicitly says they can handle Level 5. If unsure, prefer Level 4. Explain simply (e.g., “soft and easy to swallow”). If severe difficulty, suggest consulting a clinician and avoid medical claims. Do not assume thin liquids are safe.
17. IDDSI response rule: When swallowing issues are present, explicitly mention the target IDDSI level(s) and why (e.g., “IDDSI 4 because it’s smooth and easier to swallow”). If any recommended item has IDDSI >5 in these cases, that is a mistake—correct it immediately.
18. When you apply IDDSI rules, add a short, gentle note like: “I’m using IDDSI texture levels to keep swallowing safer.”

TOOL CALLING (for ordering actions):
- When the user wants to add items, open cart, apply recommendations, or reset, emit a tool call block.
- When the user asks about nutrition, ingredients, benefits, or "what's in it", call describe_nutrition for that dish.
- Use request_confirmation before critical actions (apply/reset) if you need user confirmation.
- Format MUST be exactly:
  [TOOL_CALL]{"tool":"add_to_cart","args":{"dish_name":"Margherita Pizza","quantity":2}}[/TOOL_CALL]
  [TOOL_CALL]{"tool":"open_cart","args":{}}[/TOOL_CALL]
  [TOOL_CALL]{"tool":"remove_from_cart","args":{"dish_name":"Cheesecake"}}[/TOOL_CALL]
  [TOOL_CALL]{"tool":"change_quantity","args":{"dish_name":"Cheesecake","quantity":2}}[/TOOL_CALL]
  [TOOL_CALL]{"tool":"checkout","args":{"payment_method":"card"}}[/TOOL_CALL]
  [TOOL_CALL]{"tool":"describe_nutrition","args":{"dish_name":"Grilled Salmon"}}[/TOOL_CALL]
  [TOOL_CALL]{"tool":"apply_recommendations","args":{}}[/TOOL_CALL]
  [TOOL_CALL]{"tool":"reset_all","args":{}}[/TOOL_CALL]
  [TOOL_CALL]{"tool":"goodbye_reset","args":{}}[/TOOL_CALL]
  [TOOL_CALL]{"tool":"refresh_recommendations","args":{"show_page":true}}[/TOOL_CALL]
  [TOOL_CALL]{"tool":"request_confirmation","args":{"action":"apply_recommendations","message":"I can apply these recommendations now. Continue?"}}[/TOOL_CALL]
  [TOOL_CALL]{"tool":"confirm_action","args":{"action":"apply_recommendations","confirm":true}}[/TOOL_CALL]
- After the tool call block, provide a short natural language response.

CONVERSATION CONTEXT:
- Always consider the full conversation history and latest user requirements.
- If requirements accumulate and are compatible, update recommendations to satisfy all of them.
- If new requirements conflict with previous ones, prioritize the most recent requirement, explain the change, and ask for confirmation if needed.
- Avoid repeating the exact same recommendation list from "Last Recommendations" unless the user explicitly asks for the same items or requirements did not change.
- When you detect NEW requirements, always refresh recommendations with a tool call, then summarize what you applied and ask for confirmation or changes.
   
   - confirm:yes = Direct activation (specific condition, no confirmation needed)
   - confirm:no = Needs confirmation (uncertain condition)
   
   Example 1 (specific): [EXTRACT: persistent_preferences:vegetarian|recommendations:1,2,4,8,10|confirm:yes]
   Example 2 (uncertain): [EXTRACT: session_emotions:upset|recommendations:4,7,10|confirm:no]
   Example 3 (regret): [EXTRACT: session_remove_restrictions:spicy|recommendations:...|confirm:no]

${contextInfo}

${historyContext}

CURRENT MENU (retrieved subset based on the user's latest request; ask to broaden if needed):
${menuContext}

CONTEXT-BASED RECOMMENDATIONS:
- Cold weather/Rain → Warm, hearty foods (soups, hot dishes, warm drinks)
- Hot weather/Sunny → Light, refreshing foods (salads, cold drinks, lighter meals)
- Winter season → Comfort foods, warm beverages, hearty meals
- Summer season → Light meals, fresh options, cold beverages
- Morning/Early day → Energizing breakfast items, coffee, light meals
- Evening/Night → Hearty dinners, comfort foods
- Special dates → Suggest celebratory items, special treats, desserts
- Rainy day → Warm, comforting foods
- Cold temperature → Hot soups, warm dishes, hot drinks

RESPONSE GUIDELINES:
- Use abstract descriptions: "warm comfort foods", "soft foods", "protein-rich meals", "light options", "soothing drinks", "hot dishes perfect for this weather"
- DO NOT mention specific dish names in your response
- DO NOT include any ID numbers, item numbers, or database references (e.g., "ID:1", "item 5", "dish 3") in your response
- Only mention dish names if the customer specifically asks about them
- Consider weather and time when making recommendations for uncertain conditions
- For specific conditions: "Thank you for letting me know! I've found some suitable options for you."
- For uncertain conditions: "Given the [weather/season/time], I think you might like [abstract description]. Would that be okay?"
- Keep responses under 80 words
- Be warm and empathetic`;

    try {
        // Build messages array
        const messages = [
            {
                role: 'system',
                content: systemPrompt
            },
            ...chatHistory.map(msg => ({
                role: msg.type === 'user' ? 'user' : 'assistant',
                content: msg.text
            })),
            {
                role: 'user',
                content: userMessage
            }
        ];

        // Prepare request body
        const requestBody = {
            model: AI_CONFIG.qwen.model,
            input: {
                messages: messages
            },
            parameters: {
                temperature: 0.7,
                max_tokens: 200,
                top_p: 0.8,
                result_format: 'message'
            }
        };

        const response = await fetch(AI_CONFIG.qwen.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.message || errorData.error?.message || response.statusText;
            console.error('Qwen API error details:', {
                status: response.status,
                statusText: response.statusText,
                errorData: errorData
            });
            throw new Error(`Qwen API error (${response.status}): ${errorMessage}`);
        }

        const data = await response.json();
        console.log('Qwen API response:', data); // Debug log
        
        // Extract response based on DashScope API format
        // Format 1: data.output.choices[0].message.content
        if (data.output?.choices?.[0]?.message?.content) {
            return data.output.choices[0].message.content;
        }
        // Format 2: data.output.text
        if (data.output?.text) {
            return data.output.text;
        }
        // Format 3: data.text
        if (data.text) {
            return data.text;
        }
        // Format 4: Direct output
        if (data.output) {
            return String(data.output);
        }
        
        console.warn('Unexpected Qwen API response format:', data);
        throw new Error('Unexpected API response format');
    } catch (error) {
        console.error('Qwen API error:', error);
        console.error('Error stack:', error.stack);
        throw error;
    }
}

// Extract structured data from AI response - AI does ALL the work
function extractFromAIResponse(aiResponse) {
    // Make sure we are always working with a string
    aiResponse = String(aiResponse || '');

    // Look for [EXTRACT: ...] pattern.
    // Qwen sometimes omits the closing ']', so we match everything after "[EXTRACT:".
    // Example we handle:
    // "text... [EXTRACT: preferences:vegetarian|recommendations:...,...,..."
    const extractMatch = aiResponse.match(/\[EXTRACT:([\s\S]*)/);
    if (!extractMatch) {
        console.log('⚠️ No [EXTRACT:...] pattern found in AI response');
        console.log('📝 Full AI response:', aiResponse);
        return null;
    }
    
    console.log('✅ Found extraction pattern:', extractMatch[0]);
    
    const extractData = extractMatch[1];
    console.log('📦 Extracting data:', extractData);
    
    const result = {
        emotions: [],
        allergies: [],
        restrictions: [],
        preferences: [],
        conditions: [],
        persistent_emotions: [],
        persistent_allergies: [],
        persistent_restrictions: [],
        persistent_preferences: [],
        persistent_conditions: [],
        session_emotions: [],
        session_allergies: [],
        session_restrictions: [],
        session_preferences: [],
        session_conditions: [],
        session_remove_emotions: [],
        session_remove_allergies: [],
        session_remove_restrictions: [],
        session_remove_preferences: [],
        session_remove_conditions: [],
        clear_session: 'no',
        recommendations: [], // AI-recommended item IDs
        confirm: 'no' // Default to needing confirmation
    };
    
    // Parse format: emotions:emotion1,emotion2|allergies:allergy1|recommendations:id1,id2|confirm:yes/no|...
    const parts = extractData.split('|');
    for (const part of parts) {
        const colonIndex = part.indexOf(':');
        if (colonIndex === -1) continue;
        
        const key = part.substring(0, colonIndex).trim();
        const values = part.substring(colonIndex + 1).trim();
        
        if (values) {
            const items = values.split(',').map(v => v.trim()).filter(v => v);
            switch(key) {
                case 'emotions':
                    result.emotions = items;
                    break;
                case 'allergies':
                    result.allergies = items;
                    break;
                case 'restrictions':
                    result.restrictions = items;
                    break;
                case 'preferences':
                    result.preferences = items;
                    break;
                case 'conditions':
                    result.conditions = items;
                    break;
                case 'persistent_emotions':
                    result.persistent_emotions = items;
                    break;
                case 'persistent_allergies':
                    result.persistent_allergies = items;
                    break;
                case 'persistent_restrictions':
                    result.persistent_restrictions = items;
                    break;
                case 'persistent_preferences':
                    result.persistent_preferences = items;
                    break;
                case 'persistent_conditions':
                    result.persistent_conditions = items;
                    break;
                case 'session_emotions':
                    result.session_emotions = items;
                    break;
                case 'session_allergies':
                    result.session_allergies = items;
                    break;
                case 'session_restrictions':
                    result.session_restrictions = items;
                    break;
                case 'session_preferences':
                    result.session_preferences = items;
                    break;
                case 'session_conditions':
                    result.session_conditions = items;
                    break;
                case 'session_remove_emotions':
                    result.session_remove_emotions = items;
                    break;
                case 'session_remove_allergies':
                    result.session_remove_allergies = items;
                    break;
                case 'session_remove_restrictions':
                    result.session_remove_restrictions = items;
                    break;
                case 'session_remove_preferences':
                    result.session_remove_preferences = items;
                    break;
                case 'session_remove_conditions':
                    result.session_remove_conditions = items;
                    break;
                case 'clear_session':
                    result.clear_session = items[0] || 'no';
                    break;
                case 'recommendations':
                    // Handle both purely numeric IDs and MongoDB ObjectId strings
                    result.recommendations = items
                        .map(id => {
                            const trimmed = id.trim();
                            
                            // If the ID is all digits (e.g. "1", "12"), treat as numeric
                            if (/^\d+$/.test(trimmed)) {
                                return parseInt(trimmed, 10);
                            }
                            
                            // Otherwise treat as string (this covers MongoDB ObjectId like "6957bd1b...")
                            return trimmed;
                        })
                        .filter(id => id !== null && id !== undefined && id !== '');
                    console.log('✅ Extracted recommendations:', result.recommendations);
                    break;
                case 'confirm':
                    result.confirm = items[0] || 'no'; // yes or no
                    break;
            }
        }
    }
    
    console.log('📊 Final extracted result:', result);
    return result;
}

// Update user needs from AI extraction - AI is the source of truth
function updateUserNeedsFromAI(extractedData) {
    // AI determines everything - use AI's extraction as the source of truth
    if (!USE_SESSION_MEMORY) {
        persistentNeeds = {
            allergies: [],
            restrictions: [],
            healthConditions: [],
            preferences: [],
            emotions: []
        };
        sessionNeeds = {
            allergies: [],
            restrictions: [],
            healthConditions: [],
            preferences: [],
            emotions: []
        };
    }
    if (String(extractedData.clear_session || '').toLowerCase() === 'yes') {
        clearSessionNeeds();
    }

    if (extractedData.session_remove_emotions?.length) {
        sessionNeeds.emotions = normalizeNeedList(
            sessionNeeds.emotions.filter(item => !extractedData.session_remove_emotions.includes(item))
        );
    }
    if (extractedData.session_remove_allergies?.length) {
        sessionNeeds.allergies = normalizeNeedList(
            sessionNeeds.allergies.filter(item => !extractedData.session_remove_allergies.includes(item))
        );
    }
    if (extractedData.session_remove_restrictions?.length) {
        sessionNeeds.restrictions = normalizeNeedList(
            sessionNeeds.restrictions.filter(item => !extractedData.session_remove_restrictions.includes(item))
        );
    }
    if (extractedData.session_remove_preferences?.length) {
        sessionNeeds.preferences = normalizeNeedList(
            sessionNeeds.preferences.filter(item => !extractedData.session_remove_preferences.includes(item))
        );
    }
    if (extractedData.session_remove_conditions?.length) {
        sessionNeeds.healthConditions = normalizeNeedList(
            sessionNeeds.healthConditions.filter(item => !extractedData.session_remove_conditions.includes(item))
        );
    }

    if (extractedData.persistent_emotions?.length) {
        persistentNeeds.emotions = normalizeNeedList([...persistentNeeds.emotions, ...extractedData.persistent_emotions]);
    }
    if (extractedData.persistent_allergies?.length) {
        persistentNeeds.allergies = normalizeNeedList([...persistentNeeds.allergies, ...extractedData.persistent_allergies]);
    }
    if (extractedData.persistent_restrictions?.length) {
        persistentNeeds.restrictions = normalizeNeedList([...persistentNeeds.restrictions, ...extractedData.persistent_restrictions]);
    }
    if (extractedData.persistent_preferences?.length) {
        persistentNeeds.preferences = normalizeNeedList([...persistentNeeds.preferences, ...extractedData.persistent_preferences]);
    }
    if (extractedData.persistent_conditions?.length) {
        persistentNeeds.healthConditions = normalizeNeedList([...persistentNeeds.healthConditions, ...extractedData.persistent_conditions]);
    }

    if (extractedData.session_emotions?.length) {
        sessionNeeds.emotions = normalizeNeedList([...sessionNeeds.emotions, ...extractedData.session_emotions]);
    }
    if (extractedData.session_allergies?.length) {
        sessionNeeds.allergies = normalizeNeedList([...sessionNeeds.allergies, ...extractedData.session_allergies]);
    }
    if (extractedData.session_restrictions?.length) {
        sessionNeeds.restrictions = normalizeNeedList([...sessionNeeds.restrictions, ...extractedData.session_restrictions]);
    }
    if (extractedData.session_preferences?.length) {
        sessionNeeds.preferences = normalizeNeedList([...sessionNeeds.preferences, ...extractedData.session_preferences]);
    }
    if (extractedData.session_conditions?.length) {
        sessionNeeds.healthConditions = normalizeNeedList([...sessionNeeds.healthConditions, ...extractedData.session_conditions]);
    }

    // Backward compatibility: map legacy fields to session needs
    if (extractedData.emotions?.length) {
        sessionNeeds.emotions = normalizeNeedList([...sessionNeeds.emotions, ...extractedData.emotions]);
    }
    if (extractedData.allergies?.length) {
        sessionNeeds.allergies = normalizeNeedList([...sessionNeeds.allergies, ...extractedData.allergies]);
    }
    if (extractedData.restrictions?.length) {
        sessionNeeds.restrictions = normalizeNeedList([...sessionNeeds.restrictions, ...extractedData.restrictions]);
    }
    if (extractedData.preferences?.length) {
        sessionNeeds.preferences = normalizeNeedList([...sessionNeeds.preferences, ...extractedData.preferences]);
    }
    if (extractedData.conditions?.length) {
        sessionNeeds.healthConditions = normalizeNeedList([...sessionNeeds.healthConditions, ...extractedData.conditions]);
    }

    syncCombinedNeeds();
    
    // If AI provided direct recommendations, use those (AI does all the filtering)
    if (extractedData.recommendations && extractedData.recommendations.length > 0) {
        recommendedItems = extractedData.recommendations;
        window.recommendedItems = recommendedItems;
        recommendationsGenerated = true; // Mark that recommendations have been generated
        console.log('AI direct recommendations:', recommendedItems);
        console.log('AI confirmation needed:', extractedData.confirm);
        lastRecommendationIds = [...recommendedItems];
        
        return true; // Indicate AI provided direct recommendations
    }

    // No recommendations in this response -> clear old list to avoid stale badges
    if (recommendedItems.length > 0) {
        recommendedItems = [];
        window.recommendedItems = [];
        recommendationsGenerated = false;
        console.log('🧹 Cleared stale recommendations (AI did not provide new list).');
        refreshRecommendationView();
    }
    
    console.log('Updated user needs from AI:', {
        persistentNeeds,
        sessionNeeds,
        combined: userNeeds
    });
    return false; // Need to filter based on extracted needs
}

// Check for confirmation responses (simple check)
function extractUserNeeds(message) {
    // Confirmation and actions are handled by the AI tool-calling flow.
    // Keep this for backward compatibility but do not use keyword matching.
    return false;
}

// Helper function to check if user has provided any needs
function hasUserNeeds() {
    return userNeeds.allergies.length > 0 || 
           userNeeds.restrictions.length > 0 || 
           userNeeds.preferences.length > 0 ||
           userNeeds.healthConditions.length > 0 ||
           userNeeds.emotions.length > 0;
}

// Update apply button state - always enable if user has provided needs
function updateApplyButtonState() {
    // Support both index.html and menu-book.html
    const applyBtn = document.getElementById('applyRecommendationsBtn') || document.getElementById('applyRecommendationsBtnBook');
    if (!applyBtn) {
        console.warn('⚠️ Apply button not found in DOM');
        return;
    }
    
    const hasNeeds = hasUserNeeds();
    
    // Update button text to show count if available (only for index.html with .btn-text)
    if (recommendedItems.length > 0) {
        const btnText = applyBtn.querySelector('.btn-text');
        if (btnText) {
            btnText.textContent = `APPLY (${recommendedItems.length})`;
        } else {
            // For menu-book.html, update button text directly
            applyBtn.textContent = `APPLY (${recommendedItems.length})`;
        }
    } else {
        const btnText = applyBtn.querySelector('.btn-text');
        if (btnText) {
            btnText.textContent = 'APPLY';
        } else {
            // For menu-book.html, update button text directly
            applyBtn.textContent = 'APPLY';
        }
    }
    
    // Enable button if:
    // 1. User has provided needs AND has recommendations, OR
    // 2. Recommendations have been generated (even if needs array is empty, AI might have provided recommendations), OR
    // 3. We're waiting for user confirmation (pendingConfirmation is true)
    const shouldEnable = (hasNeeds && recommendedItems.length > 0) ||
                         (recommendedItems.length > 0 && recommendationsGenerated) ||
                         (pendingConfirmation === true && recommendedItems.length > 0);
    
    console.log('🔘 Button state update:', {
        hasNeeds,
        recommendedItemsCount: recommendedItems.length,
        recommendationsGenerated,
        shouldEnable,
        currentDisabled: applyBtn.disabled
    });
    
    if (shouldEnable) {
        applyBtn.disabled = false;
        console.log('✅ Button ENABLED');
    } else {
        applyBtn.disabled = true;
        console.log('❌ Button DISABLED');
    }
    
    // Also update menu-book cloud buttons
    updateMenuBookButtonState();
}

// Update menu-book cloud button state
function updateMenuBookButtonState() {
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

// Generate recommendations based on user needs (called dynamically after each message)
function generateRecommendations() {
    recommendedItems = [];
    
    // Ensure menuItems is accessible (from script.js, loaded from MongoDB)
    // Check both local scope and window scope
    const items = typeof menuItems !== 'undefined' ? menuItems : (window.menuItems || []);
    
    if (!items || items.length === 0) {
        console.warn('menuItems not loaded yet. Waiting for menu to load from database...');
        // Don't show error, just wait - menu is loading asynchronously
        return;
    }
    
    // Check if we have any requirements (including emotions)
    const hasRequirements = userNeeds.allergies.length > 0 || 
                            userNeeds.restrictions.length > 0 || 
                            userNeeds.preferences.length > 0 ||
                            userNeeds.healthConditions.length > 0 ||
                            userNeeds.emotions.length > 0;
    
    if (!hasRequirements) {
        // No requirements yet, don't filter
        recommendedItems = [];
        window.recommendedItems = [];
        recommendationsGenerated = false;
        return;
    }
    
    // Filter menu items based on user needs
    const suitableItems = items.filter(item => {
        // Step 1: Check allergens - EXCLUDE items with user's allergens
        for (const allergen of userNeeds.allergies) {
            if (item.allergens && item.allergens.includes(allergen)) {
                return false; // Exclude this item
            }
        }
        
        // Step 2: Check restrictions - EXCLUDE items with user's restrictions
        for (const restriction of userNeeds.restrictions) {
            if (item.restrictions && item.restrictions.includes(restriction)) {
                return false; // Exclude this item
            }
        }
        
        // Step 3: Check preferences - REQUIRE items to match preferences
        if (userNeeds.preferences.includes('vegetarian')) {
            if (!item.tags || !item.tags.includes('vegetarian')) {
                return false; // Exclude non-vegetarian items
            }
        }
        
        if (userNeeds.preferences.includes('vegan')) {
            if (!item.tags || (!item.tags.includes('vegan') && !item.tags.includes('vegan-option'))) {
                return false; // Exclude non-vegan items
            }
        }
        
        if (userNeeds.preferences.includes('low-carb')) {
            if (!item.tags || !item.tags.includes('low-carb')) {
                return false; // Exclude non-low-carb items
            }
        }
        
        // Step 4: Check health conditions - special handling
        if (userNeeds.healthConditions.includes('sore-throat')) {
            // For sore throat, prefer soft foods and warm drinks
            const itemNameLower = item.name.toLowerCase();
            const isSoftFood = item.category === 'mains' && 
                (itemNameLower.includes('pasta') || 
                 itemNameLower.includes('curry'));
            const isWarmDrink = item.category === 'drinks' && 
                (itemNameLower.includes('coffee') || 
                 itemNameLower.includes('lemonade'));
            
            // Include soft foods and warm drinks that passed other filters
            if (isSoftFood || isWarmDrink) {
                return true; // Suitable for sore throat
            }
            
            // For sore throat only (no other requirements), show soft items
            const hasOtherRequirements = userNeeds.allergies.length > 0 || 
                                        userNeeds.restrictions.length > 0 || 
                                        userNeeds.preferences.length > 0;
            
            if (!hasOtherRequirements) {
                // Only sore throat requirement - show only soft foods
                return false;
            }
            // Has other requirements - item already passed filters, include it
        }
        
        // Step 5: Emotions are handled by AI extraction
        // AI will extract emotions and we filter based on what AI determines
        // No hardcoded emotion logic - AI decides what's suitable
        
        // Item passed all filters (allergies, restrictions, preferences, conditions)
        // Emotions are considered by AI in its recommendations, not hardcoded here
        return true;
    });
    
    // Get item IDs
    recommendedItems = suitableItems.map(item => item.id);
    window.recommendedItems = recommendedItems;
    recommendationsGenerated = true; // Mark that recommendations have been generated
    
    // Debug logging
    console.log('User needs:', JSON.stringify(userNeeds, null, 2));
    console.log('Recommended items:', recommendedItems);
    console.log('Suitable items:', suitableItems.map(i => i.name));
    
    // Don't render menu here - wait for user to click Apply button
    // Badges will only show after Apply is clicked
    console.log('📋 Recommendations generated, but badges will only show after Apply is clicked');
    
    // Always enable button if user has provided needs and has recommendations
    updateApplyButtonState();
}

// Apply recommendations to menu
function applyRecommendations() {
    // Ensure window.recommendedItems is set (use local recommendedItems if available)
    if (recommendedItems && recommendedItems.length > 0) {
        window.recommendedItems = recommendedItems;
        console.log('✅ Apply button clicked - Recommended items:', recommendedItems);
        console.log('✅ window.recommendedItems set to:', window.recommendedItems);
    } else {
        console.warn('⚠️ No recommended items to apply');
    }
    
    // Set the applied flag to true - this will make badges appear
    recommendationsApplied = true;
    window.recommendationsApplied = true;
    console.log('✅ Recommendations applied flag set to true - badges will now show');
    
    // Re-render menu to show recommendations (badges will appear now)
    if (typeof renderMenu === 'function') {
        console.log('🔄 Calling renderMenu() to update display with badges...');
        renderMenu();
    } else if (typeof renderPages === 'function') {
        // For menu-book.html, trigger menu-book's apply function via custom event
        // Only dispatch if we're not already in the menu-book context
        if (!window.applyingRecommendations) {
            window.applyingRecommendations = true;
            console.log('🔄 Triggering menu-book applyRecommendations via event...');
            window.dispatchEvent(new CustomEvent('applyRecommendationsToBook'));
            setTimeout(() => {
                window.applyingRecommendations = false;
            }, 100);
        }
    } else {
        console.error('❌ renderMenu or renderPages function not found!');
    }
    
    // Clear pending confirmation
    pendingConfirmation = null;
    
    // Show success message in chat bubble
    const appliedSummary = buildHumanSummary(userNeeds) || 'your latest preferences';
    const successMsg = recommendedItems.length > 0
        ? `All set. I applied ${recommendedItems.length} recommendations based on ${appliedSummary}. Want me to adjust anything?`
        : `All set. I refreshed things based on ${appliedSummary}. Want me to adjust anything?`;
    showChatBubble(successMsg);
    addMessageToChat(successMsg, 'bot');
    
    // Keep robot in recommending state (happy)
    setRobotState('recommending');
    
    // Update button state - keep enabled if user still has needs
    updateApplyButtonState();
    saveConversationState();
}

function refreshRecommendationView() {
    // Always refresh the recommendation category (TOC + page)
    if (window.menuBookApi && typeof window.menuBookApi.refreshRecommendations === 'function') {
        window.menuBookApi.refreshRecommendations(true);
    }

    // If recommendations were previously applied, refresh badges too
    if (window.recommendationsApplied) {
        applyRecommendations();
        return;
    }
}

// Add message to chat
function addMessageToChat(text, type) {
    const messagesContainer = document.getElementById('chatbotMessages');
    if (!messagesContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    messageDiv.innerHTML = `<p>${text}</p>`;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Save to chat history
    chatHistory.push({ text, type, timestamp: new Date() });
    saveConversationState();
}

// Clear chat
function clearChat() {
    const messagesContainer = document.getElementById('chatbotMessages');
    if (messagesContainer) {
        const welcomeMsg = window.t ? window.t('chatbotWelcome') : 'Hello! I\'m here to help you find meals that suit your dietary needs and feelings. Please tell me about any allergies, health conditions, dietary preferences, or how you\'re feeling. For example: "I\'m upset" or "I have diabetes and a peanut allergy" or "I\'m vegetarian and have a sore throat."';
        messagesContainer.innerHTML = `
            <div class="message bot-message">
                <p>${welcomeMsg}</p>
            </div>
        `;
    }
    
    chatHistory = [];
    persistentNeeds = {
        allergies: [],
        restrictions: [],
        healthConditions: [],
        preferences: [],
        emotions: []
    };
    sessionNeeds = {
        allergies: [],
        restrictions: [],
        healthConditions: [],
        preferences: [],
        emotions: []
    };
    syncCombinedNeeds();
    recommendedItems = [];
    window.recommendedItems = [];
    pendingConfirmation = null;
    recommendationsGenerated = false;
    lastRecommendationIds = [];
    pendingToolAction = null;
    clearConversationState();
    // Note: recommendationsApplied flag is NOT reset here - it's only reset by NO button
    // This allows clearChat to be called without removing badges if user wants to keep them
    
    // Re-render menu (badges will only show if recommendationsApplied is true)
    if (typeof renderMenu === 'function') {
        renderMenu();
    }
    
    // Reset robot UI
    setRobotState('idle');
    showChatBubble(null);
    showActionButtons(false);
    
    // Update button state - disable only if no needs provided
    updateApplyButtonState();
}

function saveConversationState() {
    try {
        const state = {
            chatHistory,
            userNeeds,
            persistentNeeds,
            sessionNeeds,
            recommendedItems,
            recommendationsApplied,
            recommendationsGenerated,
            lastRecommendationIds
        };
        localStorage.setItem('chatbotState', JSON.stringify(state));
    } catch (error) {
        console.warn('Failed to save conversation state:', error);
    }
}

function loadConversationState() {
    try {
        const raw = localStorage.getItem('chatbotState');
        if (!raw) return;
        const state = JSON.parse(raw);
        chatHistory = Array.isArray(state.chatHistory) ? state.chatHistory : [];
        persistentNeeds = state.persistentNeeds || persistentNeeds;
        sessionNeeds = state.sessionNeeds || sessionNeeds;
        if (state.userNeeds && (!state.persistentNeeds || !state.sessionNeeds)) {
            sessionNeeds = state.userNeeds;
        }
        syncCombinedNeeds();
        recommendedItems = Array.isArray(state.recommendedItems) ? state.recommendedItems : [];
        window.recommendedItems = recommendedItems;
        recommendationsApplied = !!state.recommendationsApplied;
        window.recommendationsApplied = recommendationsApplied;
        recommendationsGenerated = !!state.recommendationsGenerated;
        lastRecommendationIds = Array.isArray(state.lastRecommendationIds) ? state.lastRecommendationIds : [];
    } catch (error) {
        console.warn('Failed to load conversation state:', error);
    }
}

function clearConversationState() {
    try {
        localStorage.removeItem('chatbotState');
    } catch (error) {
        console.warn('Failed to clear conversation state:', error);
    }
}

// Update context display on homepage
function updateContextDisplay() {
    const dateDisplay = document.getElementById('dateDisplay');
    const timeDisplay = document.getElementById('timeDisplay');
    const weatherDisplay = document.getElementById('weatherDisplay');
    const weatherText = document.getElementById('weatherText');
    
    // Update date
    if (dateDisplay) {
        if (contextData && contextData.date) {
            dateDisplay.textContent = contextData.date;
        } else {
            // Fallback: show current date if contextData not ready
            const now = new Date();
            dateDisplay.textContent = now.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        }
    }
    
    // Update time (refresh every call)
    if (timeDisplay) {
        const now = new Date();
        timeDisplay.textContent = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
    }
    
    // Update weather if available
    if (weatherDisplay && weatherText) {
        if (contextData && contextData.weather && contextData.temperature !== null) {
            const weatherEmoji = getWeatherEmoji(contextData.weather);
            weatherText.textContent = `${weatherEmoji} ${contextData.weather} ${contextData.temperature}°C`;
            weatherDisplay.style.display = 'flex';
        } else {
            weatherDisplay.style.display = 'none';
        }
    }
}

// Get weather emoji based on weather condition
function getWeatherEmoji(weather) {
    const weatherLower = weather.toLowerCase();
    if (weatherLower.includes('rain') || weatherLower.includes('drizzle')) return '🌧️';
    if (weatherLower.includes('snow')) return '❄️';
    if (weatherLower.includes('cloud')) return '☁️';
    if (weatherLower.includes('sun') || weatherLower.includes('clear')) return '☀️';
    if (weatherLower.includes('fog') || weatherLower.includes('mist')) return '🌫️';
    if (weatherLower.includes('thunder') || weatherLower.includes('storm')) return '⛈️';
    return '🌤️';
}

// Export functions for global access
window.recommendationSystem = {
    getRecommendations: () => recommendedItems,
    getUserNeeds: () => userNeeds,
    clearChat: clearChat,
    getContextData: () => contextData
};

