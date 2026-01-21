module.exports = {
    defaultModel: 'claude-haiku-4-5-20251001',
    models: {
        haiku: 'claude-haiku-4-5-20251001',
        sonnet: 'claude-sonnet-4-20250514'
    },

    // Token limits
    maxInputTokens: 1000,       // User message + history limit
    maxOutputTokens: 500,       // Response length
    maxHistoryMessages: 10,     // Conversation memory

    // Defaults
    defaultTemperature: 0.7,
    defaultPersona: 'assistant',

    // Personas (preset system prompts)
    personas: {
        assistant: 'You are a helpful assistant.',
        teacher: 'You are a patient teacher who explains concepts clearly.',
        gamer: 'You are an enthusiastic gamer who loves discussing video games.',
        chef: 'You are a professional chef who gives cooking advice.',
        comedian: 'You are a witty comedian who adds humor to conversations.'
    },

    // Rate limiting
    cooldownSeconds: 5,         // Per-user cooldown
    maxRequestsPerHour: 30      // Per-user hourly limit
};