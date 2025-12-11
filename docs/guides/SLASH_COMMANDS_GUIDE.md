# Slash Commands Setup Guide

## What Changed?

Your bot now uses **slash commands** (`/`) instead of prefix commands (`!`). This gives you:
- Autocomplete in Discord
- Built-in parameter validation
- Ephemeral messages (only visible to command user)
- Better user experience

## How to Set Up Slash Commands

### Step 1: Replace Your Files

Copy these updated files to your project:
- `index.js` - Now listens for interactions instead of messages
- `deploy-commands.js` - NEW file to register commands with Discord
- `commands/utility/say.js` - Converted to slash command
- `commands/utility/userinfo.js` - Converted to slash command
- `commands/fun/roll.js` - Converted to slash command

### Step 2: Deploy Commands to Discord

**IMPORTANT:** You must run this ONCE to register your commands with Discord.

```bash
node deploy-commands.js
```

You should see:
```
✅ Loaded command: say
✅ Loaded command: userinfo
✅ Loaded command: roll
🔄 Started refreshing 3 application (/) commands.
✅ Successfully reloaded 3 application (/) commands.
```

**Note:** Global commands can take up to 1 hour to appear! For faster testing during development, see the "Guild Commands" section below.

### Step 3: Start Your Bot

```bash
node index.js
```

### Step 4: Test Your Commands

In Discord, type `/` and you should see your bot's commands appear!

Try:
- `/say message: Hello world!`
- `/userinfo` (shows your info)
- `/userinfo user: @someone`
- `/roll` (default 1d6)
- `/roll dice: 2 sides: 20` (roll 2d20)

## Guild Commands (Faster Testing)

For instant command updates during development:

1. Get your server (guild) ID:
   - Right-click your server icon in Discord
   - Click "Copy Server ID" (enable Developer Mode in Discord settings first)

2. Edit `deploy-commands.js`:
   - Find the commented section near the bottom
   - Replace `'YOUR_GUILD_ID'` with your actual server ID
   - Comment out the global registration
   - Uncomment the guild registration

3. Run `node deploy-commands.js` again

Commands will update instantly in that specific server!

## Key Differences from Prefix Commands

### Old Way (Prefix):
```javascript
module.exports = {
    name: 'userinfo',
    async execute(message, args, client) {
        const user = message.mentions.users.first() || message.author;
        message.reply('...');
    }
}
```

### New Way (Slash):
```javascript
module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .addUserOption(...),
    async execute(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        interaction.reply('...');
    }
}
```

## Important Notes

- **Run `deploy-commands.js` whenever you:**
  - Add a new command
  - Change a command's name, description, or options
  - You do NOT need to run it if you only change the command's logic/code

- **Ephemeral messages** (only visible to command user):
  ```javascript
  await interaction.reply({ 
      content: 'Only you can see this!', 
      flags: MessageFlags.Ephemeral 
  });
  ```

- **Deferred replies** (for slow commands):
  ```javascript
  await interaction.deferReply();
  // Do slow work...
  await interaction.editReply('Done!');
  ```

## Troubleshooting

**Commands not showing up?**
- Make sure you ran `deploy-commands.js`
- Wait up to 1 hour for global commands, or use guild commands for instant updates
- Make sure your bot has the `applications.commands` scope when invited

**"Unknown interaction" error?**
- Your bot restarted after receiving the interaction
- Make sure your bot stays online

**Commands showing but not working?**
- Check console for errors
- Make sure `index.js` is running
- Verify command files have both `data` and `execute`