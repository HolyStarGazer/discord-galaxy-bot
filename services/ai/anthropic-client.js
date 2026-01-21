/**
 * Anthropic Claude API Client
 * Handles AI chat functionality with conversation history and rate limiting
 */

const Anthropic = require('@anthropic-ai/sdk').default;
const aiConfig = require('../../config/ai-config');
const { logWithTimestamp } = require('../../utils/formatters');

// Lazy-loaded Anthropic client
let anthropicClient = null;

// Conversation history storage (instance-based, clears on restart)
const conversations = new Map();

// Rate limiting storage
const userRateLimits = new Map();

// Usage statistics
const usageStats = {
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    startTime: Date.now()
};

/**
 * Get or initialize the Anthropic client
 * @returns {Anthropic|null}
 */
function getClient() {
    if (anthropicClient) return anthropicClient;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        logWithTimestamp('WARN', 'ANTHROPIC_API_KEY not set. Chat features disabled.');
        return null;
    }

    try {
        anthropicClient = new Anthropic({ apiKey });
        logWithTimestamp('OK', 'Anthropic client initialized');
        return anthropicClient;
    } catch (error) {
        logWithTimestamp('ERROR', `Failed to initialize Anthropic client: ${error.message}`);
        return null;
    }
}

/**
 * Check if the AI service is available
 * @returns {boolean}
 */
function isAvailable() {
    return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Estimate token count from text
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / aiConfig.tokens.estimateRatio);
}

/**
 * Get conversation key for a user/channel combination
 * @param {string} userId
 * @param {string} channelId
 * @returns {string}
 */
function getConversationKey(userId, channelId) {
    return `${userId}-${channelId}`;
}

/**
 * Get conversation history
 * @param {string} userId
 * @param {string} channelId
 * @returns {Array}
 */
function getHistory(userId, channelId) {
    const key = getConversationKey(userId, channelId);
    return conversations.get(key) || [];
}

/**
 * Clear conversation history
 * @param {string} userId
 * @param {string} channelId
 * @returns {boolean} True if history existed and was cleared
 */
function clearHistory(userId, channelId) {
    const key = getConversationKey(userId, channelId);
    const existed = conversations.has(key);
    conversations.delete(key);
    return existed;
}

/**
 * Clear all conversations for a user
 * @param {string} userId
 * @returns {number} Number of conversations cleared
 */
function clearAllUserHistory(userId) {
    let count = 0;
    for (const key of conversations.keys()) {
        if (key.startsWith(`${userId}-`)) {
            conversations.delete(key);
            count++;
        }
    }
    return count;
}

/**
 * Check rate limit for a user
 * @param {string} userId
 * @returns {{ allowed: boolean, waitTime?: number, reason?: string }}
 */
function checkRateLimit(userId) {
    const now = Date.now();
    let userData = userRateLimits.get(userId);

    if (!userData) {
        userData = {
            lastRequest: 0,
            hourlyRequests: [],
            dailyRequests: []
        };
    }

    // Clean old requests
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    userData.hourlyRequests = userData.hourlyRequests.filter(t => t > oneHourAgo);
    userData.dailyRequests = userData.dailyRequests.filter(t => t > oneDayAgo);

    // Check cooldown
    const timeSinceLastRequest = now - userData.lastRequest;
    if (timeSinceLastRequest < aiConfig.rateLimit.cooldownMs) {
        const waitTime = Math.ceil((aiConfig.rateLimit.cooldownMs - timeSinceLastRequest) / 1000);
        return { allowed: false, waitTime, reason: 'cooldown' };
    }

    // Check hourly limit
    if (userData.hourlyRequests.length >= aiConfig.rateLimit.maxRequestsPerHour) {
        return { allowed: false, reason: 'hourly_limit' };
    }

    // Check daily limit
    if (userData.dailyRequests.length >= aiConfig.rateLimit.maxRequestsPerDay) {
        return { allowed: false, reason: 'daily_limit' };
    }

    return { allowed: true };
}

/**
 * Record a request for rate limiting
 * @param {string} userId
 */
function recordRequest(userId) {
    const now = Date.now();
    let userData = userRateLimits.get(userId) || {
        lastRequest: 0,
        hourlyRequests: [],
        dailyRequests: []
    };

    userData.lastRequest = now;
    userData.hourlyRequests.push(now);
    userData.dailyRequests.push(now);

    userRateLimits.set(userId, userData);
}

/**
 * Send a message to Claude and get a response
 * @param {Object} options
 * @param {string} options.userId - Discord user ID
 * @param {string} options.channelId - Discord channel ID
 * @param {string} options.message - User's message
 * @param {string} [options.persona] - Persona key from config
 * @param {string} [options.model] - Model key (haiku/sonnet)
 * @param {number} [options.temperature] - Temperature (0.0-1.0)
 * @returns {Promise<Object>} Response object
 */
async function chat({ userId, channelId, message, persona, model, temperature }) {
    const client = getClient();
    if (!client) {
        throw new Error('AI service is not available. ANTHROPIC_API_KEY may not be set.');
    }

    // Get configuration
    const selectedModel = aiConfig.models[model] || aiConfig.models[aiConfig.defaultModel];
    const selectedPersona = aiConfig.personas[persona] || aiConfig.personas[aiConfig.defaults.persona];
    const selectedTemperature = typeof temperature === 'number'
        ? Math.max(0, Math.min(1, temperature))
        : aiConfig.defaults.temperature;

    // Get conversation history
    const key = getConversationKey(userId, channelId);
    let history = conversations.get(key) || [];

    // Estimate input tokens
    const historyText = history.map(m => m.content).join(' ');
    const estimatedInput = estimateTokens(message + selectedPersona + historyText);

    if (estimatedInput > aiConfig.tokens.maxInput) {
        // Trim history to fit within limits
        while (history.length > 0 && estimateTokens(message + selectedPersona + history.map(m => m.content).join(' ')) > aiConfig.tokens.maxInput) {
            history.shift(); // Remove oldest messages
        }
    }

    // Add user message to history
    history.push({
        role: 'user',
        content: message
    });

    // Keep only last N messages
    if (history.length > aiConfig.tokens.maxHistoryMessages) {
        history = history.slice(-aiConfig.tokens.maxHistoryMessages);
    }

    try {
        const response = await client.messages.create({
            model: selectedModel,
            max_tokens: aiConfig.tokens.maxOutput,
            temperature: selectedTemperature,
            system: selectedPersona,
            messages: history
        });

        const reply = response.content[0].text;

        // Add assistant response to history
        history.push({
            role: 'assistant',
            content: reply
        });

        // Save updated history
        conversations.set(key, history);

        // Update usage stats
        usageStats.totalRequests++;
        usageStats.totalInputTokens += response.usage.input_tokens;
        usageStats.totalOutputTokens += response.usage.output_tokens;

        // Log usage
        const modelKey = model || aiConfig.defaultModel;
        const cost = calculateCost(modelKey, response.usage.input_tokens, response.usage.output_tokens);
        logWithTimestamp('AI', `${userId} | In: ${response.usage.input_tokens}, Out: ${response.usage.output_tokens}, Cost: $${cost.toFixed(6)}`);

        return {
            success: true,
            reply,
            usage: {
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
                estimatedCost: cost
            },
            model: selectedModel,
            persona: persona || aiConfig.defaults.persona
        };

    } catch (error) {
        logWithTimestamp('ERROR', `AI chat error: ${error.message}`);
        throw error;
    }
}

/**
 * Calculate cost for a request
 * @param {string} modelKey
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {number}
 */
function calculateCost(modelKey, inputTokens, outputTokens) {
    const costs = aiConfig.costs[modelKey] || aiConfig.costs.haiku;
    const inputCost = (inputTokens / 1000) * costs.inputPer1k;
    const outputCost = (outputTokens / 1000) * costs.outputPer1k;
    return inputCost + outputCost;
}

/**
 * Get usage statistics
 * @returns {Object}
 */
function getUsageStats() {
    return {
        ...usageStats,
        activeConversations: conversations.size,
        uptimeMs: Date.now() - usageStats.startTime
    };
}

/**
 * Get available personas
 * @returns {Array<{name: string, value: string}>}
 */
function getPersonaChoices() {
    return Object.keys(aiConfig.personas).map(key => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value: key
    }));
}

/**
 * Get available models
 * @returns {Array<{name: string, value: string}>}
 */
function getModelChoices() {
    return Object.keys(aiConfig.models).map(key => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value: key
    }));
}

module.exports = {
    isAvailable,
    estimateTokens,
    getHistory,
    clearHistory,
    clearAllUserHistory,
    checkRateLimit,
    recordRequest,
    chat,
    getUsageStats,
    getPersonaChoices,
    getModelChoices,
    aiConfig
};
