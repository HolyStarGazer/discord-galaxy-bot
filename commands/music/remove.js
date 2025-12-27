const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { queueManager } = require('../../services/music/queue-manager');
const { isConnected } = require('../../services/music/music-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a track from the queue')
        .addIntegerOption(option =>
            option
                .setName('position')
                .setDescription('Position of the track to remove')
                .setRequired(true)
                .setMinValue(1)
        ),

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

        const position = interaction.options.getInteger('position');
        const queue = queueManager.getQueue(interaction.guildId);

        if (position > queue.size) {
            return interaction.reply({
                content: `Position ${position} doesn't exist. The queue has ${queue.size} tracks.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Check if trying to remove currently playing track
        if (position === queue.currentIndex + 1) {
            return interaction.reply({
                content: 'You can\'t remove the currently playing track. Use `/skip` instead.',
                flags: MessageFlags.Ephemeral
            });
        }

        const removed = queue.remove(position);

        if (removed) {
            await interaction.reply({
                content: `Removed **${removed.title}** by ${removed.artist} from the queue.`
            });
        } else {
            await interaction.reply({
                content: 'Failed to remove the track.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
