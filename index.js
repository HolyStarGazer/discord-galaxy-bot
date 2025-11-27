require('dotenv').config();                                     // Load environment variables from .env file
const { Client, GatewayIntentBits, Collection, MessageFlags } = require('discord.js');    // Import necessary classes from discord.js
const { dbHelpers } = require('./config/database'); 
const fs = require('fs');                                       // File system module for reading command files
const path = require('path');

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

function formatCommandLine(status, name, message = '', nameWidth = 25, msgWidth = 30) {
    const statusColor = {
        'LOADED'    : '\x1b[32m',   // Green
        'SKIP'      : '\x1b[33m',   // Yellow
        'ERROR'     : '\x1b[31m',   // Red
        'DIR'       : '\x1b[34m'    // Blue
    };

    const color = statusColor[status] || '';
    const reset = '\x1b[0m';
    const statusText = '[' + status + ']';

    return `      ${color}${statusText.padEnd(8)}${reset} ${name.padEnd(nameWidth)} ${message.padEnd(msgWidth)}`;
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
    console.clear();
    console.log('\x1b[36m'); // Cyan color
    console.log(`
    ╔═══════════════════════════════════════════════════════════════════════╗
    ║       ┌───┐                                                           ║
    ║       │   │          ██████   █████  ██      █████  ██   ██ ██    ██  ║
    ║      _/\\_/\\_        ██       ██   ██ ██     ██   ██  ██ ██   ██  ██   ║
    ║      ( ^.^ )        ██   ███ ███████ ██     ███████   ███     ████    ║
    ║       > ^ <         ██    ██ ██   ██ ██     ██   ██  ██ ██     ██     ║
    ║      /|   |\\         ██████  ██   ██ ██████ ██   ██ ██   ██    ██     ║
    ║     (_|   |_)                                                         ║
    ║                      Discord Bot - Version 0.2.3 Alpha                ║
    ╚═══════════════════════════════════════════════════════════════════════╝
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

console.log('  \x1b[36m[INFO]\x1b[0m Connecting to Discord Gateway...\n');

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
    console.log('  \x1b[36m[INFO]\x1b[0m Bot is now online and ready to receive commands.\n');
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
        console.error(`  \x1b[31m[ERROR]\x1b[0m Command execution failed: ${interaction.commandName}`);
        console.error(error);

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

// XP gain on messages
client.on('messageCreate', async message => {
    if (message.author.bot) return; // Ignore bot messages
    if (!message.guild) return; // Ignore DMs

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

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n  \x1b[33m[SHUTDOWN]\x1b[0m Gracefully shutting down...');
    client.destroy();
    process.exit(0);
});