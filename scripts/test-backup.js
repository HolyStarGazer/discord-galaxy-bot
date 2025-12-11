const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

console.log('=== Backup Integrity Test ===\n');

const backupDir = path.join(__dirname, '..', 'data', 'backups');

if (!fs.existsSync(backupDir)) {
    console.log('❌ No backups directory found');
    process.exit(1);
}

const backups = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.bak'))
    .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

if (backups.length === 0) {
    console.log('❌ No backups found');
    process.exit(1);
}

console.log(`Found ${backups.length} backup(s):\n`);

let allValid = true;

backups.forEach((backup, index) => {
    const stats = fs.statSync(backup.path);
    const sizeKB = (stats.size / 1024).toFixed(2);
    
    console.log(`${index + 1}. ${backup.name}`);
    console.log(`   Size:\t${sizeKB} KB`);
    console.log(`   Date:\t${new Date(backup.time).toLocaleString()}`);
    
    try {
        const db = new Database(backup.path, { readonly: true });
        
        // Test query
        db.prepare('SELECT 1 as test').get();
        
        // Get stats
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
        const sessionCount = db.prepare('SELECT COUNT(*) as count FROM game_sessions').get();
        
        console.log(`   Users:\t${userCount.count}`);
        console.log(`   Sessions:\t${sessionCount.count}`);
        console.log('   Status:\t✅ Valid\n');
        
        db.close();
    } catch (error) {
        console.log(`   Status:\t❌ CORRUPTED - ${error.message}\n`);
        allValid = false;
    }
});

// Check last backup time
try {
    const stateFile = path.join(__dirname, '..', 'data', 'last_backup.json');
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    const hoursAgo = ((Date.now() - state.lastBackup) / (1000 * 60 * 60)).toFixed(1);
    
    console.log(`Last backup: ${hoursAgo} hours ago`);
    
    if (hoursAgo < 25) {
        console.log('Status: ✅ Backup schedule is current\n');
    } else {
        console.log('Status: ⚠️  Backup is overdue\n');
    }
} catch (error) {
    console.log('⚠️  Could not read backup state\n');
}

if (allValid) {
    console.log('=== ✅ All backups are valid ===');
    process.exit(0);
} else {
    console.log('=== ❌ Some backups are corrupted ===');
    process.exit(1);
}