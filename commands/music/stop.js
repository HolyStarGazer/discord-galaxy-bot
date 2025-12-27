const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { leave, isConnected } = require('../../services/music/music-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop playback, clear the queue, and leave the voice channel'),

    async execute(interaction) {
        if (!isConnected(interaction.guildId)) {
            return interaction.reply({
                content: 'I\'m not currently in a voice channel!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Check if user is in a voice channel
        const voiceChannel = interaction.member?.voice?.channel;

        if (!voiceChannel) {
            return interaction.reply({
                content: 'You need to be in a voice channel to stop the music!',
                flags: MessageFlags.Ephemeral
            });
        }

        leave(interaction.guildId);

        await interaction.reply({
            content: 'Stopped playback, cleared the queue, and left the voice channel.'
        });
    }
};
