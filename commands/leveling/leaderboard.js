const { SlashCommandBuilder, EmbedBuilder, MessageFlags, Message } = require('discord.js');
const { dbHelpers } = require('../../config/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the server XP leaderboard')
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Number of users to show')
                .setMinValue(3)
                .setMaxValue(25)
                .setRequired(false)),

    async execute(interaction) {
        const limit = interaction.options.getInteger('limit') || 10;

        // Get leaderboard data
        const leaderboard = dbHelpers.getLeaderboard(limit);

        if (leaderboard.length === 0) {
            return interaction.reply({
                content: 'No users have gained XP yet! Start chatting to appear on the leaderboard!',
                ephemeral: MessageFlags.Ephemeral
            });
        }

        // Build three separate columns
        const rankColumn = leaderboard.map((user, index) => {
            return String(index + 1);
        }).join('\n');
        
        const userColumn = leaderboard.map((user) => {
            return user.username.toLowerCase().substring(0, 24);
        }).join('\n');
        
        const statsColumn = leaderboard.map((user) => {
            // Align: level (3 chars), xp (7 chars), messages (8 chars)
            const level = String(user.level).padEnd(3, ' ');
            const xp = String(user.xp).padEnd(7, ' ');
            const msgs = String(user.total_messages);
            return `${level} ${xp} ${msgs}`;
        }).join('\n');
        
        // Find user's rank
        const userRank = dbHelpers.getUserRank(interaction.user.id);
        const userData = dbHelpers.getOrCreateUser(interaction.user.id, interaction.user.username);
        
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`${interaction.guild.name} Leaderboard`)
            .addFields(
                { 
                    name: 'Rank', 
                    value: `\`\`\`\n${rankColumn}\n\`\`\``, 
                    inline: true 
                },
                { 
                    name: 'Username', 
                    value: `\`\`\`\n${userColumn}\n\`\`\``, 
                    inline: true 
                },
                { 
                    name: 'Level⠀XP⠀⠀⠀⠀⠀Messages', 
                    value: `\`\`\`\n${statsColumn}\n\`\`\``, 
                    inline: true 
                }
            )
            .setTimestamp();
        
        // Add user's position if they're not in the top list
        if (userRank && userRank > limit) {
            const userLevel = String(userData.level).padEnd(3, ' ');
            const userXp = String(userData.xp).padEnd(7, ' ');
            const userMsgs = String(userData.total_messages);
            
            embed.addFields(
                { 
                    name: '\u200B', // Zero-width space for visual separator
                    value: '\u200B',
                    inline: false 
                },
                { 
                    name: 'Rank', 
                    value: `\`\`\`\n${userRank}\n\`\`\``, 
                    inline: true 
                },
                { 
                    name: 'Username', 
                    value: `\`\`\`\n${userData.username.toLowerCase().substring(0, 24)}\n\`\`\``, 
                    inline: true 
                },
                { 
                    name: 'Level⠀XP⠀⠀⠀⠀⠀Messages', 
                    value: `\`\`\`\n${userLevel} ${userXp} ${userMsgs}\n\`\`\``, 
                    inline: true 
                }
            );
        }
        
        // Set footer
        embed.setFooter({
            text: `Showing top ${leaderboard.length} users}`
        });

        await interaction.reply({ embeds: [embed] });
    }
};