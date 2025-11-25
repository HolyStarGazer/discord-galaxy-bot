const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { dbHelpers } = require('../../config/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View teh server XP leaderboard')
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Number of users to show')
                .setMinValue(5)
                .setMaxValue(25)
                .setRequired(false)),

    async execute(interaction) {
        const limit = interaction.options.getInteger('limit') || 10;

        // Get leaderboard data
        const leaderboard = dbHelpers.getLeaderboard(limit);

        if (leaderboard.length === 0) {
            return interaction.reply({
                content: 'No users have gained XP yet! Start chatting to appear on the leaderboard!',
                ephemeral: true
            });
        }

        // Format leaderboard
        const leaderboardText = leaderboard.map((user, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
            return `${medal} **${user.username}** - Level ${user.level} (${user.xp} XP)`;
        }).join('\n');

        // Find user's rank if not in top list
        const userRank = dbHelpers.getUserRank(interaction.user.id);
        let userPosition = '';

        if (userRank && userRank > limit) {
            const userData = dbHelpers.getOrCreateUser(interaction.user.id, interaction.user.username);
            userPosition = `\n\n**Your Rank:** #${userRank} - Level ${userData.level} (${userData.xp} XP)`;
        };

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`🏆 ${interaction.guild.name} Leaderboard`)
            .setDescription(leaderboardText + userPosition)
            .setFooter({ text: `Showing top ${leaderboard.length} users`})
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};