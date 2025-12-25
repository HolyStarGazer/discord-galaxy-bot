const readline = require('readline');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const version = require('../package.json').version;
const { displayTableHeader, displayTableHeaderColored,  displayTableFooter, formatRow, formatUptime, log, logWithTimestamp } = require('./formatters');
const { backupDatabase, getBackupStats } = require('../config/backup');

let rl = null;
let client = null;
let db = null;
const BACKUP_STATE_FILE = path.join(__dirname, '..', 'data', 'backup-state.json');

async function redeployCommands() {
    logWithTimestamp('WARN', 'Deploying commands...\n');

    return new Promise((resolve, reject) => {
        const deployProcess = spawn('node', ['deploy-commands.js'], {
            stdio: 'inherit'
        });

        deployProcess.on('close', (code) => {
            if (code === 0) {
                log('OK', 'Commands deployed successfully', 4);
                restartBot();
                resolve();
            } else {
                log('ERROR', `Deploy failed with code ${code}`, 4);
                reject(new Error('Deploy failed'));
            }
        });

        deployProcess.on('error', (error) => {
            logWithTimestamp('ERROR', `Deploy process error: ${error.message}`);
            reject(error);
        });
    });
}

function setupInteractiveCommands(clientInstance, dbInstance) {
    logWithTimestamp('INFO', 'Initializing interactive command console...');

    // Detect if running in VSCode integrated terminal
    if (process.env.TERM_PROGRAM === 'vscode') {
        log('WARN', 'Commands not fully supported in VSCode integrated terminal (i.e. :restart, :redeploy)', 4);
    }

    rl = readline.createInterface({
        input: process.stdin,
        prompt: ''
    });
    client = clientInstance;
    db = dbInstance;

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
                executeInteractiveCommand(command, rl, client, db).catch(err => {
                    log('ERROR', `Command execution failed: ${err.message}`, 4);
                });
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
            process.stdout.write('\n  \x1b[33m[WARN]\x1b[0m Command cancelled\n');
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

    log('OK', 'Interactive commands enabled. Type \':\' to enter command mode.\n', 4);
}

async function executeInteractiveCommand(command) {
    logWithTimestamp('CMD', `Executing command: ${command}`);

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
            log('ERROR', `Unknown command: ${command}`, 4);
            log('INFO', 'Type :help for available commands.', 4);
    }
}

function showInteractiveHelp() {
    displayTableHeaderColored('INTERACTIVE COMMANDS', 'cyan');
    console.log('│  \x1b[33m:help\x1b[0m       - Show this help message                               │');
    console.log('│  \x1b[33m:restart\x1b[0m    - Restart the bot                                      │');
    console.log('│  \x1b[33m:redeploy\x1b[0m   - Deploy commands and restart                          │');
    console.log('│  \x1b[33m:status\x1b[0m     - Show bot status                                      │');
    console.log('│  \x1b[33m:stats\x1b[0m      - Show detailed statistics                             │');
    console.log('│  \x1b[33m:backup\x1b[0m     - Create manual database backup                        │');
    console.log('│  \x1b[33m:stop\x1b[0m       - Gracefully stop the bot                              │');
    console.log('│                                                                     │');
    console.log('│  Press \x1b[33mESC\x1b[0m to cancel command entry                                  │');
    displayTableFooter();
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
        log('INFO', 'Closing database connection...', 4);
        db.close();
    }

    log('INFO', 'Starting new instance...', 4);
    setTimeout(() => process.exit(0), 1000);  // Code 0 = restart
}

function showBotStatus() {
    displayTableHeaderColored('BOT STATUS', 'cyan');
    console.log(formatRow('Status:', client.isReady() ? 'Online' : 'Offline', client.isReady() ? '\x1b[32m' : '\x1b[31m'));
    console.log(formatRow('Uptime:', formatUptime(client.uptime)));
    console.log(formatRow('User:', client.user?.tag || 'Not logged in'));
    console.log(formatRow('Guilds:', client.guilds.cache.size));
    console.log(formatRow('Users:', client.users.cache.size));
    console.log(formatRow('Channels:', client.channels.cache.size));
    console.log(formatRow('Commands:', client.commands.size));
    displayTableFooter();
}

function showBotStats() {
    displayTableHeaderColored('DETAILED STATISTICS', 'cyan');
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

    const backupStats = getBackupStats();
    if (backupStats) {
        console.log(formatRow('Backups:', `${backupStats.count} files`));
        console.log(formatRow('Backup Size:', `${backupStats.totalSizeMB} MB`));

        if (backupStats.backups.length > 0) {
            const latestBackup = backupStats.backups[0];
            const hoursAgo = ((Date.now() - latestBackup.date) / (1000 * 60 * 60)).toFixed(2);
            console.log(formatRow('Latest Backup:', `${hoursAgo} hours ago`));
        }
    }

    displayTableFooter();
}

function gracefulShutdown(signal) {
    logWithTimestamp('WARN', `Received ${signal}, shutting down gracefully...`);

    // Close readline interface
    if (rl) {
        rl.close();
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
    }

    // Close Discord client
    client.destroy();

    // Close database
    if (db) {
        log('INFO', 'Closing database connection...', 4);
        db.close();
    }

    log('OK', 'Shutdown complete.', 4);
    setTimeout(() => process.exit(1), 1000);  // Code 1 = shutdown
}

module.exports = {
    setupInteractiveCommands,
    gracefulShutdown
};