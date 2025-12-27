const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { queueManager } = require('../../services/music/queue-manager');
const { isConnected } = require('../../services/music/music-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('move')
        .setDescription('Move a track to a different position in the queue')
        .addIntegerOption(option =>
            option
                .setName('from')
                .setDescription('Current position of the track')
                .setRequired(true)
                .setMinValue(1)
        )
        .addIntegerOption(option =>
            option
                .setName('to')
                .setDescription('New position for the track')
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

        const from = interaction.options.getInteger('from');
        const to = interaction.options.getInteger('to');

        const queue = queueManager.getQueue(interaction.guildId);

        if (from > queue.size) {
            return interaction.reply({
                content: `Position ${from} doesn't exist. The queue has ${queue.size} tracks.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Get track info before moving
        const track = queue.tracks[from - 1];
        const success = queue.move(from, to);

        if (success) {
            const actualTo = Math.min(to, queue.size);
            await interaction.reply({
                content: `Moved **${track.title}** from position ${from} to position ${actualTo}.`
            });
        } else {
            await interaction.reply({
                content: 'Failed to move the track. Please check the positions.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
