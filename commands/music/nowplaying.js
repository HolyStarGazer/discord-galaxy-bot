const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { queueManager } = require('../../services/music/queue-manager');
const { isConnected, getStatus } = require('../../services/music/music-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show information about the currently playing track'),

    async execute(interaction) {
        if (!isConnected(interaction.guildId)) {
            return interaction.reply({
                content: 'I\'m not currently playing any music!',
                flags: MessageFlags.Ephemeral
            });
        }

        const status = getStatus(interaction.guildId);
        const queue = queueManager.getQueue(interaction.guildId);

        if (!status.nowPlaying) {
            return interaction.reply({
                content: 'Nothing is currently playing.',
                flags: MessageFlags.Ephemeral
            });
        }

        const track = status.nowPlaying;

        const embed = new EmbedBuilder()
            .setColor(0x00D4AA)
            .setTitle(status.paused ? 'Paused' : 'Now Playing')
            .setDescription(`**[${track.title}](${track.license})**`)
            .addFields(
                { name: 'Artist', value: track.artist, inline: true },
                { name: 'Album', value: track.album || 'Unknown', inline: true },
                { name: 'Duration', value: track.durationFormatted || '--:--', inline: true },
                { name: 'Volume', value: `${queue.volume}%`, inline: true },
                { name: 'Queue Position', value: `${queue.currentIndex + 1}/${queue.size}`, inline: true },
                { name: 'Remaining', value: `${queue.remaining} tracks`, inline: true }
            )
            .setFooter({ text: `Source: Jamendo (Royalty-Free) | Loop: ${queue.loop ? 'Track' : queue.loopQueue ? 'Queue' : 'Off'}` });

        if (track.artworkUrl) {
            embed.setThumbnail(track.artworkUrl);
        }

        if (track.tags && track.tags.length > 0) {
            embed.addFields({ name: 'Tags', value: track.tags.slice(0, 5).join(', ') });
        }

        await interaction.reply({ embeds: [embed] });
    }
};
