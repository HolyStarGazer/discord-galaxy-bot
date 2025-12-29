const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { skip, isConnected, getStatus } = require('../../services/music/music-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the currently playing track'),

    async execute(interaction) {
        if (!isConnected(interaction.guildId)) {
            return interaction.reply({
                content: 'I\'m not currently playing any music!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Check if user is in the same voice channel
        const voiceChannel = interaction.member?.voice?.channel;
        const status = getStatus(interaction.guildId);

        if (!voiceChannel) {
            return interaction.reply({
                content: 'You need to be in a voice channel to skip tracks!',
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            const skippedTrack = status.nowPlaying;
            const nextTrack = await skip(interaction.guildId);

            if (nextTrack) {
                await interaction.reply({
                    content: `Skipped **${skippedTrack.title || 'current track'}**. Now playing: **${nextTrack.title}**`
                });
            } else {
                await interaction.reply({
                    content: `Skipped **${skippedTrack.title || 'current track'}**. The queue is now empty.`
                });
            }
        } catch (error) {
            await interaction.reply({
                content: `Failed to skip: ${error.message}`,
                flags: MessageFlags.Ephemeral
            });
        }
    }
};