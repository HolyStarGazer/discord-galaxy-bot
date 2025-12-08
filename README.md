# Galaxy Discord Bot

![Version](https://img.shields.io/badge/version-0.3.1-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2)
![License](https://img.shields.io/badge/license-MIT-green)

A feature-rich Discord bot built with discord.js featuring user interaction commands, dice rolling, and a player leveling system with games

## Features

### Commands

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

- Automatic XP gain on messages (15-25 XP, 60s cooldown)
- Level-up notification with celebratory messages
- XP progress tracking with visual progress bars
- Visual progress bars and statistics
- Professional startup banner with version display
- Color-coded logging system

### Planned Features
- Blackjack (vs AI or another player)
- Tic-tac-toe (vs AI or another player)
- Achievement system
- Economy system with virtual currency
- Level-up rewards and role assignments
- And more!

## Quick Setup

### Prerequisites
- Node.js (Version: 0.3.1 or higher)
- A discord bot token from [Discord Developer Portal](https://discord.com/developers/applications)

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

## Documentation

- **[CHANGELOG.md](CHANGELOG.md)** - Version history and update
- **[DATABASE_GUIDE.md](docs/guides/DATABASE_GUIDE.md)** - Database schema and usage
- **[SLASH_COMMANDS_GUIDE.md](docs/guides/SLASH_COMMANDS_GUIDE.md)** - Adding new commands

## Development

### Project Structure

```
discord-galaxy-bot/
├── index.js                    # Main bot file
├── config/
│   └── database.js             # Database setup and helper functions
├── data/
│   └── bot.db                  # SQLite database (auto-generated)
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

### Adding Commmands

1. Create file in `commands/category/mycommand.js`
2. Follow the command template (see [SLASH_COMMANDS_GUIDE.md](SLASH_COMMANDS_GUIDE.md))
3. Run `npm run deploy`
4. Restart bot

### Database

- **Automatic migrations** - Schema updates run on startup
- **SQLite database** - Stored in `data/bot.db`
- **Tables**: `users`, `game_sessions`
- **View**: `leaderboard` (cached rankings)

See [DATABASE_GUIDE.md](DATABASE_GUIDE.md) for details.

---

### Tech Stack

| Component | Technology |
| --------- | ---------- |
| Runtime | Node.js 18+ |
| Framework | discord.js v14 |
| Database | SQLite (better-sqlite3) |
| Environment | dotenv |

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

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Links

- [Discord.js Documentation](https://discord.js.org/)
- [Discord Developer Portal](https://discord.com/developers/applications)
- [Semantic Versioning](https://semver.org/)

---

## Troubleshooting

### Database errors on startup
- Delete `data/bot.db` and restart the bot to recreate the database

### Commands not appearing?
- Make sure you ran `node deploy-commands.js`
- For instant updates, set `DISCORD_GUILD_ID` in `.env`
- Wait up to 1 hour for global commands to propagate

### Database errors?
- Database auto-creates on first run
- Migrations run automatically
- See [DATABASE_GUIDE.md](docs/guides/DATABASE_GUIDE.md)

### Bot not responding?
- Check bot has `MessageContent` intent enabled
- Verify bot permissions in server
- Check console for errors

For more help, see documentation or open an issue.

---

**Made with ❤️ using discord.js**

## Acknowledgements

- Built with [discord.js](https://discord.js.org/)
- Database powered by better-sqlite3
- Inspired by community Discord bots

---

**Status**: In active development