const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { dbHelpers } = require('../../config/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily XP bonus!'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;

        // Get or create user 
        const userData = dbHelpers.getOrCreateUser(userId, username);

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
                .setFooter({ text : 'Come back tomorrow for more XP!' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // Calculate daily reward
        const baseReward = 100;
        const bonusReward = Math.floor(Math.random() * 51); // Random bonus between 0-50
        const dailyXP = baseReward + bonusReward;

        // Give XP and update daily claim timestamp
        const result = dbHelpers.claimDaily(userId, username, dailyXP);

        // Create success embed
        const embed = new EmbedBuilder()
            .setColor('#4CAF50')
            .setTitle('🎁 Daily Reward Claimed!')
            .setDescription(`You've received your daily XP bonus!`)
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
                }
            )
            .setFooter({ text: 'Come back in 24 hours for another reward!' })
            .setTimestamp()
        
        // Add level up notification if applicable
        if (result.leveledUp) {
            embed.setDescription(`🎉 **You've received your daily XP bonus AND leveled up!**`)
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