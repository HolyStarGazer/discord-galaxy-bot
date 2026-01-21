/**
 * AI Chat Configuration
 * Global settings for Anthropic Claude integration
 */

module.exports = {
    // Available models
    models: {
        haiku: 'claude-haiku-4-5-20251001',
        sonnet: 'claude-sonnet-4-20250514'
    },

    // Default model (use haiku for cost efficiency)
    defaultModel: 'haiku',

    // Token limits
    tokens: {
        maxInput: 1000,         // Max tokens for user message + history
        maxOutput: 500,         // Max tokens for response
        maxHistoryMessages: 10, // Number of messages to keep in history
        estimateRatio: 4        // Characters per token (rough estimate)
    },

    // Default generation settings
    defaults: {
        temperature: 0.7,       // 0.0 = deterministic, 1.0 = creative
        persona: 'assistant'
    },

    // Preset personas (system prompts)
    // Keep these concise to minimize token cost
    personas: {
        assistant: 'You are a helpful assistant. Be concise and informative.',
        teacher: 'You are a patient teacher. Explain concepts clearly with examples.',
        gamer: 'You are an enthusiastic gamer. Discuss video games with passion and knowledge.',
        chef: 'You are a professional chef. Give practical cooking advice and recipes.',
        comedian: 'You are a witty comedian. Add appropriate humor to your responses.',
        coder: 'You are a senior software developer. Help with code and explain technical concepts.',
        scientist: 'You are a scientist. Explain things accurately with scientific reasoning.',
        storyteller: 'You are a creative storyteller. Craft engaging narratives and descriptions.',
        fitness: 'You are a fitness coach. Give exercise and health advice.',
        philosopher: 'You are a thoughtful philosopher. Explore ideas deeply and ask probing questions.'
    },

    // Rate limiting (per user)
    rateLimit: {
        cooldownMs: 5000,           // Milliseconds between requests
        maxRequestsPerHour: 30,     // Max requests per user per hour
        maxRequestsPerDay: 100      // Max requests per user per day
    },

    // Cost tracking (approximate, for logging)
    costs: {
        haiku: {
            inputPer1k: 0.001,      // $0.001 per 1K input tokens
            outputPer1k: 0.005      // $0.005 per 1K output tokens
        },
        sonnet: {
            inputPer1k: 0.003,      // $0.003 per 1K input tokens
            outputPer1k: 0.015      // $0.015 per 1K output tokens
        }
    }
};
