const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { queueManager } = require('../../services/music/queue-manager');
const { isConnected } = require('../../services/music/music-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Shuffle the upcoming tracks in the queue'),

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

        if (queue.remaining < 2) {
            return interaction.reply({
                content: 'Not enough tracks in the queue to shuffle.',
                flags: MessageFlags.Ephemeral
            });
        }

        queue.shuffle();

        await interaction.reply({
            content: `Shuffled **${queue.remaining}** upcoming tracks.`
        });
    }
};
