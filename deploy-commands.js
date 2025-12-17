require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { version } = require('./package.json');
const fs = require('fs');
const path = require('path');
const { displayBanner, displayHeader, displayTableHeaderColored, displayHeaderColored, displayTableFooter, log, logWithTimestamp } = require('./utils/formatters');

// Suppress database initialization messages during command loading
const originalLog = console.log;
let suppressDatabaseLogs = false;

console.log = function(...args) {
    if (suppressDatabaseLogs) {
        const message = args.join(' ');
        // Suppress database-related messages (including emoji variants)
        if (message.includes('📦') || 
            message.includes('✅') ||
            message.includes('database') || 
            message.includes('Database') ||
            message.includes('migration') ||
            message.includes('Opening existing') ||
            message.includes('Creating new') ||
            message.includes('initialized')) {
            return; // Skip these messages
        }
    }
    originalLog.apply(console, args);
};

const commands = [];
const commandStats = {
    total: 0,
    successful: 0,
    failed: 0
}

// Load command files
function loadCommands(dir, depth = 0) {
    const files = fs.readdirSync(dir);
    const indent = '  '.repeat(depth + 1);
    const COMMAND_NAME_WIDTH = 25;

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            console.log(`${indent}\x1b[34m[DIR]\x1b[0m     ${file}/`);
            loadCommands(filePath, depth + 1);
        } else if (file.endsWith('.js')) {
            commandStats.total++;

            try {
                const command = require(filePath);

                if (command.data && command.execute) {
                    commands.push(command.data.toJSON());
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


// Display banner
displayBanner();
displayHeader('INITIALIZATION');

log('INFO', 'Loading environment variables...');
log('OK', 'Environment loaded successfully\n', 4);

log('INFO', 'Verifying Discord credentials...');

// Verify required environment variables
const requiredVars = ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID'];
const missingVars = requiredVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
    log('ERROR', `Missing required environment variables: ${missingVars.join(', ')}`, 4);
    process.exit(1);
}

log('OK', 'Discord credentials verified successfully\n', 4);

// Check deployment mode
const isGuildDeploy = !!process.env.DISCORD_GUILD_ID;
const deployMode = isGuildDeploy ? 'Guild (instant)' : 'Global (up to 1 hour)';

log('INFO', `Deployment mode: ${deployMode}`);
if (isGuildDeploy) {
    log('INFO', `Target guild ID: ${process.env.DISCORD_GUILD_ID}\n`, 4);
} else {
    log('WARN]', 'Global deployment may take up to 1 hour to propagate\n', 4);
}

displayHeader('COMMAND LOADER');

// Load all commands
const commandsPath = path.join(__dirname, 'commands');
const startTime = Date.now();

if (fs.existsSync(commandsPath)) {
    console.log('  Commands:\n');
    suppressDatabaseLogs = true; // Suppress database logs during command loading
    loadCommands(commandsPath);
    suppressDatabaseLogs = false; // Re-enable database logs
} else {
    console.error('  \x1b[31m[ERROR]\x1b[0m Commands directory not found!', commandsPath);
    process.exit(1);
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

// Exit if no commands loaded
if (commandStats.successful === 0) {
    log('ERROR', 'No commands to deploy. Exiting...\n', 2);
    process.exit(1);
}

displayHeaderColored('DEPLOYMENT', 'cyan');

// Construct REST module
const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);

// Deploy commands 
(async () => {
    try {
        log('INFO', `Starting deployment of ${commands.length} command(s)...`);
        log('INFO', 'Connecting to Discord API...');

        let data;
        const deployStartTime = Date.now();

        if (isGuildDeploy) {
            log('INFO', 'Deploying to guild (instant updates)...');
            data = await rest.put(
                Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
                { body: commands }
            );
        } else {
            log('INFO', 'Deploying globally (may take up to 1 hour)...');
            data = await rest.put(
                Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
                { body: commands }
            );
        }
        
        const deployTime = Date.now() - deployStartTime;
        
        displayTableHeaderColored('DEPLOYMENT SUCCESS', 'green');
        console.log(formatRow('Commands Deployed:', data.length, '\x1b[32m'));
        console.log(formatRow('Deployment Mode:', isGuildDeploy ? 'Guild (instant)' : 'Global (1 hour)'));
        console.log(formatRow('Deploy Time:', `${deployTime}ms`));
        console.log(formatRow('Total Time:', `${Date.now() - startTime}ms`));
        if (isGuildDeploy) {
            console.log(formatRow('Guild ID:', process.env.DISCORD_GUILD_ID));
        }
        console.log(formatRow('Timestamp:', new Date().toLocaleString()));
        displayTableFooter();
        
        if (isGuildDeploy) {
            log('OK', 'Commands are now available in the target guild!\n', 4);
        } else {
            log('OK', 'Commands will be available globally within 1 hour.\n', 4);
        }
        
        // List deployed commands
        displayTableHeaderColored('DEPLOYED COMMANDS', 'cyan');
        
        data.forEach((cmd, index) => {
            const num = (index + 1).toString().padStart(2);
            const cmdName = cmd.name.padEnd(20); // 20 chars for command name
            
            // Description: 43 chars (truncate or pad)
            let cmdDesc = cmd.description;
            if (cmdDesc.length > 41) {
                cmdDesc = cmdDesc.substring(0, 38) + '...';
            } else {
                cmdDesc = cmdDesc.padEnd(41);
            }
            
            console.log(`│  ${num}. \x1b[36m/${cmdName}\x1b[0m ${cmdDesc}│`);
        });
        
        displayTableFooter();
        
    } catch (error) {
        displayTableHeaderColored('DEPLOYMENT FAILED', 'red');
        console.log(formatRow('Error:', error.message, '\x1b[31m'));
        displayTableFooter();

        log('ERROR', 'Deployment failed', 2, error);
        console.log('');
        
        // Common error suggestions
        log('INFO', 'Common issues:');
        console.log('    1. Check your DISCORD_TOKEN is correct');
        console.log('    2. Verify DISCORD_CLIENT_ID matches your bot');
        console.log('    3. Ensure bot has proper permissions');
        console.log('    4. Check if DISCORD_GUILD_ID exists (if using guild deploy)\n');
        
        process.exit(1);
    }
})();