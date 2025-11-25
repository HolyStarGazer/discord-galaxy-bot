require('dotenv').config();                                     // Load environment variables from .env file
const { Client, GatewayIntentBits, Collection } = require('discord.js');    // Import necessary classes from discord.js
const fs = require('fs');                                       // File system module for reading command files
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,           // Enables guild-related events
        GatewayIntentBits.GuildMessages,    // Enables message-related events in guilds
        GatewayIntentBits.MessageContent    // Enables access to the content of messages
    ]
});

// Create a collection to store commands
client.commands = new Collection();

function loadCommands(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        // If it's a directory, recursively load commands from it
        if (stat.isDirectory()) {
            loadCommands(filePath);
        }

        // If it's a .js file, load it as a command
        else if (file.endsWith('.js')) {
            const command = require(filePath);

            // Check if the command has required properties
            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
                console.log('✅ Loaded command:', command.data.name);
            } else {
                console.warn(`⚠️ Skipping ${file}: is missing 'name' or 'execute' property.`);
            }
        }
    }
}

// Load all commands from the commands folder
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    loadCommands(commandsPath);
} else {
    console.warn('⚠️ Commands directory not found:', commandsPath);
}

// Bot ready event
client.once('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}!`);
    console.log(`📊 Loaded ${client.commands.size} command(s)`);
});

// Message handler - listens for slash commands
client.on('interactionCreate', async interaction => {
    // Ignore messages from bots
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.warn(`⚠️ No command matching ${interaction.commandName} was found.`);
        return;
    }

    // Execute the command with error handling
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`❌ Error executing command ${interaction.commandName}:`, error);

        // Reply with error message
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: 'There was an error while executing this command!',
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: 'There was an error while executing this command!',
                ephemeral: true
            });
        }
    }
});

// Login to Discord
client.login(process.env.DISCORD_BOT_TOKEN);