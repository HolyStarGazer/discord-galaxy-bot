require('dotenv').config();                                     // Load environment variables from .env file
const { Client, GatewayIntentBits, Collection, MessageFlags } = require('discord.js');    // Import necessary classes from discord.js
const { db, statements, dbHelpers } = require('./config/database'); 
const { version } = require('./package.json');  // ← Add this
const fs = require('fs');                                       // File system module for reading command files
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

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

// ============================================
// INTERACTIVE COMMAND SYSTEM
// ============================================

let rl = null;

function setupInteractiveCommands() {
    // Detect if running in VSCode integrated terminal
    if (process.env.TERM_PROGRAM === 'vscode') {
        console.log('  \x1b[33m[WARN]\x1b[0m Commands not fully supported in VSCode integrated terminal (i.e. :restart, :redeploy)\n');
    }

    rl = readline.createInterface({
        input: process.stdin,
        prompt: ''
    });

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
    }

    let commandMode = false;
    let commandBuffer = '';

    process.stdin.on('keypress', (str, key) => {
        // Ctrl + C
        if (key.ctrl && key.name === 'c') { // or \u0003 for Ctrl+C
            gracefulShutdown('SIGINT');
            return;
        }

        if (!commandMode && str === ':') { 
            commandMode = true;
            commandBuffer = '';
            process.stdout.write('\n\x1b[33m[CMD]\x1b[0m : ');
            
            return;
        }

        if (!commandMode) return;

        // Enter - execute
        if (key.name === 'return') {
            const command = commandBuffer.trim();
            process.stdout.write('\n');

            if (command) {
                executeInteractiveCommand(command);
            }

            commandMode = false;
            commandBuffer = '';
            return;
        }

        // Backspace
        if (key.name === 'backspace') {
            if (commandBuffer.length > 0) {
                commandBuffer = commandBuffer.slice(0, -1);
                process.stdout.write('\b \b'); // Move back, write space, move back again
            }

        return;
        }
        
        // Escape - cancel
        if (key.name === 'escape') {
            process.stdout.write('\n  \x1b[33m[INFO]\x1b[0m Command cancelled\n');
            commandMode = false;
            commandBuffer = '';
            return;
        }

        // Regular character input
        if (str && str.length === 1 && str.charCodeAt(0) >= 32) {
            commandBuffer += str;
            process.stdout.write(str);
        }
    });

    console.log('  \x1b[34m[INFO]\x1b[0m Interactive commands enabled. Type \x1b[33m:\x1b[0m to enter command mode.\n');
}

async function executeInteractiveCommand(command) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`  \x1b[36m[${timestamp}]\x1b[0m Executing command: ${command}`);

    switch (command.toLowerCase()) {
        case 'help':
            showInteractiveHelp();
            break;
        case 'restart':
            restartBot();
            break;
        case 'redeploy':
            redeployCommands();
            break;
        case 'status':
            showBotStatus();
            break;
        case 'backup':
            console.log('  \x1b[34m[INFO]\x1b[0m Creating manual backup...\n');
            backupDatabase();
            break;
        case 'stats':
            showBotStats();
            break;
        case 'stop':
        case 'quit':
        case 'exit':
            gracefulShutdown('USER_COMMAND');
            break;
        default:
            console.log(`  \x1b[31m[ERROR]\x1b[0m Unknown command: ${command}\n`);
            console.log(`  \x1b[34m[INFO]\x1b[0m Type \x1b[33m:help\x1b[0m for available commands.\n`);
    }
}

function showInteractiveHelp() {
    console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
    console.log('│  \x1b[32mINTERACTIVE COMMANDS\x1b[0m                                               │');
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    console.log('│  \x1b[33m:help\x1b[0m       - Show this help message                               │');
    console.log('│  \x1b[33m:restart\x1b[0m    - Restart the bot                                      │');
    console.log('│  \x1b[33m:redeploy\x1b[0m   - Deploy commands and restart                          │');
    console.log('│  \x1b[33m:status\x1b[0m     - Show bot status                                      │');
    console.log('│  \x1b[33m:stats\x1b[0m      - Show detailed statistics                             │');
    console.log('│  \x1b[33m:backup\x1b[0m     - Create manual database backup                        │');
    console.log('│  \x1b[33m:stop\x1b[0m       - Gracefully stop the bot                              │');
    console.log('│                                                                     │');
    console.log('│  Press \x1b[33mESC\x1b[0m to cancel command entry                                  │');
    console.log('└─────────────────────────────────────────────────────────────────────┘\n');
}

function restartBot() {
    console.log('  \x1b[33m[RESTART]\x1b[0m Restarting bot...\n');

    if (rl) {
        rl.close();

        // Turn off raw mode before exiting
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
    }

    // Close Discord Client
    client.destroy();

    // Close database
    if (db) {
        console.log('  \x1b[34m[INFO]\x1b[0m Closing database connection...');
        db.close();
    }

    console.log('  \x1b[34m[INFO]\x1b[0m Starting new instance...\n');

    // Get the full path to the current script (index.js)
    const scriptPath = path.resolve(process.argv[1]);

    // Spawn new process
    const args = process.argv.slice(1);
    const child = spawn(process.argv[0], args, {
        detached: true,
        stdio: 'inherit',
        cmd: process.cwd(),
        env: process.env
    });

    // Windows unreference
    if (process.platform === 'win32') {
        child.unref();
        
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    } else {
        child.unref();
        process.exit(0);
    }
}

async function redeployCommands() {
    console.log('  \x1b[33m[REDEPLOY]\x1b[0m Deploying commands...\n');

    return new Promise((resolve, reject) => {
        const deployProcess = spawn('node', ['deploy-commands.js'], {
            stdio: 'inherit'
        });

        deployProcess.on('close', (code) => {
            if (code === 0) {
                console.log('\n  \x1b[32m[OK]\x1b[0m Commands deployed successfully');
                setTimeout(() => restartBot(), 1000);
                resolve();
            } else {
                console.log(`\n  \x1b[31m[ERROR]\x1b[0m Deploy failed with code ${code}\n`);
                reject(new Error('Deploy failed'));
            }
        });

        deployProcess.on('error', (error) => {
            console.error(`\n  \x1b[31m[ERROR]\x1b[0m Deploy process error: ${error.message}\n`);
            reject(error);
        });
    });
}

function showBotStatus() {
    console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
    console.log('│  \x1b[32mBOT STATUS\x1b[0m                                                         │');
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    console.log(formatRow('Status:', client.isReady() ? 'Online' : 'Offline', client.isReady() ? '\x1b[32m' : '\x1b[31m'));
    console.log(formatRow('Uptime:', formatUptime(client.uptime)));
    console.log(formatRow('User:', client.user?.tag || 'Not logged in'));
    console.log(formatRow('Guilds:', client.guilds.cache.size));
    console.log(formatRow('Users:', client.users.cache.size));
    console.log(formatRow('Channels:', client.channels.cache.size));
    console.log(formatRow('Commands:', client.commands.size));
    console.log('└─────────────────────────────────────────────────────────────────────┘\n');
}

function showBotStats() {
    console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
    console.log('│  \x1b[32mDETAILED STATISTICS\x1b[0m                                                │');
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    console.log(formatRow('Status:', client.isReady() ? 'Online' : 'Offline', client.isReady() ? '\x1b[32m' : '\x1b[31m'));
    console.log(formatRow('Uptime:', formatUptime(client.uptime)));
    console.log(formatRow('Version:', version));
    console.log(formatRow('Node.js:', process.version));
    console.log(formatRow('Discord.js:', require('discord.js').version));
    console.log(formatRow('Guilds:', client.guilds.cache.size));
    console.log(formatRow('Total Users:', client.users.cache.size));
    console.log(formatRow('Channels:', client.channels.cache.size));
    console.log(formatRow('Commands:', client.commands.size));

    try {
        const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
        const totalXP = db.prepare('SELECT SUM(xp) AS total FROM users').get().total || 0;
        const avgLevel = db.prepare('SELECT AVG(level) AS avg FROM users').get();

        console.log(formatRow('DB Users:', userCount));
        console.log(formatRow('Total XP:', totalXP?.toLocaleString() || '0'));
        console.log(formatRow('Average Level:', avgLevel.avg?.toFixed(2) || '0'));
    } catch (error) {
        console.log(formatRow('DB Status:', '\x1b[31mError\x1b[0m'));
    }

    const memUsage = process.memoryUsage();
    console.log(formatRow('Memory (RSS):', `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`));
    console.log(formatRow('Memory (Heap):', `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`));

    try {
        if (fs.existsSync(BACKUP_STATE_FILE)) {
            const backupState = JSON.parse(fs.readFileSync(BACKUP_STATE_FILE, 'utf-8'));
            const hoursAgo = ((Date.now() - backupState.lastBackup) / (1000 * 60 * 60)).toFixed(2);
            console.log(formatRow('Last Backup:', `${hoursAgo} hours ago`));
        }
    } catch (error) {
        console.log(formatRow('Last Backup:', '\x1b[33mUnknown\x1b[0m'));
    }

    console.log('└─────────────────────────────────────────────────────────────────────┘\n');
}

function formatUptime(ms) {
    if (!ms) return 'Just started';

    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / (1000 * 60)) % 60;
    const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
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

    // Initialize interactive command system
    setupInteractiveCommands();
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