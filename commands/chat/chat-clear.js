const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { clearHistory, clearAllUserHistory, getHistory } = require('../../services/ai/anthropic-client');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chat-clear')
        .setDescription('Clear your AI chat conversation history')
        .addStringOption(option =>
            option
                .setName('scope')
                .setDescription('What to clear')
                .addChoices(
                    { name: 'This channel', value: 'channel' },
                    { name: 'All my conversations', value: 'all' }
                )
        ),

    async execute(interaction) {
        const userId = interaction.user.id;
        const channelId = interaction.channel.id;
        const scope = interaction.options.getString('scope') || 'channel';

        if (scope === 'all') {
            const count = clearAllUserHistory(userId);

            if (count > 0) {
                await interaction.reply({
                    content: `Cleared ${count} conversation(s) across all channels.`,
                    flags: MessageFlags.Ephemeral
                });
            } else {
                await interaction.reply({
                    content: 'You don\'t have any active conversations to clear.',
                    flags: MessageFlags.Ephemeral
                });
            }
        } else {
            // Check if there's history to clear
            const history = getHistory(userId, channelId);

            if (history.length === 0) {
                return interaction.reply({
                    content: 'You don\'t have any conversation history in this channel.',
                    flags: MessageFlags.Ephemeral
                });
            }

            clearHistory(userId, channelId);

            await interaction.reply({
                content: `Cleared your conversation history in this channel (${history.length} messages).`,
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
