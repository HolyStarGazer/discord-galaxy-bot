const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { statements, dbHelpers, db } = require('../../config/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setlevel')
        .setDescription('Set the level of a user (Admin only)')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to set the level for')
                .setRequired(true))
        .addIntegerOption(option =>
            option
                .setName('level')
                .setDescription('The level to set (0-100)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(100))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for level change (optional)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Admin only

    async execute(interaction) {
        // Double-check admin permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: 'This command requires Administrator permissions.',
                flags: MessageFlags.Ephemeral
            });
        }
        
        // Get command options
        const targetUser = interaction.options.getUser('user');
        const newLevel = interaction.options.getInteger('level');
        const reason = interaction.options.getString('reason');

        // Don't allow setting level for bots
        if (targetUser.bot) {
            return interaction.deferReply({
                content: 'Cannot set level for bots!',
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            // Get or create user
            const userData = dbHelpers.getOrCreateUser(targetUser.id, targetUser.username);
            const oldLevel = userData.level;
            const oldXP = userData.xp;

            // Calculate XP for the new level
            // Formula: level = floor(sqrt(xp / 100)) + 1
            // Inverse: xp = (level - 1)^2 * 100
            const newXP = Math.pow(newLevel - 1, 2) * 100;

            // Update the user
            const currentTime = Math.floor(Date.now() / 1000);
            statements.updateUserXP.run(newXP, newLevel, currentTime, targetUser.id);

            // Calculate XP for next level
            const xpForNext = dbHelpers.xpForNextLevel(newLevel);
            const xpNeeded = xpForNext - newXP;

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(newLevel > oldLevel ? '#57F287' : newLevel < oldLevel ? '#ED4245' : '#5865F2')
                .setTitle('⚡ Level Set')
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setDescription(`Level has been set for ${targetUser}`)
                .addFields(
                    {
                        name: '⭐ Level Change',
                        value: `${oldLevel} → ${newLevel}${newLevel !== oldLevel ? ` (${newLevel > oldLevel ? '+' : ''}${newLevel - oldLevel})` : ' (No change)'}`,
                        inline: true
                    },
                    {
                        name: '📊 New XP',
                        value: `${oldXP.toLocaleString()} → ${newXP.toLocaleString()}`,
                        inline: true
                    }
                )
                .addFields({
                    name: '📈 Progress',
                    value: `To reach level ${newLevel + 1}, ${targetUser.username} needs ${xpNeeded.toLocaleString()} more XP`,
                    inline: false
                })
                .setTimestamp()
                .setFooter({ text: `Modified by ${interaction.user.tag}` });

            // Add reason if provided
            if (reason) {
                embed.addFields({
                    name: '📝 Reason',
                    value: reason,
                    inline: false
                });
            }

            await interaction.reply({ embeds: [embed] });

            // Log the action
            console.log(`    [ADMIN] ${interaction.user.tag} set level: ${targetUser.tag} Level ${oldLevel} → ${newLevel} (${oldXP} XP → ${newXP} XP)${reason ? ` | Reason: ${reason}` : ''}`);

        } catch (error) {
            console.error('Error in setlevel command:', error);
            await interaction.reply({
                content: 'An error occurred while setting the level.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};