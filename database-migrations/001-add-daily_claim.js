const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'bot.db');
const db = new Database(dbPath);

console.log('Running database migration...');

try {
    // Utilize transactions to ensure atomicity of the migration
    const migrate = db.transaction(() => {
        db.exec(`
            ALTER TABLE users
            ADD column last_daily_claim INTEGER DEFAULT 0
        `);
    });

    migrate();

    console.log('✅ Successfully added last_daily_claim column to users table.');
} catch (error) {
    if (error.message.includes('duplicate column name')) {
        console.log('⚠️ Migration skipped: last_daily_claim column already exists.');
    } else {
        console.error('❌ Migration failed:', error.message);
    }
}

db.close();
console.log('Migration complete!');