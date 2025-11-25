const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { dbHelpers } = require('../../config/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Check your current level and XP')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check level for')
                .setRequired(false)),
    
    async execute(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;

        // Get user data from database
        const userData = dbHelpers.getOrCreateUser(user.id, user.username);
        const rankn = dbHelpers.getUserRank(user.id);
        const xpForNext = dbHelpers.xpForNextLevel(userData.level);
        const xpProgress = userData.xp - dbHelpers.xpForNextLevel(userData.level - 1);
        const xpNeeded = xpForNext - dbHelpers.xpForNextLevel(userData.level - 1);

        // Create progress bar
        const progressBarLength = 20;
        const filledBars = Math.round((xpProgress / xpNeeded) * progressBarLength);
        const emptyBars = progressBarLength - filledBars;
        const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

        // Create embed
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`Level Stats for ${user.username}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                {
                    name: 'Level',
                    value: `**${userData.level}**`,
                    inline: true
                },
                {
                    name: 'Total XP',
                    value: `**${userData.xp}**`,
                    inline: true
                },
                {
                    name: 'Rank',
                    value: `**#${rankn || 'Unranked'}**`,
                    inline: true
                },
                {
                    name: 'XP Progress',
                    value: `${progressBar} \n**${xpProgress} / ${xpNeeded} XP (${Math.round((xpProgress / xpNeeded) * 100)}%)**`,
                    inline: false
                },
                {
                    name: 'Messages Sent',
                    value: `**${userData.total_messages}**`,
                    inline: true
                }
            )
            .setFooter({ text: 'Keep chatting to earn more XP and level up!' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
}