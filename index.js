require('dotenv').config();                                     // Load environment variables from .env file
const { Client, GatewayIntentBits, Collection, MessageFlags } = require('discord.js');    // Import necessary classes from discord.js
const { db, statements, dbHelpers } = require('./config/database'); 
const { version } = require('./package.json');  // ← Add this
const fs = require('fs');                                       // File system module for reading command files
const path = require('path');
const { time } = require('console');

// ============================================
// DATABASE BACKUP SYSTEM
// ============================================

const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');
const BACKUP_STATE_FILE = path.join(__dirname, 'data', 'last_backup.json');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log('  \x1b[32m[OK]\x1b[0m   Created backup directory');
}

/**
 * Perform database backup
 */
function backupDatabase() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]; // YYYY-MM-DD
    const timeString = new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('Z')[0]; // HH-MM-SS
    const backupFilename = `bot.db.${timestamp}_${timeString}.bak`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);
    const dbPath = path.join(__dirname, 'data', 'bot.db');

    try {
        // Check if database file exists
        if (!fs.existsSync(dbPath)) {
            console.log('  \x1b[33m[WARN]\x1b[0m Database file not found, skipping backup');
            return false;
        }

        // Copy database file
        fs.copyFileSync(dbPath, backupPath);
        
        const stats = fs.statSync(backupPath);
        const fileSizeKB = (stats.size / 1024).toFixed(2);

        console.log(`  \x1b[32m[OK]\x1b[0m Database backed up successfully`);
        console.log(`  \x1b[34m[INFO]\x1b[0m   File: ${backupFilename}`);
        console.log(`  \x1b[34m[INFO]\x1b[0m   Size: ${fileSizeKB} KB\n`);
        
        // Save backup timestamp
        const backupState = {
            lastBackup: Date.now(),
            lastBackupDate: new Date().toISOString(),
            backupFile: backupFilename
        };
        fs.writeFileSync(BACKUP_STATE_FILE, JSON.stringify(backupState, null, 2));

        // Cleanup old backups (keep last 3)
        cleanupOldBackups(3);

        return true;
    } catch (error) {
        console.error(`  \x1b[31m[ERROR]\x1b[0m Backup failed: ${error.message}\n`);
        return false;
    }
}

/**
 * Cleanup old backups, keep only the last N
 */
function cleanupOldBackups(keepCount = 3) {
    try {
        const backups = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('bot.db.') && f.endsWith('.bak'))
            .map(f => ({
                name: f,
                path: path.join(BACKUP_DIR, f),
                time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // Newest first
        
        if (backups.length <= keepCount) return; // Nothing to delete

        const toDelete = backups.slice(keepCount);
        toDelete.forEach(backup => {
            fs.unlinkSync(backup.path);
            console.log(`  \x1b[34m[INFO]\x1b[0m  Removed old backup: ${backup.name}`);
        });
        console.log('');
    } catch (error) {
        console.error(`  \x1b[33m[WARN]\x1b[0m Cleanup failed: ${error.message}`);
    }
}

/**
 * Check if backup is needed based on last backup time
 */
function shouldBackup() {
    try {
        // Check if state file exists
        if (!fs.existsSync(BACKUP_STATE_FILE)) {
            console.log('  \x1b[34m[INFO]\x1b[0m No previous backup found');
            return true;
        }

        const backupState = JSON.parse(fs.readFileSync(BACKUP_STATE_FILE, 'utf-8'));
        const lastBackup = backupState.lastBackup || 0;
        const timeSinceBackup = (Date.now() - lastBackup);

        if (timeSinceBackup >= BACKUP_INTERVAL) {
            console.log(`  \x1b[34m[INFO]\x1b[0m Last backup: ${(timeSinceBackup / (1000 * 60 * 60)).toFixed(1)} hours ago`);
            return true;
        } else {
            console.log(`  \x1b[32m[OK]\x1b[0m   Backup not needed (last backup: ${(timeSinceBackup / (1000 * 60 * 60)).toFixed(1)} hours ago)`);
            return false;
        }
    } catch (error) {
        console.error(`  \x1b[33m[WARN]\x1b[0m Could not read backup state: ${error.message}`);
        return true; // Backup if we can't tell
    }
}

/**
 * Initialize  backup system
 */
function initializeBackupSystem() {
    console.log('  \x1b[34m[INFO]\x1b[0m Checking database backup status...');
    
    // Check if backup is needed at startup
    if (shouldBackup()) {
        console.log('  \x1b[34m[INFO]\x1b[0m Performing startup backup...\n');
        backupDatabase();
    } else {
        console.log('');
    }

    const checkInterval = 60 * 60 * 1000; // 1 hour
    
    // Check if backup is needed
    setInterval(() => {
        console.log('  \x1b[34m[INFO]\x1b[0m Running scheduled backup check...');
        if (shouldBackup()) {
            backupDatabase();
        } else {
            console.log('');
        }
    }, checkInterval); // Check every hour
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,           // Enables guild-related events
        GatewayIntentBits.GuildMessages,    // Enables message-related events in guilds
        GatewayIntentBits.MessageContent    // Enables access to the content of messages
    ]
});

// Create a collection to store commands
client.commands = new Collection();

const commandStats = {
    total: 0,
    successful: 0,
    failed: 0
};

function loadCommands(dir, depth = 0) {
    const files = fs.readdirSync(dir);
    const indent = '  '.repeat(depth + 1);
    const COMMAND_NAME_WIDTH = 25; // Pre-allocate width

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        // If it's a directory, recursively load commands from it
        if (stat.isDirectory()) {
            console.log(`${indent}\x1b[34m[DIR]\x1b[0m     ${file}/`);
            loadCommands(filePath, depth + 1);
        }
        // If it's a .js file, load it as a command
        else if (file.endsWith('.js')) {
            commandStats.total++;

            try {
                const command = require(filePath);

                // Check if the command has required properties
                if (command.data && command.execute) {
                    client.commands.set(command.data.name, command);
                    console.log(`${indent}\x1b[32m[LOADED]\x1b[0m  ${command.data.name.padEnd(COMMAND_NAME_WIDTH)}`);
                    commandStats.successful++;
                } else {
                    console.warn(`${indent}\x1b[33m[SKIP]\x1b[0m    ${file.padEnd(COMMAND_NAME_WIDTH)} Missing properties`);            
                    commandStats.failed++;
                }
            } catch (error) {
                console.error(`${indent}\x1b[31m[ERROR]\x1b[0m   ${file.padEnd(COMMAND_NAME_WIDTH)} ${error.message}`);
                commandStats.failed++;
            }
        }
    }
}

function formatRow(label, value, color = '') {
   const valueStr = String(value);
   
    // Calculate padding based on visible characters only
    const labelPart = label.padEnd(17);
    const valuePart = valueStr.padEnd(50);

    // Apply color after padding if provided
    const coloredValue = color ? `${color}${valueStr}${'\x1b[0m'}` : valueStr;
    const combined = labelPart + coloredValue.padEnd(50 + (color ? 9 : 0));

    return `│  ${combined}│`;
}

function displayBanner() {
    // Banner version text
    const versionText = `Discord Bot - Version ${version} Alpha`;
    const paddedVersionText = versionText.padStart((65 + versionText.length) / 2).padEnd(65);
    
    console.clear();
    console.log('\x1b[36m'); // Cyan color
    console.log(`
    ╔═════════════════════════════════════════════════════════════════╗
    ║    ┌───┐                                                        ║
    ║    │   │       ██████   █████  ██      █████  ██   ██ ██    ██  ║
    ║   _/\\_/\\_     ██       ██   ██ ██     ██   ██  ██ ██   ██  ██   ║
    ║   ( ^.^ )     ██   ███ ███████ ██     ███████   ███     ████    ║
    ║    > ^ <      ██    ██ ██   ██ ██     ██   ██  ██ ██     ██     ║
    ║   /|   |\\      ██████  ██   ██ ██████ ██   ██ ██   ██    ██     ║
    ║  (_|   |_)                                                      ║
    ║${paddedVersionText}║
    ╚═════════════════════════════════════════════════════════════════╝
    `);
    console.log('\x1b[0m'); // Reset color
}

function displayHeader(header) {
    console.log(`
┌─────────────────────────────────────────────────────────────────────┐        
│  ${header.padEnd(65)}  │
└─────────────────────────────────────────────────────────────────────┘
        `);
}

displayBanner();
displayHeader('INITIALIZATION');

console.log('  \x1b[34m[INFO]\x1b[0m Loading environment variables...');
console.log('  \x1b[32m[OK]\x1b[0m   Environment loaded successfully\n');

console.log('  \x1b[34m[INFO]\x1b[0m Verifying database...');

const health = dbHelpers.healthCheck();

if (!health.healthy) {
    console.log(`  \x1b[31m[ERROR]\x1b[0m Database health check failed\n`);
    
    if (!health.connected) {
        console.log('  \x1b[31m[FATAL]\x1b[0m Cannot connect to database. Exiting...\n');
        process.exit(1); // Exit for connection failures
    } else {
        console.log(`  \x1b[33m[WARN]\x1b[0m Database missing tables: ${2 - health.tables.length} missing\n`);
        console.log('  \x1b[33m[WARN]\x1b[0m Run migrations or check database setup\n');
        // Maybe exit here too?
        // Or add a flag to halt and database-related commands?
    }
} else {
    console.log('  \x1b[32m[OK]\x1b[0m   Database healthy (2 tables verified)\n');
}

displayHeader('COMMAND LOADER');

// Load all commands from the commands folder
const commandsPath = path.join(__dirname, 'commands');
let startTime = Date.now();

if (fs.existsSync(commandsPath)) {
    console.log('  Commands:\n');
    loadCommands(commandsPath);
} else {
    console.warn('  \x1b[31m[ERROR]\x1b[0m Commands directory not found:', commandsPath);
}

// Calculate stats
const loadTime = Date.now() - startTime;
const successRate = commandStats.total > 0
    ? (commandStats.successful / commandStats.total * 100).toFixed(2)
    : '0.00';

console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
console.log('│  SUMMARY                                                            │');
console.log('├─────────────────────────────────────────────────────────────────────┤');
console.log(formatRow('Total:', commandStats.total));
console.log(formatRow('Loaded:', commandStats.successful, '\x1b[32m'));
console.log(formatRow('Failed:', commandStats.failed, '\x1b[31m'));
console.log(formatRow('Success Rate:', `${successRate}%`));
console.log(formatRow('Load Time:', `${loadTime}ms`));
console.log('└─────────────────────────────────────────────────────────────────────┘\n');

console.log('  \x1b[34m[INFO]\x1b[0m Connecting to Discord Gateway...\n');

// Bot ready event
client.once('clientReady', () => {
    const timestamp = new Date().toLocaleString();

    console.log('┌─────────────────────────────────────────────────────────────────────┐');
    console.log('│  \x1b[32mBOT READY\x1b[0m                                                          │');
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    console.log(formatRow('Bot User:', client.user.tag));
    console.log(formatRow('Bot ID:', client.user.id));
    console.log(formatRow('Commands:', client.commands.size));
    console.log(formatRow('Guilds:', client.guilds.cache.size));
    console.log(formatRow('Timestamp:', timestamp));
    console.log('└─────────────────────────────────────────────────────────────────────┘\n');
    console.log('  \x1b[34m[INFO]\x1b[0m Bot is now online and ready to receive commands.\n');

    // Initialize backup system after bot is ready
    initializeBackupSystem();
});

// Message handler - listens for slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return; // Ignore messages from bots

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.warn(`  \x1b[33m[WARN]\x1b[0m Unknown command: ${interaction.commandName}`);
        return;
    }

    // Execute the command with error handling
    try {
        const timestamp = new Date().toLocaleString();
        console.log(`  \x1b[36m[${timestamp}]\x1b[0m ${interaction.user.tag} → /${interaction.commandName}`);
        await command.execute(interaction);
    } catch (error) {
        // Log sanitized error info
        console.error(`  \x1b[31m[ERROR]\x1b[0m Command failed: ${interaction.commandName}`);
        console.error(`  Error type: ${error.name}`);
        if (process.env.NODE_ENV === 'development') {
            console.error(error.stack); // Full stack trace only in dev
        } else {
            console.error(`  Error message: ${error.message}`); // Minimal in production
        }

        const errorMessage = {
            content: 'There was an error while executing this command!',
            flags: MessageFlags.Ephemeral
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

// Login to Discord
client.login(process.env.DISCORD_BOT_TOKEN);

// Add global rate limiter
const globalMessageTracker = new Map(); // userId -> message count in window
const GLOBAL_MESSAGE_LIMIT = 100; // per minute per user
const GLOBAL_WINDOW = 60000; // 1 minute in ms

// XP gain on messages
client.on('messageCreate', async message => {
    if (message.author.bot) return; // Ignore bot messages
    if (!message.guild) return; // Ignore DMs

    // Check global rate limit
    const userTracker = globalMessageTracker.get(message.author.id) || { count: 0, resetAt: Date.now() + GLOBAL_WINDOW };

    if (Date.now() > userTracker.resetAt) {
        // Reset window
        userTracker.count = 0;
        userTracker.resetAt = Date.now() + GLOBAL_WINDOW;
    }

    userTracker.count++;

    if (userTracker.count > GLOBAL_MESSAGE_LIMIT) {
        console.log(`  \x1b[33m[WARN]\x1b[0m Rate limit exceeded: ${message.author.tag}`);
        return;
    }

    globalMessageTracker.set(message.author.id, userTracker);

    // Get user data
    const userData = dbHelpers.getOrCreateUser(message.author.id, message.author.username);

    // Check cooldown (1 minute between XP gains to prevent spam)
    const currentTime = Math.floor(Date.now() / 1000);
    const cooldownTime = 60; // seconds

    if (currentTime - userData.last_xp_gain < cooldownTime) return;

    // Calculate XP gain (random between 15-25)
    const xpGain = Math.floor(Math.random() * 11) + 15;

    // Add XP
    const result = dbHelpers.addXP(message.author.id, message.author.username, xpGain);

    // Send level up message if user leveled up
    if (result.leveledUp) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`  \x1b[35m[${timestamp}]\x1b[0m Level Up! ${message.author.tag} → Level ${result.newLevel}`);

        const levelUpMessages = [
            `🎉 Congrats ${message.author}, you've reached level ${result.newLevel}! Keep it up!`,
            `🚀 Awesome ${message.author}! You've leveled up to ${result.newLevel}!`,
            `🔥 ${message.author}, you're now level ${result.newLevel}! Amazing progress!`
        ];

        const randomMessage = levelUpMessages[Math.floor(Math.random() * levelUpMessages.length)];
        message.channel.send(randomMessage).catch(() => {});
    }
});

// ============================================
// GRACEFUL SHUTDOWN WITH DATABASE CLOSE
// ============================================

// Handle multiple shutdown signals
function gracefulShutdown(signal) {
    console.log(`\n  \x1b[33m[SHUTDOWN]\x1b[0m Received ${signal}, shutting down gracefully...`);

    // Close Discord client
    client.destroy();

    // Close database
    if (db) {
        console.log('  \x1b[34m[INFO]\x1b[0m Closing database connection...');
        db.close();
    }

    console.log('  \x1b[32m[OK]\x1b[0m Shutdown complete.');
    process.exit(0);
}

// Handle graceful shutdown on signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('  \x1b[31m[UNCAUGHT EXCEPTION]\x1b[0m', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('  \x1b[31m[UNHANDLED REJECTION]\x1b[0m', reason);
});