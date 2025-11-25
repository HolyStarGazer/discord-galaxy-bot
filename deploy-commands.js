require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];

// Load command files
function loadCommands(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            loadCommands(filePath);
        } else if (file.endsWith('.js')) {
            const command = require(filePath);

            if (command.data && command.execute) {
                commands.push(command.data.toJSON());
                console.log('✅ Loaded command for deployment:', command.data.name);
            }
        }
    }
}

const commandsPath = path.join(__dirname, 'commands');
loadCommands(commandsPath);

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);

// Deploy commands 
(async () => {
    try {
        console.log(`🔄 Started refreshing ${commands.length} application (/) commands.`);

        // Check if DISCORD_GUILD_ID is set for guild-specific deployment (instant updates)
        if (process.env.DISCORD_GUILD_ID) {
            console.log('📍 Deploying to guild (instange updates)...');
            const data = await rest.put(
                Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
                { body: commands }
            );
            console.log(`✅ Successfully deployed ${data.length} guild commands to server ${process.env.DISCORD_GUILD_ID}.`);
        } else {
            // Register commands globally (takes up to 1 hour to update)
            console.log('🌍 Deploying globally (may take up to 1 hour to update)...');
            const data = await rest.put(
                Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
                { body: commands }
            );
            console.log(`✅ Successfully deployed ${data.length} global commands.`);
        }
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
})();