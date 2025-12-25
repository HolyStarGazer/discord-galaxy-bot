const rateLimits = new Map();

const LIMITS = {
    default: { max: 5, window: 10000 },     // 5 commands per 10 seconds
    blackjack: { max: 3, window: 30000 },   // 3 commands per 30 seconds
    daily: { max: 1, window: 5000 },        // 1 command per 5 seconds (spam prevention)
    addpoints: { max: 10, window: 60000 },  // Admin: 10 per minute
    setpoints: { max: 10, window: 60000 },  // Admin: 10 per minute
};

/**
 * Check if user is rate limited
 * @param {string} userId - Discord user ID
 * @param {string} command - Command name
 * @returns {{ limited: boolean, remaining: number, resetIn: number }}
 */
function checkRateLimit(userId, command) {
    const limit = LIMITS[command] || LIMITS.default;
    const key = `${userId}:${command}`;
    const now = Date.now();

    let userData = rateLimits.get(key);

    if (!userData || now > userData.resetAt) {
        userData = {
            count: 0,
            resetAt: now + limit.window,
        };
    }

    userData.count++;
    rateLimits.set(key, userData);

    const remaining = Math.max(0, limit.max - userData.count);
    const resetIn = Math.max(0, userData.resetAt - now);

    return {
        limited: userData.count > limit.max,
        remaining,
        resetIn
    };
}

/**
 * Clean up expired rate limit entries (call periodically)
 */
function cleanupRateLimits() {
    const now = Date.now();

    for (const [key, data] of rateLimits.entries()) {
        if (now > data.resetAt) {
            rateLimits.delete(key);
        }
    }
}

// Clean up every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

module.exports = { checkRateLimit, cleanupRateLimits };