const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { statements, dbHelpers, db } = require('../../config/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setxp')
        .setDescription('Set the XP of a user (Admin only)')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to set the XP for')
                .setRequired(true))
        .addIntegerOption(option =>
            option
                .setName('xp')
                .setDescription('The amount of XP to set (0 or higher)')
                .setRequired(true)
                .setMinValue(0))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for XP change (optional)')
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
        const newXP = interaction.options.getInteger('xp');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        // Don't allow setting XP for bots
        if (targetUser.bot) {
            return interaction.deferReply({
                content: 'Cannot set XP for bots!',
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            // Get or create user
            const userData = dbHelpers.getOrCreateUser(targetUser.id, targetUser.username);
            const oldLevel = userData.level;
            const oldXP = userData.xp;

            // Calculate new level based on new XP
            const newLevel = dbHelpers.calculateLevel(newXP);

            // Update the user
            const currentTime = Math.floor(Date.now() / 1000);
            statements.updateUserXP.run(newXP, newLevel, currentTime, targetUser.id);

            // Calculate XP for next level
            const xpForNext = dbHelpers.xpForNextLevel(newLevel);
            const xpNeeded = xpForNext - newXP;

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(newXP > oldXP ? '#57F287' : '#ED4245')
                .setTitle('💫 XP Set')
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setDescription(`XP has been set for ${targetUser}`)
                .addFields(
                    {
                        name: '📊 XP Change',
                        value: `${oldXP.toLocaleString()} → ${newXP.toLocaleString()} (${newXP - oldXP >= 0 ? '+' : ''}${(newXP - oldXP).toLocaleString()})`,
                        inline: true
                    },
                )
                .addFields({
                    name: '📈 Progress',
                    value: `To reach level ${newLevel + 1}, ${targetUser.username} needs ${xpNeeded.toLocaleString()} more XP`,
                    inline: false
                })
                .addFields({
                    name: 'Reason',
                    value: reason,
                    inline: false
                })
                .setTimestamp()
                .setFooter({ text: `Modified by ${interaction.user.tag}` });

            await interaction.reply({ embeds: [embed] });

            // Log the action
            log('ADMIN', `${interaction.user.tag} set XP: ${targetUser.tag} ${newXP} XP (${oldXP} → ${newXP}), Level ${oldLevel} → ${newLevel})`, 4);
            log('INFO', `Reason: ${reason}`, 4);
        } catch (error) {
            log('ERROR', `'/setxp' command failed`, 4, error);
            await interaction.reply({
                content: 'An error occurred while setting the XP.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};