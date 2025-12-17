const fs = require('fs');
const path = require('path');
const { log, logWithTimestamp } = require('../utils/formatters.js');

const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups'); // config/../data/backups
const BACKUP_STATE_FILE = path.join(__dirname, '..', 'data', 'last_backup.json');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    log('OK', 'Created backup directory', 4);
}

/**
 * Perform database backup
 */
function backupDatabase() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]; // YYYY-MM-DD
    const timeString = new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('Z')[0]; // HH-MM-SS
    const backupFilename = `bot.db.${timestamp}_${timeString}.bak`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);
    const dbPath = path.join(__dirname, '..', 'data', 'bot.db');

    try {
        // Check if database file exists
        if (!fs.existsSync(dbPath)) {
            log('WARN', 'Database file not found, skipping backup');
            return false;
        }

        // Copy database file
        fs.copyFileSync(dbPath, backupPath);
        
        const stats = fs.statSync(backupPath);
        const fileSizeKB = (stats.size / 1024).toFixed(2);

        log('OK', 'Database backed up successfully', 4);
        log('INFO', `File: ${backupFilename}`, 6);
        log('INFO', `Size: ${fileSizeKB} KB\n`, 6);
        
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
        log('ERROR', `Backup failed: ${error.message}\n`, 4);
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
            logWithTimestamp('INFO', `Removed old backup: ${backup.name}`);
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
            log('INFO', 'No previous backup found', 4);
            return true;
        }

        const backupState = JSON.parse(fs.readFileSync(BACKUP_STATE_FILE, 'utf-8'));
        const lastBackup = backupState.lastBackup || 0;
        const timeSinceBackup = (Date.now() - lastBackup);

        if (timeSinceBackup >= BACKUP_INTERVAL) {
            log('INFO', `Last backup: ${(timeSinceBackup / (1000 * 60 * 60)).toFixed(1)} hours ago`, 4);
            return true;
        } else {
            log('OK', `Backup not needed (last backup: ${(timeSinceBackup / (1000 * 60 * 60)).toFixed(1)} hours ago)`, 4);
            return false;
        }
    } catch (error) {
        log('WARN', 'Could not read backup state, proceeding with backup', 4, error);
        return true; // Backup if we can't tell
    }
}

/**
 * Initialize  backup system
 */
function initializeBackupSystem() {
    log('INFO', 'Initializing backup system...');
    log('INFO', 'Checking database backup status...', 4);
    
    // Check if backup is needed at startup
    if (shouldBackup()) {
        log('INFO', 'Performing startup backup...', 4);
        backupDatabase();
    }

    const checkInterval = 60 * 60 * 1000; // 1 hour
    
    // Check if backup is needed
    setInterval(() => {
        logWithTimestamp('INFO', 'Performing scheduled backup check...', 4);
        if (shouldBackup()) {
            backupDatabase();
        }
    }, checkInterval); // Check every hour

    log('OK', 'Backup system initialized and running.\n', 4);
}

module.exports = {
    backupDatabase,
    initializeBackupSystem
};