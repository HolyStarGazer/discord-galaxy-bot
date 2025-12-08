const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('✅ Created data directory');
}

// Create or open the database
const dbPath = path.join(__dirname, '..', 'data', 'bot.db');
const dbExists = fs.existsSync(dbPath);
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

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
    const currentVersion = getDatabaseVersion();

    if (!dbExists) {
        console.log('📦 Creating new database...');
    } else {
        console.log('📦 Opening existing database...');
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
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `);
    
    // Game sessions table - for tracking active games
    db.exec(`
        CREATE TABLE IF NOT EXISTS game_sessions (
            session_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            game_type TEXT NOT NULL,
            game_state TEXT,
            started_at INTEGER DEFAULT (strftime('%s', 'now')),
            ended_at INTEGER,
            result TEXT,
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
            RANK() OVER (ORDER BY xp DESC) AS rank
        FROM users
        ORDER BY xp DESC    
    `);

    console.log('✅ Database initialized successfully.');
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
                    console.log('  -> Adding last_daily_claim column...');
                    db.exec('ALTER TABLE users ADD COLUMN last_daily_claim INTEGER DEFAULT 0');
                }
            }
        },
        // Add future migrations here with version 2, 3, etc.
    ];

    // Run migrations that haven't been applied yet
    migrations.forEach(migration => {
        if (currentVersion < migration.version) {
            if (currentVersion < migration.version) {
                console.log(`📝 Running migration ${migration.version}: ${migration.description}`);
                try {
                    migration.run();
                    setDatabaseVersion(migration.version);
                    console.log(`  ✅ Migration ${migration.version} applied successfully.`);
                } catch (error) {
                    console.error(`  ❌  Migration ${migration.version} failed:`, error.message);
                }
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

    // Game session operations
    createGameSession: db.prepare(`
        INSERT INTO game_sessions (session_id, user_id, game_type, game_state)
        VALUES (?, ?, ?, ?)
    `),

    updateGameSession: db.prepare(`
        UPDATE game_sessions
        SET game_state = ?, ended_at = ?, result = ?
        WHERE session_id = ?
    `),

    getActiveGameSession: db.prepare(`
        SELECT * FROM game_sessions
        WHERE user_id = ? AND ended_at IS NULL
    `),
};

// Help functions
const dbHelpers = {
    /**
     * Get or create a user
     */
    getOrCreateUser(userId, username) {
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
     * Calculate level based on XP (you can adjust this formula)
     */
    calculateLevel(xp) {
        // Formula: level = floor(sqrt(xp / 100))
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
    claimDaily(userId, username, xpAmount) {
        // Use transaction to ensure atomic update
        const transaction = db.transaction(() => {
            const user = this.getOrCreateUser(userId, username);
            const newXP = user.xp + xpAmount;
            const newLevel = this.calculateLevel(newXP);
            const currentTime = Math.floor(Date.now() / 1000);

            statements.updateDailyClaim.run(newXP, newLevel, currentTime, userId);

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

module.exports = {
    db,
    statements,
    dbHelpers,
};
