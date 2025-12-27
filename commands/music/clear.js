const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { queueManager } = require('../../services/music/queue-manager');
const { isConnected, stop } = require('../../services/music/music-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear all tracks from the queue'),

    async execute(interaction) {
        if (!isConnected(interaction.guildId)) {
            return interaction.reply({
                content: 'I\'m not currently playing any music!',
                flags: MessageFlags.Ephemeral
            });
        }

        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
            return interaction.reply({
                content: 'You need to be in a voice channel to manage the queue!',
                flags: MessageFlags.Ephemeral
            });
        }

        const queue = queueManager.getQueue(interaction.guildId);
        const trackCount = queue.size;

        stop(interaction.guildId);

        await interaction.reply({
            content: `Cleared **${trackCount}** tracks from the queue.`
        });
    }
};
