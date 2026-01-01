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
    }
};

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
let recommendedItems = [];
window.recommendedItems = recommendedItems;
let pendingConfirmation = null; // Track if we're waiting for confirmation
let recommendationsGenerated = false; // Track if recommendations have been generated

    // Voice recognition setup
let recognition = null;
let isListening = false;

// Initialize voice recognition
function initVoiceRecognition() {
    // Check if browser supports Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        console.warn('Speech Recognition not supported in this browser');
        const voiceBtn = document.getElementById('voiceInputBtn');
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
        const voiceBtn = document.getElementById('voiceInputBtn');
        const voiceStatus = document.getElementById('voiceStatus');
        const voiceStatusText = document.getElementById('voiceStatusText');
        
        if (voiceBtn) {
            voiceBtn.classList.add('listening');
            voiceBtn.disabled = false;
        }
        if (voiceStatus) {
            voiceStatus.style.display = 'flex';
        }
        if (voiceStatusText) {
            voiceStatusText.textContent = 'Listening...';
        }
    };
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const chatbotInput = document.getElementById('chatbotInput');
        
        if (chatbotInput) {
            chatbotInput.value = transcript;
            // Auto-send the message
            sendMessage();
        }
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        const voiceStatusText = document.getElementById('voiceStatusText');
        
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
    const voiceBtn = document.getElementById('voiceInputBtn');
    const voiceStatus = document.getElementById('voiceStatus');
    
    if (voiceBtn) {
        voiceBtn.classList.remove('listening');
    }
    if (voiceStatus) {
        voiceStatus.style.display = 'none';
    }
}

// Initialize chatbot
document.addEventListener('DOMContentLoaded', async () => {
    // Display date/time immediately (don't wait for async operations)
    updateContextDisplay();
    
    setupChatbot();
    initVoiceRecognition(); // Initialize voice recognition
    
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

// Setup chatbot event listeners
function setupChatbot() {
    const specialNeedsBtn = document.getElementById('specialNeedsBtn');
    const chatbotModal = document.getElementById('chatbotModal');
    const closeChatbot = document.getElementById('closeChatbot');
    const sendBtn = document.getElementById('sendMessageBtn');
    const chatbotInput = document.getElementById('chatbotInput');
    const applyBtn = document.getElementById('applyRecommendationsBtn');
    const clearBtn = document.getElementById('clearChatBtn');

    if (specialNeedsBtn) {
        specialNeedsBtn.addEventListener('click', () => {
            chatbotModal.style.display = 'block';
        });
    }

    if (closeChatbot) {
        closeChatbot.addEventListener('click', () => {
            chatbotModal.style.display = 'none';
        });
    }

    if (chatbotModal) {
        chatbotModal.addEventListener('click', (e) => {
            if (e.target.id === 'chatbotModal') {
                chatbotModal.style.display = 'none';
            }
        });
    }

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

    if (clearBtn) {
        clearBtn.addEventListener('click', clearChat);
    }
    
    // Voice input button
    const voiceBtn = document.getElementById('voiceInputBtn');
    if (voiceBtn) {
        voiceBtn.addEventListener('click', startListening);
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

// Send message to chatbot
async function sendMessage() {
    const input = document.getElementById('chatbotInput');
    const message = input.value.trim();
    
    if (!message) return;

    // Add user message to chat
    addMessageToChat(message, 'user');
    input.value = '';

    // Disable input while processing
    const sendBtn = document.getElementById('sendMessageBtn');
    const chatbotInput = document.getElementById('chatbotInput');
    sendBtn.disabled = true;
    chatbotInput.disabled = true;

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
            return;
        }
        
        // Extract structured data from AI response
        const extractedData = extractFromAIResponse(response);
        
        // Update user needs from AI extraction
        let aiProvidedDirectRecommendations = false;
        if (extractedData) {
            aiProvidedDirectRecommendations = updateUserNeedsFromAI(extractedData);
            
            // Check if AI says direct activation (confirm:yes) or needs confirmation (confirm:no)
            if (extractedData.confirm === 'yes') {
                // Specific condition - direct activation, no confirmation needed
                pendingConfirmation = null;
            } else {
                // Uncertain condition - needs confirmation
                const displayResponse = response.replace(/\[EXTRACT:.*?\]/g, '').trim();
                const responseLower = displayResponse.toLowerCase();
                if (responseLower.includes('okay') || responseLower.includes('ok?') || responseLower.includes('would that be') || responseLower.includes('is that ok')) {
                    pendingConfirmation = true;
                }
            }
        }
        
        // Remove extraction marker from displayed response
        const displayResponse = response.replace(/\[EXTRACT:.*?\]/g, '').trim();
        addMessageToChat(displayResponse, 'bot');
        
        // If AI provided direct recommendations, use them; otherwise filter based on needs
        if (aiProvidedDirectRecommendations) {
            // AI already provided recommendations, just update display
            if (typeof renderMenu === 'function') {
                renderMenu();
            }
        } else {
            // AI provided needs but not direct recommendations, filter menu
            generateRecommendations();
        }
        
        // Always enable button if user has provided needs
        updateApplyButtonState();
    } catch (error) {
        console.error('Error processing message:', error);
        console.error('Error details:', error.stack);
        addMessageToChat('Sorry, I encountered an error. Please try again.', 'bot');
    } finally {
        sendBtn.disabled = false;
        chatbotInput.disabled = false;
        chatbotInput.focus();
    }
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

// Get AI response from Qwen3 API (Alibaba Cloud DashScope)
async function getQwenResponse(userMessage) {
    if (!AI_CONFIG.qwen.apiKey) {
        throw new Error('Qwen API key not configured');
    }

    // Get menu items for AI context (check both local and window scope)
    const items = typeof menuItems !== 'undefined' ? menuItems : (window.menuItems || []);
    const menuContext = items.length > 0 ? items.map(item => 
        `ID:${item.id} "${item.name}" (${item.category}) - Tags:${item.tags?.join(',') || 'none'} Allergens:${item.allergens?.join(',') || 'none'} Restrictions:${item.restrictions?.join(',') || 'none'}`
    ).join('\n') : 'Menu is loading from database. Please wait a moment.';
    
    // Build context information string
    let contextInfo = `CURRENT CONTEXT:
- Date: ${contextData.date} (${contextData.dayOfWeek})
- Time: ${contextData.time}
- Season: ${contextData.season}
- Month: ${contextData.month}`;
    
    if (contextData.isSpecialDate) {
        contextInfo += `\n- Special Date: ${contextData.specialDateName} (consider special menu items)`;
    }
    
    if (contextData.weather && contextData.temperature !== null) {
        contextInfo += `\n- Weather: ${contextData.weather}, ${contextData.temperature}°C`;
    }

    // Specialized system prompt - AI handles EVERYTHING
    const systemPrompt = `You are a caring and empathetic dietary assistant for a restaurant ordering system. You understand customers' emotions, feelings, dietary needs, allergies, and health conditions to provide personalized meal recommendations.

YOUR TASKS:
1. Understand customer emotions, feelings, and mood (upset, sad, stressed, happy, tired, anxious, sick, etc.)
2. Understand dietary restrictions, allergies, and health conditions
3. Consider current context: weather, season, time of day, special dates
4. Provide empathetic, warm, and understanding responses
5. Give ABSTRACT descriptions (e.g., "warm comfort foods", "soft foods", "energizing meals") - DO NOT list specific dish names
6. Smart confirmation logic:
   - If condition is VERY SPECIFIC and CLEAR (e.g., "I'm vegetarian", "I have peanut allergy") → Thank them and directly activate recommendations (no confirmation needed)
   - If condition is UNCERTAIN or needs interpretation (e.g., "I'm upset", "I feel tired") → Consider weather, time, and special dates, then ask: "I think you might like [abstract description based on context]. Would that be okay?"
7. After your response, ALWAYS include structured data in this EXACT format:
   [EXTRACT: emotions:emotion1,emotion2|allergies:allergy1,allergy2|restrictions:restriction1,restriction2|preferences:preference1,preference2|conditions:condition1,condition2|recommendations:itemId1,itemId2,itemId3|confirm:yes/no]
   
   - confirm:yes = Direct activation (specific condition, no confirmation needed)
   - confirm:no = Needs confirmation (uncertain condition)
   
   Example 1 (specific): [EXTRACT: preferences:vegetarian|recommendations:1,2,4,8,10|confirm:yes]
   Example 2 (uncertain): [EXTRACT: emotions:upset|recommendations:4,7,10|confirm:no]

${contextInfo}

CURRENT MENU:
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
    // Look for [EXTRACT: ...] pattern
    const extractMatch = aiResponse.match(/\[EXTRACT:(.*?)\]/);
    if (!extractMatch) {
        return null;
    }
    
    const extractData = extractMatch[1];
    const result = {
        emotions: [],
        allergies: [],
        restrictions: [],
        preferences: [],
        conditions: [],
        recommendations: [], // AI-recommended item IDs
        confirm: 'no' // Default to needing confirmation
    };
    
    // Parse format: emotions:emotion1,emotion2|allergies:allergy1|recommendations:id1,id2|confirm:yes/no|...
    const parts = extractData.split('|');
    for (const part of parts) {
        const [key, values] = part.split(':');
        if (values) {
            const items = values.split(',').map(v => v.trim()).filter(v => v);
            switch(key.trim()) {
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
                case 'recommendations':
                    result.recommendations = items.map(id => parseInt(id)).filter(id => !isNaN(id));
                    break;
                case 'confirm':
                    result.confirm = items[0] || 'no'; // yes or no
                    break;
            }
        }
    }
    
    return result;
}

// Update user needs from AI extraction - AI is the source of truth
function updateUserNeedsFromAI(extractedData) {
    // AI determines everything - use AI's extraction as the source of truth
    if (extractedData.emotions) {
        userNeeds.emotions = [...new Set(extractedData.emotions)];
    }
    if (extractedData.allergies) {
        userNeeds.allergies = [...new Set(extractedData.allergies)];
    }
    if (extractedData.restrictions) {
        userNeeds.restrictions = [...new Set(extractedData.restrictions)];
    }
    if (extractedData.preferences) {
        userNeeds.preferences = [...new Set(extractedData.preferences)];
    }
    if (extractedData.conditions) {
        userNeeds.healthConditions = [...new Set(extractedData.conditions)];
    }
    
    // If AI provided direct recommendations, use those (AI does all the filtering)
    if (extractedData.recommendations && extractedData.recommendations.length > 0) {
        recommendedItems = extractedData.recommendations;
        window.recommendedItems = recommendedItems;
        console.log('AI direct recommendations:', recommendedItems);
        console.log('AI confirmation needed:', extractedData.confirm);
        return true; // Indicate AI provided direct recommendations
    }
    
    console.log('Updated user needs from AI:', userNeeds);
    return false; // Need to filter based on extracted needs
}

// Check for confirmation responses (simple check)
function extractUserNeeds(message) {
    const msg = message.toLowerCase();
    
    // Check for confirmation responses
    if (msg.includes('ok') || msg.includes('okay') || msg.includes('yes') || msg.includes('sure') || msg.includes('sounds good') || msg.includes('that works') || msg.includes('fine') || msg.includes('that\'s fine') || msg.includes('give me') || msg.includes('i want') || msg.includes('i\'ll take') || msg.includes('i take') || msg.includes('that\'s good') || msg.includes('sounds great') || msg.includes('go ahead') || msg.includes('please') || msg.includes('do it') || msg.includes('apply') || msg.includes('use that')) {
        if (pendingConfirmation) {
            // User confirmed, automatically enable apply button (no need to confirm twice)
            pendingConfirmation = null;
            const applyBtn = document.getElementById('applyRecommendationsBtn');
            if (applyBtn && recommendedItems.length > 0) {
                applyBtn.disabled = false;
                // Automatically apply recommendations when user confirms (don't make them click button)
                applyRecommendations();
            }
            return true; // Indicate confirmation was processed
        }
    }
    
    if (msg.includes('no') || msg.includes('not') || msg.includes('dont') || msg.includes("don't") || msg.includes('cancel') || msg.includes('skip')) {
        if (pendingConfirmation) {
            // User declined
            addMessageToChat('No problem! Let me know what else I can help you with.', 'bot');
            pendingConfirmation = null;
            return true; // Indicate confirmation was processed
        }
    }
    
    return false; // No confirmation processed
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
    const applyBtn = document.getElementById('applyRecommendationsBtn');
    if (!applyBtn) return;
    
    const hasNeeds = hasUserNeeds();
    
    // Always enable button if user has provided needs and has recommendations
    // Disable only if user hasn't provided any needs
    if (hasNeeds && recommendedItems.length > 0) {
        applyBtn.disabled = false;
    } else if (!hasNeeds) {
        // Disable only if user hasn't provided any needs
        applyBtn.disabled = true;
    } else {
        // Has needs but no recommendations yet - keep disabled
        applyBtn.disabled = true;
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
    
    // Debug logging
    console.log('User needs:', JSON.stringify(userNeeds, null, 2));
    console.log('Recommended items:', recommendedItems);
    console.log('Suitable items:', suitableItems.map(i => i.name));
    
    // Update menu display dynamically when recommendations change
    if (typeof renderMenu === 'function') {
        renderMenu();
    }
    
    // Always enable button if user has provided needs and has recommendations
    updateApplyButtonState();
}

// Apply recommendations to menu
function applyRecommendations() {
    // Re-render menu to show recommendations
    if (typeof renderMenu === 'function') {
        renderMenu();
    }
    
    // Clear pending confirmation
    pendingConfirmation = null;
    
    // Show success message in chat
    if (recommendedItems.length > 0) {
        addMessageToChat(`Great! I've applied ${recommendedItems.length} recommendations to your menu. Look for items marked with "✓ Recommended for you".`, 'bot');
    }
    
    // Update button state - keep enabled if user still has needs
    updateApplyButtonState();
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
    userNeeds = {
        allergies: [],
        restrictions: [],
        healthConditions: [],
        preferences: [],
        emotions: [] // Reset emotions too
    };
    recommendedItems = [];
    window.recommendedItems = [];
    pendingConfirmation = null;
    recommendationsGenerated = false;
    
    // Re-render menu to remove recommendations
    if (typeof renderMenu === 'function') {
        renderMenu();
    }
    
    // Update button state - disable only if no needs provided
    updateApplyButtonState();
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

