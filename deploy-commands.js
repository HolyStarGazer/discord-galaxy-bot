process.env.DB_SILENT = 'true';

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { displayTableHeaderColored, displayHeaderColored, displayTableFooter, log } = require('./utils/formatters');

const CACHE_FILE = path.join(__dirname, 'command-cache.json');

/**
 * Generate a hash of command data to detect changes
 * @param {object} command - The command module
 * @return {string} The hash string
 */
function hashCommand(command) {
    const data = JSON.stringify(command.data.toJSON());
    return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Load the previous command cache
 * @return {object} The command cache
 */
function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        }
    } catch (error) {
        log('WARN', 'Failed to load command cache, will redeploy all commands', 2, error);
    }
    return { commands: {}, lastDeploy: null };
}

/**
 * Save the command cache
 * @param {object} cache - The command cache to save
 */
function saveCache(cache) {
    try {
        const dataDir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch (error) {
        log('WARN', 'Failed to save command cache', 2, error);
    }
}

/**
 * Load all commands from the commands directory
 * @param {string} dir - The commands directory
 * @param {array} commands - The array to populate with commands
 * @return {array} The loaded commands
 */
function loadCommands(dir, commands = []) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            loadCommands(filePath, commands);
        } else if (file.endsWith('.js')) {
            try {
                // Clear require cache to get fresh version
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);

                if (command.data && command.execute) {
                    commands.push({
                        name: command.data.name,
                        data: command.data,
                        path: filePath,
                        hash: hashCommand(command)
                    });
                }
            } catch (error) {
                log('ERROR', `Failed to load ${file} at ${filePath}`, 2, error);
            }
        }
    }

    return commands;
}

/**
 * Main deployment function
 * @param {object} options - Deployment options
 * @param {boolean} options.force - Force deployment even if no changes detected
 * @param {boolean} options.guild - Deploy to guild (true) or globally (false)
 * @return {object} Deployment result
 */
async function deployCommands(options = {}) {
    const { force = false, guild = true } = options;

    displayHeaderColored('COMMAND DEPLOYMENT', 'cyan');

    // Load commands and cache
    const commandsPath = path.join(__dirname, 'commands');
    const commands = loadCommands(commandsPath);
    const cache = loadCache();

    log('INFO', `Found ${commands.length} command(s)`);

    // Detect changes
    const newCommands = [];
    const updatedCommands = [];
    const unchangedCommands = [];
    const removedCommands = [];

    // Check for new/updated commands
    for (const cmd of commands) {
        const cachedHash = cache.commands[cmd.name];

        if (!cachedHash) {
            newCommands.push(cmd);
        } else if (cachedHash !== cmd.hash) {
            updatedCommands.push(cmd);
        } else {
            unchangedCommands.push(cmd);
        }
    }

    // Check for removed commands
    const currentCommandNames = commands.map(c => c.name);
    for (const cachedName of Object.keys(cache.commands)) {
        if (!currentCommandNames.includes(cachedName)) {
            removedCommands.push(cachedName);
        }
    }

    // Display change summary
    displayTableHeaderColored('CHANGE SUMMARY', 'cyan');
    console.log(formatRow('New:', newCommands.length, '\x1b[32m'));
    console.log(formatRow('Updated:', updatedCommands.length, '\x1b[33m'));
    console.log(formatRow('Unchanged:', unchangedCommands.length));
    console.log(formatRow('Removed:', removedCommands.length, '\x1b[31m'));
    displayTableFooter();

    // Check if deployment is needed
    const hasChanges = newCommands.length > 0 || updatedCommands.length > 0 || removedCommands.length > 0;

    if (!hasChanges && !force) {
        log('OK', 'No changes detected. Skipping deployment.', 2);
        log('INFO', 'Use --force to deploy anyway.', 4);
        console.log('');
        return { deployed: false, reason: 'no-changes' };
    }

    if (force && !hasChanges) {
        log('INFO', 'Force flag set. Deploying all commands...');
        console.log('');
    }

    // Log individual changes
    if (newCommands.length > 0) {
        log('INFO', 'New commands:');
        newCommands.forEach(cmd => console.log(`    + ${cmd.name}`));
        console.log('');
    }

    if (updatedCommands.length > 0) {
        log('INFO', 'Updated commands:');
        updatedCommands.forEach(cmd => console.log(`    ~ ${cmd.name}`));
        console.log('');
    }

    if (removedCommands.length > 0) {
        log('INFO', 'Removed commands:');
        removedCommands.forEach(name => console.log(`    - ${name}`));
        console.log('');
    }

    // Deploy to Discord
    const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);
    const commandData = commands.map(cmd => cmd.data.toJSON());

    try {
        log('INFO', 'Deploying commands to Discord...');

        let result;
        if (guild && process.env.DISCORD_GUILD_ID) {
            // Guild deployment (instant)
            result = await rest.put(
                Routes.applicationGuildCommands(
                    process.env.DISCORD_CLIENT_ID,
                    process.env.DISCORD_GUILD_ID
                ),
                { body: commandData }
            );
            log('OK', `Deployed ${result.length} command(s) to guild (instant)`, 4);
        } else {
            // Global deployment (up to 1 hour delay)
            result = await rest.put(
                Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
                { body: commandData }
            );
            log('OK', `Deployed ${result.length} command(s) globally (may take up to 1 hour)`, 4);
        }

        // Update cache
        const newCache = {
            commands: {},
            lastDeploy: new Date().toISOString(),
            deployedCount: commands.length
        };

        for (const cmd of commands) {
            newCache.commands[cmd.name] = cmd.hash;
        }

        saveCache(newCache);
        log('OK', 'Command cache updated', 4);

        return {
            deployed: true,
            count: result.length,
            new: newCommands.length,
            updated: updatedCommands.length,
            removed: removedCommands.length
        };
    } catch (error) {
        log('ERROR', 'Deployment failed', 4, error);
        throw error;
    }
}

/**
 * Format a table row with fixed width
 * @param {string} label - The label for the row
 * @param {string|number} value - The value for the row
 * @param {string} color - Optional ANSI color code for the value
 * @return {string} The formatted table row
 */
function formatRow(label, value, color = '') {
    const valueStr = String(value);
    
    // Fixed width: label (20 chars) + value (47 chars) = 67 total
    const labelPart = label.padEnd(20);
    
    // Apply color if provided
    const coloredValue = color ? `${color}${valueStr}\x1b[0m` : valueStr;
    
    // Calculate padding needed (account for ANSI color codes if present)
    const visibleLength = valueStr.length;
    const totalPadding = 67 - labelPart.length;
    const paddingNeeded = Math.max(0, totalPadding - visibleLength);
    
    return `│  ${labelPart}${coloredValue}${' '.repeat(paddingNeeded)}│`;
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    force: args.includes('--force') || args.includes('-f'),
    guild: !args.includes('--global') || !args.includes('-g')
};

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node deploy-commands.js [options]

Options:
    --f, --force       Force deployment even if no changes detected
    --g, --global      Deploy commands globally instead of to a guild (slower)
    --h, --help        Show this help message

Examples:
    node deploy-commands.js             # Smart deploy to guild
    node deploy-commands.js --force     # Force deploy to guild
    node deploy-commands.js --global    # Deploy globally
    `);

    process.exit(0);
}

// Run deployment
deployCommands(options)
    .then(result => {
        if (result.deployed) {
            log('OK', 'Deployment complete!', 4);
            console.log('');
        }
        setTimeout(() => process.exit(0), 100);
    })
    .catch(error => {
        log('ERROR', 'Deployment failed!', 4, error);
        console.log('');
        setTimeout(() => process.exit(1), 100);
    });

module.exports = { deployCommands };