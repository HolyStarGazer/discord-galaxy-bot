# Galaxy Discord Bot

![Version](https://img.shields.io/badge/version-0.7.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2)
![License](https://img.shields.io/badge/license-MIT-green)

A feature-rich Discord bot built with discord.js featuring XP leveling, moderation tools, games, and automated database backups.

## Features

### Games & Entertainment

**Blackjack**
- `/blackjack <bet>` - Play blackjack against the dealer
    - Interactive button controls (Hit, Stand, Rules)
    - Blackjack pays 3:2, regular win pays 1:1
    - Real-time game state with card display
    - Bet between 10 - 10,000 points
    - Standard dealer rules (hits on 16, stands on 17)

**Points System**
- `/points [user]` - Check point balance and active games
- Earn points by winning blackjack games or the daily reward
- Starting balance: 1,000 points
- Points persist across bot restarts

**Fun Commands**
- `/say <message>` - Make the bot say anything you want
- `/roll [dice] [sides]` - Roll dice with customizable patterns (e.g., 2d20)
- `/spin <options...>` - Spin a wheel to randomly select from options

### Leveling System

**Leveling Commands**

- `/daily` - Claim daily XP and points rewards (100-150 XP, 100-200 points every 24 hours)
- `/leaderboard [limit]` - View the server's top users by XP and points
- `/level [user]` - Check you or another user's level, XP, rank, and progress

**Passive Features**
- Automatic XP gain on messages (15-25 XP, 60s cooldown)
- Level-up notification with celebrator messages
- XP progress tracking with virtual progress bars
- Rankings and leaderboards

### Admin Commands

**User Management**
- `/addxp <user> <ammount> [reason]` - Add or remove XP from users
- `/resetxp <user> [reason]` - Reset user's XP and level to 0
- `/setlevel <user> <level> [reason]` - Set a user's level directly
- `/setxp <user> <amount> [reason]` - Set a user's XP directly

**Points Management**
- `/addpoints <user> <amount> [reason]` - Add points to user
- `/setpoints <user> <amount> [reason]` - Set points for user

**Moderation**
- `/purge <amount> [user] [reason]` - Delete bulk messages (up to 100)

### Utility Commands

- `/userinfo [user]` - Display detailed information about a user

### System Features

**Interactive Console Commands**
Vim-style `:` commands for management:
- `:help` - Show available commands
- `:restart` - Restart the bot
- `:redeploy` - Deploy commands and restart
- `:status` - Show bot status
- `:stats` - Show detailed statistics
- `:backup` - Create manual database backup
- `:stop` - Gracefully stop the bot

**Process Management**
- Cross-platform start scripts (Windows, Mac, Linux)
- Automatic restart on crash
- Crash loop detection (stops after 5 crashes in 60 seconds)
- Graceful shutdown handling

**Security & Performance
- Environemnt variable validation on startup
- Command rate limiting (per-command configurable)
- Message rate limiting (100/minute per user)
- User data caching with automatic invalidation
- Database indexes for optimized queries
- Health monitoring (Discord, database, memory)

**Backup System**
- Automatic backups every 24 hours
- WAL checkpoint before backup (data integrity)
- Backup verification (validates SQLite header)
- Keeps last 3 backups
- Manual backup via `:backup` commadn

**Other Features**
- Smart command deployment (only deploys changed commands)
- Game session cleanup (auto-cleanup after 24 hours)
- Color-coded logging with timestamps
- Input sanitization for security

### Planned Features
- Blackjack (vs another player)
- Poker game (Texas Hold'em)
- Tic-tac-toe (vs AI or another player)
- Achievement system
- Level-up rewards and role assignments
- And more!

---

## Quick Setup

### Prerequisites
- Node.js Version: 18.0.0 or higher
- A Discord bot token from [Discord Developer Portal](https://discord.com/developers/applications)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/HolyStarGazer/discord-galaxy-bot.git
cd discord-galaxy-bot
```

2. Install dependencies
```bash
npm install
```

3. Create a new `.env` file in the root directory:
```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_id_here
DISCORD_GUILD_ID=your_server_id_here
```

4. Deploy slash commands to Discord:
```bash
node deploy-commands.js
```

5. Start the bot:
```bash
# Recommended (with auto-restart)
npm start
# Or
node start.js

# Development (no auto-restart)
npm run dev
# or
node index.js
```

---

## Getting Your Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application (or select an existing one)
3. Go to the "Bot" tab
4. Click "Reset Token" and copy your token
5. Enable **Message Content Intent** under "Privelileged Gateway Intents"
6. Paste token into your `.env` file

---

## Inviting the Bot to Your Server

1. In the Developer Portal, go to **OAuth2** -> **URL Generator**
2. Select scopes: 
    - `bot`
    - `applications.commands`
3. Select bot permissions:
    - Send Messages
    - Manage messages
    - Embed Links
    - Attach Files
    - Read Message History
    - Use Slash Commands
4. Copy the generated URL and open it in your browser
5. Select your server and authorize

---

## Documentation

- **[CHANGELOG.md](CHANGELOG.md)** - Version history and update
- **[DATABASE_GUIDE.md](docs/guides/DATABASE_GUIDE.md)** - Database schema and usage
- **[SLASH_COMMANDS_GUIDE.md](docs/guides/SLASH_COMMANDS_GUIDE.md)** - Adding new commands

---

## Project Structure

```
discord-galaxy-bot/
├── index.js                        # Main bot entry point
├── start.js                        # Cross-platform process manager
├── start-bot.bat                   # Windows start script
├── start-bot.sh                    # Unix/Mac start script
├── deploy-commands.js              # Command deployment script
├── package.json                    # Dependencies and scripts
├── .env                            # Environment variables (create this)
├── config/
│   ├── database.js                 # Database setup and migrations
│   └── backup.js                   # Backup system
├── data/
│   ├── bot.db                      # SQLite database (auto-generated)
│   ├── bot.db-wal                  # WAL journal (auto-generated)
│   ├── bot.db-shm                  # Shared memory (auto-generated)
│   ├── backups/                    # Automatic database backups
│   └── backup-state.json           # Backup state tracking
├── commands/
│   ├── admin/
│   │   ├── addxp.js                # Add/remove XP command
│   │   ├── setlevel.js             # Set level command
│   │   ├── setxp.js                # Set XP command
│   │   ├── resetxp.js              # Reset XP command
│   │   ├── addpoints.js            # Award points command
│   │   ├── setpoints.js            # Set points command
│   │   └── purge.js                # Bulk delete messages
│   ├── games/
│   │   ├── blackjack.js            # Blackjack game command
│   │   └── points.js               # Points balance command
│   ├── utility/
│   │   └── userinfo.js             # User information display
│   ├── fun/
│   │   ├── roll.js                 # Dice rolling
│   │   ├── say.js                  # Echo command
│   │   └── spin.js                 # Wheel spinner
│   └── leveling/
│       ├── level.js                # Level checker
│       ├── leaderboard.js          # XP & points rankings
│       └── daily.js                # Daily XP rewards
├── games/
│   └── blackjack/
│       └── blackjack-engine.js     # Blackjack game logic
├── utils/
│   ├── blackjack-handler.js        # Blackjack button handlers
│   ├── env-validator.js            # Environment validation
│   ├── error-handler.js            # Error handling utilities
│   ├── formatters.js               # Display utilities
│   ├── game-cleanup.js             # Game session cleanup
│   ├── health-monitor.js           # Health monitoring
│   ├── interactive-console.js      # Console command system
│   └── rate-limiter.js             # Rate limiting
└── docs/
    └── guides/
        ├── DATABASE_GUIDE.md
        ├── SLASH_COMMANDS_GUIDE.md
        └── ADMIN_COMMANDS_GUIDE.md
```

---

## Development

### Adding Commmands

1. Create file in `commands/category/mycommand.js`
2. Follow the command template (see [SLASH_COMMANDS_GUIDE.md](SLASH_COMMANDS_GUIDE.md))
3. Run `node deploy-commands.js`
4. Restart bot or use `:redeploy` console command

### Smart Deployment

The deploy script only updates changed commands:
```bash
# Smart deploy (only changed commands)
node deploy-commands.js

# Force deploy all commands
node deploy-commands.js --force
node deploy-commands.js -f

# Deploy globally (slower, up to 1 hour)
node deploy-commands.js --global
node deploy-commands.js -g

# Show whelp
node deploy-commands.js --help
```

### Database

- **Automatic migrations** - Schema updates run on startup
- **SQLite with WAL mode** - Better concurrency and performance
- **Automatic backups** - Every 24 hours to `data/backups/`
- **User caching** - 60-second TTL for frequently accessed data
- **Optimized indexes** - For XP, points, and level queries
- **Tables**: 
    - `users` - User data (XP, level, points, stats)
    - `game_sessions` - Active/completed game sessions
- **Views**: 
    - `leaderboard` - Cached rankings with XP and points
    - `active_blackjack_games` - Active games with age tracking

See [DATABASE_GUIDE.md](DATABASE_GUIDE.md) for schema details.

### Starting the Bot

Choose ONE method:
```bash
# Cross-platform with auto-restart (recommended)
npm start
node start.js

# Windows only
start-bot.bat

# Mac/Linux only
chmod +x start-bot.sh   # First time only
./start-bot.sh

# Development (no auto-restart)
npm run dev
node index.js
```

### Interactive Console Commands

While the bot is running, press `:` to enter command mode:
```
:help       - Show available commands
:restart    - Restart the bot
:redeploy   - Deploy commands and restart
:status     - Show bot status
:stats      - Show detailed statistics
:backup     - Create manual database backup
:stop       - Gracefully stop the bot
```

Press `ESC` to cancel command entry.

---

## Configuration

### XP Settings

Edit `index.js` to adjust XP rates:

```javascript
const xpGain = Math.floor(Math.random() * 11) + 15; // 15-25 XP
const cooldownTime = 60 // seconds
```

### Daily Rewards

Edit `commands/leveling/daily.js`

```javascript
const baseReward = 100;
const bonusReward = Math.floor(Math.random() * 51) // 0-50 bonus
```

### Blackjack Settings
Edit `commands/games/blackjack.js`
```javascript
.setMinValue(10)        // Minimum bet
.setMaxValue(10000)     // Maximum bet
```

Starting points balance in `config/database.js`
```SQL
points INTEGER DEFAULT 1000 NOT NULL
```

### Rate Limiting

Edit `utils/rate-limiter.js`
```javascript
const LIMITS = {
    default: { max: 5, window: 10000 },     // 5 commands per 10 seconds
    blackjack: { max: 3, window: 30000 },   // 3 games per 30 seconds
    daily: { max: 1, window: 5000 },        // 1 per 5 seconds
};
```

### Backup Settings

```javascript
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 HOURS
const keepCount = 3; // Number of backups to retain
```

### Crash Loop Detection
```javascript
const MAX_CRASHES = 5;              // Max crashes before script
const CRASH_WINDOW = 60 * 1000;     // Time window (60 seconds)
```

---

## Tech Stack

| Component | Technology |
| --------- | ---------- |
| Runtime | Node.js 18+ |
| Framework | discord.js v14 |
| Database | SQLite (better-sqlite3) |
| Environment | dotenv |

---

## Security Features

- **Environment Validation** - Validates required env vars on startup
- **SQL Injection Protection** - All queries used prepared statements
- **Input Sanitizations** - User IDs, usernames, and inputs are sanitized
- **Command Rate Limiting** - Per-command configurable limits
- **Message Rate limiting** - 100 messages/minute per user
- **Permission Checks** - Runtime verification for admin commands
- **Session Validation** - Game sessions verify ownership
- **Error Handling** - Graceful error recovery
- **Audit Logging** - All admin actions logged to console

---

## Troubleshooting

### Commands not appearing?
- Make sure you ran `node deploy-commands.js`
- For instant updates, set `DISCORD_GUILD_ID` in `.env`
- Use `--force` flag to redeploy all comands
- Wait up to 1 hour for global commands to propagate

### Database errors on startup
- Check database version: `sqlite3 data/bot.db "PRAGMA user_version;"`
- Force migration re-run: `sqlite3 data/bot.db "PRAGMA user_version = 1;"`
- Delete `data/bot.db` and restart the bot to recreate the database
- Check `data/` directory permissions

### Bot keeps crashing?
- Check console logs for error details
- Review crash loop detection output
- If crash loop detected, fix the issue before restarting
- Check memory usage with `:stats` command

### Blackjack button interactions failing?
- Check console logs for detailed errors
- Verify game sessions exists: `sqlite3 data/bot.db "SELECT * FROM game_sessions;"`
- Ensure database migration v2 completed successfully

### Bot not responding?
- Verify bot has `MessageContent` intent enabled in Developer Portal
- Check bot has proper permissions in server
- Review console for errors
- Ensure `.env` file is properly configured

### Rate limited messages?
- Default: 5 commands per 10 seconds per user
- Adjust limits in `utils/rate-limiter.js`
- Check `:stats` for current rate limit settings

### Purge command not working?
- Bot needs `Manage Messages` permission
- Messages older than 14 days cannot be deleted (Discord limitation)
- Maximum 100 messages per command

### Points not appearing in leaderboard?
- Recreate view: `sqlite3 data/bot.db "DROP VIEW leaderboard;"`
- Restart bot to recreate view with points column
- Check if points column exists: `sqlite3 data/bot.db ".schema users"`

### Backup system issues?
- Check `data/backups/` directory exists
- Review `data/last_backup.json` for backup state
- Use `:backup` command for manual backup
- Check disk space availability

For more help, see documentation or open an issue on GitHub.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Links

- [Discord.js Documentation](https://discord.js.org/)
- [Discord Developer Portal](https://discord.com/developers/applications)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3)
- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)

---

## Roadmap

### Planned Features
- Blackjack game (vs players)
- Tic-tac-toe (vs AI or players)
- Achievement system
- Level-up rewards and role assignments
- Server statistics dashboard
- User profile customization
- Custom notifications

---

## Acknowledgements

- Built with [discord.js](https://discord.js.org/)
- Database powered by [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- Inspired by community Discord bots

---

**Made with ❤️ using discord.js**

**Status**: In active development