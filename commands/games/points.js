const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { dbHelpers } = require('../../config/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('points')
        .setDescription('Check your points balance')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to check (leave empty to check your own)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userId = targetUser.id;
        const username = targetUser.username;

        // Get or create user
        const user = dbHelpers.getOrCreateUser(userId, username);

        // Check for active game
        const activeGame = dbHelpers.getActiveGame(userId, 'blackjack');

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('Points Balance')
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(
                {
                    name: 'User',
                    value: targetUser.toString(),
                    inline: true
                },
                {
                    name: 'Points',
                    value: `**${user.points.toLocaleString()}** points`,
                    inline: true
                },
                {
                    name: 'Level',
                    value: `Level ${user.level}`,
                    inline: true
                },
                {
                    name: 'Active Game',
                    value: activeGame ? '🎰 Blackjack in progress' : 'None',
                    inline: true
                }
            )
            .setFooter({ text: 'Use /blackjack to play and earn points!' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};