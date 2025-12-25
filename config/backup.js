const fs = require('fs');
const path = require('path');
const { log, logWithTimestamp } = require('../utils/formatters.js');
const { db } = require('../config/database.js');

const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups'); // config/../data/backups
const BACKUP_STATE_FILE = path.join(__dirname, '..', 'data', 'last_backup.json');
const DB_PATH = path.join(__dirname, '..', 'data', 'bot.db');

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

    try {
        // Check if database file exists
        if (!fs.existsSync(DB_PATH)) {
            log('WARN', 'Database file not found, skipping backup');
            return false;
        }

        // Checkpoint WAL to merge changes into main DB
        // This ensures the backup contains all recent data
        try {
            db.pragma('wal_checkpoint(TRUNCATE)');
            log('OK', 'WAL checkpoint completed', 4);
        } catch (error) {
            log('WARN', 'WAL checkpoint failed, backup may be incomplete', 4, error);
        }

        // Copy database file
        fs.copyFileSync(DB_PATH, backupPath);
        
        const stats = fs.statSync(backupPath);
        const fileSizeKB = (stats.size / 1024).toFixed(2);

        log('OK', 'Database backed up successfully', 4);
        log('INFO', `File: ${backupFilename}`, 6);
        log('INFO', `Size: ${fileSizeKB} KB\n`, 6);

        // Verify backup integrity
        if (!verifyBackup(backupPath)) {
            log('ERROR', 'Backup verification failed!', 4);
            return false;
        }

        log('OK', 'Backup verified successfully\n', 4);
        
        // Save backup timestamp
        const backupState = {
            lastBackup: Date.now(),
            lastBackupDate: new Date().toISOString(),
            backupFile: backupFilename,
            fileSize: stats.size,
            verified: true
        };
        fs.writeFileSync(BACKUP_STATE_FILE, JSON.stringify(backupState, null, 2));

        // Cleanup old backups (keep last 3)
        cleanupOldBackups(3);

        return true;
    } catch (error) {
        log('ERROR', `Backup failed: ${error.message}\n`, 4);
        
        // Clean up failed backup file if it exists
        if (fs.existsSync(backupPath)) {
            try {
                fs.unlinkSync(backupPath);
            } catch (cleanupError) {
                log('WARN', 'Could not clean up failed backup file', 4, cleanupError);
            }
        }

        return false;
    }
}

/**
 * Verify backup file integrity
 */
function verifyBackup(backupPath) {
    try {
        // Check file exists and has size > 0
        const stats = fs.statSync(backupPath);
        if (stats.size === 0) {
            log('ERROR', 'Backup file is empty', 6);
            return false;
        }

        // Check SQLite header
        const fd = fs.openSync(backupPath, 'r');
        const buffer = Buffer.alloc(16);
        fs.readSync(fd, buffer, 0, 16, 0);
        fs.closeSync(fd);

        const header = buffer.toString('ascii');
        if (!header.startsWith('SQLite format 3')) {
            log('ERROR', 'Invalid SQLite database header', 6);
            return false;
        }

        // Normally this would be enough for basic verification.
        // For more thorough verification, we can try to open and query the DB.
        // Try to open the backup as SQLite database
        const Database = require('better-sqlite3');
        const testDb = new Database(backupPath);

        // Disable WAL mode for backup verification
        // This prevents creating -wal/-shm backup files accidentally 
        testDb.pragma('journal_mode = DELETE');

        // Try a simple query to verify it's a valid database
        const result = testDb.prepare('SELECT COUNT(*) as count FROM users').get();
        testDb.close();

        // Clean up any -wal/-shm files created during verification
        const walPath = backupPath + '-wal';
        const shmPath = backupPath + '-shm';

        if (fs.existsSync(walPath)) {
            fs.unlinkSync(walPath);
        }

        if (fs.existsSync(shmPath)) {
            fs.unlinkSync(shmPath);
        }

        return result !== undefined;
    } catch (error) {
        log('ERROR', 'Backup verification failed', 6, error);
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
        
        if (backups.length <= keepCount) {
            return; // Nothing to delete
        }

        const toDelete = backups.slice(keepCount);
        let deletedSize = 0;

        toDelete.forEach(backup => {
            const stats = fs.statSync(backup.path);
            deletedSize += stats.size;
            fs.unlinkSync(backup.path);
            log('OK', `Removed old backup: ${backup.name}`, 4);
        });

        if (deletedSize > 0) {
            const freedMB = (deletedSize / (1024 * 1024)).toFixed(2);
            log('INFO', `Freed ${freedMB} MB`, 6);
        }

        console.log('');
    } catch (error) {
        log('WARN', 'Cleanup failed', 4, error);
    }
}

/**
 * Get backup statistics
 */
function getBackupStats() {
    try {
        const backups = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('bot.db.') && f.endsWith('.bak'))
            .map(f => {
                const stats = fs.statSync(path.join(BACKUP_DIR, f));
                return {
                    name: f,
                    size: stats.size,
                    date: stats.mtime
                };
            })
            .sort((a, b) => b.date - a.date); // Newest first

        const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

        return {
            count: backups.length,
            totalSize: totalSize,
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
            backups: backups
        };
    } catch (error) {
        log('ERROR', 'Failed to get backup stats', 4, error);
        return null;
    }
}

/**
 * Restore database from backup
 */
function restoreFromBackup(backupFilename) {
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    try {
        // Verify backup exists
        if (!fs.existsSync(backupPath)) {
            throw new Error('Backup file does not exist');
        }

        // Verify backup integrity before restoring
        if(!verifyBackup(backupPath)) {
            throw new Error('Backup file is corrupt');
        }

        // Create backup of current database before restoring
        const emergencyBackup = path.join(BACKUP_DIR, `emergency-backup-${Date.now()}.bak`);
        if (fs.existsSync(DB_PATH)) {
            fs.copyFileSync(DB_PATH, emergencyBackup);
            log('INFO', `Created emergency backup: ${path.basename(emergencyBackup)}`, 4);
        }

        // Close current database connection
        db.close();

        // Restore backup
        fs.copyFileSync(backupPath, DB_PATH);

        log('OK', `Database restored from: ${backupFilename}`, 4);
        log('WARN', 'Please restart the bot to use the restored database', 4);

        return true;
    } catch (error) {
        log('ERROR', 'Restore failed', 4, error);
        return false;
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
        const hoursSince = (timeSinceBackup / (1000 * 60 * 60)).toFixed(1);

        if (timeSinceBackup >= BACKUP_INTERVAL) {
            log('INFO', `Last backup: ${hoursSince} hours ago`, 4);
            return true;
        } else {
            const hoursUntilNext = ((BACKUP_INTERVAL - timeSinceBackup) / (1000 * 60 * 60)).toFixed(1);
            log('OK', `Backup not needed (last: ${hoursSince}h ago, next in: ${hoursUntilNext}h)\n`, 4);
            return false;
        }
    } catch (error) {
        log('WARN', 'Could not read backup state, proceeding with backup\n', 4, error);
        return true; // Backup if we can't tell
    }
}



/**
 * Initialize  backup system
 */
function initializeBackupSystem() {
    logWithTimestamp('INFO', 'Initializing backup system...');
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
    initializeBackupSystem,
    getBackupStats,
    restoreFromBackup,
    cleanupOldBackups
};