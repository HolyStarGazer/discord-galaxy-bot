const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { statements, dbHelpers } = require('../../config/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resetxp')
        .setDescription('Reset user\'s XP and level to 0 (Admin only)')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to reset XP for')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for resetting XP (optional)')
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
        const reason = interaction.options.getString('reason');

        // Don't allow resetting XP for bots
        if (targetUser.bot) {
            return interaction.deferReply({
                content: 'Cannot reset XP for bots!',
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            // Reset user's XP and level to 0
            const userData = dbHelpers.getOrCreateUser(targetUser.id, targetUser.username);
            const currentTime = Math.floor(Date.now() / 1000);
            
            statements.updateUserXP.run(0, 0, currentTime, userData.id);

            console.log(`    [ADMIN] ${interaction.user.tag} reset XP for ${userData.username} to 0.${reason ? ` | Reason: ${reason}` : ''}`);

            return interaction.reply({
                content: `Successfully reset XP and level for ${userData.username}.`,
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error(`  \x1b[31m[ERROR]\x1b[0m ResetXP command failed:`, error);
            return interaction.reply({
                content: 'An error occurred while resetting XP.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};