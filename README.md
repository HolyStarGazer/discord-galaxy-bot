# Galaxy Discord Bot

![Version](https://img.shields.io/badge/version-0.3.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2)
![License](https://img.shields.io/badge/license-MIT-green)

A feature-rich Discord bot built with discord.js featuring user interaction commands, dice rolling, and a player leveling system with games

## Features

### Current Commands

**Utility Commands**

- `/userinfo [user]` - Display detailed information about a user

**Fun Commands**

- `/say <message>` - Make the bot say anything you want
- `/roll [dice] [sides]` - Roll dice with customizable patterns (e.g., 2d20)

**Leveling Commands**

- `/daily` - Claim daily XP rewards (100-150 XP every 24 hours)
- `/leaderboard [limit]` - View the server's top users by XP
- `/level [user]` - Check you or another user's level, XP, rank, and progress

**Passive Features**

- Automatic XP gain on messages (15-25 XP per message, 60s cooldown)
- Level-up notification with celebratory messages
- XP progress tracking with visual progress bars
- Professional startup banner with ASCII art
- Color-coded console logging with timestamps
- Database health check on startup

### Planned Features
- Blackjack (vs AI or another player)
- Tic-tac-toe (vs AI or another player)
- Achievement system
- Economy system with virtual currency
- Level-up rewards and role assignments
- And more!

## Tech Stack

- **Language**: Javascript (Node.js)
- **Library**: discord.js v14
- **Database**: SQLite with better-sqlite3
- **Environment**: dotenv for configuration

## Project Structure

```
discord-galaxy-bot/
├── .env                        # Environment variables (not committed)
├── .gitignore                  # Git ignore rules
├── package.json                # Dependencies
├── index.js                    # Main bot file
├── deploy-commands.js          # Command registration script
├── config/
│   └── database.js             # Database setup and helper functions
├── data/
│   └── bot.db                  # SQLite database (auto-generated)
├── database-migrations
│   └── 001-add-daily_claim.js  # Database migration for daily rewards
└── commands/
    ├── utility/
    │   └── userinfo.js
    ├── fun/
    │   └── roll.js
    │   ├── say.js
    └── leveling/
        ├── level.js
        ├── leaderboard.js
        └── daily.js
```

## Setup

### Prerequisites
- Node.js (Version: 0.3.0 or higher)
- A discord bot token from [Discord Developer Portal](https://discord.com/developers/applications)

### Installation

1. Clone the repository:
```bash
git clone
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

4. Create the data directory
```bash
mkdir data
```

5. Initialize the database
```bash 
node config/database.js
```

6. Deploy slash commands to Discord:
```bash
node deploy-commands.js
```

7. Start the bot:
```bash
node index.js
```

## Getting Your Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application (or select an existing one)
3. Go to the "Bot" tab
4. Click "Reset Token" and copy your token
5. Paste it into your `.env` file

## Inviting the Bot to Your Server

1. In the Developer Portal, go to OAuth2 -> URL Generator
2. Select scopes: `bot`, `applications.commands`
3. Select bot permissions:
    - Send Messages:
    - Embed Links
    - Attach Files
    - Read Message History
    - Use Slash Commands
4. Copy the generated URL and open it in your browser
5. Select your server and authorize

## XP & Leveling System

### How It Works

**XP Gain:**
- Earn 15-25 random XP per message
- 60-second cooldown between XP gains (prevents spam)
- XP gain happens automatically in the background

**Leveling Formula:**
```
Level = floor(sqrt(XP / 100)) + 1
```

**Level Requirements:**
- Level 1: 0-99 XP
- Level 2: 100-399 XP
- Level 3: 400-899 XP
- Level 4: 900-1599 XP
- Level 5: 1600-2499 XP

**Daily Rewards:**
- Claim 100-150 bonus XP once every 24 hours
- Use `/daily` to claim your reward

### Customization

Want to adjust XP rates or cooldowns? Edit these values in `index.js`:

```javascript
// XP gain amount (line ~113)
const xpGain = Math.floor(Math.random() * 11) + 15; // 15-25 XP

// XP cooldown (line ~108)
const cooldownTime = 60; // 60 seconds
```

For daily rewards, edit `commands/leveling/daily.js`:

```javascript
// Daily reward amount (line ~42-43)
const baseReward = 100;
const bonusReward = Math.floor(Math.random() * 51); // 0-50 bonus
```

## Development

### Adding New Commands

1. Create a new file in the appropriate folder under `commands/`
2. Follow this structure:
```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commandname')
        .setDescription('Command description'),

    async execute(interaction) {
        await interaction.reply('Response');
    }
};
```

3. Run `node deploy-commands.js` to register the new command
4. Restart the bot

### Guild Commands vs Global Commands

- **Guild commands** (instant updates): Set `DISCORD_GUILD_ID` in `.env`
- **Global commands** (up to 1 hour): Remove `DISCORD_GUILD_ID` from `.env`

During development, use guild commands for instant testing!

### Database Migrations

When adding new database features, create a migration script

```javascript
const Database = require('better-sqlite3');
const db = new Database('./data/bot.db');

const migrate = db.transaction(() => {
    db.exec(`ALTER TABLE users ADD COLUMN new_column INTEGER DEFAULT 0`);
});

migrate();
db.close();
```

Run migrations before starting the bot:
```bash
node your-migration-script.js
node index.js
```

## Database

The bot uses SQLite for data persistence with the following tables:

**users** - Stores user XP and leveling data
- `user_id` - Discord user ID
- `username` - User's Discord username
- `xp` - Total experience points
- `level` - Current level
- `total_messages` - Total messages sent
- `last_xp_gain` - Timestamp of last XP gain
- `last_daily_claim` - Timestamp of last daily reward claim
- `created_at` - Account creation timestamp

**game_sessions** - For tracking game states (future use)
- `session_id` - Unique session identifier
- `user_id` - Player's Discord ID
- `game_type` - Type of game
- `game_state` - JSON state of the game
- `started_at` - Game start timestamp
- `ended_at` - Game end timestamp
- `result` - Game outcome

The database file is stored at `data/bot.db` and is automatically created on first run.

## Troubleshooting

**Database errors on startup:**
- Delete `data/bot.db` and restart the bot to recreate the database

**Commands not appearing:**
- Make sure you ran `node deploy-commands.js`
- For instant updates, use guild commands (set `DISCORD_GUILD_ID` in `.env`)
- Wait up to 1 hour for global commands to propagate

**Bot not gaining XP:**
- Ensure the bot has the `MessageContent` intent enabled in the Developer Portal
- Check that messages aren't coming too quickly (60s cooldown)
- Verify the bot isn't responding to its own messages

**"Unknown interaction" errors:**
- The bot restarted while a command was being processed
- Make sure the bot stays online

## Contributing

This is a personal project, but feedback and suggestions are welcome!

## License

This project is licensed under the MIT License - feel free to use and modify as needed.

## Acknowledgements

- Built with [discord.js](https://discord.js.org/)
- Database powered by better-sqlite3
- Inspired by community Discord bots

---

**Status**: In active development