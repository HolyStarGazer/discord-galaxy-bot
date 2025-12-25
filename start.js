const { spawn } = require('child_process');
const path = require('path');
const { displayHeaderColored, log, logWithTimestamp } = require('./utils/formatters');

const scriptPath = path.join(__dirname, 'index.js');

// Crash loop detection settings
const MAX_CRASHES = 5;
const CRASH_WINDOW = 60 * 1000; // 1 minute
const crashTimes = [];

let child = null;
let shouldRestart = true;
let intentionalRestart = false;

displayHeaderColored('Galaxy Discord Bot - Process Manager', 'cyan');

/**
 * Check if we're in a crash loop
 * Returns true if too many crashes in short time
 */
function isInCrashLoop() {
    const now = Date.now();

    // Remove crashes outside the window
    while (crashTimes.length > 0 && (now - crashTimes[0]) > CRASH_WINDOW) {
        crashTimes.shift();
    }

    return crashTimes.length >= MAX_CRASHES;
}

/**
 * Record a crash
 */
function recordCrash() {
    crashTimes.push(Date.now());
}

/**
 * Clear crash history (called on successful startup)
 */
function clearCrashHistory() {
    crashTimes.length = 0;
}

function startBot() {
    logWithTimestamp('INFO', 'Starting Galaxy Discord Bot...');
    console.log('─'.repeat(50));

    intentionalRestart = false;
    const startTime = Date.now();
    
    child = spawn('node', [scriptPath], {
        stdio: 'inherit',
        env: { ...process.env, BOT_MANAGED: 'true' }
    });

    child.on('exit', (code) => {
        const runTime = Date.now() - startTime;
        const runTimeSeconds = (runTime / 1000).toFixed(1);

        console.log('');
        console.log('─'.repeat(50));
        logWithTimestamp('INFO', `Bot exited with code ${code}`);
        
        // Don't restart if wrapper is shutting down
        if (!shouldRestart) {
            logWithTimestamp('INFO', 'Wrapper shutting down. Goodbye!');
            process.exit(0);
        }
        
        // Handle different exit scenarios
        if (code === 0) {
            // Exit code 0 = intentional restart
            logWithTimestamp('INFO', 'Restart requested. Restarting in 2 seconds...');
            setTimeout(startBot, 2000);
        } else if (code === 1) {
            // Exit code 1 = clean shutdown
            logWithTimestamp('INFO', 'Clean shutdown. Goodbye!');
            process.exit(0);
        } else {
            // Other codes = crash
            recordCrash();

            // Check for crash loop
            if (isInCrashLoop()) {

            }

            const remaintaingAttempts = MAX_CRASHES - crashTimes.length;
            logWithTimestamp('WARN', 'Crash detected! Restarting in 5 seconds...');
            log('INFO', `Remaining restart attempts: ${remaintaingAttempts}`, 4);
            setTimeout(startBot, 5000);
        }
    });

    child.on('error', (error) => {
        logWithTimestamp('ERROR', 'Failed to start bot', 4, error);
        recordCrash();

        if (isInCrashLoop()) {
            logWithTimestamp('ERROR', 'Crash loop detected. Stopping.');
            process.exit(1);
        }

        if (shouldRestart) {
            setTimeout(startBot, 5000);
        }
    });
}

// Handle Ctrl+C 
process.on('SIGINT', () => {
    console.log('');
    logWithTimestamp('WARN', 'Received SIGINT, shutting down...');
    shouldRestart = false;
    
    if (child) {
        child.kill('SIGINT');
    } else {
        process.exit(0);
    }
});

process.on('SIGTERM', () => {
    console.log('');
    logWithTimestamp('WARN', 'Received SIGTERM, shutting down...');
    shouldRestart = false;
    
    if (child) {
        child.kill('SIGTERM');
    } else {
        process.exit(0);
    }
});

// Start the bot
startBot();