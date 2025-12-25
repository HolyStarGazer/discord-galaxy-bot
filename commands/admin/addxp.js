const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const { statements, dbHelpers } = require('../../config/database');
const { log, logWithTimestamp } = require('../../utils/formatters');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addxp')
        .setDescription('Add XP to a user (Admin only)')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to add XP to')
                .setRequired(true))
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('The amount of XP to add (can be negative)')
                .setRequired(true)
                .setMinValue(-1000000)
                .setMaxValue(1000000))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for XP modification (optional)')
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
        const amount = interaction.options.getInteger('amount');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        // Don't allow adding XP to bots
        if (targetUser.bot) {
            return interaction.deferReply({
                content: 'Cannot add XP to bots!',
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            // Get current user data
            const userData = dbHelpers.getOrCreateUser(targetUser.id, targetUser.username);
            const oldXP = userData.xp;
            const oldLevel = userData.level;

            // Calculate new XP (ensure it doesn't go below 0)
            const newXP = Math.max(0, oldXP + amount);

            // Calculate new level based on new XP
            // Level formula: level = floor(sqrt(xp / 100)) + 1
            const newLevel = Math.floor(Math.sqrt(newXP / 100)) + 1;

            // Prevent integer overflow
            if (newXP > Number.MAX_SAFE_INTEGER) {
                return interaction.reply({
                    content: 'The resulting XP exceeds the maximum safe integer limit.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Update the user
            const currentTime = Math.floor(Date.now() / 1000);
            statements.updateUserXP.run(newXP, newLevel, currentTime, targetUser.id);

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(amount > 0 ? '#57F287' : '#ED4245')
                .setTitle('💫 XP Modified')
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setDescription(`XP has been ${amount > 0 ? 'added to' : 'removed from'} ${targetUser}`)
                .addFields(
                    {
                        name: '📊 XP Change',
                        value: `${oldXP.toLocaleString()} → ${newXP.toLocaleString()} (${amount > 0 ? '+' : ''}${amount.toLocaleString()})`,
                        inline: true
                    },
                    {
                        name: '⭐ Level Change',
                        value: `${oldLevel} → ${newLevel}${newLevel !== oldLevel ? ` (${newLevel > oldLevel ? '+' : ''}${newLevel - oldLevel})` : ' (No change)'}`,
                        inline: true
                    }
                )
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
            log('ADMIN', `${interaction.user.tag} modified XP: ${targetUser.tag} ${amount > 0 ? '+' : ''}${amount} XP (${oldXP} → ${newXP}), Level ${oldLevel} → ${newLevel})`, 4);
            log('INFO', `Reason: ${reason}`, 4);
        } catch (error) {
            log('ERROR', `'/addxp' command failed`, 4, error);
            await interaction.reply({
                content: 'An error occurred while modifying XP.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
    