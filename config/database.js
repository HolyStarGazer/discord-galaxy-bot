const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const SILENT = process.env.DB_SILENT === 'true';

const LOG_COLORS = {
    INFO: '\x1b[34m',   // Blue
    NOTE: '\x1b[34m',   // Blue
    WARN: '\x1b[33m',   // Yellow
    ADMIN: '\x1b[33m',  // Yellow
    ERROR: '\x1b[31m',  // Red
    FAILED: '\x1b[31m', // Red
    OK: '\x1b[32m',     // Green
    LOADED: '\x1b[32m',  // Green
    SUCCESS: '\x1b[32m', // Green
    CMD: '\x1b[35m'     // Magenta
}

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    dbLog('OK', 'Created data directory');
}

// Create or open the database
const dbPath = path.join(__dirname, '..', 'data', 'bot.db');
const dbExists = fs.existsSync(dbPath);
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for better concurrency
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Get current database version
function getDatabaseVersion() {
    try {
        const result = db.prepare('PRAGMA user_version').get();
        return result.user_version;
    } catch (error) {
        return 0;
    }
}

// Set database version
function setDatabaseVersion(version) {
    db.pragma(`user_version = ${version}`);
}

// Initialize tables
function initDatabase() {
    dbLog('INFO', 'Initializing database...', 2);
    const currentVersion = getDatabaseVersion();

    if (!dbExists) {
        dbLog('INFO', 'Creating new database...', 4);
    } else {
        dbLog('INFO', 'Opening existing database...', 4);
    }

    // User table - stores XP and level data
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            total_messages INTEGER DEFAULT 0,
            last_xp_gain INTEGER DEFAULT 0,
            last_daily_claim INTEGER DEFAULT 0,
            points INTEGER DEFAULT 1000 NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `);
    
    // Game sessions table - for tracking active games
    db.exec(`
        CREATE TABLE IF NOT EXISTS game_sessions (
            session_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            game_type TEXT NOT NULL,
            game_state TEXT NOT NULL,
            bet_amount INTEGER NOT NULL,
            status TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            completed_at INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
    `);

    // Run migrations if needed
    runMigrations(currentVersion);

    // Leaderboard view for easy querying
    db.exec(`
        CREATE VIEW IF NOT EXISTS leaderboard AS
        SELECT
            user_id,
            username,
            xp,
            level,
            total_messages,
            points,
            RANK() OVER (ORDER BY xp DESC) AS rank
        FROM users
        ORDER BY xp DESC    
    `);

    // Create indexes
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_active_games
        ON game_sessions(user_id, status)
        WHERE status = 'active'    
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_game_created_at
        ON game_sessions(created_at)
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_xp
        ON users(xp DESC)
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_points
        ON users(points DESC)
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_level
        ON users(level DESC)
    `);

    // Create View for active games
    db.exec(`
        CREATE VIEW IF NOT EXISTS active_blackjack_games AS
        SELECT
            session_id,
            user_id,
            game_state,
            bet_amount,
            created_at,
            updated_at,
            CAST((julianday('now') - julianday(datetime(created_at, 'unixepoch'))) * 24 AS INTEGER) AS hours_active
        FROM game_sessions
        WHERE game_type = 'blackjack'
        AND status = 'active'
    `);

    dbLog('OK', 'Database initialized successfully', 4);
}

// Run database migrations
function runMigrations(currentVersion) {
    const migrations = [
        {
            version: 1,
            description: 'Add last_daily_claim column',
            run: () => {
                // Check if column exists
                const columns = db.prepare("PRAGMA table_info(users)").all();
                const hasColumn = columns.some(col => col.name === 'last_daily_claim');

                if (!hasColumn) {
                    dbLog('INFO', 'Adding last_daily_claim column...');
                    db.exec('ALTER TABLE users ADD COLUMN last_daily_claim INTEGER DEFAULT 0');
                }
            }
        },
        {
            version: 2,
            description: 'Add points column to users table and update game_sessions table',
            run: () => {
                // Add points column to users table 
                const columns = db.prepare("PRAGMA table_info(users)").all();
                const hasColumn = columns.some(col => col.name === 'points');

                if (!hasColumn) {
                    dbLog('INFO', 'Adding points column...', 4);
                    db.exec('ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 1000 NOT NULL');
                }

                // Check if game_sessions needs updating
                const gsColumns = db.prepare("PRAGMA table_info(game_sessions)").all();
                const hasCompletedAt = gsColumns.some(col => col.name === 'completed_at');

                if (!hasCompletedAt) {
                    dbLog('INFO', 'Updating game_sessions table...', 4);
                    // Drop and recreate with correct schema
                    db.exec('DROP TABLE IF EXISTS game_sessions');
                    db.exec(`
                        CREATE TABLE game_sessions (
                            session_id TEXT PRIMARY KEY,
                            user_id TEXT NOT NULL,
                            game_type TEXT NOT NULL,
                            game_state TEXT NOT NULL,
                            bet_amount INTEGER NOT NULL,
                            status TEXT NOT NULL,
                            created_at INTEGER NOT NULL,
                            updated_at INTEGER NOT NULL,
                            completed_at INTEGER,
                            FOREIGN KEY (user_id) REFERENCES users(user_id)
                        )
                    `);
                }

                // Recreate indexes
                db.exec(`CREATE INDEX IF NOT EXISTS idx_active_games ON game_sessions(user_id, status) WHERE status = 'active'`);
                db.exec('CREATE INDEX IF NOT EXISTS idx_game_created_at ON game_sessions(created_at)');

                // Recreate view
                db.exec(`
                    CREATE VIEW IF NOT EXISTS active_blackjack_games AS
                    SELECT
                        session_id,
                        user_id,
                        game_state,
                        bet_amount,
                        created_at,
                        updated_at,
                        CAST((julianday('now') - julianday(datetime(created_at, 'unixepoch'))) * 24 AS INTEGER) AS hours_active
                    FROM game_sessions
                    WHERE game_type = 'blackjack'
                    AND status = 'active'
                `);
            }
        },
        // Add future migrations here
    ];

    // Run migrations that haven't been applied yet
    migrations.forEach(migration => {
        if (currentVersion < migration.version) {
            dbLog('INFO', `Running migration ${migration.version}: ${migration.description}`);
            try {
                migration.run();
                setDatabaseVersion(migration.version);
                dbLog('OK', `Migration ${migration.version} applied successfully`, 4);
            } catch (error) {
                dbLog('ERROR', `Migration ${migration.version} failed`, 4, error);
            }
        }
    });
}

// Initialize database on import
initDatabase();

// Prepared statements for common operations
const statements = {
    // User operations
    getUser: db.prepare('SELECT * FROM users WHERE user_id = ?'),

    createUser: db.prepare(`
        INSERT INTO users (user_id, username, xp, level)
        VALUES (?, ?, 0, 1)
    `),

    updateUserXP: db.prepare(`
        UPDATE users
        SET xp = ?, level = ?, total_messages = total_messages + 1, last_xp_gain = ?
        WHERE user_id = ?
    `),

    updateDailyClaim: db.prepare(`
        UPDATE users
        SET xp = ?, level = ?, last_daily_claim = ?
        WHERE user_id = ?
    `),

    getLeaderboard: db.prepare(`
        SELECT * FROM leaderboard
        LIMIT ?
    `),

    getUserRank: db.prepare(`
        SELECT rank FROM leaderboard
        WHERE user_id = ?
    `),

    // Points operations
    getPoints: db.prepare('SELECT points FROM users WHERE user_id = ?'),

    updatePoints: db.prepare('UPDATE users SET points = ? WHERE user_id = ?'),

    addPoints: db.prepare('UPDATE users SET points = points + ? WHERE user_id = ?'),

    subtractPoints: db.prepare('UPDATE users SET points = points - ? WHERE user_id = ?'),

    // Game session operations
    createGameSession: db.prepare(`
        INSERT INTO game_sessions
        (session_id, user_id, game_type, game_state, bet_amount, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `),

    getActiveGame: db.prepare(`
        SELECT * FROM game_sessions
        WHERE user_id = ? AND game_type = ? AND status = 'active'
    `),

    updateGameSession: db.prepare(`
        UPDATE game_sessions
        SET game_state = ?, updated_at = ?
        WHERE session_id = ?
    `),

    endGameSession: db.prepare(`
        UPDATE game_sessions
        SET status = ?, completed_at = ?, updated_at = ?
        WHERE session_id = ?
    `),

    getGameSession: db.prepare(`
        SELECT * FROM game_sessions
        WHERE session_id = ?
    `),

    deleteOldGames: db.prepare(`
        DELETE FROM game_sessions
        WHERE status = 'active' AND created_at < ?
    `),

    getOldActiveSessions: db.prepare(`
        SELECT session_id, user_id, hours_active
        FROM active_blackjack_games
        WHERE hours_active >= 24
    `),
};

/**
 * Sanitize string input to prevent injection
 */
function sanitizeString(input, maxLength = 100) {
    if (typeof input !== 'string') {
        throw new Error('Input must be a string');
    }

    // Remove null bytes and control characters
    const cleaned = input
        .replace(/\0/g, '')
        .replace(/[\x00-\x1F\x7F]/g, '')
        .trim();

    return cleaned.slice(0, maxLength);
}

/**
 * Sanitize numeric input
 */
function sanitizeNumber(input, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const num = parseInt(input, 10);

    if (isNaN(num)) {
        throw new Error('Input must be a number');
    }

    return Math.max(min, Math.min(max, num));
}

function sanitizeUserId(userId) {
    // Discord IDs are numeric strings, 17-19 chars
    if (typeof userId !== 'string' || !/^\d{17,19}$/.test(userId)) {
        throw new Error('Invalid user ID format');
    }
    return userId;
}

function sanitizeUsername(username) {
    if (!username || typeof username !== 'string') {
        throw new Error('Invalid username');
    }

    // Discord usernames: 2-32 chars, alphanumeric and some special chars
    const cleaned = sanitizeString(username, 32);

    if (cleaned.length < 2) {
        throw new Error('Username too short');
    }

    return cleaned;
}

// Add a simple cache for frequently accessed data
const userCache = new Map();
const CACHE_TTL = 60 * 1000; // 1 minute cache

/**
 * Get user wich caching
 */
function getCachedUser(userId) {
    const cached = userCache.get(userId);

    if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
    }

    const user = statements.getUser.get(userId);

    if (user) {
        userCache.set(userId, {
            data: user,
            expiresAt: Date.now() + CACHE_TTL
        });
    }

    return user;
}

/**
 * Invalidate user cache (call after updates)
 */
function invalidateUserCache(userId) {
    userCache.delete(userId);
}

/**
 * Clear entire cache
 */
function clearUserCache() {
    userCache.clear();
}

// Clean expired cache entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of userCache.entries()) {
        if (now > value.expiresAt) {
            userCache.delete(key);
        }
    }
}, 5 * 60 * 1000);

// Help functions
const dbHelpers = {
    /**
     * Get or create a user
     */
    getOrCreateUser(userId, username) {
        userId = sanitizeUserId(userId);
        username = sanitizeUsername(username);

        let user = statements.getUser.get(userId);

        if (!user) {
            statements.createUser.run(userId, username);
            user = statements.getUser.get(userId);
        }

        return user;
    },

    /**
     * Add XP to a user and handle level ups
     */
    addXP(userId, username, xpAmount) {
        // Use transaction to ensure atomic update
        const transaction = db.transaction(() => {
            const user = this.getOrCreateUser(userId, username);
            const newXP = user.xp + xpAmount;
            const newLevel = this.calculateLevel(newXP);
            const currentTime = Math.floor(Date.now() / 1000);

            statements.updateUserXP.run(newXP, newLevel, currentTime, userId);

            // Return level up info
            return {
                leveledUp: newLevel > user.level,
                oldLevel: user.level,
                newLevel: newLevel,
                newXP: newXP
            };
        });

        return transaction();
    },

    /**
     * Get user's points balance
     */
    getPoints(userId) {
        const result = statements.getPoints.get(userId);
        return result ? result.points : 0;
    },

    /**
     * Set user's points
     */
    setPoints(userId, points) {
        statements.updatePoints.run(points, userId);
    },

    /**
     * Add points to user
     */
    addPoints(userId, points) {
        statements.addPoints.run(points, userId);
    },

    /**
     * Subtract points from user
     */
    subtractPoints(userId, points) {
        statements.subtractPoints.run(points, userId);
    },

    /**
     * Create a new game session
     */
    createGameSession(userId, gameType, gameState, betAmount) {
        const sessionId = `${gameType}_${userId}_${Date.now()}`;
        const now = Date.now();
        const gameStateJson = JSON.stringify(gameState);

        statements.createGameSession.run(
            sessionId,
            userId,
            gameType,
            gameStateJson,
            betAmount,
            now,
            now
        );

        return sessionId;
    },

    /**
     * Get active game for user
     */
    getActiveGame(userId, gameType) {
        const game = statements.getActiveGame.get(userId, gameType);
        if (game) {
            game.game_state = JSON.parse(game.game_state);
        }
        return game;
    },

    /**
     * Update game state
     */
    updateGameState(sessionId, gameState) {
        const gameStateJson = JSON.stringify(gameState);
        const now = Date.now();
        statements.updateGameSession.run(gameStateJson, now, sessionId);
    },

    /**
     * End game session
     */
    endGameSession(sessionId, status) {
        const now = Date.now();
        statements.endGameSession.run(status, now, now, sessionId);
    },

    /**
     * Get game session by ID
     */
    getGameSession(sessionId) {
        const game = statements.getGameSession.get(sessionId);
        if (game) {
            game.game_state = JSON.parse(game.game_state);
        }
        return game;
    },

    /**
     * Clean up old game sessions (24+ hours)
     */
    cleanupOldGames() {
        const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
        const oldGames = statements.getOldActiveSessions.all();

        if (oldGames.length > 0) {
            const deleted = statements.deleteOldGames.run(twentyFourHoursAgo);
            dbLog('INFO', `Cleaned up ${deleted.changes} abandoned game session(s)`);
            return deleted.changes;
        }

        return 0;
    },

    /**
     * Calculate level based on XP (you can adjust this formula)
     */
    calculateLevel(xp) {
        // Formula: level = floor(sqrt(xp / 100)) + 1
        // This means: Level 1 = 0-99 XP, Level 2 = 100-399 XP, Level 3 = 400-899 XP, etc.
        return Math.floor(Math.sqrt(xp / 100)) + 1;
    },

    /**
     * Calculate XP needed for next level
     */
    xpForNextLevel(currentLevel) {
        return Math.pow(currentLevel, 2) * 100;
    },

    /**
     * Get top N users from leaderboard
     */
    getLeaderboard(limit = 10) {
        return statements.getLeaderboard.all(limit);
    },

    /**
     * Get user's rank
     */
    getUserRank(userId) {
        const result = statements.getUserRank.get(userId);
        return result ? result.rank : null;
    },

    /**
     * Claim daily reward
     */
    claimDaily(userId, username, xpAmount, pointsAmount) {
        // Use transaction to ensure atomic update
        const transaction = db.transaction(() => {
            const user = this.getOrCreateUser(userId, username);
            const newPoints = user.points + pointsAmount;
            const newXP = user.xp + xpAmount;
            const newLevel = this.calculateLevel(newXP);
            const currentTime = Math.floor(Date.now() / 1000);

            statements.updateDailyClaim.run(newXP, newLevel, currentTime, userId);
            statements.addPoints.run(pointsAmount, userId);

            // Return level up info
            return {
                leveledUp: newLevel > user.level,
                oldLevel: user.level,
                newLevel: newLevel,
                newXP: newXP,
                newPoints: newPoints
            };
        });

        return transaction();
    },

    /**
     * Health check - verify database is working
     */
    healthCheck() {
        try {
            // Test basic query
            const test = db.prepare('SELECT 1 as test').get();

            // Check tables exist
            const tables = db.prepare(`
                SELECT name FROM sqlite_master
                WHERE type='table' AND name IN ('users', 'game_sessions')
            `).all();

            return {
                connected: test && test.test === 1,
                tables: tables.map(t => t.name),
                healthy: tables.length === 2
            }
        } catch (error) {
            return {
                connected: false,
                tables: [],
                healthy: false,
                error: error.message
            }
        } 
    }
};



/**
 * Enable silent mode (no console output)
 * @param {boolean} silent - Whether to enable silent mode
 */
function setSilentMode(silent) {
    silentMode = silent;
}

/**
 * Database log message with level
 * @param {string} level - Log level (INFO, WARN, ERROR, OK)
 * @param {string} message - Log message
 * @param {number} indent - Number of spaces to indent (default: 2)
 * @param {Error} [error] - Optional error object
 * @example dbLog('INFO', 'Bot started successfully'); ->     [INFO] Bot started successfully
 */
function dbLog(level, message, indent = 2, error = null) {
    if (SILENT) return;

    const color = LOG_COLORS[level] || '';
    const prefix = ' '.repeat(indent);

    // Choose the appropriate console method based on log level and presence of error
    const logger = (level === 'ERROR' || level === 'WARN') ? console.error : console.log;
    logger(`${prefix}${color}[${level}]\x1b[0m ${message}`);

    if (error !== null) {
        console.error(`${' '.repeat(indent+2)}Error type: ${error.name}`);
        if (process.env.NODE_ENV === 'development') {
            console.error(error.stack); // Full stack trace only in dev
        } else {
            console.error(`${' '.repeat(indent+2)}Error message: ${error.message}`); // Minimal in production
        }
    }
}

module.exports = {
    db,
    statements,
    dbHelpers,
    sanitizeString,
    sanitizeNumber,
    sanitizeUserId,
    sanitizeUsername
};
