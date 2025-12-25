const { version } = require('../package.json');

const LOG_COLORS = {
    INFO: '\x1b[34m',   // Blue
    NOTE: '\x1b[34m',   // Blue
    WARN: '\x1b[33m',   // Yellow
    ADMIN: '\x1b[33m',  // Yellow
    ERROR: '\x1b[31m',  // Red
    FAILED: '\x1b[31m', // Red
    OK: '\x1b[32m',     // Green
    LOADED: '\x1b[32m',  // Green
    SUCCESS: '\x1b[32m', // Green
    CMD: '\x1b[35m'     // Magenta
}

/**
 * Format a table row with consistent padding
 * @param {string} label - Row label
 * @param {string|number} value - Row value
 * @param {string} color - Optional ANSI color code
 * @returns {string} Formatted row
 * @example formatRow('Uptime', '5 days', '\x1b[32m'); -> │  Uptime          5 days                                      │
 */
function formatRow(label, value, color = '') {
    const colors = {
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
        black: '\x1b[30m'
    };

    const colorCode = colors[color.toLowerCase()] || '';
    const valueStr = String(value);

    // Check if value already contains ANSI codes
    const hasAnsiCodes = /\x1b\[[0-9;]*m/.test(valueStr);

    // Calculate visible length (strip ANSI codes for measurement)
    const visibleValue = valueStr.replace(/\x1b\[\d+m/g, '');
    const visibleLength = visibleValue.length;

    // Label always 17 chars
    const labelPart = label.padEnd(17);

    // Padding calculation
    const paddingNeeded = Math.max(0, 50 - visibleLength);
    const padding = ' '.repeat(paddingNeeded);

    // Build the value part
    let valuePart;
    if (hasAnsiCodes) {
        // Already colored so use as is
        valuePart = valueStr + padding;
    } else if (color) {
        // Apply color
        valuePart = colorCode + valueStr + '\x1b[0m' + padding;
    } else {
        // No color
        valuePart = valueStr + padding;
    }

    return `│  ${labelPart}${valuePart}│`;
}

/**
 * Format uptime in human-readable format
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted uptime
 */
function formatUptime(ms) {
    if (!ms) return 'Just started';

    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / (1000 * 60)) % 60;
    const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

/**
 * Display ASCII banner with bot version
 */
function displayBanner() {
    const versionText = `Discord Bot - Version ${version} Alpha`;
    const paddedVersionText = versionText.padStart((65 + versionText.length) / 2).padEnd(65);
    
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

/**
 * Display a section header
 * @param {string} header - Header text
 */
function displayHeader(header) {
    console.log(`
┌─────────────────────────────────────────────────────────────────────┐        
│  ${header.padEnd(67)}│
└─────────────────────────────────────────────────────────────────────┘
        `);
}

/**
 * Display a section header with colored text
 * @param {string} header - Header text
 * @param {string} color - ANSI color code
 */
function displayHeaderColored(title, color) {
    const colors = {
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
        black: '\x1b[30m'
    };

    const titleStr = String(title);
    const colorCode = colors[color.toLowerCase()] || '';
    
    // Calculate visible length (strip ANSI codes for measurement)
    const visibleValue = titleStr.replace(/\x1b\[\d+m/g, '');
    const visibleLength = visibleValue.length;

    // Padding calculation
    const paddingNeeded = Math.max(0, 67 - visibleLength);
    const padding = ' '.repeat(paddingNeeded);

    // Build the colored title part
    const coloredTitle = colorCode + titleStr + '\x1b[0m' + padding;

    console.log(`
┌─────────────────────────────────────────────────────────────────────┐        
│  ${coloredTitle.padEnd(67)}│
└─────────────────────────────────────────────────────────────────────┘
        `);
}

/**
 * Display a table header with border
 * @param {string} title - Table title
 */
function displayTableHeader(title) {

    const titleStr = String(title);
    const colorCode = colors[color.toLowerCase()] || '';
    
    // Calculate visible length (strip ANSI codes for measurement)
    const visibleValue = titleStr.replace(/\x1b\[\d+m/g, '');
    const visibleLength = visibleValue.length;

    // Padding calculation
    const paddingNeeded = Math.max(0, 67 - visibleLength);
    const padding = ' '.repeat(paddingNeeded);

    // Build the colored title part
    const coloredTitle = colorCode + titleStr + '\x1b[0m' + padding;

    console.log(`
┌─────────────────────────────────────────────────────────────────────┐        
│  ${coloredTitle}│
├─────────────────────────────────────────────────────────────────────┤`);
}

/**
 * Display a table header with border with colored title
 * @param {string} title - Table title
 * @param {string} color - ANSI color code
 */
function displayTableHeaderColored(title, color) {
    const colors = {
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
        black: '\x1b[30m'
    };

    const titleStr = String(title);
    const colorCode = colors[color.toLowerCase()] || '';
    
    // Calculate visible length (strip ANSI codes for measurement)
    const visibleValue = titleStr.replace(/\x1b\[\d+m/g, '');
    const visibleLength = visibleValue.length;

    // Padding calculation
    const paddingNeeded = Math.max(0, 67 - visibleLength);
    const padding = ' '.repeat(paddingNeeded);

    // Build the colored title part
    const coloredTitle = colorCode + titleStr + '\x1b[0m' + padding;

    console.log(`
┌─────────────────────────────────────────────────────────────────────┐        
│  ${coloredTitle.padEnd(67)}│
├─────────────────────────────────────────────────────────────────────┤`);
}

/**
 * Display table footer
 */
function displayTableFooter() {
    console.log('└─────────────────────────────────────────────────────────────────────┘\n');
}

/**
 * Create a colored status indicator
 * @param {boolean} status isOnline - Online status
 * @returns {string} Colored status text
 */
function formatStatus(isOnline) {
    return isOnline ? '\x1b[32mOnline\x1b[0m' : '\x1b[31mOffline\x1b[0m';
}

/**
 * Format a file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format a timestamp
 * @param {Date|number} date - Date object or timestamp
 * @returns {string} Formatted date string
 */
function formatTimestamp(date) {
    return new Date(date).toLocaleString();
}

/**
 * Log with timestamp
 * @param {string} level - Log level (INFO, WARN, ERROR, OK)
 * @param {string} message - Log message
 * @param {number} indent - Number of spaces to indent (default: 2)
 * @param {Error} [error] - Optional error object
 * @example logWithTimestamp('INFO', 'Bot started successfully'); ->    [2024-06-01 12:00:00] [INFO] Bot started successfully
 */
function logWithTimestamp(level, message, indent = 2, error = null) {
    const timestamp = new Date().toLocaleString();
    const color = LOG_COLORS[level] || '';
    const prefix = ' '.repeat(indent);

    // Choose the appropriate console method based on log level and presence of error
    const logger = (level === 'ERROR' || level === 'WARN') ? console.error : console.log;
    logger(`${color}${prefix}[${timestamp}] [${level}]\x1b[0m ${message}`);
    
    if (error !== null) {
        console.error(`    Error type: ${error.name}`);
        if (process.env.NODE_ENV === 'development') {
            console.error(error.stack); // Full stack trace only in dev
        } else {
            console.error(`    Error message: ${error.message}`); // Minimal in production
        }
    }
}

/**
 * Log message with level
 * @param {string} level - Log level (INFO, WARN, ERROR, OK)
 * @param {string} message - Log message
 * @param {number} indent - Number of spaces to indent (default: 2)
 * @param {Error} [error] - Optional error object
 * @example log('INFO', 'Bot started successfully'); ->     [INFO] Bot started successfully
 */
function log(level, message, indent = 2, error = null) {
    const color = LOG_COLORS[level] || '';
    const prefix = ' '.repeat(indent);

    // Choose the appropriate console method based on log level and presence of error
    const logger = (level === 'ERROR' || level === 'WARN') ? console.error : console.log;
    logger(`${prefix}${color}[${level}]\x1b[0m ${message}`);

    if (error !== null) {
        console.error(`${' '.repeat(indent+2)}Error type: ${error.name}`);
        if (process.env.NODE_ENV === 'development') {
            console.error(error.stack); // Full stack trace only in dev
        } else {
            console.error(`${' '.repeat(indent+2)}Error message: ${error.message}`); // Minimal in production
        }
    }
}

module.exports = {
    formatRow,
    formatUptime,
    displayBanner,
    displayHeader,
    displayHeaderColored,
    displayTableHeader,
    displayTableHeaderColored,
    displayTableFooter,
    formatStatus,
    formatFileSize,
    formatTimestamp,
    log,
    logWithTimestamp,
    LOG_COLORS
};
