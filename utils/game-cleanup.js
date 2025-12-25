const { dbHelpers } = require('../config/database');
const { log, logWithTimestamp } = require('../utils/formatters');

/**
 * Initialize game cleanup system
 * Runs every hour to clean up abandoned games (24+ hours old)
 */
function initializeGameCleanup() {
    logWithTimestamp('INFO', 'Initializing game session cleanup system...');

    // Run immediately on startup
    cleanupGameSessions();

    // Run every hour
    const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour in ms
    setInterval(() => {
        cleanupGameSessions();
    }, CLEANUP_INTERVAL);

    log('OK', 'Game cleanup system initialized (runs hourly)\n', 4);
}

/**
 * Clean up games that have been active for 24+ hours
 */
function cleanupGameSessions() {
    try {
        const deleted = dbHelpers.cleanupOldGames();

        if (deleted > 0) {
            logWithTimestamp('INFO', `Cleaned up ${deleted} abandoned game session(s).`);
        }
    } catch (error) {
        log('ERROR', 'Game cleanup failed', 2, error);
    }
}

module.exports = {
    initializeGameCleanup,
    cleanupGameSessions
};