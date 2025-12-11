# Database Backups

Simple guide to understanding and managing your bot's database backups.

---

## Quick Overview

Your bot automatically backs up its database every 24 hours. Backups are stored in the `data/backups/` folder and help you recover data if something goes wrong.

---

## How It Works

### Automatic Backups

The bot checks every hour if a backup is needed:
- **First run**: Creates a backup immediately
- **Every 24 hours**: Creates a new backup
- **After restart**: Checks if 24 hours have passed and backs up if needed

### What Gets Backed Up

- User XP and levels
- Message counts
- Game session data
- All database tables and views

### Storage

```
data/
├── bot.db                          # Main database
├── last_backup.json                # Tracks last backup time
└── backups/
    ├── bot.db.2024-12-10_15-30-45.bak
    ├── bot.db.2024-12-09_15-30-45.bak
    └── bot.db.2024-12-08_15-30-45.bak
```

**File naming**: `bot.db.YYYY-MM-DD_HH-MM-SS.bak`

---

## Backup Logs

When the bot creates a backup, you'll see:

```
  [INFO] Checking database backup status...
  [INFO] Last backup: 25.3 hours ago
  [INFO] Performing startup backup...

  [OK] Database backed up successfully
  [INFO]   File: bot.db.2024-12-10_15-30-45.bak
  [INFO]   Size: 142.50 KB
```

---

## Configuration

### Change Backup Frequency

Edit `index.js`:

```javascript
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

// Examples:
// 12 hours: 12 * 60 * 60 * 1000
// 6 hours:  6 * 60 * 60 * 1000
// 1 hour:   1 * 60 * 60 * 1000
```

### Change Number of Backups Kept

Edit `index.js` in the `cleanupOldBackups()` call:

```javascript
cleanupOldBackups(3);  // Keeps last 3 backups

// Examples:
// Keep 7 (one week):   cleanupOldBackups(7);
// Keep 30 (one month): cleanupOldBackups(30);
```

---

## Testing Backups

### Quick Test (Node.js)

```bash
node scripts/test-backup.js
```

**Output:**
```
=== Backup Integrity Test ===

Found 3 backup(s):

1. bot.db.2024-12-10_15-30-45.bak
   Size: 142.50 KB
   Date: 12/10/2024, 3:30:45 PM
   Users: 5
   Sessions: 12
   Status: ✅ Valid

Last backup: 2.3 hours ago
Status: ✅ Backup schedule is current

=== All backups are valid ===
```

---

## Restoring a Backup

### Option 1: Manual (Simple)

```bash
# 1. Stop the bot (Ctrl+C)

# 2. Backup current database (safety)
cp data/bot.db data/bot.db.before-restore

# 3. Copy backup over main database
cp data/backups/bot.db.2024-12-09_15-30-45.bak data/bot.db

# 4. Start the bot
node index.js
```

---

## Backup Files

### File Format

Backups are standard SQLite database files with a `.bak` extension.

### File Size

- Typical size: **50-500 KB** depending on users and data
- Grows over time as more users join
- Monitor if exceeding **1 MB** (check for issues)

### Location

**Default**: `data/backups/`

To change location, edit `index.js`:
```javascript
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');
// Change to:
const BACKUP_DIR = path.join(__dirname, 'my-backup-folder');
```

---

## Important Notes

### Backup Retention

By default, the bot keeps only the **last 3 backups**. Older backups are automatically deleted to save disk space.

**If you need long-term backups:**
1. Manually copy backups to another location
2. Increase retention count (see Configuration above)

### Backup Timing

Backups happen based on **time elapsed**, not specific times:
- If bot starts at 3:00 PM, next backup at 3:00 PM next day
- Survives restarts (tracks last backup time)

### Manual Backups

To create a backup immediately without waiting 24 hours:

```bash
# 1. Stop the bot

# 2. Copy the database
cp data/bot.db data/backups/bot.db.manual-backup-$(date +%Y-%m-%d).bak

# 3. Start the bot
```

---

## Best Practices

### Regular Monitoring

Check backups weekly:
```bash
node scripts/test-backup.js
```

### Before Major Changes

Create a manual backup before:
- Updating the bot
- Running database migrations
- Making bulk changes (mass XP changes, resets)

### Off-Site Backups

For critical servers, periodically copy backups to:
- External drive
- Cloud storage (Google Drive, Dropbox)
- Another computer

**Example weekly backup:**
```bash
# Copy all backups to external drive
cp -r data/backups/ /mnt/external-drive/discord-bot-backups/
```

---

## Troubleshooting

### "No backups found"

**Cause:** Backup directory doesn't exist or bot hasn't run for 24 hours yet

**Fix:**
1. Check if `data/backups/` folder exists
2. Wait for bot to run (creates backup on first run)
3. Check console logs for backup messages

### "Backup failed"

**Cause:** Permission issues or disk full

**Fix:**
1. Check disk space: `df -h` (Linux/Mac) or check drive properties (Windows)
2. Check folder permissions
3. Review console error message

### "Backups are corrupted"

**Cause:** Disk issues or incomplete backup

**Fix:**
1. Run integrity test: `node scripts/test-backup.js`
2. Delete corrupted backups
3. Wait for next automatic backup
4. Check disk health

### Backup shows "0 users"

**Cause:** Backup was created before any users joined

**Fix:**
- This is normal for fresh installs
- Later backups will have user data

---

## Backup State File

The bot tracks backup timing in `data/last_backup.json`:

```json
{
  "lastBackup": 1733849145000,
  "lastBackupDate": "2024-12-10T15:45:45.000Z",
  "backupFile": "bot.db.2024-12-10_15-45-45.bak"
}
```

**Fields:**
- `lastBackup` - Unix timestamp (milliseconds)
- `lastBackupDate` - Human-readable date
- `backupFile` - Most recent backup filename

**Don't edit this file manually!** The bot manages it automatically.

---

## Tips

### Check Backup Age

```bash
# Quick check
cat data/last_backup.json
```

### List All Backups

```bash
# Linux/Mac
ls -lh data/backups/

# Windows
dir data\backups
```

### Backup Size Trend

```bash
# See size of each backup (Linux/Mac)
ls -lh data/backups/*.bak

# Compare sizes
du -h data/backups/
```

If backups are growing rapidly, investigate:
- Spam users (delete spam accounts)
- Game session accumulation (future cleanup feature)

---

## Emergency Recovery

If your database gets corrupted:

1. **Don't panic** - You have backups!
2. **Stop the bot** immediately
3. **Find latest backup:**
   ```bash
   ls -lt data/backups/
   ```
4. **Restore it:**
   ```bash
   cp data/backups/bot.db.2024-12-10_15-45-45.bak data/bot.db
   ```
5. **Restart bot:**
   ```bash
   node index.js
   ```

**Data loss:** Only data since last backup (max 24 hours)

---

## Related Documentation

- [DATABASE_GUIDE.md](docs/guides/DATABASE_GUIDE.md) - Database schema

---

## FAQ

**Q: Do backups run if the bot is offline?**  
A: No. Backups only happen when the bot is running. The bot will create a backup when it starts up if more than 24 hours have passed.

**Q: Can I disable backups?**  
A: Yes, but **not recommended**. Comment out `initializeBackupSystem();` in `index.js` (line ~322).

**Q: Are backups encrypted?**  
A: No. Backups are standard SQLite files. If security is a concern, encrypt your backup folder or store backups securely.

**Q: What happens if disk is full?**  
A: Backup fails gracefully with an error message. Bot continues running. Free up space and wait for next backup.

**Q: Can I restore while bot is running?**  
A: **No!** Always stop the bot first to avoid database corruption.

**Q: How much disk space do I need?**  
A: For 3 backups of ~150 KB each, less than 1 MB. Most systems have plenty of space.

**Q: Do backups affect bot performance?**  
A: No. Backups are simple file copies that take milliseconds.

---

**Last Updated:** December 10, 2025