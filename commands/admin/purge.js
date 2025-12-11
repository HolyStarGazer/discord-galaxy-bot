// Removes the N most recent messages in the current channel
console.error("Not implemented yet.");

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete a specific number of messages (Admin only)')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('The number of messages to delete (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .addStringOption(option =>
            option
                .setName('user')
                .setDescription('Only delete messages from this user (optional)')
                .setRequired(false))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for purging messages (optional)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages), // Admin only

    async execute(interaction) {
        // Runtime permission check
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({
                content: 'You need the "Manage Messages" permission to use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Check if bot has permissions
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({
                content: 'I need the "Manage Messages" permission to purge messages.',
                flags: MessageFlags.Ephemeral
            });
        }        

        // Get command options
        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        // Defer reply (purging might take time)
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            // Fetch messages (Discord allows fetching up to 100 at a time)
            const fetchedMessages = await interaction.channel.messages.fetch({
                limit: Math.min(amount + 50, 100) // Fetch extra in case we're filtering
            });

            let messagesToDelete = Array.from(fetchedMessages.values());

            // Filter by user if specified
            if (targetUser) {
                messagesToDelete = messagesToDelete.filter(msg => msg.author.username === targetUser);
            }

            // Limit to requested amount
            messagesToDelete = messagesToDelete.slice(0, amount);

            // Discord limitation: Can't  delete messages older than 14 days
            const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
            const oldMessages = messagesToDelete.filter(msg => msg.createdTimestamp < twoWeeksAgo);
            messagesToDelete = messagesToDelete.filter(msg => msg.createdTimestamp >= twoWeeksAgo);

            if (messagesToDelete.length === 0) {
                return interaction.editReply({
                    content: 'No messages found to delete. Messages must be less than 14 days old.'
                });
            }

            // Bulk delete messages
            const deletedMessages = await interaction.channel.bulkDelete(messagesToDelete, true);
            
            // Build response
            const timestamp = new Date().toLocaleString();
            let response = `Successfully deleted **${deletedMessages.size}** message(s)`;

            if (targetUser) {
                response += `from **${targetUser.username}** `;
            }

            if (oldMessages.length > 0) {
                response += `\n\tCould not delete ${oldMessages.length} message(s) (older than 14 days)`;
            }

            // Log to console
            console.log(`    [ADMIN] Purge: ${interaction.user.tag} deleted ${deletedMessages.size} messages in #${interaction.channel.name}`);
            if (targetUser) {
                console.log(`  \x1b[34m[INFO]\x1b[0m   Target user: ${targetUser.tag}`);
            }
            console.log(`  \x1b[34m[INFO]\x1b[0m   Reason: ${reason}`);

            // Send response
            await interaction.editReply({ content: response });

        } catch (error) {
            console.error(`  \x1b[31m[ERROR]\x1b[0m Purge command failed:`, error);

            let errorMessage = 'Failed to delete messages.';

            if (error.code === 50013) {
                errorMessage = 'I don\'t have permission to delete messages in this channel.';
            } else if (error.code === 10008) {
                errorMessage = 'Some messages no longer exist.';
            }

            return interaction.editReply({
                content: errorMessage
            });
        }

    }
};