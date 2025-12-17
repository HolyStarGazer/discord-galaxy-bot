const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { statements, dbHelpers } = require('../../config/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setpoints')
        .setDescription('Set points for a user (Admin only)')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to set points for')
                .setRequired(true))
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('The amount of points to set (can be negative)')
                .setRequired(true)
                .setMinValue(-1000000)
                .setMaxValue(1000000))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for points modification (optional)')
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
        const reason = interaction.options.getString('reason');

        // Don't allow adding points to bots
        if (targetUser.bot) {
            return interaction.deferReply({
                content: 'Cannot add points to bots!',
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            // Get current user data
            const userData = dbHelpers.getOrCreateUser(targetUser.id, targetUser.username);
            const oldPoints = userData.points;

            // Calculate new points (ensure it doesn't go below 0)
            const newPoints = Math.max(0, amount);
            
            // Prevent integer overflow
            if (newPoints > 2147483647) {
                return interaction.reply({
                    content: 'Points value cannot exceed the maximum safe integer limit.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Update the user
            statements.updatePoints.run(newPoints, targetUser.id);

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(amount >= oldPoints ? '#57F287' : '#ED4245')
                .setTitle('Points Modified')
                .setDescription(`Points has been set for ${targetUser}`)
                .addFields(
                    { 
                        name: 'Old Points', 
                        value: `**${oldPoints.toLocaleString()}** points`, 
                        inline: true 
                    },
                    { 
                        name: 'New Points', 
                        value: `**${newPoints.toLocaleString()}** points`, 
                        inline: true 
                    },
                    { 
                        name: 'Change', 
                        value: `**${amount >= oldPoints ? '+' : ''}${(amount - oldPoints).toLocaleString()}** points`, 
                        inline: true 
                    }
                )
                .setFooter({ text: `Modified by ${interaction.user.tag}` })
                .setTimestamp();

                // Add reason if provided
            if (reason) {
                embed.addFields({
                    name: 'Reason',
                    value: reason,
                    inline: false
                });
            }

            await interaction.reply({ embeds: [embed] });

            // Log the action
            console.log(`    [ADMIN] ${interaction.user.tag} modified points: ${targetUser.tag} ${amount >= 0 ? '+' : ''}${amount} points (${oldPoints} → ${newPoints})${reason ? ` | Reason: ${reason}` : ''}`);

        } catch (error) {
            console.error('Error in addpoints command:', error);
            await interaction.reply({
                content: 'An error occurred while modifying points.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
}