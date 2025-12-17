require('dotenv').config();                                     
const { Client, GatewayIntentBits, Collection, MessageFlags } = require('discord.js');
const { db, statements, dbHelpers } = require('./config/database'); 
const fs = require('fs');                                       
const path = require('path');
const { displayBanner, displayHeader, displayHeaderColored, displayTableHeader, displayTableFooter, formatRow, formatUptime, log, logWithTimestamp, displayTableHeaderColored } = require('./utils/formatters');
const { setupInteractiveCommands, gracefulShutdown } = require('./utils/interactive-console');
const { initializeBackupSystem } = require('./config/backup');

// ============================================
// COMMAND LOADER
// ============================================

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

// ============================================
// BOT INITIALIZATION
// ============================================

displayBanner();
displayHeaderColored('INITIALIZATION', 'cyan');

log('INFO', 'Loading environment variables...', 2);
log('OK', 'Environment loaded successfully', 4);

console.log('');
log('INFO', 'Verifying database...', 2);

const health = dbHelpers.healthCheck();

if (!health.healthy) {
    log('ERROR', 'Database health check failed', 4);
    
    if (!health.connected) {
        log('ERROR', 'Cannot connect to database. Exiting...', 4);
        process.exit(1); // Exit for connection failures
    } else {
        log('WARN', `Database missing tables: ${2 - health.tables.length} missing`, 4);
        log('WARN', 'Run migrations or check database setup', 4);
        process.exit(1); // Exit for missing tables
    }
} else {
    log('OK', 'Database healthy (2 tables verified)', 4);
}

displayHeaderColored('COMMAND LOADER', 'cyan');

// Load all commands from the commands folder
const commandsPath = path.join(__dirname, 'commands');
let startTime = Date.now();

if (fs.existsSync(commandsPath)) {
    loadCommands(commandsPath);
} else {
    log('ERROR', 'Commands directory not found: ' + commandsPath, 4);
}

// Calculate stats
const loadTime = Date.now() - startTime;
const successRate = commandStats.total > 0
    ? (commandStats.successful / commandStats.total * 100).toFixed(2)
    : '0.00';

displayTableHeaderColored('SUMMARY', 'cyan');
console.log(formatRow('Total:', commandStats.total));
console.log(formatRow('Loaded:', commandStats.successful, '\x1b[32m'));
console.log(formatRow('Failed:', commandStats.failed, '\x1b[31m'));
console.log(formatRow('Success Rate:', `${successRate}%`));
console.log(formatRow('Load Time:', `${loadTime}ms`));
displayTableFooter();

log('INFO', 'Connecting to Discord Gateway...');

// Bot ready event
client.once('clientReady', () => {
    const timestamp = new Date().toLocaleString();

    displayTableHeaderColored('BOT READY', 'green');
    console.log(formatRow('Bot User:', client.user.tag));
    console.log(formatRow('Bot ID:', client.user.id));
    console.log(formatRow('Commands:', client.commands.size));
    console.log(formatRow('Guilds:', client.guilds.cache.size));
    console.log(formatRow('Timestamp:', timestamp));
    displayTableFooter();
    
    log('OK', 'Bot is now online and ready to receive commands.');
    console.log('');

    // Initialize backup system after bot is ready
    initializeBackupSystem();

    // Initialize interactive command system
    setupInteractiveCommands(client, db);
});

// Message handler - listens for slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return; // Ignore messages from bots

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        log('WARN', `Received unknown command: ${interaction.commandName}`);
        return;
    }

    // Execute the command with error handling
    try {
        logWithTimestamp('CMD', `${interaction.user.tag} : /${interaction.commandName}`);
        await command.execute(interaction);
    } catch (error) {
        // Log sanitized error info
        log('ERROR', `Command execution failed: ${interaction.commandName}`, 2, error);
        logWithTimestamp('ERROR', `Command execution failed: ${interaction.commandName}`, 2, error);

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
        logWithTimestamp('WARN', `Rate limit exceeded for user: ${message.author.tag}`);
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
        logWithTimestamp('OK', `Level up! ${message.author.tag} reached level ${result.newLevel}`);

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

// Handle graceful shutdown on signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logWithTimestamp('ERROR', 'Uncaught Exception', 4, error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    logWithTimestamp('ERROR', 'Unhandled Rejection', 4, reason);
});