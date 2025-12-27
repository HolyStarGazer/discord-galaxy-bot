const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { pause, resume, isConnected, getStatus } = require('../../services/music/music-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause or resume the current track'),

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
                content: 'You need to be in a voice channel to control playback!',
                flags: MessageFlags.Ephemeral
            });
        }

        const status = getStatus(interaction.guildId);

        if (status.paused) {
            resume(interaction.guildId);
            await interaction.reply({
                content: `Resumed: **${status.nowPlaying?.title || 'current track'}**`
            });
        } else if (status.playing) {
            pause(interaction.guildId);
            await interaction.reply({
                content: `Paused: **${status.nowPlaying?.title || 'current track'}**`
            });
        } else {
            await interaction.reply({
                content: 'Nothing is currently playing.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
