# SQLite Database Setup Guide

## Overview

Your bot now has a complete XP and levling system using SQLite!

## Installation

```bash
npm install better-sqlite3
```

## Database Structure

### Tables

**users**
- `user_id` - Discord user ID (primary key)
- `username` - User's Discord username
- `xp` - Total experience points
- `level` - Current level
- `total_messages` - Total messages sent
- `last_xp_gain` - Timestamp of last XP gain (for cooldown)
- `created_at` - When user was first added

**game_sessions**
- `session_id` - Unique session ID
- `user_id` - Player's Discord ID
- `game_type` - Type of game (blackjack, tictactoe, etc.)
- `game_state` - JSON state of the game
- `started_at` - Game start timestamp
- `ended_at` - Game end timestamp
- `result` - Outcome (win/loss/draw)

### Views

**leaderboard**
- Ranked view of all users by XP
- Includes rank, XP, level, messages

## How It Works

### XP System

**XP Gain:**
- Userse gain 15-25 random XP per message
- 60-second cooldown between XP gains (prevents spam)
- XP gain happens automatically in the background

**Level Formula:**
```javascript
level = floor(sqrt(xp / 100)) + 1
```

**Level Requirements:**
- Level 1: 0-99 XP
- Level 2: 100-399 XP
- Level 3: 400-899 XP
- Level 4: 900-1599 XP
- Level 5: 1600-2499 XP
- etc.

### Commands

**`/level [user]`**
- View your current level, XP, rank, and progress
- Optional: Check another user's stats

**`/leaderboard [limit]`**
- View top users by XP
- Default shows top 10, can show up to 25
- Shows your rank even if you're not in the top list

## File Structure

```
discord-galaxy-bot/
├── config/
│   └── database.js          # Database setup and helpers
├── commands/
│   └── leveling/
│       ├── level.js         # /level command
│       └── leaderboard.js   # /leaderboard command
├── data/
│   └── bot.db              # SQLite database file (created automatically)
└── index.js                # Updated with XP message handler
```

## Database Helpers

The `database.js` file exports helpful functions:

```javascript
const { dbHelpers } = require('./config/database');

// Get or create a user
const user = dbHelpers.getOrCreateUser(userId, username);

// Add XP to a user
const result = dbHelpers.addXP(userId, username, 25);
if (result.leveledUp) {
    console.log(`User leveled up to ${result.newLevel}!`);
}

// Get leaderboard
const top10 = dbHelpers.getLeaderboard(10);

// Get user's rank
const rank = dbHelpers.getUserRank(userId);

// Calculate level from XP
const level = dbHelpers.calculateLevel(500); // Returns 3

// Calculate XP needed for level
const xpNeeded = dbHelpers.xpForNextLevel(5); // Returns 2500
```

## Customization

### Change XP Gain Amount

In `index.js`, line ~100:
```javascript
// Current: random between 15-25
const xpGain = Math.floor(Math.random() * 11) + 15;

// Example: Fixed 20 XP
const xpGain = 20;

// Example: Random between 10-50
const xpGain = Math.floor(Math.random() * 41) + 10;
```

### Change XP Cooldown

In `index.js`, line ~90:
```javascript
const cooldown = 60; // 60 seconds (1 minute)

// Example: 30 seconds
const cooldown = 30;

// Example: 2 minutes
const cooldown = 120;
```

### Change Level Formula

In `config/database.js`, `calculateLevel()` function:
```javascript
// Current formula
return Math.floor(Math.sqrt(xp / 100)) + 1;

// Example: Slower progression
return Math.floor(Math.sqrt(xp / 200)) + 1;

// Example: Faster progression  
return Math.floor(Math.sqrt(xp / 50)) + 1;

// Example: Linear (100 XP per level)
return Math.floor(xp / 100) + 1;
```

## Testing

1. **Install the package:**
   ```bash
   npm install better-sqlite3
   ```

2. **Deploy the new commands:**
   ```bash
   node deploy-commands.js
   ```

3. **Start the bot:**
   ```bash
   node index.js
   ```

4. **Test it:**
   - Send some messages in your Discord server
   - Wait 1 minute between messages to gain XP
   - Use `/level` to check your progress
   - Use `/leaderboard` to see rankings

## Database Location

The database file is stored at: `data/bot.db`

**Important:** 
- This file is already in `.gitignore` (won't be committed to GitHub)
- Back it up regularly if you care about the data!
- To reset everything, just delete `data/bot.db`

## Troubleshooting

**"Database is locked" error:**
- Restart the bot
- Make sure only one instance is running

**Users not gaining XP:**
- Check console for errors
- Verify the bot has `GatewayIntentBits.GuildMessages` and `GatewayIntentBits.MessageContent` enabled
- Make sure you're not sending messages too quickly (60s cooldown)

**Commands not working:**
- Run `node deploy-commands.js` to register them
- Restart the bot
- Wait a few minutes for commands to propagate

## Next Steps

Now that you have a working database, you can:
- Add more complex game logic (store game states)
- Add rewards for leveling up (roles, currency)
- Track win/loss statistics for games
- Add achievements or badges
- Create an economy system with virtual currency
