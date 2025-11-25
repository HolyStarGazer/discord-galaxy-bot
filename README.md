# Galaxy Discord Bot

A feature-rich Discord bot built with discord.js featuring user interaction commands, dice rolling, and a player leveling system with games

## Features

### Current Commands
- `/userinfo [user]` - Display detailed information about a user
- `/say <message>` - Make the bot say anything you want
- `/roll [dice] [sides]` - Roll dice with customizable patterns (e.g., 2d20)

### Planned Features
- Player XP and leveling system
- Blackjack game
- Tic-tac-toe (vs AI or another palyer)
- Leaderboards
- And more!

## Tech Stack

- **Language**: Javascript (Node.js)
- **Library**: discord.js v14
- **Database**: SQLite (planned)
- **Environment**: dotenv for configuration

## Project Structure

```
discord-galaxy-bot/
├── .env                   # Environment variables (not committed)
├── .gitignore             # Git ignore rules
├── package.json           # Dependencies
├── index.js               # Main bot file
├── deploy-commands.js     # Command registration script
└── commands/
    ├── utility/
    │   ├── say.js
    │   └── userinfo.js
    └── fun/
        └── roll.js
```

## Setup

### Prerequisites
- Node.js (v16.9.0 or higher)
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

During development, use guild commands for isntant testing!

## Contributing

This is a personal project, but feedback and suggestions are welcome!

## License

This project is licensed under the MIT License - feel free to use and modify as needed.

## Acknowledgements

- Built with [discord.js](https://discord.js.org/)
- Inspired by community Discord bots

---

**Status**: In active development
**Current Version**: 0.1.0 (Alpha)