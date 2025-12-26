const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { dbHelpers, statements } = require('../../config/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily points and XP bonus!'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;

        // Get or create user 
        let userData = dbHelpers.getOrCreateUser(userId, username);

        // Check if user has claimed daily within the last 24 hours
        const now = Math.floor(Date.now() / 1000);
        const cooldown = 24 * 60 * 60; // 24 hours in seconds
        const timeLeft = (userData.last_daily_claim || 0) + cooldown - now;

        // If a still on cooldown
        if (timeLeft > 0) {
            const hoursLeft = Math.floor(timeLeft / 3600);
            const minutesLeft = Math.floor((timeLeft % 3600) / 60);

            const embed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('⏰ Daily Reward Already Claimed!')
                .setDescription('You have already claimed your daily reward today!')
                .addFields({
                    name: '⏳ Time Until Next Claim',
                    value: `${hoursLeft}h ${minutesLeft}m`,
                    inline: false
                })
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // Calculate daily reward
        const baseReward = 100;
        const xpBonus = Math.floor(Math.random() * 51); // Random bonus between 0-50
        const pointsBonus = Math.floor(Math.random() * 101); // Random bonus between 0-100

        const dailyXP = baseReward + xpBonus;
        const dailyPoints = baseReward + pointsBonus;

        // Give XP and update daily claim timestamp
        const result = dbHelpers.claimDaily(userId, username, dailyXP, dailyPoints);

        userData = dbHelpers.getOrCreateUser(userId, username); // Refresh user data

        // Create success embed
        const embed = new EmbedBuilder()
            .setColor('#4CAF50')
            .setTitle('🎁 Daily Reward Claimed!')
            .setDescription(`You've received your daily bonus!`)
            .addFields(
                {
                    name: 'XP Gained',
                    value: `**+${dailyXP} XP**`,
                    inline: true
                },
                {
                    name: 'Total XP',
                    value: `**${result.newXP} XP**`,
                    inline: true
                },
                {
                    name: 'Current Level',
                    value: `**Level ${result.newLevel}**`,
                    inline: true
                },
                {
                    name: 'Points Gained',
                    value: `**+${dailyPoints} Points**`,
                    inline: true
                },
                {
                    name: 'Total Points',
                    value: `**${result.newPoints} Points**`,
                    inline: true
                }
            )
            .setTimestamp()
        
        // Add level up notification if applicable
        if (result.leveledUp) {
            embed.setDescription(`🎉 **You've received your daily bonus AND leveled up!**`)
            .addFields({
                name: 'Level Up!',
                value: `Level ${result.oldLevel} -> **Level ${result.newLevel}**`,
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed] });

        // Send level up message in channel if leveled up
        if (result.leveledUp) {
            interaction.channel.send(`🎉 Congrats ${interaction.user}, you've leveled up to Level ${result.newLevel}**!`).catch(() => {});
        }
    }
}